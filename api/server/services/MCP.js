const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { Time, CacheKeys, StepTypes } = require('librechat-data-provider');
const { Constants: AgentConstants, Providers, GraphEvents } = require('@librechat/agents');
const { Constants, ContentTypes, isAssistantsEndpoint } = require('librechat-data-provider');
const {
  sendEvent,
  MCPOAuthHandler,
  normalizeServerName,
  convertWithResolvedRefs,
} = require('@librechat/api');
const { findToken, createToken, updateToken } = require('~/models');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { getCachedTools } = require('./Config');
const { getLogStores } = require('~/cache');
const bookUpdateService = require('./BookUpdateService');

/**
 * @param {object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.stepId - The ID of the step in the flow.
 * @param {ToolCallChunk} params.toolCall - The tool call object containing tool information.
 * @param {string} params.loginFlowId - The ID of the login flow.
 * @param {FlowStateManager<any>} params.flowManager - The flow manager instance.
 */
function createOAuthStart({ res, stepId, toolCall, loginFlowId, flowManager, signal }) {
  /**
   * Creates a function to handle OAuth login requests.
   * @param {string} authURL - The URL to redirect the user for OAuth authentication.
   * @returns {Promise<boolean>} Returns true to indicate the event was sent successfully.
   */
  return async function (authURL) {
    /** @type {{ id: string; delta: AgentToolCallDelta }} */
    const data = {
      id: stepId,
      delta: {
        type: StepTypes.TOOL_CALLS,
        tool_calls: [{ ...toolCall, args: '' }],
        auth: authURL,
        expires_at: Date.now() + Time.TWO_MINUTES,
      },
    };
    /** Used to ensure the handler (use of `sendEvent`) is only invoked once */
    await flowManager.createFlowWithHandler(
      loginFlowId,
      'oauth_login',
      async () => {
        sendEvent(res, { event: GraphEvents.ON_RUN_STEP_DELTA, data });
        logger.debug('Sent OAuth login request to client');
        return true;
      },
      signal,
    );
  };
}

/**
 * @param {object} params
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.stepId - The ID of the step in the flow.
 * @param {ToolCallChunk} params.toolCall - The tool call object containing tool information.
 * @param {string} params.loginFlowId - The ID of the login flow.
 * @param {FlowStateManager<any>} params.flowManager - The flow manager instance.
 */
function createOAuthEnd({ res, stepId, toolCall }) {
  return async function () {
    /** @type {{ id: string; delta: AgentToolCallDelta }} */
    const data = {
      id: stepId,
      delta: {
        type: StepTypes.TOOL_CALLS,
        tool_calls: [{ ...toolCall }],
      },
    };
    sendEvent(res, { event: GraphEvents.ON_RUN_STEP_DELTA, data });
    logger.debug('Sent OAuth login success to client');
  };
}

/**
 * @param {object} params
 * @param {string} params.userId - The ID of the user.
 * @param {string} params.serverName - The name of the server.
 * @param {string} params.toolName - The name of the tool.
 * @param {FlowStateManager<any>} params.flowManager - The flow manager instance.
 */
function createAbortHandler({ userId, serverName, toolName, flowManager }) {
  return function () {
    logger.info(`[MCP][User: ${userId}][${serverName}][${toolName}] Tool call aborted`);
    const flowId = MCPOAuthHandler.generateFlowId(userId, serverName);
    flowManager.failFlow(flowId, 'mcp_oauth', new Error('Tool call aborted'));
  };
}

/**
 * Creates a general tool for an entire action set.
 *
 * @param {Object} params - The parameters for loading action sets.
 * @param {ServerRequest} params.req - The Express request object, containing user/request info.
 * @param {ServerResponse} params.res - The Express response object for sending events.
 * @param {string} params.toolKey - The toolKey for the tool.
 * @param {import('@librechat/agents').Providers | EModelEndpoint} params.provider - The provider for the tool.
 * @param {string} params.model - The model for the tool.
 * @returns { Promise<typeof tool | { _call: (toolInput: Object | string) => unknown}> } An object with `_call` method to execute the tool input.
 */
async function createMCPTool({ req, res, toolKey, provider: _provider }) {
  const availableTools = await getCachedTools({ userId: req.user?.id, includeGlobal: true });
  const toolDefinition = availableTools?.[toolKey]?.function;
  if (!toolDefinition) {
    logger.error(`Tool ${toolKey} not found in available tools`);
    return null;
  }
  /** @type {LCTool} */
  const { description, parameters } = toolDefinition;
  const isGoogle = _provider === Providers.VERTEXAI || _provider === Providers.GOOGLE;
  let schema = convertWithResolvedRefs(parameters, {
    allowEmptyObject: !isGoogle,
    transformOneOfAnyOf: true,
  });

  if (!schema) {
    schema = z.object({ input: z.string().optional() });
  }

  const [toolName, serverName] = toolKey.split(Constants.mcp_delimiter);
  const normalizedToolKey = `${toolName}${Constants.mcp_delimiter}${normalizeServerName(serverName)}`;

  if (!req.user?.id) {
    logger.error(
      `[MCP][${serverName}][${toolName}] User ID not found on request. Cannot create tool.`,
    );
    throw new Error(`User ID not found on request. Cannot create tool for ${toolKey}.`);
  }

  /** @type {(toolArguments: Object | string, config?: GraphRunnableConfig) => Promise<unknown>} */
  const _call = async (toolArguments, config) => {
    const userId = config?.configurable?.user?.id || config?.configurable?.user_id;
    /** @type {ReturnType<typeof createAbortHandler>} */
    let abortHandler = null;
    /** @type {AbortSignal} */
    let derivedSignal = null;

    try {
      const flowsCache = getLogStores(CacheKeys.FLOWS);
      const flowManager = getFlowStateManager(flowsCache);
      derivedSignal = config?.signal ? AbortSignal.any([config.signal]) : undefined;
      const mcpManager = getMCPManager(userId);
      const provider = (config?.metadata?.provider || _provider)?.toLowerCase();

      const { args: _args, stepId, ...toolCall } = config.toolCall ?? {};
      const loginFlowId = `${serverName}:oauth_login:${config.metadata.thread_id}:${config.metadata.run_id}`;
      const oauthStart = createOAuthStart({
        res,
        stepId,
        toolCall,
        loginFlowId,
        flowManager,
        signal: derivedSignal,
      });
      const oauthEnd = createOAuthEnd({
        res,
        stepId,
        toolCall,
      });

      if (derivedSignal) {
        abortHandler = createAbortHandler({ userId, serverName, toolName, flowManager });
        derivedSignal.addEventListener('abort', abortHandler, { once: true });
      }

      const customUserVars =
        config?.configurable?.userMCPAuthMap?.[`${Constants.mcp_prefix}${serverName}`];

      const result = await mcpManager.callTool({
        serverName,
        toolName,
        provider,
        toolArguments,
        options: {
          signal: derivedSignal,
        },
        user: config?.configurable?.user,
        customUserVars,
        flowManager,
        tokenMethods: {
          findToken,
          createToken,
          updateToken,
        },
        oauthStart,
        oauthEnd,
      });

      // Handle post-call processing for book-related tools
      if (serverName === 'book-creation-server') {
        handleBookToolPostProcessing(
          toolName,
          toolArguments,
          result,
          config?.configurable?.user,
        ).catch((error) => {
          logger.warn('Book tool post-processing failed', {
            error: error.message,
            toolName,
            serverName,
          });
        });
      }

      if (isAssistantsEndpoint(provider) && Array.isArray(result)) {
        return result[0];
      }
      if (isGoogle && Array.isArray(result[0]) && result[0][0]?.type === ContentTypes.TEXT) {
        return [result[0][0].text, result[1]];
      }
      return result;
    } catch (error) {
      logger.error(
        `[MCP][User: ${userId}][${serverName}] Error calling "${toolName}" MCP tool:`,
        error,
      );

      /** OAuth error, provide a helpful message */
      const isOAuthError =
        error.message?.includes('401') ||
        error.message?.includes('OAuth') ||
        error.message?.includes('authentication') ||
        error.message?.includes('Non-200 status code (401)');

      if (isOAuthError) {
        throw new Error(
          `OAuth authentication required for ${serverName}. Please check the server logs for the authentication URL.`,
        );
      }

      throw new Error(
        `"${toolKey}" tool call failed${error?.message ? `: ${error?.message}` : '.'}`,
      );
    } finally {
      // Clean up abort handler to prevent memory leaks
      if (abortHandler && derivedSignal) {
        derivedSignal.removeEventListener('abort', abortHandler);
      }
    }
  };

  const toolInstance = tool(_call, {
    schema,
    name: normalizedToolKey,
    description: description || '',
    responseFormat: AgentConstants.CONTENT_AND_ARTIFACT,
  });
  toolInstance.mcp = true;
  toolInstance.mcpRawServerName = serverName;
  return toolInstance;
}

/**
 * Handle post-processing for book-related MCP tools
 * @param {string} toolName
 * @param {Object} toolArguments
 * @param {Object} result
 * @param {Object} user
 */
async function handleBookToolPostProcessing(toolName, toolArguments, result, user) {
  try {
    if (!user?.id) {
      logger.debug('No user found for book tool post-processing');
      return;
    }

    // Extract bookId from tool arguments or result
    let bookId = toolArguments?.bookId || toolArguments?.book_id;

    // For tools that might not have bookId in arguments but return it in result
    if (!bookId && result?.content?.[0]?.text) {
      const match = result.content[0].text.match(/\bID:\s*([a-zA-Z0-9_-]{6,})/);
      if (match) {
        bookId = match[1];
      }
    }

    if (!bookId) {
      logger.debug('No bookId found for book tool post-processing', { toolName, toolArguments });
      return;
    }

    // Define tools that modify book content and should trigger export
    const bookModifyingTools = [
      'create_book',
      'update_book',
      'add_chapter',
      'update_chapter',
      'add_page',
      'update_page',
      'delete_page',
      'write_content',
      'enhance_content',
      'generate_chapter',
      'import_book',
      'add_comic_page',
      'update_comic_page',
    ];

    if (bookModifyingTools.includes(toolName)) {
      logger.info('Book content modified via agents, notifying update', {
        toolName,
        bookId,
        userId: user.id,
      });

      // Notify book update - this will auto-trigger export due to our enhanced logic
      bookUpdateService.notifyBookUpdate(bookId, 'book_updated', {
        toolName,
        userId: user.id,
        action: 'content_modified',
        source: 'agent',
      });
    }

    logger.debug('Book tool executed via agents', {
      toolName,
      bookId,
    });
  } catch (error) {
    logger.error('Error in book tool post-processing (agents)', {
      error: error.message,
      toolName,
      bookId: toolArguments?.bookId,
    });
  }
}

module.exports = {
  createMCPTool,
};

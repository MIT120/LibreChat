const { Router } = require('express');
const { logger } = require('@librechat/data-schemas');
const { MCPOAuthHandler } = require('@librechat/api');
const { CacheKeys, Constants } = require('librechat-data-provider');
const { findToken, updateToken, createToken, deleteTokens } = require('~/models');
const { setCachedTools, getCachedTools, loadCustomConfig } = require('~/server/services/Config');
const { getUserPluginAuthValue } = require('~/server/services/PluginService');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { requireJwtAuth } = require('~/server/middleware');
const { getLogStores } = require('~/cache');
const bookUpdateService = require('~/server/services/BookUpdateService');

const router = Router();

/**
 * List configured MCP servers with basic metadata
 * @route GET /api/mcp/servers
 */
router.get('/servers', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const printConfig = false;
    const config = await loadCustomConfig(printConfig);
    const mcpServers = config?.mcpServers || {};

    const mcpManager = getMCPManager(user.id);
    const oauthServers = mcpManager.getOAuthServers?.() || new Set();

    const servers = Object.entries(mcpServers).map(([serverName, serverConfig]) => ({
      name: serverName,
      chatMenu: serverConfig?.chatMenu !== false,
      requiresOAuth: oauthServers.has(serverName),
      customUserVars: serverConfig?.customUserVars || {},
    }));

    return res.json({ success: true, servers });
  } catch (error) {
    logger.error('[MCP] Failed to list servers', error);
    return res.status(500).json({ success: false, error: 'Failed to list MCP servers' });
  }
});

/**
 * List tools for a specific MCP server
 * - Attempts user-scoped connection
 * - If OAuth is required, returns oauthRequired flag and authorization URL
 * @route GET /api/mcp/:serverName/tools
 */
router.get('/:serverName/tools', requireJwtAuth, async (req, res) => {
  const { serverName } = req.params;
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);
    const mcpManager = getMCPManager(user.id);

    let oauthRequired = false;
    let oauthUrl = null;
    let tools = [];

    try {
      const connection = await mcpManager.getUserConnection({
        user,
        serverName,
        flowManager,
        tokenMethods: { findToken, updateToken, createToken, deleteTokens },
        returnOnOAuth: true,
        oauthStart: async (authURL) => {
          oauthRequired = true;
          oauthUrl = authURL;
        },
      });

      if (!oauthRequired && (await connection.isConnected())) {
        tools = await connection.fetchTools();
      }
    } catch (err) {
      // If an OAuth flow was initiated, surface it gracefully
      const isOAuthFlowInitiated = err?.message === 'OAuth flow initiated - return early';
      if (!oauthRequired && !isOAuthFlowInitiated) {
        logger.error(`[MCP] Error listing tools for ${serverName}`, err);
        return res.status(500).json({ success: false, error: 'Failed to list tools' });
      }
      oauthRequired = true;
    }

    // Shape tool response
    const toolList = Array.isArray(tools)
      ? tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
      : [];

    return res.json({ success: true, serverName, oauthRequired, oauthUrl, tools: toolList });
  } catch (error) {
    logger.error('[MCP] Unexpected error listing tools', error);
    return res.status(500).json({ success: false, error: 'Unexpected error' });
  }
});

/**
 * Get formatted instructions for a specific MCP server
 * @route GET /api/mcp/:serverName/instructions
 */
router.get('/:serverName/instructions', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { serverName } = req.params;
    const mcpManager = getMCPManager(user.id);
    const instructions = mcpManager.formatInstructionsForContext?.([serverName]) || '';
    return res.json({ success: true, serverName, instructions });
  } catch (error) {
    logger.error('[MCP] Failed to get instructions', error);
    return res.status(500).json({ success: false, error: 'Failed to get instructions' });
  }
});

/**
 * Initiate OAuth flow
 * This endpoint is called when the user clicks the auth link in the UI
 */
router.get('/:serverName/oauth/initiate', requireJwtAuth, async (req, res) => {
  try {
    const { serverName } = req.params;
    const { userId, flowId } = req.query;
    const user = req.user;

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      return res.status(403).json({ error: 'User mismatch' });
    }

    logger.debug('[MCP OAuth] Initiate request', { serverName, userId, flowId });

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    /** Flow state to retrieve OAuth config */
    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');
    if (!flowState) {
      logger.error('[MCP OAuth] Flow state not found', { flowId });
      return res.status(404).json({ error: 'Flow not found' });
    }

    const { serverUrl, oauth: oauthConfig } = flowState.metadata || {};
    if (!serverUrl || !oauthConfig) {
      logger.error('[MCP OAuth] Missing server URL or OAuth config in flow state');
      return res.status(400).json({ error: 'Invalid flow state' });
    }

    const { authorizationUrl, flowId: oauthFlowId } = await MCPOAuthHandler.initiateOAuthFlow(
      serverName,
      serverUrl,
      userId,
      oauthConfig,
    );

    logger.debug('[MCP OAuth] OAuth flow initiated', { oauthFlowId, authorizationUrl });

    // Redirect user to the authorization URL
    res.redirect(authorizationUrl);
  } catch (error) {
    logger.error('[MCP OAuth] Failed to initiate OAuth', error);
    res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
});

/**
 * OAuth callback handler
 * This handles the OAuth callback after the user has authorized the application
 */
router.get('/:serverName/oauth/callback', async (req, res) => {
  try {
    const { serverName } = req.params;
    const { code, state, error: oauthError } = req.query;

    logger.debug('[MCP OAuth] Callback received', {
      serverName,
      code: code ? 'present' : 'missing',
      state,
      error: oauthError,
    });

    if (oauthError) {
      logger.error('[MCP OAuth] OAuth error received', { error: oauthError });
      return res.redirect(`/oauth/error?error=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code || typeof code !== 'string') {
      logger.error('[MCP OAuth] Missing or invalid code');
      return res.redirect('/oauth/error?error=missing_code');
    }

    if (!state || typeof state !== 'string') {
      logger.error('[MCP OAuth] Missing or invalid state');
      return res.redirect('/oauth/error?error=missing_state');
    }

    // Extract flow ID from state
    const flowId = state;
    logger.debug('[MCP OAuth] Using flow ID from state', { flowId });

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    logger.debug('[MCP OAuth] Getting flow state for flowId: ' + flowId);
    const flowState = await MCPOAuthHandler.getFlowState(flowId, flowManager);

    if (!flowState) {
      logger.error('[MCP OAuth] Flow state not found for flowId:', flowId);
      return res.redirect('/oauth/error?error=invalid_state');
    }

    logger.debug('[MCP OAuth] Flow state details', {
      serverName: flowState.serverName,
      userId: flowState.userId,
      hasMetadata: !!flowState.metadata,
      hasClientInfo: !!flowState.clientInfo,
      hasCodeVerifier: !!flowState.codeVerifier,
    });

    // Complete the OAuth flow
    logger.debug('[MCP OAuth] Completing OAuth flow');
    const tokens = await MCPOAuthHandler.completeOAuthFlow(flowId, code, flowManager);
    logger.info('[MCP OAuth] OAuth flow completed, tokens received in callback route');

    // Try to establish the MCP connection with the new tokens
    try {
      const mcpManager = getMCPManager(flowState.userId);
      logger.debug(`[MCP OAuth] Attempting to reconnect ${serverName} with new OAuth tokens`);

      // For user-level OAuth, try to establish the connection
      if (flowState.userId !== 'system') {
        // We need to get the user object - in this case we'll need to reconstruct it
        const user = { id: flowState.userId };

        // Try to establish connection with the new tokens
        const userConnection = await mcpManager.getUserConnection({
          user,
          serverName,
          flowManager,
          tokenMethods: {
            findToken,
            updateToken,
            createToken,
            deleteTokens,
          },
        });

        logger.info(
          `[MCP OAuth] Successfully reconnected ${serverName} for user ${flowState.userId}`,
        );

        // Fetch and cache tools now that we have a successful connection
        const userTools = (await getCachedTools({ userId: flowState.userId })) || {};

        // Remove any old tools from this server in the user's cache
        const mcpDelimiter = Constants.mcp_delimiter;
        for (const key of Object.keys(userTools)) {
          if (key.endsWith(`${mcpDelimiter}${serverName}`)) {
            delete userTools[key];
          }
        }

        // Add the new tools from this server
        const tools = await userConnection.fetchTools();
        for (const tool of tools) {
          const name = `${tool.name}${Constants.mcp_delimiter}${serverName}`;
          userTools[name] = {
            type: 'function',
            ['function']: {
              name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          };
        }

        // Save the updated user tool cache
        await setCachedTools(userTools, { userId: flowState.userId });

        logger.debug(
          `[MCP OAuth] Cached ${tools.length} tools for ${serverName} user ${flowState.userId}`,
        );
      } else {
        logger.debug(`[MCP OAuth] System-level OAuth completed for ${serverName}`);
      }
    } catch (error) {
      // Don't fail the OAuth callback if reconnection fails - the tokens are still saved
      logger.warn(
        `[MCP OAuth] Failed to reconnect ${serverName} after OAuth, but tokens are saved:`,
        error,
      );
    }

    /** ID of the flow that the tool/connection is waiting for */
    const toolFlowId = flowState.metadata?.toolFlowId;
    if (toolFlowId) {
      logger.debug('[MCP OAuth] Completing tool flow', { toolFlowId });
      await flowManager.completeFlow(toolFlowId, 'mcp_oauth', tokens);
    }

    /** Redirect to success page with flowId and serverName */
    const redirectUrl = `/oauth/success?serverName=${encodeURIComponent(serverName)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('[MCP OAuth] OAuth callback error', error);
    res.redirect('/oauth/error?error=callback_failed');
  }
});

/**
 * Call a specific MCP tool by name on a server (book-creation-server without auth)
 * @route POST /api/mcp/book-creation-server/tools/:toolName/call
 * Body: { arguments?: object, customUserVars?: Record<string,string> }
 */
router.post('/book-creation/tools/:toolName/call', async (req, res) => {
  try {
    const { toolName } = req.params;
    const serverName = 'book-creation';
    const toolArguments = req.body?.arguments || {};
    const customUserVars = req.body?.customUserVars;

    // Create a mock user for book creation tools
    const user = { id: 'system-user' };

    // For book creation tools, we need to ensure the authorId is provided (except for export_book which might be auto-generated)
    if (!toolArguments.authorId && toolName !== 'export_book') {
      logger.error(`[MCP] ${toolName} requires authorId but none was provided`);
      return res.status(400).json({ success: false, error: `${toolName} requires authorId` });
    }

    // Auto-inject conversationId for book creation tools if not already provided
    const bookToolsRequiringConversationId = [
      'create_book',
      'list_books',
      'create_chapter',
      'create_page',
      'export_book',
    ];

    if (bookToolsRequiringConversationId.includes(toolName) && !toolArguments.conversationId) {
      // Try to get conversationId from request headers or body
      const conversationId =
        req.headers['x-conversation-id'] ||
        req.body?.conversationId ||
        req.body?.metadata?.conversationId;

      if (conversationId) {
        toolArguments.conversationId = conversationId;
        logger.debug(`[MCP] Auto-injected conversationId for ${toolName}`, {
          conversationId,
          toolName,
        });
      } else {
        // Fallback: use authorId as conversationId if no conversationId is available
        if (toolArguments.authorId) {
          toolArguments.conversationId = `fallback-${toolArguments.authorId}`;
          logger.warn(
            `[MCP] No conversationId provided for ${toolName}, using fallback based on authorId`,
            {
              toolName,
              authorId: toolArguments.authorId,
              fallbackConversationId: toolArguments.conversationId,
            },
          );
        } else {
          logger.error(
            `[MCP] ${toolName} requires conversationId but none was provided and no authorId available`,
            { toolName },
          );
        }
      }
    }

    // Auto-inject authorId for export_book if missing
    if (toolName === 'export_book' && !toolArguments.authorId) {
      toolArguments.authorId = 'auto-export-system';
      logger.debug(`[MCP] Auto-injected authorId for ${toolName}`, {
        authorId: toolArguments.authorId,
      });
    }

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);
    const mcpManager = getMCPManager(user.id); // Use user-level MCP manager

    const result = await mcpManager.callTool({
      user,
      serverName,
      toolName,
      provider: 'openai',
      toolArguments,
      flowManager,
      tokenMethods: { findToken, updateToken, createToken, deleteTokens },
      customUserVars,
    });

    // Handle post-call processing for book-related tools
    await handleBookToolPostProcessing(toolName, toolArguments, result, user);

    res.json({ success: true, result });
  } catch (error) {
    logger.error('[MCP] Tool call failed', error);
    res.status(500).json({ success: false, error: error?.message || 'Tool call failed' });
  }
});

/**
 * Call a specific MCP tool by name on a server (authenticated route)
 * @route POST /api/mcp/:serverName/tools/:toolName/call
 * Body: { arguments?: object, customUserVars?: Record<string,string> }
 */
router.post('/:serverName/tools/:toolName/call', requireJwtAuth, async (req, res) => {
  try {
    const { serverName, toolName } = req.params;
    const user = req.user;
    const toolArguments = req.body?.arguments || {};
    const customUserVars = req.body?.customUserVars;

    // Auto-inject conversationId for book creation tools if not already provided
    if (serverName === 'book-creation') {
      const bookToolsRequiringConversationId = [
        'create_book',
        'list_books',
        'create_chapter',
        'create_page',
      ];

      if (bookToolsRequiringConversationId.includes(toolName) && !toolArguments.conversationId) {
        // Try to get conversationId from request headers or body
        const conversationId =
          req.headers['x-conversation-id'] ||
          req.body?.conversationId ||
          req.body?.metadata?.conversationId;

        if (conversationId) {
          toolArguments.conversationId = conversationId;
          logger.debug(`[MCP] Auto-injected conversationId for ${toolName}`, {
            conversationId,
            toolName,
          });
        } else {
          // Fallback: use authorId as conversationId if no conversationId is available
          if (toolArguments.authorId) {
            toolArguments.conversationId = `fallback-${toolArguments.authorId}`;
            logger.warn(
              `[MCP] No conversationId provided for ${toolName}, using fallback based on authorId`,
              {
                toolName,
                authorId: toolArguments.authorId,
                fallbackConversationId: toolArguments.conversationId,
              },
            );
          } else {
            logger.error(
              `[MCP] ${toolName} requires conversationId but none was provided and no authorId available`,
              { toolName },
            );
          }
        }
      }
    }

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);
    const mcpManager = getMCPManager(user.id);

    const result = await mcpManager.callTool({
      user,
      serverName,
      toolName,
      provider: 'openai',
      toolArguments,
      flowManager,
      tokenMethods: { findToken, updateToken, createToken, deleteTokens },
      customUserVars,
    });

    // Handle post-call processing for book-related tools
    if (serverName === 'book-creation') {
      await handleBookToolPostProcessing(toolName, toolArguments, result, user);
    }

    res.json({ success: true, result });
  } catch (error) {
    logger.error('[MCP] Tool call failed', error);
    res.status(500).json({ success: false, error: error?.message || 'Tool call failed' });
  }
});

/**
 * Get OAuth tokens for a completed flow
 * This is primarily for user-level OAuth flows
 */
router.get('/oauth/tokens/:flowId', requireJwtAuth, async (req, res) => {
  try {
    const { flowId } = req.params;
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Allow system flows or user-owned flows
    if (!flowId.startsWith(`${user.id}:`) && !flowId.startsWith('system:')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');
    if (!flowState) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    if (flowState.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Flow not completed' });
    }

    res.json({ tokens: flowState.result });
  } catch (error) {
    logger.error('[MCP OAuth] Failed to get tokens', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

/**
 * Check OAuth flow status
 * This endpoint can be used to poll the status of an OAuth flow
 */
router.get('/oauth/status/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');
    if (!flowState) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    res.json({
      status: flowState.status,
      completed: flowState.status === 'COMPLETED',
      failed: flowState.status === 'FAILED',
      error: flowState.error,
    });
  } catch (error) {
    logger.error('[MCP OAuth] Failed to get flow status', error);
    res.status(500).json({ error: 'Failed to get flow status' });
  }
});

/**
 * Cancel OAuth flow
 * This endpoint cancels a pending OAuth flow
 */
router.post('/oauth/cancel/:serverName', requireJwtAuth, async (req, res) => {
  try {
    const { serverName } = req.params;
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info(`[MCP OAuth Cancel] Cancelling OAuth flow for ${serverName} by user ${user.id}`);

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    // Generate the flow ID for this user/server combination
    const flowId = MCPOAuthHandler.generateFlowId(user.id, serverName);

    // Check if flow exists
    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');

    if (!flowState) {
      logger.debug(`[MCP OAuth Cancel] No active flow found for ${serverName}`);
      return res.json({
        success: true,
        message: 'No active OAuth flow to cancel',
      });
    }

    // Cancel the flow by marking it as failed
    await flowManager.completeFlow(flowId, 'mcp_oauth', null, 'User cancelled OAuth flow');

    logger.info(`[MCP OAuth Cancel] Successfully cancelled OAuth flow for ${serverName}`);

    res.json({
      success: true,
      message: `OAuth flow for ${serverName} cancelled successfully`,
    });
  } catch (error) {
    logger.error('[MCP OAuth Cancel] Failed to cancel OAuth flow', error);
    res.status(500).json({ error: 'Failed to cancel OAuth flow' });
  }
});

/**
 * Reinitialize MCP server
 * This endpoint allows reinitializing a specific MCP server
 */
router.post('/:serverName/reinitialize', requireJwtAuth, async (req, res) => {
  try {
    const { serverName } = req.params;
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info(`[MCP Reinitialize] Reinitializing server: ${serverName}`);

    const printConfig = false;
    const config = await loadCustomConfig(printConfig);
    if (!config || !config.mcpServers || !config.mcpServers[serverName]) {
      return res.status(404).json({
        error: `MCP server '${serverName}' not found in configuration`,
      });
    }

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);
    const mcpManager = getMCPManager();

    await mcpManager.disconnectServer(serverName);
    logger.info(`[MCP Reinitialize] Disconnected existing server: ${serverName}`);

    const serverConfig = config.mcpServers[serverName];
    mcpManager.mcpConfigs[serverName] = serverConfig;
    let customUserVars = {};
    if (serverConfig.customUserVars && typeof serverConfig.customUserVars === 'object') {
      for (const varName of Object.keys(serverConfig.customUserVars)) {
        try {
          const value = await getUserPluginAuthValue(user.id, varName, false);
          if (value) {
            customUserVars[varName] = value;
          }
        } catch (err) {
          logger.error(`[MCP Reinitialize] Error fetching ${varName} for user ${user.id}:`, err);
        }
      }
    }

    let userConnection = null;
    let oauthRequired = false;
    let oauthUrl = null;

    try {
      userConnection = await mcpManager.getUserConnection({
        user,
        serverName,
        flowManager,
        customUserVars,
        tokenMethods: {
          findToken,
          updateToken,
          createToken,
          deleteTokens,
        },
        returnOnOAuth: true, // Return immediately when OAuth is initiated
        // Add OAuth handlers to capture the OAuth URL when needed
        oauthStart: async (authURL) => {
          logger.info(`[MCP Reinitialize] OAuth URL received: ${authURL}`);
          oauthUrl = authURL;
          oauthRequired = true;
        },
      });

      logger.info(`[MCP Reinitialize] Successfully established connection for ${serverName}`);
    } catch (err) {
      logger.info(`[MCP Reinitialize] getUserConnection threw error: ${err.message}`);
      logger.info(
        `[MCP Reinitialize] OAuth state - oauthRequired: ${oauthRequired}, oauthUrl: ${oauthUrl ? 'present' : 'null'}`,
      );

      // Check if this is an OAuth error - if so, the flow state should be set up now
      const isOAuthError =
        err.message?.includes('OAuth') ||
        err.message?.includes('authentication') ||
        err.message?.includes('401');

      const isOAuthFlowInitiated = err.message === 'OAuth flow initiated - return early';

      if (isOAuthError || oauthRequired || isOAuthFlowInitiated) {
        logger.info(
          `[MCP Reinitialize] OAuth required for ${serverName} (isOAuthError: ${isOAuthError}, oauthRequired: ${oauthRequired}, isOAuthFlowInitiated: ${isOAuthFlowInitiated})`,
        );
        oauthRequired = true;
        // Don't return error - continue so frontend can handle OAuth
      } else {
        logger.error(
          `[MCP Reinitialize] Error initializing MCP server ${serverName} for user:`,
          err,
        );
        return res.status(500).json({ error: 'Failed to reinitialize MCP server for user' });
      }
    }

    // Only fetch and cache tools if we successfully connected (no OAuth required)
    if (userConnection && !oauthRequired) {
      const userTools = (await getCachedTools({ userId: user.id })) || {};

      // Remove any old tools from this server in the user's cache
      const mcpDelimiter = Constants.mcp_delimiter;
      for (const key of Object.keys(userTools)) {
        if (key.endsWith(`${mcpDelimiter}${serverName}`)) {
          delete userTools[key];
        }
      }

      // Add the new tools from this server
      const tools = await userConnection.fetchTools();
      for (const tool of tools) {
        const name = `${tool.name}${Constants.mcp_delimiter}${serverName}`;
        userTools[name] = {
          type: 'function',
          ['function']: {
            name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        };
      }

      // Save the updated user tool cache
      await setCachedTools(userTools, { userId: user.id });
    }

    logger.debug(
      `[MCP Reinitialize] Sending response for ${serverName} - oauthRequired: ${oauthRequired}, oauthUrl: ${oauthUrl ? 'present' : 'null'}`,
    );

    res.json({
      success: true,
      message: oauthRequired
        ? `MCP server '${serverName}' ready for OAuth authentication`
        : `MCP server '${serverName}' reinitialized successfully`,
      serverName,
      oauthRequired,
      oauthUrl,
    });
  } catch (error) {
    logger.error('[MCP Reinitialize] Unexpected error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get connection status for all MCP servers
 * This endpoint returns the actual connection status from MCPManager without disconnecting idle connections
 */
router.get('/connection/status', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const mcpManager = getMCPManager(user.id);
    const connectionStatus = {};

    const printConfig = false;
    const config = await loadCustomConfig(printConfig);
    const mcpConfig = config?.mcpServers;

    const appConnections = mcpManager.getAllConnections() || new Map();
    const userConnections = mcpManager.getUserConnections(user.id) || new Map();
    const oauthServers = mcpManager.getOAuthServers() || new Set();

    if (!mcpConfig) {
      return res.status(404).json({ error: 'MCP config not found' });
    }

    // Get flow manager to check for active/timed-out OAuth flows
    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);

    for (const [serverName] of Object.entries(mcpConfig)) {
      const getConnectionState = (serverName) =>
        appConnections.get(serverName)?.connectionState ??
        userConnections.get(serverName)?.connectionState ??
        'disconnected';

      const baseConnectionState = getConnectionState(serverName);

      let hasActiveOAuthFlow = false;
      let hasFailedOAuthFlow = false;

      if (baseConnectionState === 'disconnected' && oauthServers.has(serverName)) {
        try {
          // Check for user-specific OAuth flows
          const flowId = MCPOAuthHandler.generateFlowId(user.id, serverName);
          const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');
          if (flowState) {
            // Check if flow failed or timed out
            const flowAge = Date.now() - flowState.createdAt;
            const flowTTL = flowState.ttl || 180000; // Default 3 minutes

            if (flowState.status === 'FAILED' || flowAge > flowTTL) {
              hasFailedOAuthFlow = true;
              logger.debug(`[MCP Connection Status] Found failed OAuth flow for ${serverName}`, {
                flowId,
                status: flowState.status,
                flowAge,
                flowTTL,
                timedOut: flowAge > flowTTL,
              });
            } else if (flowState.status === 'PENDING') {
              hasActiveOAuthFlow = true;
              logger.debug(`[MCP Connection Status] Found active OAuth flow for ${serverName}`, {
                flowId,
                flowAge,
                flowTTL,
              });
            }
          }
        } catch (error) {
          logger.error(
            `[MCP Connection Status] Error checking OAuth flows for ${serverName}:`,
            error,
          );
        }
      }

      // Determine the final connection state
      let finalConnectionState = baseConnectionState;
      if (hasFailedOAuthFlow) {
        finalConnectionState = 'error'; // Report as error if OAuth failed
      } else if (hasActiveOAuthFlow && baseConnectionState === 'disconnected') {
        finalConnectionState = 'connecting'; // Still waiting for OAuth
      }

      connectionStatus[serverName] = {
        requiresOAuth: oauthServers.has(serverName),
        connectionState: finalConnectionState,
      };
    }

    res.json({
      success: true,
      connectionStatus,
    });
  } catch (error) {
    logger.error('[MCP Connection Status] Failed to get connection status', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
});

/**
 * Check which authentication values exist for a specific MCP server
 * This endpoint returns only boolean flags indicating if values are set, not the actual values
 */
router.get('/:serverName/auth-values', requireJwtAuth, async (req, res) => {
  try {
    const { serverName } = req.params;
    const user = req.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const printConfig = false;
    const config = await loadCustomConfig(printConfig);
    if (!config || !config.mcpServers || !config.mcpServers[serverName]) {
      return res.status(404).json({
        error: `MCP server '${serverName}' not found in configuration`,
      });
    }

    const serverConfig = config.mcpServers[serverName];
    const pluginKey = `${Constants.mcp_prefix}${serverName}`;
    const authValueFlags = {};

    // Check existence of saved values for each custom user variable (don't fetch actual values)
    if (serverConfig.customUserVars && typeof serverConfig.customUserVars === 'object') {
      for (const varName of Object.keys(serverConfig.customUserVars)) {
        try {
          const value = await getUserPluginAuthValue(user.id, varName, false, pluginKey);
          // Only store boolean flag indicating if value exists
          authValueFlags[varName] = !!(value && value.length > 0);
        } catch (err) {
          logger.error(
            `[MCP Auth Value Flags] Error checking ${varName} for user ${user.id}:`,
            err,
          );
          // Default to false if we can't check
          authValueFlags[varName] = false;
        }
      }
    }

    res.json({
      success: true,
      serverName,
      authValueFlags,
    });
  } catch (error) {
    logger.error(
      `[MCP Auth Value Flags] Failed to check auth value flags for ${req.params.serverName}`,
      error,
    );
    res.status(500).json({ error: 'Failed to check auth value flags' });
  }
});

/**
 * Handle post-processing for book-related MCP tools
 * @param {string} toolName
 * @param {Object} toolArguments
 * @param {Object} result
 * @param {Object} user
 */
async function handleBookToolPostProcessing(toolName, toolArguments, result, user) {
  try {
    // Extract bookId from tool arguments or result
    let bookId = toolArguments?.bookId || toolArguments?.book_id;

    // For tools that might not have bookId in arguments but return it in result
    if (!bookId && result?.content?.[0]?.text) {
      const match = result.content[0].text.match(/\bID:\s*([a-zA-Z0-9_-]{6,})/);
      if (match) {
        bookId = match[1];
      }
    }

    // For create_book, try to extract bookId from different result formats
    if (!bookId && toolName === 'create_book' && result?.content?.[0]?.text) {
      const text = result.content[0].text;
      // Try different patterns to extract book ID
      const patterns = [
        /Book ID:\s*([a-f0-9-]{36})/i,
        /book\s*(?:id|identifier):\s*([a-f0-9-]{36})/i,
        /created.*id:\s*([a-f0-9-]{36})/i,
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          bookId = match[1];
          break;
        }
      }
    }

    if (!bookId) {
      logger.debug('No bookId found for book tool post-processing', {
        toolName,
        toolArguments,
        resultPreview: result?.content?.[0]?.text?.substring(0, 200),
      });
      return;
    }

    // Define tools that modify book content and should trigger automatic export
    const bookModifyingTools = [
      'create_book',
      'create_chapter',
      'create_page',
      'update_book',
      'update_chapter',
      'update_page',
      'delete_book',
      'delete_chapter',
      'delete_page',
      'add_chapter',
      'add_page',
      'write_content',
      'enhance_content',
      'generate_chapter',
      'import_book',
    ];

    if (bookModifyingTools.includes(toolName)) {
      logger.info('Book content modified, triggering automatic export', {
        toolName,
        bookId,
        userId: user.id,
      });

      // Trigger automatic export generation, passing the original authorId from tool arguments
      await triggerAutomaticExport(
        bookId,
        toolArguments?.conversationId,
        toolName,
        user,
        toolArguments?.authorId,
      );

      // Notify book update
      bookUpdateService.notifyBookUpdate(bookId, 'book_updated', {
        toolName,
        userId: user.id,
        action: 'content_modified',
      });
    }

    logger.debug('Book tool post-processing completed', {
      toolName,
      bookId,
      isModifyingTool: bookModifyingTools.includes(toolName),
    });
  } catch (error) {
    logger.error('Error in book tool post-processing', {
      error: error.message,
      toolName,
      bookId: toolArguments?.bookId,
    });
  }
}

/**
 * Trigger automatic export generation for a book
 * @param {string} bookId
 * @param {string} conversationId
 * @param {string} triggerTool
 * @param {Object} user
 * @param {string} authorId - The actual authorId from the original tool call
 */
async function triggerAutomaticExport(bookId, conversationId, triggerTool, user, authorId) {
  try {
    logger.info('Triggering automatic export generation', {
      bookId,
      conversationId,
      triggerTool,
      userId: user.id,
    });

    // Use the authorId from the original tool call, with fallbacks
    let bookAuthorId = authorId;

    if (!bookAuthorId && user.id !== 'system-user') {
      bookAuthorId = user.id;
    }

    // If we still don't have an authorId, try to find it by querying the book-creation MCP server
    // using a database query approach (looking at common authorIds)
    if (!bookAuthorId) {
      logger.warn('No authorId available for automatic export, trying to discover book owner', {
        bookId,
      });

      // Try a few common authorIds that might exist in the system
      const possibleAuthorIds = [
        'writer001',
        'test-user-001',
        'user-1',
        'admin',
        'author-1',
        'system',
        'book-author',
        'default-author',
        '6747b3c65dfea0bce0a7d7c6',
      ];

      for (const testAuthorId of possibleAuthorIds) {
        try {
          const testResponse = await fetch(
            `${process.env.SERVER_HOST || 'http://localhost:3080'}/api/mcp/book-creation/tools/list_books/call`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                arguments: {
                  authorId: testAuthorId,
                  conversationId: conversationId || `lookup-${bookId.slice(0, 8)}`,
                },
              }),
            },
          );

          if (testResponse.ok) {
            const testResult = await testResponse.json();
            if (
              testResult.success &&
              testResult.result?.[0]?.[0]?.text &&
              testResult.result[0][0].text.includes(bookId)
            ) {
              bookAuthorId = testAuthorId;
              logger.info('Found book owner through discovery', { bookId, authorId: bookAuthorId });
              break;
            }
          }
        } catch (error) {
          // Continue to next possible authorId
        }
      }
    }

    if (!bookAuthorId) {
      logger.error('Cannot determine book authorId for automatic export after discovery attempt', {
        bookId,
        userId: user.id,
        providedAuthorId: authorId,
      });
      return;
    }

    logger.debug('Using authorId for automatic export', {
      bookId,
      authorId: bookAuthorId,
      originalUserId: user.id,
    });

    // Generate a unique filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const filename = `book-${bookId.slice(0, 8)}-${timestamp}.html`;

    // Prepare the export tool arguments with the correct authorId
    const exportArguments = {
      bookId: bookId,
      format: 'html',
      includeMetadata: true,
      aliasFilename: filename,
      authorId: bookAuthorId,
    };

    // Add conversationId if available
    if (conversationId) {
      exportArguments.conversationId = conversationId;
    } else if (bookAuthorId) {
      exportArguments.conversationId = `fallback-${bookAuthorId}`;
    } else {
      exportArguments.conversationId = `auto-export-${bookId.slice(0, 8)}`;
    }

    // Use internal HTTP call to the unauthenticated endpoint to avoid MCP config issues
    const serverHost = process.env.SERVER_HOST || 'http://localhost:3080';
    const response = await fetch(`${serverHost}/api/mcp/book-creation/tools/export_book/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: exportArguments,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        logger.info('Automatic export generated successfully', {
          bookId,
          filename,
          triggerTool,
          userId: user.id,
        });

        // Notify about the new export
        bookUpdateService.notifyBookUpdate(bookId, 'export_ready', {
          filename: filename,
          exportUrl: `/c/exports/${filename}`,
          triggerTool: triggerTool,
          userId: user.id,
          timestamp: new Date().toISOString(),
          format: 'html',
        });
      } else {
        logger.warn('Automatic export generation failed', {
          bookId,
          filename,
          triggerTool,
          error: result.error,
        });
      }
    } else {
      const errorText = await response.text();
      logger.error('Failed to call automatic export endpoint', {
        bookId,
        filename,
        triggerTool,
        status: response.status,
        error: errorText,
      });
    }
  } catch (error) {
    logger.error('Failed to trigger automatic export', {
      error: error.message,
      bookId,
      conversationId,
      triggerTool,
      userId: user.id,
    });
  }
}

module.exports = router;

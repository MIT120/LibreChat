const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const logger = require('~/utils/logger');
const { MCPToolHandlers } = require('./MCPToolHandlers');
const { MCPValidators, MCPValidationError } = require('./MCPValidators');

/**
 * CS2 MCP Server for providing Counter-Strike 2 match data and predictions
 * to Anthropic agents through the Model Context Protocol
 *
 * Refactored for better separation of concerns and maintainability
 */
class CS2MCPServer {
  constructor(options = {}) {
    this.serverInfo = {
      name: options.name || 'cs2-hltv-server',
      version: options.version || '1.0.0',
    };

    this.server = new Server(this.serverInfo, {
      capabilities: {
        tools: {},
      },
    });

    this.toolHandlers = new MCPToolHandlers();
    this.toolDefinitions = new ToolDefinitions();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * Set up tool handlers for MCP protocol
   */
  setupToolHandlers() {
    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolDefinitions.getAllTools(),
      };
    });

    // Handle tool execution with validation
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate input based on tool type
        this.validateToolInput(name, args);

        // Execute the appropriate handler
        return await this.executeToolHandler(name, args);
      } catch (error) {
        logger.error(`[CS2MCPServer] Error executing tool ${name}:`, error);
        return this.createErrorResponse(name, error);
      }
    });
  }

  /**
   * Validate tool input based on tool type
   */
  validateToolInput(toolName, args) {
    const validators = {
      get_match_data: () => MCPValidators.validateGetMatchData(args),
      get_team_stats: () => MCPValidators.validateGetTeamStats(args),
      predict_match_outcome: () => MCPValidators.validatePredictMatchOutcome(args),
    };

    const validator = validators[toolName];
    if (!validator) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const validation = validator();
    if (!validation.isValid) {
      throw new MCPValidationError(`Invalid input for ${toolName}`, validation.errors);
    }
  }

  /**
   * Execute the appropriate tool handler
   */
  async executeToolHandler(toolName, args) {
    const handlers = {
      get_match_data: () => this.toolHandlers.handleGetMatchData(args),
      get_team_stats: () => this.toolHandlers.handleGetTeamStats(args),
      predict_match_outcome: () => this.toolHandlers.handlePredictMatchOutcome(args),
    };

    const handler = handlers[toolName];
    return await handler();
  }

  /**
   * Create standardized error response
   */
  createErrorResponse(toolName, error) {
    const errorMessage =
      error instanceof MCPValidationError
        ? `Validation error for ${toolName}: ${error.errors.join(', ')}`
        : `Error executing ${toolName}: ${error.message}`;

    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }

  /**
   * Set up error handling for the server
   */
  setupErrorHandling() {
    this.server.onerror = (error) => {
      logger.error('[CS2MCPServer] Server error:', error);
    };

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`[CS2MCPServer] Received ${signal}, shutting down gracefully...`);
      try {
        await this.server.close();
        logger.info('[CS2MCPServer] Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('[CS2MCPServer] Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info(
        `[CS2MCPServer] ${this.serverInfo.name} v${this.serverInfo.version} started successfully`,
      );
    } catch (error) {
      logger.error('[CS2MCPServer] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Get server status and statistics
   */
  getStatus() {
    return {
      name: this.serverInfo.name,
      version: this.serverInfo.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      availableTools: this.toolDefinitions.getAllTools().map((tool) => tool.name),
    };
  }
}

/**
 * Tool definitions separated for better maintainability
 */
class ToolDefinitions {
  getAllTools() {
    return [this.getMatchDataTool(), this.getTeamStatsTool(), this.getPredictMatchOutcomeTool()];
  }

  getMatchDataTool() {
    return {
      name: 'get_match_data',
      description: 'Retrieve CS2 match information by ID, team name, or other criteria',
      inputSchema: {
        type: 'object',
        properties: {
          matchId: {
            type: 'string',
            description: 'HLTV match ID to retrieve specific match data',
          },
          teamName: {
            type: 'string',
            description: 'Team name to find matches for',
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date' },
              end: { type: 'string', format: 'date' },
            },
            description: 'Date range to filter matches',
          },
          status: {
            type: 'string',
            enum: ['upcoming', 'live', 'finished'],
            description: 'Match status filter',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Maximum number of matches to return',
          },
        },
      },
    };
  }

  getTeamStatsTool() {
    return {
      name: 'get_team_stats',
      description: 'Get comprehensive team statistics and recent form',
      inputSchema: {
        type: 'object',
        properties: {
          teamName: {
            type: 'string',
            description: 'Team name to get statistics for',
          },
          mapName: {
            type: 'string',
            description: 'Specific map to get statistics for (optional)',
          },
          timeframe: {
            type: 'string',
            enum: ['1month', '3months', '6months', '1year'],
            default: '3months',
            description: 'Time period for statistics',
          },
        },
        required: ['teamName'],
      },
    };
  }

  getPredictMatchOutcomeTool() {
    return {
      name: 'predict_match_outcome',
      description: 'Generate predictions for match outcomes with probabilities',
      inputSchema: {
        type: 'object',
        properties: {
          matchId: {
            type: 'string',
            description: 'HLTV match ID to generate predictions for',
          },
          predictionType: {
            type: 'string',
            enum: ['half_time', 'map_winner', 'series_outcome'],
            description: 'Type of prediction to generate',
          },
        },
        required: ['matchId', 'predictionType'],
      },
    };
  }
}

module.exports = CS2MCPServer;

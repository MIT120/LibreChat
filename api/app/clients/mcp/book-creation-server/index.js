#!/usr/bin/env node

/**
 * Book Creation MCP Server
 *
 * An MCP server that enables AI-powered book creation with structured,
 * approval-based workflows. Integrates with LibreChat's existing infrastructure.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

// Import tools
const { getAllTools } = require('./tools/index.js');

class BookCreationMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'book-creation-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.tools = new Map();
    this.isInitialized = false;

    // Delay handler setup to avoid initialization issues
    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  setupHandlers() {
    // Set up list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getAllTools();
      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Set up call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: toolArgs } = request.params;

      const tool = getAllTools().find((t) => t.name === toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      try {
        // Execute the tool with context including models and services
        const context = {
          userId: request.meta?.userId || 'anonymous',
          user: request.meta?.user || { id: 'anonymous' },
          models: this.models,
          dbManager: this.dbManager,
          // Provide models for service instantiation
          serverModels: this.models,
        };

        const result = await tool.execute(toolArgs, context);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`[MCP] Error executing tool ${toolName}:`, error);
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Register a tool with the server
   * @param {Object} tool - Tool object with name, description, inputSchema, and execute function
   */
  registerTool(tool) {
    if (!tool.name || !tool.description || !tool.inputSchema || !tool.execute) {
      throw new Error('Tool must have name, description, inputSchema, and execute properties');
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Initialize the server and register tools
   */
  async initialize() {
    try {
      // Initialize database connection
      await this.initializeDatabase();

      // Register all available tools
      const tools = getAllTools();
      tools.forEach((tool) => {
        this.registerTool(tool);
      });

      console.error(`Registered ${tools.length} MCP tools: ${tools.map((t) => t.name).join(', ')}`);

      this.isInitialized = true;
      console.error('Book Creation MCP Server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Book Creation MCP Server:', error);
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    try {
      const { DatabaseManager } = require('./utils/database.js');

      // Use MongoDB URI from environment or default
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat';

      this.dbManager = new DatabaseManager({
        maxRetries: 3,
        retryDelay: 2000,
        connectionTimeout: 10000,
        operationTimeout: 30000,
      });

      await this.dbManager.connect(mongoUri);
      console.error(`[MCP] Connected to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);

      // Initialize models
      await this.initializeModels();
    } catch (error) {
      console.error('[MCP] Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database models for book creation
   */
  async initializeModels() {
    try {
      // Import LibreChat's model creation functions
      const { createModels } = require('@librechat/data-schemas');
      const mongoose = require('mongoose');

      // Create all models including Book and Chapter
      this.models = createModels(mongoose);

      console.error('[MCP] Database models initialized successfully');
    } catch (error) {
      console.error('[MCP] Model initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start the server with stdio transport
   */
  async start() {
    // Initialize the server first
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Book Creation MCP Server started on stdio');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      console.error('Shutting down Book Creation MCP Server...');

      // Close database connections if any
      if (this.dbManager) {
        await this.dbManager.disconnect();
        console.error('Database connections closed');
      }

      // Close server
      await this.server.close();

      console.error('Book Creation MCP Server shut down successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new BookCreationMCPServer();

  server.start().catch((error) => {
    console.error('Failed to start Book Creation MCP Server:', error);
    process.exit(1);
  });
}

module.exports = BookCreationMCPServer;

#!/usr/bin/env node

/**
 * Standalone CS2 MCP Server executable
 * This script can be run directly to start the CS2 MCP server
 * Usage: node api/server/services/CS2/mcp-server.js
 */

const path = require('path');
const { connectDb } = require('~/db/connect');
const CS2MCPServer = require('./CS2MCPServer');

async function main() {
  try {
    // Connect to database
    await connectDb();
    console.log('[CS2MCPServer] Database connected');

    // Create and start the MCP server
    const server = new CS2MCPServer();
    await server.start();

    console.log('[CS2MCPServer] Server is running and ready to accept connections');
  } catch (error) {
    console.error('[CS2MCPServer] Failed to start:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[CS2MCPServer] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CS2MCPServer] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { main };

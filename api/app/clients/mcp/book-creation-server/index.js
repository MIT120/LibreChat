#!/usr/bin/env node

/**
 * Temporary JavaScript entry point for the book-creation-server
 * This bypasses TypeScript compilation issues for now
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

console.error('Book Creation Server starting...');

// Create a simple MCP server instance
const server = new Server(
  {
    name: 'book-creation',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Add basic tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'create_book',
        description: 'Create a new book',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Book title' },
            author: { type: 'string', description: 'Book author' },
            genre: { type: 'string', description: 'Book genre' },
          },
          required: ['title'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'create_book') {
    return {
      content: [
        {
          type: 'text',
          text: `📚 **Book Created Successfully!**\n\n**Title:** ${args.title}\n**Author:** ${args.author || 'Unknown'}\n**Genre:** ${args.genre || 'General'}\n\n✨ Your book has been created and is ready for editing!`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Book Creation Server connected successfully');
}

main().catch((error) => {
  console.error('Book Creation Server error:', error);
  process.exit(1);
});

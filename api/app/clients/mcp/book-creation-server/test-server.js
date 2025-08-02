#!/usr/bin/env node

// Simple test to verify the MCP server can start and respond to basic requests
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testServer() {
  console.log('Testing Book Creation MCP Server...');

  try {
    // Start the server
    const serverPath = join(__dirname, 'index.js');
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send a list tools request
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    };

    // Set up response handling
    let responseReceived = false;
    server.stdout.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.result && response.result.tools) {
          console.log('✅ Server responded with tools list');
          console.log(`📚 Found ${response.result.tools.length} tools:`);
          response.result.tools.forEach((tool) => {
            console.log(`  - ${tool.name}: ${tool.description.split('.')[0]}`);
          });
          responseReceived = true;
          server.kill();
        }
      } catch (e) {
        // Ignore JSON parse errors for now
      }
    });

    server.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Book Creation MCP server running')) {
        console.log('✅ Server started successfully');
        // Send the request
        server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
      } else if (message.includes('Error')) {
        console.error('❌ Server error:', message);
      }
    });

    server.on('close', (code) => {
      if (responseReceived) {
        console.log('✅ Test completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Test failed - no valid response received');
        process.exit(1);
      }
    });

    server.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.error('❌ Test timeout - server did not respond in time');
        server.kill();
        process.exit(1);
      }
    }, 10000);
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testServer();

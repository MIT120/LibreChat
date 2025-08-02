#!/usr/bin/env node

console.log('🔧 Starting MCP Book Creation Database Cleanup...');
console.log('This will fix pages with null pageId values.\n');

import('./utils/database-cleanup.js')
  .then(({ cleanupDatabase }) => {
    return cleanupDatabase();
  })
  .catch((error) => {
    console.error('❌ Failed to import or run cleanup:', error.message);
    process.exit(1);
  });

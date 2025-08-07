#!/usr/bin/env node

import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Get the current directory and set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a require function for this ES module
const require = createRequire(import.meta.url);

// Set up module alias for the API directory
const moduleAlias = require('module-alias');

// Point ~ to the API directory (5 levels up from this MCP server)
const apiPath = resolve(__dirname, '..', '..', '..', '..');
moduleAlias.addAlias('~', apiPath);

// Now import and run the main server
import('./index.js').catch(console.error);

/**
 * CS2 Services Module
 * 
 * This module exports all CS2-related services for HLTV data scraping,
 * vector processing, MCP integration, and prediction engine functionality.
 * 
 * @module CS2Services
 */

// Safe require with fallback for missing modules during development
const safeRequire = (modulePath) => {
  try {
    return require(modulePath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn(`CS2 Module ${modulePath} not found, using placeholder`);
      return class Placeholder {
        constructor() {
          throw new Error(`${modulePath} is not implemented yet`);
        }
      };
    }
    throw error;
  }
};

// Main services (some may not exist yet during development)
const HLTVScraperService = safeRequire('./HLTVScraperService');
const CS2VectorService = safeRequire('./CS2VectorService');
const CS2MCPServer = safeRequire('./CS2MCPServer');
const CS2PredictionEngine = safeRequire('./CS2PredictionEngine');

// Existing utilities and configuration
const config = require('./config');
const errors = require('./errors');
const utils = require('./utils');

/**
 * @typedef {Object} CS2Services
 * @property {HLTVScraperService} HLTVScraperService - Service for scraping HLTV match data
 * @property {CS2VectorService} CS2VectorService - Service for vector embeddings and similarity search
 * @property {CS2MCPServer} CS2MCPServer - MCP server for agent communication
 * @property {CS2PredictionEngine} CS2PredictionEngine - Engine for match outcome predictions
 * @property {Object} config - Configuration settings for CS2 services
 * @property {Object} errors - Custom error classes for CS2 operations
 * @property {Object} utils - Utility functions for CS2 data processing
 */

module.exports = {
  // Main services
  HLTVScraperService,
  CS2VectorService,
  CS2MCPServer,
  CS2PredictionEngine,
  
  // Utilities and configuration
  config,
  errors,
  utils,
};
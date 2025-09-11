#!/usr/bin/env node

/**
 * Toki Looker MCP Server - TypeScript Implementation
 * Main entry point for the server
 */

// Load environment variables
import { config } from 'dotenv';
config();

import { Logger, LogLevel } from './core/Logger.js';
import { LookerService } from './services/LookerService.js';
import { MCPServer } from './server/MCPServer.js';
import { LookerConfig, ConfigurationError } from '../types/index.js';

async function main(): Promise<void> {
    const logger = new Logger('TokiLookerServer');

    try {
        // Set log level from environment
        const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
        switch (logLevel) {
            case 'debug':
                logger.setLevel(LogLevel.DEBUG);
                break;
            case 'warn':
                logger.setLevel(LogLevel.WARN);
                break;
            case 'error':
                logger.setLevel(LogLevel.ERROR);
                break;
            default:
                logger.setLevel(LogLevel.INFO);
        }

        logger.info('Starting Toki Looker MCP Server v1.0.0');
        logger.info('Environment configuration', {
            nodeEnv: process.env.NODE_ENV || 'development',
            logLevel,
            lookerBaseUrl: process.env.LOOKER_BASE_URL ? 'configured' : 'not configured',
            lookerClientId: process.env.LOOKER_CLIENT_ID ? 'configured' : 'not configured',
            lookerClientSecret: process.env.LOOKER_CLIENT_SECRET ? 'configured' : 'not configured',
        });

        // Create configuration (defer validation until first use)
        const config = createConfiguration();
        if (config.isValid) {
            logger.info('Looker configuration found and validated');
        } else {
            logger.warn('Looker configuration is incomplete. Tools will fail until credentials are properly configured.');
        }

        // Create services
        const lookerService = new LookerService(logger, config.config);

        // Create and start the MCP server
        const mcpServer = new MCPServer(logger, lookerService);
        await mcpServer.initialize();
        await mcpServer.start();

        logger.info('Toki Looker MCP Server started successfully');

        // Keep the process alive
        process.on('exit', async () => {
            logger.info('Shutting down Toki Looker MCP Server');
            await mcpServer.stop();
        });

    } catch (error) {
        logger.error('Failed to start Toki Looker MCP Server', error as Error);
        process.exit(1);
    }
}

function createConfiguration(): { config: LookerConfig; isValid: boolean } {
    const baseUrl = process.env.LOOKER_BASE_URL;
    const clientId = process.env.LOOKER_CLIENT_ID;
    const clientSecret = process.env.LOOKER_CLIENT_SECRET;

    const isValid = !!(baseUrl && clientId && clientSecret);

    // Ensure the base URL ends with the API version
    const normalizedBaseUrl = baseUrl
        ? (baseUrl.endsWith('/api/4.0') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/4.0`)
        : 'https://example.looker.com/api/4.0';

    return {
        config: {
            baseUrl: normalizedBaseUrl,
            clientId: clientId || 'not-configured',
            clientSecret: clientSecret || 'not-configured',
            apiVersion: '4.0'
        },
        isValid
    };
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { main };

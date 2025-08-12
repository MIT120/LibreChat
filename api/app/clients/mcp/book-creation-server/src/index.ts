#!/usr/bin/env node

/**
 * Book Creation MCP Server - TypeScript Implementation
 * Main entry point for the server
 */

import { Logger, LogLevel } from './core/Logger.js';
import { container } from './core/ServiceContainer.js';
import { SERVICE_TOKENS } from './interfaces/index.js';

// Import services
import { AIContentService } from './services/AIContentService.js';
import { BookService } from './services/BookService.js';
import { ConfigService } from './services/ConfigService.js';
import { DatabaseService } from './services/DatabaseService.js';
import { ExportService } from './services/ExportService.js';
import { ImageService } from './services/ImageService.js';
import { ResearchService } from './services/ResearchService.js';
import { WritingAnalyticsService } from './services/WritingAnalyticsService.js';

// Import new writing assistant services
import { WritingAssistantService } from './services/WritingAssistantService.js';
import { PlotAnalysisService } from './services/PlotAnalysisService.js';
import { ContentEnhancementService } from './services/ContentEnhancementService.js';

// Import server
import { MCPServer } from './server/MCPServer.js';

async function main(): Promise<void> {
    const logger = new Logger('BookCreationServer');

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

        logger.info('Starting Book Creation MCP Server v2.0.0');
        logger.info('Environment configuration', {
            nodeEnv: process.env.NODE_ENV || 'development',
            logLevel,
            mongoUri: process.env.MONGODB_URI ? 'configured' : 'not configured',
            exportDir: process.env.EXPORT_DIR || './exports',
        });

        // Register services in dependency injection container
        await registerServices(logger);

        // Create and start the MCP server
        const mcpServer = container.resolve<MCPServer>('MCPServer');
        await mcpServer.initialize();
        await mcpServer.start();

        logger.info('Book Creation MCP Server started successfully');

        // Keep the process alive
        process.on('exit', async () => {
            logger.info('Shutting down Book Creation MCP Server');
            await mcpServer.stop();
        });

    } catch (error) {
        logger.error('Failed to start Book Creation MCP Server', error as Error);
        process.exit(1);
    }
}

async function registerServices(logger: Logger): Promise<void> {
    logger.info('Registering services');

    try {
        // Core services
        container.registerInstance(SERVICE_TOKENS.LOGGER, logger);

        // Configuration service
        container.registerSingleton(
            SERVICE_TOKENS.CONFIG_SERVICE,
            ConfigService,
            [SERVICE_TOKENS.LOGGER]
        );

        // Database service
        container.registerSingleton(
            SERVICE_TOKENS.DATABASE_SERVICE,
            DatabaseService,
            [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.CONFIG_SERVICE]
        );

        // Business services
        container.registerSingleton(
            SERVICE_TOKENS.BOOK_SERVICE,
            BookService,
            [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.DATABASE_SERVICE]
        );

        // Image service (needs to be registered before ExportService)
        container.registerSingleton(
            SERVICE_TOKENS.IMAGE_SERVICE,
            ImageService,
            [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.CONFIG_SERVICE]
        );

        container.registerSingleton(
            SERVICE_TOKENS.EXPORT_SERVICE,
            ExportService,
            [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.BOOK_SERVICE, SERVICE_TOKENS.CONFIG_SERVICE, SERVICE_TOKENS.IMAGE_SERVICE]
        );

        // Research service
        container.registerSingleton(
            SERVICE_TOKENS.RESEARCH_SERVICE,
            ResearchService,
            [SERVICE_TOKENS.LOGGER]
        );

        // AI Content service
        container.registerSingleton(
            SERVICE_TOKENS.AI_CONTENT_SERVICE,
            AIContentService,
            [SERVICE_TOKENS.LOGGER]
        );

        // Writing Analytics service
        container.registerSingleton(
            SERVICE_TOKENS.ANALYTICS_SERVICE as any,
            WritingAnalyticsService,
            [SERVICE_TOKENS.LOGGER]
        );

        // Writing Assistant Features
        container.registerSingleton(
            'WritingAssistantService',
            WritingAssistantService,
            [SERVICE_TOKENS.LOGGER]
        );

        container.registerSingleton(
            'PlotAnalysisService',
            PlotAnalysisService,
            [SERVICE_TOKENS.LOGGER]
        );

        container.registerSingleton(
            'ContentEnhancementService',
            ContentEnhancementService,
            [SERVICE_TOKENS.LOGGER]
        );

        // MCP Server - register as instance since it needs container reference
        const mcpServer = new MCPServer(logger, container);
        container.registerInstance('MCPServer', mcpServer);

        logger.info('Services registered successfully');

        // Initialize configuration service to load config
        const configService = container.resolve<ConfigService>(SERVICE_TOKENS.CONFIG_SERVICE);
        await configService.initialize();

        // Get database config and register database service with proper config
        const databaseConfig = configService.getDatabaseConfig();

        // Re-register database service with config
        container.registerSingleton(
            SERVICE_TOKENS.DATABASE_SERVICE,
            DatabaseService,
            [SERVICE_TOKENS.LOGGER]
        );

        // Create database service instance with config
        const databaseService = new DatabaseService(logger, databaseConfig);
        container.registerInstance(SERVICE_TOKENS.DATABASE_SERVICE, databaseService);

        logger.info('Services configured and ready for initialization');

    } catch (error) {
        logger.error('Failed to register services', error as Error);
        throw error;
    }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { main };

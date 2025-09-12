/**
 * Factory for creating Looker service instances with proper dependency injection
 */

import { LookerNodeSDK } from '@looker/sdk-node';
import { Looker40SDK } from '@looker/sdk';
import { ILogger } from '../interfaces/ILogger.js';
import { ILookerService } from '../interfaces/ILookerService.js';
import { LookerConfig } from '../../types/index.js';
import { LookerService } from '../services/LookerService.js';
import { LookerMetadataService } from '../services/core/LookerMetadataService.js';
import { LookerQueryService } from '../services/core/LookerQueryService.js';
import { LookerContentService } from '../services/core/LookerContentService.js';
import { ElectricityAnalyticsService } from '../services/analytics/ElectricityAnalyticsService.js';
import { LookerDiagnosticsService } from '../services/diagnostics/LookerDiagnosticsService.js';

export class LookerServiceFactory {
    private static instance: LookerServiceFactory;

    private constructor() { }

    public static getInstance(): LookerServiceFactory {
        if (!LookerServiceFactory.instance) {
            LookerServiceFactory.instance = new LookerServiceFactory();
        }
        return LookerServiceFactory.instance;
    }

    /**
     * Creates a fully configured LookerService instance
     */
    public createLookerService(logger: ILogger, config: LookerConfig): ILookerService {
        // Create SDK instance
        const sdk = this.createLookerSDK(config);

        // Create specialized services
        const metadataService = new LookerMetadataService(logger, config);
        const queryService = new LookerQueryService(logger, config);
        const contentService = new LookerContentService(logger, config);
        const electricityAnalyticsService = new ElectricityAnalyticsService(
            logger,
            config,
            queryService,
            metadataService
        );
        const diagnosticsService = new LookerDiagnosticsService(logger, config);

        // Create the main service with composition
        return new LookerService(logger, config);
    }

    /**
     * Creates a Looker SDK instance with proper configuration
     */
    public createLookerSDK(config: LookerConfig): Looker40SDK {
        // Set environment variables from config for the SDK to use
        process.env.LOOKER_BASE_URL = config.baseUrl.replace('/api/4.0', ''); // SDK expects base URL without /api/4.0
        process.env.LOOKER_CLIENT_ID = config.clientId;
        process.env.LOOKER_CLIENT_SECRET = config.clientSecret;

        // Configure timeout
        const timeout = parseInt(process.env.LOOKER_TIMEOUT_MS || '60000');
        process.env.LOOKER_TIMEOUT = timeout.toString();

        // Initialize the SDK using the official pattern from documentation
        return LookerNodeSDK.init40();
    }

    /**
     * Creates individual service instances (useful for testing or specific use cases)
     */
    public createMetadataService(logger: ILogger, config: LookerConfig): LookerMetadataService {
        return new LookerMetadataService(logger, config);
    }

    public createQueryService(logger: ILogger, config: LookerConfig): LookerQueryService {
        return new LookerQueryService(logger, config);
    }

    public createContentService(logger: ILogger, config: LookerConfig): LookerContentService {
        return new LookerContentService(logger, config);
    }

    public createElectricityAnalyticsService(
        logger: ILogger,
        config: LookerConfig
    ): ElectricityAnalyticsService {
        const queryService = this.createQueryService(logger, config);
        const metadataService = this.createMetadataService(logger, config);

        return new ElectricityAnalyticsService(logger, config, queryService, metadataService);
    }

    public createDiagnosticsService(logger: ILogger, config: LookerConfig): LookerDiagnosticsService {
        return new LookerDiagnosticsService(logger, config);
    }
}

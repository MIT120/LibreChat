/**
 * Looker Configuration - Handles configuration loading and validation
 */

import { LookerConfig as ILookerConfig } from '../../types/index.js';
import { ILogger } from '../interfaces/ILogger.js';

export class LookerConfigManager {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    loadConfig(): ILookerConfig {
        const config: ILookerConfig = {
            baseUrl: this.getRequiredEnvVar('LOOKER_BASE_URL'),
            clientId: this.getRequiredEnvVar('LOOKER_CLIENT_ID'),
            clientSecret: this.getRequiredEnvVar('LOOKER_CLIENT_SECRET'),
            apiVersion: process.env.LOOKER_API_VERSION || '4.0'
        };

        this.validateConfig(config);
        this.logger.info('Looker configuration loaded successfully', {
            baseUrl: config.baseUrl,
            apiVersion: config.apiVersion,
            clientIdConfigured: !!config.clientId
        });

        return config;
    }

    private getRequiredEnvVar(name: string): string {
        const value = process.env[name];
        if (!value || value === 'not-configured') {
            throw new Error(`Required environment variable ${name} is not set or is set to 'not-configured'`);
        }
        return value;
    }

    private validateConfig(config: ILookerConfig): void {
        if (!config.baseUrl) {
            throw new Error('LOOKER_BASE_URL is required');
        }

        if (!config.clientId) {
            throw new Error('LOOKER_CLIENT_ID is required');
        }

        if (!config.clientSecret) {
            throw new Error('LOOKER_CLIENT_SECRET is required');
        }

        // Validate URL format
        try {
            new URL(config.baseUrl);
        } catch (error) {
            throw new Error(`Invalid LOOKER_BASE_URL format: ${config.baseUrl}`);
        }

        // Ensure base URL ends with /api/4.0 or similar
        if (!config.baseUrl.includes('/api/')) {
            this.logger.warn('LOOKER_BASE_URL should include /api/4.0 path. Adding it automatically.');
            config.baseUrl = config.baseUrl.replace(/\/$/, '') + '/api/4.0';
        }
    }

    getTimeout(): number {
        return parseInt(process.env.LOOKER_TIMEOUT_MS || '60000');
    }

    isDevelopment(): boolean {
        return process.env.NODE_ENV === 'development';
    }

    isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    getLogLevel(): string {
        return process.env.LOG_LEVEL || 'info';
    }
}

// Export the manager as the default export
export { LookerConfigManager as default };

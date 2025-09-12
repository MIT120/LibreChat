/**
 * Base Looker Service - Common functionality for all Looker operations
 */

import { Looker40SDK } from '@looker/sdk';
import { LookerNodeSDK } from '@looker/sdk-node';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import {
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    NetworkError,
    LookerError
} from '../../../types/errors.js';

export abstract class BaseLookerService {
    protected logger: ILogger;
    protected config: LookerConfig;
    protected sdk!: Looker40SDK;
    protected isInitialized = false;

    constructor(logger: ILogger, config: LookerConfig) {
        this.logger = logger;
        this.config = config;
        this.initializeSDK();
    }

    private initializeSDK(): void {
        // Set environment variables from config for the SDK to use
        process.env.LOOKER_BASE_URL = this.config.baseUrl.replace('/api/4.0', '');
        process.env.LOOKER_CLIENT_ID = this.config.clientId;
        process.env.LOOKER_CLIENT_SECRET = this.config.clientSecret;

        // Configure timeout
        const timeout = parseInt(process.env.LOOKER_TIMEOUT_MS || '60000');
        process.env.LOOKER_TIMEOUT = timeout.toString();

        // Initialize the SDK
        this.sdk = LookerNodeSDK.init40();

        this.logger.info('Initialized Looker SDK with environment variables', {
            baseUrl: this.config.baseUrl,
            timeout,
            clientIdConfigured: !!this.config.clientId
        });
    }

    protected async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            try {
                await this.authenticate();
                this.isInitialized = true;
            } catch (error) {
                this.logger.error('Failed to initialize Looker SDK', error);
                throw error;
            }
        }
    }

    protected handleSDKError(error: any): Error {
        const errorMessage = error?.message || String(error);

        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            return new AuthenticationError('Authentication failed - check credentials');
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
            return new AuthorizationError('Access forbidden - insufficient permissions');
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            return new NotFoundError('Resource', 'not found');
        } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
            return new ValidationError('Invalid request parameters');
        } else if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
            return new RateLimitError('Rate limit exceeded');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
            return new NetworkError(`Request timeout. Consider increasing LOOKER_TIMEOUT_MS environment variable.`);
        } else if (errorMessage.includes('ECONNREFUSED')) {
            return new NetworkError(`Connection refused to Looker API at ${this.config.baseUrl}. Please verify LOOKER_BASE_URL is correct.`);
        } else if (errorMessage.includes('ENOTFOUND')) {
            return new NetworkError(`DNS resolution failed for ${this.config.baseUrl}. Please verify the hostname is correct.`);
        } else if (errorMessage.includes('aborted') || errorMessage.includes('canceled')) {
            return new NetworkError('Request was aborted. This may be due to a timeout or cancelled operation.');
        } else {
            return new LookerError(`Looker API error: ${errorMessage}`);
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.logger.info('Authenticating with Looker API using SDK');

            const me = await this.sdk.ok(this.sdk.me("id, first_name, last_name, display_name, email, personal_space_id, home_space_id"));

            this.logger.info('Successfully authenticated with Looker API', {
                userId: me.id,
                email: me.email,
                displayName: me.display_name
            });
        } catch (error) {
            this.logger.error('Failed to authenticate with Looker API', error);
            throw new AuthenticationError(`Failed to authenticate with Looker API: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    isAuthenticated(): boolean {
        return this.isInitialized;
    }

    protected async makeSDKCall<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
        await this.ensureInitialized();

        try {
            this.logger.debug(`Executing ${operationName}`);
            const startTime = Date.now();
            const result = await operation();
            const duration = Date.now() - startTime;

            this.logger.debug(`Successfully completed ${operationName} in ${duration}ms`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to execute ${operationName}`, error);
            throw this.handleSDKError(error);
        }
    }

    protected async makeHTTPCall<T>(url: string, options: RequestInit, operationName: string): Promise<T> {
        await this.ensureInitialized();

        try {
            this.logger.debug(`Making HTTP request to ${url} for ${operationName}`);

            const response = await fetch(url, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.sdk.authSession.getToken()}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.warn(`HTTP request failed for ${operationName}`, {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText
                });
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            this.logger.debug(`Successfully completed HTTP request for ${operationName}`);
            return data;
        } catch (error) {
            this.logger.error(`Failed to execute HTTP request for ${operationName}`, error);
            throw this.handleSDKError(error);
        }
    }
}

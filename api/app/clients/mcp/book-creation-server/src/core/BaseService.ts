/**
 * Base service class with common functionality
 */

import { ILogger } from '../interfaces/ILogger.js';

export abstract class BaseService {
    protected logger: ILogger;
    protected initialized: boolean = false;

    constructor(logger: ILogger) {
        this.logger = (logger as any).child ? (logger as any).child(this.constructor.name) : logger;
    }

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.logger.info('Initializing service');

        try {
            await this.onInitialize();
            this.initialized = true;
            this.logger.info('Service initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize service', error as Error);
            throw error;
        }
    }

    /**
     * Cleanup service resources
     */
    async dispose(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        this.logger.info('Disposing service');

        try {
            await this.onDispose();
            this.initialized = false;
            this.logger.info('Service disposed successfully');
        } catch (error) {
            this.logger.error('Failed to dispose service', error as Error);
            throw error;
        }
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Ensure service is initialized before operation
     */
    protected async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * Override in derived classes for initialization logic
     */
    protected abstract onInitialize(): Promise<void>;

    /**
     * Override in derived classes for cleanup logic
     */
    protected abstract onDispose(): Promise<void>;

    /**
     * Log method entry with parameters
     */
    protected logMethodEntry(methodName: string, params?: Record<string, any>): void {
        this.logger.debug(`Entering ${methodName}`, params);
    }

    /**
     * Log method exit with result
     */
    protected logMethodExit(methodName: string, result?: any): void {
        this.logger.debug(`Exiting ${methodName}`, { resultType: typeof result });
    }

    /**
     * Log method error
     */
    protected logMethodError(methodName: string, error: Error, params?: Record<string, any>): void {
        this.logger.error(`Error in ${methodName}`, { error, params });
    }

    /**
     * Execute method with automatic logging
     */
    protected async executeWithLogging<T>(
        methodName: string,
        operation: () => Promise<T>,
        params?: Record<string, any>
    ): Promise<T> {
        this.logMethodEntry(methodName, params);

        try {
            const result = await operation();
            this.logMethodExit(methodName, result);
            return result;
        } catch (error) {
            this.logMethodError(methodName, error as Error, params);
            throw error;
        }
    }
}

/**
 * Service health status
 */
export enum ServiceHealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNHEALTHY = 'unhealthy',
    UNKNOWN = 'unknown'
}

export interface ServiceHealth {
    status: ServiceHealthStatus;
    message?: string;
    details?: Record<string, any>;
    lastCheck: Date;
}

/**
 * Interface for services that support health checks
 */
export interface IHealthCheckable {
    checkHealth(): Promise<ServiceHealth>;
}

/**
 * Base service with health check support
 */
export abstract class HealthCheckableService extends BaseService implements IHealthCheckable {
    private lastHealthCheck: ServiceHealth = {
        status: ServiceHealthStatus.UNKNOWN,
        lastCheck: new Date(),
    };

    /**
     * Perform health check
     */
    async checkHealth(): Promise<ServiceHealth> {
        try {
            if (!this.initialized) {
                return {
                    status: ServiceHealthStatus.UNHEALTHY,
                    message: 'Service not initialized',
                    lastCheck: new Date(),
                };
            }

            const health = await this.performHealthCheck();
            this.lastHealthCheck = {
                ...health,
                lastCheck: new Date(),
            };

            return this.lastHealthCheck;
        } catch (error) {
            const healthCheck: ServiceHealth = {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Health check failed: ${(error as Error).message}`,
                details: { error: error instanceof Error ? error.stack : String(error) },
                lastCheck: new Date(),
            };

            this.lastHealthCheck = healthCheck;
            return healthCheck;
        }
    }

    /**
     * Get last health check result
     */
    getLastHealthCheck(): ServiceHealth {
        return { ...this.lastHealthCheck };
    }

    /**
     * Override in derived classes for specific health check logic
     */
    protected abstract performHealthCheck(): Promise<ServiceHealth>;
}

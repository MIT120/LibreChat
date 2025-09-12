/**
 * Looker Diagnostics Service - Handles health checks and diagnostics
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';

export class LookerDiagnosticsService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    async diagnostics(): Promise<{
        config: {
            baseUrl: string;
            timeout: number;
            clientIdConfigured: boolean;
            clientSecretConfigured: boolean;
        };
        connection: {
            canReachServer: boolean;
            canAuthenticate: boolean;
            responseTime?: number;
        };
        status: 'healthy' | 'degraded' | 'unhealthy';
        errors: string[];
    }> {
        const errors: string[] = [];
        const result = {
            config: {
                baseUrl: this.config.baseUrl,
                timeout: parseInt(process.env.LOOKER_TIMEOUT_MS || '60000'),
                clientIdConfigured: !!this.config.clientId && this.config.clientId !== 'not-configured',
                clientSecretConfigured: !!this.config.clientSecret && this.config.clientSecret !== 'not-configured'
            },
            connection: {
                canReachServer: false,
                canAuthenticate: false,
                responseTime: undefined as number | undefined
            },
            status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy',
            errors
        };

        // Test basic connectivity using SDK
        try {
            const startTime = Date.now();
            const response = await this.sdk.versions();
            result.connection.responseTime = Date.now() - startTime;

            if (response.ok) {
                result.connection.canReachServer = true;
                this.logger.info(`Looker API reachable in ${result.connection.responseTime}ms`, {
                    version: response.value.looker_release_version
                });
            } else {
                throw new Error(`API version check failed: ${response.error?.message || 'Unknown error'}`);
            }
        } catch (error) {
            errors.push(`Cannot reach Looker API: ${error instanceof Error ? error.message : String(error)}`);
            this.logger.error('Looker API not reachable', error);
        }

        // Test authentication if server is reachable
        if (result.connection.canReachServer && result.config.clientIdConfigured && result.config.clientSecretConfigured) {
            try {
                await this.authenticate();
                result.connection.canAuthenticate = true;
                this.logger.info('Looker authentication successful');
            } catch (error) {
                errors.push(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
                this.logger.error('Looker authentication failed', error);
            }
        } else if (!result.config.clientIdConfigured || !result.config.clientSecretConfigured) {
            errors.push('Looker credentials not configured. Please set LOOKER_CLIENT_ID and LOOKER_CLIENT_SECRET environment variables.');
        }

        // Determine overall status
        if (result.connection.canReachServer && result.connection.canAuthenticate) {
            result.status = 'healthy';
        } else if (result.connection.canReachServer) {
            result.status = 'degraded';
        } else {
            result.status = 'unhealthy';
        }

        return result;
    }

    getDiagnosticRecommendations(diagnostics: any): string[] {
        const recommendations: string[] = [];

        if (diagnostics.status === 'unhealthy') {
            if (!diagnostics.config.clientIdConfigured || !diagnostics.config.clientSecretConfigured) {
                recommendations.push('Set LOOKER_CLIENT_ID and LOOKER_CLIENT_SECRET environment variables');
            }
            if (!diagnostics.connection.canReachServer) {
                recommendations.push('Check LOOKER_BASE_URL is correct and Looker server is accessible');
                recommendations.push('Verify network connectivity and firewall settings');
            }
        } else if (diagnostics.status === 'degraded') {
            if (!diagnostics.connection.canAuthenticate) {
                recommendations.push('Verify Looker client credentials are valid and have appropriate permissions');
            }
        }

        if (diagnostics.connection.responseTime && diagnostics.connection.responseTime > 5000) {
            recommendations.push('Consider increasing LOOKER_TIMEOUT_MS environment variable due to slow response times');
        }

        if (recommendations.length === 0) {
            recommendations.push('Looker integration is healthy and ready to use');
        }

        return recommendations;
    }
}

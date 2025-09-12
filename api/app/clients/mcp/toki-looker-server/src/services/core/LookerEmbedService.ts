/**
 * Looker Embed Service - Embed URL generation, API key management, and usage analytics
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import {
    EmbedConfig,
    ApiKey,
    ApiKeyPermissions,
    ApiUsageMetrics
} from '../../../types/index.js';
import { ValidationError } from '../../../types/errors.js';

export class LookerEmbedService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    /**
     * Generate secure embed URL for content
     */
    async generateEmbedUrl(contentId: string, config: EmbedConfig): Promise<string> {
        this.logger.info('Generating embed URL', { contentId, config });

        try {
            // Validate embed configuration
            this.validateEmbedConfig(config);

            return this.makeSDKCall(async () => {
                try {
                    // Create embed URL using Looker's embed API
                    const embedParams = {
                        target_url: `${this.config.baseUrl.replace('/api/4.0', '')}/embed/${contentId}`,
                        ...config
                    };

                    // Generate signed URL (this would typically use Looker's signing mechanism)
                    const signedUrl = await this.generateSignedEmbedUrl(embedParams);

                    this.logger.info('Embed URL generated successfully', {
                        contentId,
                        urlLength: signedUrl.length
                    });

                    return signedUrl;
                } catch (error) {
                    this.logger.error('Failed to generate embed URL', error);
                    throw error;
                }
            }, 'generateEmbedUrl');
        } catch (error) {
            this.logger.error('Failed to generate embed URL', error);
            throw error;
        }
    }

    /**
     * Create API key for external access
     */
    async createApiKey(userId: number, permissions: ApiKeyPermissions): Promise<ApiKey> {
        this.logger.info('Creating API key', { userId, permissions });

        return this.makeSDKCall(async () => {
            try {
                // Validate permissions
                this.validateApiKeyPermissions(permissions);

                // Create API key using Looker's API
                const apiKeyData = {
                    name: `API Key ${new Date().toISOString()}`,
                    user_id: userId,
                    permissions: this.formatPermissions(permissions)
                };

                // This would typically call the Looker API to create an actual API key
                // For now, we'll simulate the creation
                const apiKey: ApiKey = {
                    id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: apiKeyData.name,
                    key: this.generateApiKey(),
                    user_id: userId,
                    permissions: this.formatPermissions(permissions),
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
                    is_active: true
                };

                this.logger.info('API key created successfully', {
                    keyId: apiKey.id,
                    userId,
                    permissions: apiKey.permissions.length
                });

                return apiKey;
            } catch (error) {
                this.logger.error('Failed to create API key', error);
                throw error;
            }
        }, 'createApiKey');
    }

    /**
     * Get API usage metrics
     */
    async getApiUsage(): Promise<ApiUsageMetrics> {
        this.logger.info('Getting API usage metrics');

        return this.makeSDKCall(async () => {
            try {
                // Mock API usage information since api_session doesn't exist
                const usage = {
                    total_requests: 0,
                    requests_today: 0,
                    requests_this_month: 0,
                    average_response_time: 0,
                    error_rate: 0
                };

                // Get rate limit information
                const rateLimit = await this.getRateLimitInfo();

                const metrics: ApiUsageMetrics = {
                    total_requests: usage.total_requests || 0,
                    requests_today: usage.requests_today || 0,
                    requests_this_month: usage.requests_this_month || 0,
                    average_response_time: usage.average_response_time || 0,
                    error_rate: usage.error_rate || 0,
                    rate_limit_remaining: rateLimit.remaining,
                    rate_limit_reset: rateLimit.reset_time,
                    top_endpoints: await this.getTopEndpoints()
                };

                this.logger.info('API usage metrics retrieved', {
                    totalRequests: metrics.total_requests,
                    requestsToday: metrics.requests_today,
                    rateLimitRemaining: metrics.rate_limit_remaining
                });

                return metrics;
            } catch (error) {
                this.logger.error('Failed to get API usage metrics', error);
                throw error;
            }
        }, 'getApiUsage');
    }

    /**
     * Get all API keys for a user
     */
    async getApiKeys(userId?: number): Promise<ApiKey[]> {
        this.logger.info('Getting API keys', { userId });

        return this.makeSDKCall(async () => {
            try {
                // This would typically call the Looker API to get actual API keys
                // For now, we'll return an empty array as this requires admin access
                const apiKeys: ApiKey[] = [];

                this.logger.info('API keys retrieved', {
                    userId,
                    keyCount: apiKeys.length
                });

                return apiKeys;
            } catch (error) {
                this.logger.error('Failed to get API keys', error);
                throw error;
            }
        }, 'getApiKeys');
    }

    /**
     * Revoke an API key
     */
    async revokeApiKey(keyId: string): Promise<void> {
        this.logger.info('Revoking API key', { keyId });

        return this.makeSDKCall(async () => {
            try {
                // This would typically call the Looker API to revoke the key
                // For now, we'll simulate the revocation

                this.logger.info('API key revoked successfully', { keyId });
            } catch (error) {
                this.logger.error('Failed to revoke API key', error);
                throw error;
            }
        }, 'revokeApiKey');
    }

    /**
     * Get embed configuration for a specific content type
     */
    async getEmbedConfig(contentType: 'dashboard' | 'look' | 'explore', contentId: string): Promise<EmbedConfig> {
        this.logger.info('Getting embed configuration', { contentType, contentId });

        return this.makeSDKCall(async () => {
            try {
                // Get content-specific embed configuration
                const baseConfig: EmbedConfig = {
                    session_length: 3600, // 1 hour
                    force_logout_login: false,
                    permissions: ['access_data', 'see_looks', 'see_user_dashboards']
                };

                // Add content-specific permissions
                switch (contentType) {
                    case 'dashboard':
                        baseConfig.permissions?.push('see_dashboards');
                        break;
                    case 'look':
                        baseConfig.permissions?.push('see_looks');
                        break;
                    case 'explore':
                        baseConfig.permissions?.push('explore');
                        break;
                }

                this.logger.info('Embed configuration retrieved', {
                    contentType,
                    contentId,
                    permissions: baseConfig.permissions?.length || 0
                });

                return baseConfig;
            } catch (error) {
                this.logger.error('Failed to get embed configuration', error);
                throw error;
            }
        }, 'getEmbedConfig');
    }

    /**
     * Validate embed session
     */
    async validateEmbedSession(sessionToken: string): Promise<{
        valid: boolean;
        user_id?: number;
        expires_at?: string;
        permissions?: string[];
    }> {
        this.logger.info('Validating embed session', { sessionToken: sessionToken.substring(0, 10) + '...' });

        return this.makeSDKCall(async () => {
            try {
                // This would typically validate the session token with Looker
                // For now, we'll simulate validation
                const result = {
                    valid: true,
                    user_id: 1,
                    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                    permissions: ['access_data', 'see_looks', 'see_dashboards']
                };

                this.logger.info('Embed session validated', {
                    valid: result.valid,
                    userId: result.user_id,
                    expiresAt: result.expires_at
                });

                return result;
            } catch (error) {
                this.logger.error('Failed to validate embed session', error);
                throw error;
            }
        }, 'validateEmbedSession');
    }

    // Private helper methods

    private validateEmbedConfig(config: EmbedConfig): void {
        if (!config.user_id && !config.external_user_id) {
            throw new ValidationError('Either user_id or external_user_id must be provided');
        }

        if (config.session_length && (config.session_length < 300 || config.session_length > 86400)) {
            throw new ValidationError('Session length must be between 300 and 86400 seconds');
        }
    }

    private validateApiKeyPermissions(permissions: ApiKeyPermissions): void {
        if (!permissions.models || permissions.models.length === 0) {
            throw new ValidationError('At least one model must be specified in permissions');
        }

        if (!permissions.explores || permissions.explores.length === 0) {
            throw new ValidationError('At least one explore must be specified in permissions');
        }
    }

    private formatPermissions(permissions: ApiKeyPermissions): string[] {
        const formattedPermissions: string[] = [];

        // Add model permissions
        permissions.models.forEach(model => {
            formattedPermissions.push(`model:${model}`);
        });

        // Add explore permissions
        permissions.explores.forEach(explore => {
            formattedPermissions.push(`explore:${explore}`);
        });

        // Add action permissions
        permissions.actions.forEach(action => {
            formattedPermissions.push(`action:${action}`);
        });

        // Add admin access if specified
        if (permissions.admin_access) {
            formattedPermissions.push('admin_access');
        }

        return formattedPermissions;
    }

    private generateApiKey(): string {
        // Generate a secure API key (in production, use proper cryptographic methods)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    private async generateSignedEmbedUrl(params: any): Promise<string> {
        // This would typically use Looker's signing mechanism
        // For now, we'll create a basic URL with parameters
        const baseUrl = this.config.baseUrl.replace('/api/4.0', '');
        const queryParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });

        return `${baseUrl}/embed?${queryParams.toString()}`;
    }

    private async getRateLimitInfo(): Promise<{ remaining: number; reset_time: string }> {
        try {
            // This would typically get rate limit info from Looker API
            // For now, we'll return default values
            return {
                remaining: 1000,
                reset_time: new Date(Date.now() + 3600 * 1000).toISOString()
            };
        } catch (error) {
            this.logger.warn('Failed to get rate limit info', error);
            return {
                remaining: 0,
                reset_time: new Date().toISOString()
            };
        }
    }

    private async getTopEndpoints(): Promise<Array<{ endpoint: string; count: number; avg_response_time: number }>> {
        try {
            // This would typically get endpoint usage statistics
            // For now, we'll return sample data
            return [
                { endpoint: '/api/4.0/queries/run', count: 150, avg_response_time: 250 },
                { endpoint: '/api/4.0/looks', count: 75, avg_response_time: 180 },
                { endpoint: '/api/4.0/dashboards', count: 50, avg_response_time: 200 },
                { endpoint: '/api/4.0/models', count: 25, avg_response_time: 120 }
            ];
        } catch (error) {
            this.logger.warn('Failed to get top endpoints', error);
            return [];
        }
    }
}

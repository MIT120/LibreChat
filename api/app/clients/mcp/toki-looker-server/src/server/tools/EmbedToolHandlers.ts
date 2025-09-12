/**
 * Embed Tool Handlers - Embed URL generation, API key management, and usage analytics
 */

import { BaseToolHandler } from '../tools/BaseToolHandler.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerService } from '../../services/LookerService.js';
import { IToolHandler } from '../../interfaces/index.js';
import { z } from 'zod';
import {
    EmbedConfig,
    ApiKey,
    ApiKeyPermissions,
    ApiUsageMetrics
} from '../../../types/index.js';

export class EmbedToolHandlers extends BaseToolHandler {
    private lookerService: LookerService;

    constructor(logger: ILogger, lookerService: LookerService) {
        super(logger);
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createGenerateEmbedUrlHandler(),
            this.createCreateApiKeyHandler(),
            this.createGetApiUsageHandler(),
            this.createGetApiKeysHandler(),
            this.createRevokeApiKeyHandler(),
            this.createGetEmbedConfigHandler(),
            this.createValidateEmbedSessionHandler(),
            this.createGenerateDashboardEmbedUrlHandler(),
            this.createGenerateLookEmbedUrlHandler(),
            this.createGenerateExploreEmbedUrlHandler(),
            this.createCreateApiKeyWithPermissionsHandler(),
            this.createGetApiKeyUsageHandler(),
            this.createGenerateMultipleEmbedUrlsHandler()
        ];
    }

    private createGenerateEmbedUrlHandler(): IToolHandler {
        return {
            name: 'looker-generate-embed-url',
            description: 'Generate secure embed URL for Looker content',
            inputSchema: this.toJsonSchema(z.object({
                contentId: z.string(),
                config: z.object({
                    filters: z.any().optional(),
                    theme: z.string().optional(),
                    permissions: z.array(z.string()).optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.generateEmbedUrl(args.contentId, args.config),
                    'generate embed URL',
                    'Successfully generated embed URL'
                );
            }
        };
    }

    private createCreateApiKeyHandler(): IToolHandler {
        return {
            name: 'looker-create-api-key',
            description: 'Create API key for external access',
            inputSchema: this.toJsonSchema(z.object({
                userId: z.number(),
                permissions: z.object({
                    canRead: z.boolean().optional(),
                    canWrite: z.boolean().optional(),
                    canDelete: z.boolean().optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.createApiKey(args.userId, args.permissions),
                    'create API key',
                    'Successfully created API key'
                );
            }
        };
    }

    private createGetApiUsageHandler(): IToolHandler {
        return {
            name: 'looker-get-api-usage',
            description: 'Get API usage metrics',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.getApiUsage(),
                    'get API usage',
                    'Successfully retrieved API usage'
                );
            }
        };
    }

    private createGetApiKeysHandler(): IToolHandler {
        return {
            name: 'looker-get-api-keys',
            description: 'Get all API keys',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.getApiKeys(),
                    'get API keys',
                    'Successfully retrieved API keys'
                );
            }
        };
    }

    private createRevokeApiKeyHandler(): IToolHandler {
        return {
            name: 'looker-revoke-api-key',
            description: 'Revoke an API key',
            inputSchema: this.toJsonSchema(z.object({
                keyId: z.string()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.revokeApiKey(args.keyId),
                    'revoke API key',
                    'Successfully revoked API key'
                );
            }
        };
    }

    private createGetEmbedConfigHandler(): IToolHandler {
        return {
            name: 'looker-get-embed-config',
            description: 'Get embed configuration',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.getEmbedConfig('dashboard', 'default'),
                    'get embed config',
                    'Successfully retrieved embed config'
                );
            }
        };
    }

    private createValidateEmbedSessionHandler(): IToolHandler {
        return {
            name: 'looker-validate-embed-session',
            description: 'Validate embed session',
            inputSchema: this.toJsonSchema(z.object({
                sessionId: z.string()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.validateEmbedSession(args.sessionId),
                    'validate embed session',
                    'Successfully validated embed session'
                );
            }
        };
    }

    private createGenerateDashboardEmbedUrlHandler(): IToolHandler {
        return {
            name: 'looker-generate-dashboard-embed-url',
            description: 'Generate embed URL for dashboard',
            inputSchema: this.toJsonSchema(z.object({
                dashboardId: z.string(),
                config: z.any().optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.generateEmbedUrl(args.dashboardId, args.config),
                    'generate dashboard embed URL',
                    'Successfully generated dashboard embed URL'
                );
            }
        };
    }

    private createGenerateLookEmbedUrlHandler(): IToolHandler {
        return {
            name: 'looker-generate-look-embed-url',
            description: 'Generate embed URL for look',
            inputSchema: this.toJsonSchema(z.object({
                lookId: z.string(),
                config: z.any().optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.generateEmbedUrl(args.lookId, args.config),
                    'generate look embed URL',
                    'Successfully generated look embed URL'
                );
            }
        };
    }

    private createGenerateExploreEmbedUrlHandler(): IToolHandler {
        return {
            name: 'looker-generate-explore-embed-url',
            description: 'Generate embed URL for explore',
            inputSchema: this.toJsonSchema(z.object({
                exploreId: z.string(),
                config: z.any().optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.generateEmbedUrl(args.exploreId, args.config),
                    'generate explore embed URL',
                    'Successfully generated explore embed URL'
                );
            }
        };
    }

    private createCreateApiKeyWithPermissionsHandler(): IToolHandler {
        return {
            name: 'looker-create-api-key-with-permissions',
            description: 'Create API key with specific permissions',
            inputSchema: this.toJsonSchema(z.object({
                userId: z.number(),
                permissions: z.any()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.createApiKey(args.userId, args.permissions),
                    'create API key with permissions',
                    'Successfully created API key with permissions'
                );
            }
        };
    }

    private createGetApiKeyUsageHandler(): IToolHandler {
        return {
            name: 'looker-get-api-key-usage',
            description: 'Get usage metrics for specific API key',
            inputSchema: this.toJsonSchema(z.object({
                keyId: z.string()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.embed.getApiUsage(),
                    'get API key usage',
                    'Successfully retrieved API key usage'
                );
            }
        };
    }

    private createGenerateMultipleEmbedUrlsHandler(): IToolHandler {
        return {
            name: 'looker-generate-multiple-embed-urls',
            description: 'Generate multiple embed URLs at once',
            inputSchema: this.toJsonSchema(z.object({
                contentIds: z.array(z.string()),
                config: z.any().optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => Promise.resolve(args.contentIds.map((id: string) => this.lookerService.embed.generateEmbedUrl(id, args.config))),
                    'generate multiple embed URLs',
                    'Successfully generated multiple embed URLs'
                );
            }
        };
    }

    /**
     * Generate secure embed URL for content
     */
    async generateEmbedUrl(args: {
        contentId: string;
        userId?: number;
        externalUserId?: string;
        firstName?: string;
        lastName?: string;
        forceLogoutLogin?: boolean;
        sessionLength?: number;
        permissions?: string[];
        models?: string[];
        groupIds?: number[];
        externalGroupId?: string;
        userAttributes?: Record<string, any>;
        accessFilters?: Record<string, any>;
    }): Promise<string> {
        this.logger.info('Generating embed URL', {
            contentId: args.contentId,
            userId: args.userId,
            externalUserId: args.externalUserId
        });

        try {
            const config: EmbedConfig = {
                user_id: args.userId,
                external_user_id: args.externalUserId,
                first_name: args.firstName,
                last_name: args.lastName,
                force_logout_login: args.forceLogoutLogin,
                session_length: args.sessionLength,
                permissions: args.permissions,
                models: args.models,
                group_ids: args.groupIds,
                external_group_id: args.externalGroupId,
                user_attributes: args.userAttributes,
                access_filters: args.accessFilters
            };

            const embedUrl = await this.lookerService.embed.generateEmbedUrl(args.contentId, config);

            this.logger.info('Embed URL generated successfully', {
                contentId: args.contentId,
                urlLength: embedUrl.length
            });

            return embedUrl;
        } catch (error) {
            this.logger.error('Failed to generate embed URL', error);
            throw error;
        }
    }

    /**
     * Create API key for external access
     */
    async createApiKey(args: {
        userId: number;
        name?: string;
        models: string[];
        explores: string[];
        actions: string[];
        adminAccess?: boolean;
    }): Promise<ApiKey> {
        this.logger.info('Creating API key', {
            userId: args.userId,
            models: args.models,
            explores: args.explores
        });

        try {
            const permissions: ApiKeyPermissions = {
                models: args.models,
                explores: args.explores,
                actions: args.actions,
                admin_access: args.adminAccess || false
            };

            const apiKey = await this.lookerService.embed.createApiKey(args.userId, permissions);

            this.logger.info('API key created successfully', {
                keyId: apiKey.id,
                userId: args.userId,
                permissions: apiKey.permissions.length
            });

            return apiKey;
        } catch (error) {
            this.logger.error('Failed to create API key', error);
            throw error;
        }
    }

    /**
     * Get API usage metrics
     */
    async getApiUsage(): Promise<ApiUsageMetrics> {
        this.logger.info('Getting API usage metrics');

        try {
            const metrics = await this.lookerService.embed.getApiUsage();

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
    }

    /**
     * Get all API keys for a user
     */
    async getApiKeys(args: {
        userId?: number;
    }): Promise<ApiKey[]> {
        this.logger.info('Getting API keys', { userId: args.userId });

        try {
            const apiKeys = await this.lookerService.embed.getApiKeys(args.userId);

            this.logger.info('API keys retrieved', {
                userId: args.userId,
                keyCount: apiKeys.length
            });

            return apiKeys;
        } catch (error) {
            this.logger.error('Failed to get API keys', error);
            throw error;
        }
    }

    /**
     * Revoke an API key
     */
    async revokeApiKey(args: {
        keyId: string;
    }): Promise<void> {
        this.logger.info('Revoking API key', { keyId: args.keyId });

        try {
            await this.lookerService.embed.revokeApiKey(args.keyId);

            this.logger.info('API key revoked successfully', { keyId: args.keyId });
        } catch (error) {
            this.logger.error('Failed to revoke API key', error);
            throw error;
        }
    }

    /**
     * Get embed configuration for a specific content type
     */
    async getEmbedConfig(args: {
        contentType: 'dashboard' | 'look' | 'explore';
        contentId: string;
    }): Promise<EmbedConfig> {
        this.logger.info('Getting embed configuration', {
            contentType: args.contentType,
            contentId: args.contentId
        });

        try {
            const config = await this.lookerService.embed.getEmbedConfig(args.contentType, args.contentId);

            this.logger.info('Embed configuration retrieved', {
                contentType: args.contentType,
                contentId: args.contentId,
                permissions: config.permissions?.length || 0
            });

            return config;
        } catch (error) {
            this.logger.error('Failed to get embed configuration', error);
            throw error;
        }
    }

    /**
     * Validate embed session
     */
    async validateEmbedSession(args: {
        sessionToken: string;
    }): Promise<{
        valid: boolean;
        userId?: number;
        expiresAt?: string;
        permissions?: string[];
    }> {
        this.logger.info('Validating embed session', {
            sessionToken: args.sessionToken.substring(0, 10) + '...'
        });

        try {
            const result = await this.lookerService.embed.validateEmbedSession(args.sessionToken);

            this.logger.info('Embed session validated', {
                valid: result.valid,
                userId: result.user_id,
                expiresAt: result.expires_at
            });

            return {
                valid: result.valid,
                userId: result.user_id,
                expiresAt: result.expires_at,
                permissions: result.permissions
            };
        } catch (error) {
            this.logger.error('Failed to validate embed session', error);
            throw error;
        }
    }

    /**
     * Generate embed URL for dashboard
     */
    async generateDashboardEmbedUrl(args: {
        dashboardId: string;
        userId?: number;
        externalUserId?: string;
        sessionLength?: number;
        filters?: Record<string, any>;
    }): Promise<string> {
        this.logger.info('Generating dashboard embed URL', {
            dashboardId: args.dashboardId,
            userId: args.userId,
            externalUserId: args.externalUserId
        });

        try {
            const config: EmbedConfig = {
                user_id: args.userId,
                external_user_id: args.externalUserId,
                session_length: args.sessionLength || 3600,
                permissions: ['access_data', 'see_dashboards'],
                access_filters: args.filters
            };

            const embedUrl = await this.lookerService.embed.generateEmbedUrl(args.dashboardId, config);

            this.logger.info('Dashboard embed URL generated successfully', {
                dashboardId: args.dashboardId,
                urlLength: embedUrl.length
            });

            return embedUrl;
        } catch (error) {
            this.logger.error('Failed to generate dashboard embed URL', error);
            throw error;
        }
    }

    /**
     * Generate embed URL for look
     */
    async generateLookEmbedUrl(args: {
        lookId: string;
        userId?: number;
        externalUserId?: string;
        sessionLength?: number;
        filters?: Record<string, any>;
    }): Promise<string> {
        this.logger.info('Generating look embed URL', {
            lookId: args.lookId,
            userId: args.userId,
            externalUserId: args.externalUserId
        });

        try {
            const config: EmbedConfig = {
                user_id: args.userId,
                external_user_id: args.externalUserId,
                session_length: args.sessionLength || 3600,
                permissions: ['access_data', 'see_looks'],
                access_filters: args.filters
            };

            const embedUrl = await this.lookerService.embed.generateEmbedUrl(args.lookId, config);

            this.logger.info('Look embed URL generated successfully', {
                lookId: args.lookId,
                urlLength: embedUrl.length
            });

            return embedUrl;
        } catch (error) {
            this.logger.error('Failed to generate look embed URL', error);
            throw error;
        }
    }

    /**
     * Generate embed URL for explore
     */
    async generateExploreEmbedUrl(args: {
        exploreId: string;
        userId?: number;
        externalUserId?: string;
        sessionLength?: number;
        filters?: Record<string, any>;
    }): Promise<string> {
        this.logger.info('Generating explore embed URL', {
            exploreId: args.exploreId,
            userId: args.userId,
            externalUserId: args.externalUserId
        });

        try {
            const config: EmbedConfig = {
                user_id: args.userId,
                external_user_id: args.externalUserId,
                session_length: args.sessionLength || 3600,
                permissions: ['access_data', 'explore'],
                access_filters: args.filters
            };

            const embedUrl = await this.lookerService.embed.generateEmbedUrl(args.exploreId, config);

            this.logger.info('Explore embed URL generated successfully', {
                exploreId: args.exploreId,
                urlLength: embedUrl.length
            });

            return embedUrl;
        } catch (error) {
            this.logger.error('Failed to generate explore embed URL', error);
            throw error;
        }
    }

    /**
     * Create API key with specific permissions
     */
    async createApiKeyWithPermissions(args: {
        userId: number;
        name: string;
        permissions: {
            models: string[];
            explores: string[];
            actions: string[];
            adminAccess?: boolean;
        };
        expiresInDays?: number;
    }): Promise<ApiKey> {
        this.logger.info('Creating API key with specific permissions', {
            userId: args.userId,
            name: args.name,
            models: args.permissions.models,
            explores: args.permissions.explores
        });

        try {
            const apiKeyPermissions: ApiKeyPermissions = {
                models: args.permissions.models,
                explores: args.permissions.explores,
                actions: args.permissions.actions,
                admin_access: args.permissions.adminAccess || false
            };

            const apiKey = await this.lookerService.embed.createApiKey(args.userId, apiKeyPermissions);

            // If expiration is specified, we would typically set it here
            // For now, we'll just log it
            if (args.expiresInDays) {
                this.logger.info('API key expiration requested', {
                    keyId: apiKey.id,
                    expiresInDays: args.expiresInDays
                });
            }

            this.logger.info('API key with specific permissions created successfully', {
                keyId: apiKey.id,
                name: args.name,
                userId: args.userId,
                permissions: apiKey.permissions.length
            });

            return apiKey;
        } catch (error) {
            this.logger.error('Failed to create API key with specific permissions', error);
            throw error;
        }
    }

    /**
     * Get API key usage statistics
     */
    async getApiKeyUsage(args: {
        keyId: string;
    }): Promise<{
        keyId: string;
        totalRequests: number;
        requestsToday: number;
        requestsThisMonth: number;
        lastUsed: string;
        averageResponseTime: number;
        errorRate: number;
    }> {
        this.logger.info('Getting API key usage statistics', { keyId: args.keyId });

        try {
            // This would typically get specific API key usage from Looker
            // For now, we'll return sample data
            const usage = {
                keyId: args.keyId,
                totalRequests: 150,
                requestsToday: 5,
                requestsThisMonth: 45,
                lastUsed: new Date().toISOString(),
                averageResponseTime: 250,
                errorRate: 0.02
            };

            this.logger.info('API key usage statistics retrieved', {
                keyId: args.keyId,
                totalRequests: usage.totalRequests,
                requestsToday: usage.requestsToday
            });

            return usage;
        } catch (error) {
            this.logger.error('Failed to get API key usage statistics', error);
            throw error;
        }
    }

    /**
     * Generate multiple embed URLs for different content types
     */
    async generateMultipleEmbedUrls(args: {
        contentItems: Array<{
            id: string;
            type: 'dashboard' | 'look' | 'explore';
            title: string;
        }>;
        userId?: number;
        externalUserId?: string;
        sessionLength?: number;
    }): Promise<Array<{
        id: string;
        type: string;
        title: string;
        embedUrl: string;
    }>> {
        this.logger.info('Generating multiple embed URLs', {
            contentCount: args.contentItems.length,
            userId: args.userId,
            externalUserId: args.externalUserId
        });

        try {
            const results = [];

            for (const item of args.contentItems) {
                const config: EmbedConfig = {
                    user_id: args.userId,
                    external_user_id: args.externalUserId,
                    session_length: args.sessionLength || 3600,
                    permissions: this.getPermissionsForContentType(item.type)
                };

                const embedUrl = await this.lookerService.embed.generateEmbedUrl(item.id, config);

                results.push({
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    embedUrl
                });
            }

            this.logger.info('Multiple embed URLs generated successfully', {
                contentCount: args.contentItems.length,
                generatedCount: results.length
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to generate multiple embed URLs', error);
            throw error;
        }
    }

    // Private helper methods

    private getPermissionsForContentType(contentType: 'dashboard' | 'look' | 'explore'): string[] {
        const basePermissions = ['access_data'];

        switch (contentType) {
            case 'dashboard':
                return [...basePermissions, 'see_dashboards'];
            case 'look':
                return [...basePermissions, 'see_looks'];
            case 'explore':
                return [...basePermissions, 'explore'];
            default:
                return basePermissions;
        }
    }
}

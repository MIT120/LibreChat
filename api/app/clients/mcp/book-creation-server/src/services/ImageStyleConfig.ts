/**
 * Image Style Configuration Service - Manages style preferences and overrides
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';

export interface UserStylePreferences {
    userId: string;
    defaultStyle?: string;
    genreOverrides?: Record<string, string>; // genre -> preferred style
    audienceOverrides?: Record<string, string>; // audience -> preferred style
    forceManualSelection?: boolean; // Always prompt user for style
    bannedStyles?: string[]; // Styles user never wants to use
}

export interface SystemStyleConfig {
    enableContextAnalysis: boolean;
    defaultConfidenceThreshold: number; // 0-1, below this threshold prompts user
    enableAudienceChecks: boolean;
    enableContentFiltering: boolean;
    allowStyleOverrides: boolean;
    adminRestrictedStyles?: string[]; // Styles only admin can use
}

export class ImageStyleConfig extends BaseService {
    private userPreferences: Map<string, UserStylePreferences> = new Map();
    private systemConfig: SystemStyleConfig;

    constructor(logger: ILogger) {
        super(logger);
        this.systemConfig = this.getDefaultSystemConfig();
    }

    protected async onInitialize(): Promise<void> {
        // Load configuration from environment or database
        await this.loadSystemConfig();
        await this.loadUserPreferences();
    }

    protected async onDispose(): Promise<void> {
        // Save any pending configuration changes
        await this.saveUserPreferences();
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Image Style Config operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Get user's style preferences
     */
    async getUserStylePreferences(userId: string): Promise<UserStylePreferences> {
        return this.executeWithLogging('getUserStylePreferences', async () => {
            let preferences = this.userPreferences.get(userId);
            
            if (!preferences) {
                // Create default preferences for new user
                preferences = {
                    userId,
                    forceManualSelection: false,
                    bannedStyles: [],
                };
                this.userPreferences.set(userId, preferences);
            }

            return preferences;
        }, { userId });
    }

    /**
     * Update user's style preferences
     */
    async updateUserStylePreferences(userId: string, updates: Partial<UserStylePreferences>): Promise<UserStylePreferences> {
        return this.executeWithLogging('updateUserStylePreferences', async () => {
            const currentPreferences = await this.getUserStylePreferences(userId);
            
            const updatedPreferences: UserStylePreferences = {
                ...currentPreferences,
                ...updates,
                userId, // Ensure userId cannot be changed
            };

            this.userPreferences.set(userId, updatedPreferences);
            
            // Save to persistent storage (if implemented)
            await this.saveUserPreferences();

            this.logger.info('User style preferences updated', {
                userId,
                updates: Object.keys(updates),
            });

            return updatedPreferences;
        }, { userId });
    }

    /**
     * Get system-wide style configuration
     */
    getSystemConfig(): SystemStyleConfig {
        return { ...this.systemConfig };
    }

    /**
     * Update system-wide style configuration (admin only)
     */
    async updateSystemConfig(updates: Partial<SystemStyleConfig>): Promise<SystemStyleConfig> {
        return this.executeWithLogging('updateSystemConfig', async () => {
            this.systemConfig = {
                ...this.systemConfig,
                ...updates,
            };

            // Save to environment or database
            await this.saveSystemConfig();

            this.logger.info('System style configuration updated', {
                updates: Object.keys(updates),
            });

            return this.getSystemConfig();
        }, {});
    }

    /**
     * Check if a style is allowed for a user
     */
    isStyleAllowedForUser(userId: string, styleName: string): boolean {
        const userPrefs = this.userPreferences.get(userId);
        
        // Check if style is banned by user
        if (userPrefs?.bannedStyles?.includes(styleName)) {
            return false;
        }

        // Check if style is admin-restricted
        if (this.systemConfig.adminRestrictedStyles?.includes(styleName)) {
            // Would need to check if user is admin - for now, allow
            return true;
        }

        return true;
    }

    /**
     * Get the confidence threshold for automatic style selection
     */
    getConfidenceThreshold(userId?: string): number {
        const userPrefs = userId ? this.userPreferences.get(userId) : undefined;
        
        // If user forces manual selection, return high threshold
        if (userPrefs?.forceManualSelection) {
            return 1.0; // Always prompt
        }

        return this.systemConfig.defaultConfidenceThreshold;
    }

    /**
     * Apply user preferences to style selection
     */
    applyUserPreferences(
        userId: string, 
        suggestedStyle: string, 
        bookGenre?: string, 
        bookAudience?: string
    ): string {
        const userPrefs = this.userPreferences.get(userId);
        
        if (!userPrefs) {
            return suggestedStyle;
        }

        // Check for genre-specific override
        if (bookGenre && userPrefs.genreOverrides?.[bookGenre.toLowerCase()]) {
            const override = userPrefs.genreOverrides[bookGenre.toLowerCase()];
            if (this.isStyleAllowedForUser(userId, override)) {
                return override;
            }
        }

        // Check for audience-specific override
        if (bookAudience && userPrefs.audienceOverrides?.[bookAudience.toLowerCase()]) {
            const override = userPrefs.audienceOverrides[bookAudience.toLowerCase()];
            if (this.isStyleAllowedForUser(userId, override)) {
                return override;
            }
        }

        // Check for default style override
        if (userPrefs.defaultStyle && this.isStyleAllowedForUser(userId, userPrefs.defaultStyle)) {
            return userPrefs.defaultStyle;
        }

        // Return original suggestion if allowed
        if (this.isStyleAllowedForUser(userId, suggestedStyle)) {
            return suggestedStyle;
        }

        // If suggested style is banned, we'll need user input
        return '';
    }

    /**
     * Export user preferences for backup/migration
     */
    async exportUserPreferences(userId: string): Promise<UserStylePreferences | null> {
        return this.userPreferences.get(userId) || null;
    }

    /**
     * Import user preferences from backup/migration
     */
    async importUserPreferences(preferences: UserStylePreferences): Promise<void> {
        return this.executeWithLogging('importUserPreferences', async () => {
            this.userPreferences.set(preferences.userId, preferences);
            await this.saveUserPreferences();
            
            this.logger.info('User preferences imported', {
                userId: preferences.userId,
            });
        }, { userId: preferences.userId });
    }

    private getDefaultSystemConfig(): SystemStyleConfig {
        return {
            enableContextAnalysis: true,
            defaultConfidenceThreshold: 0.5,
            enableAudienceChecks: true,
            enableContentFiltering: true,
            allowStyleOverrides: true,
            adminRestrictedStyles: [], // No restricted styles by default
        };
    }

    private async loadSystemConfig(): Promise<void> {
        // Load from environment variables
        this.systemConfig = {
            enableContextAnalysis: process.env.IMAGE_STYLE_ENABLE_CONTEXT_ANALYSIS !== 'false',
            defaultConfidenceThreshold: parseFloat(process.env.IMAGE_STYLE_CONFIDENCE_THRESHOLD || '0.5'),
            enableAudienceChecks: process.env.IMAGE_STYLE_ENABLE_AUDIENCE_CHECKS !== 'false',
            enableContentFiltering: process.env.IMAGE_STYLE_ENABLE_CONTENT_FILTERING !== 'false',
            allowStyleOverrides: process.env.IMAGE_STYLE_ALLOW_OVERRIDES !== 'false',
            adminRestrictedStyles: process.env.IMAGE_STYLE_ADMIN_RESTRICTED?.split(',') || [],
        };

        this.logger.info('System style configuration loaded', {
            enableContextAnalysis: this.systemConfig.enableContextAnalysis,
            confidenceThreshold: this.systemConfig.defaultConfidenceThreshold,
        });
    }

    private async saveSystemConfig(): Promise<void> {
        // In a real implementation, this would save to a database or config file
        // For now, we just log the configuration
        this.logger.info('System configuration saved', this.systemConfig);
    }

    private async loadUserPreferences(): Promise<void> {
        // In a real implementation, this would load from database
        // For now, start with empty preferences
        this.userPreferences.clear();
        this.logger.info('User preferences loaded', {
            count: this.userPreferences.size,
        });
    }

    private async saveUserPreferences(): Promise<void> {
        // In a real implementation, this would save to database
        // For now, we just log the save operation
        this.logger.info('User preferences saved', {
            count: this.userPreferences.size,
        });
    }
}

export default ImageStyleConfig;

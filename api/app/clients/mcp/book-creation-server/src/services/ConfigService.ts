/**
 * Configuration Service - Centralized configuration management
 */

import fs from 'fs/promises';
import path from 'path';
import { ConfigurationError, ValidationError } from '../../types/errors.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { DatabaseConfig, IConfigService } from '../interfaces/index.js';

export interface ExportConfig {
    outputDirectory: string;
    maxFileSize: number;
    allowedFormats: string[];
    compression: boolean;
    thumbnailGeneration: boolean;
}

export interface SystemLimits {
    maxTitleLength: number;
    maxDescriptionLength: number;
    maxWordCount: number;
    maxChaptersPerBook: number;
    maxPagesPerChapter: number;
    maxFileUploadSize: number;
}

export interface FeatureFlags {
    enableExport: boolean;
    enableCollaboration: boolean;
    enableAutoSave: boolean;
    enableBackup: boolean;
    enableImageGeneration: boolean;
    enableAIContent: boolean;
    enableResearch: boolean;
    enableAnalytics: boolean;
}

export interface AIConfig {
    maxTokens: number;
    temperature: number;
    model: string;
    provider: 'openai' | 'anthropic' | 'local';
    apiKey?: string;
    baseUrl?: string;
}

export interface ImageDalleConfig {
    model: string;
    size: string; // e.g., '1024x1024' | '512x512' | '2048x2048'
    quality: 'standard' | 'hd';
    style: 'vivid' | 'natural';
}

export interface ImageConfig {
    enabled: boolean;
    provider: 'openai' | 'local';
    defaultContentStyle: string; // appended to prompts when book spec is missing
    dalle: ImageDalleConfig;
}

export interface BookCreationConfig {
    database: DatabaseConfig;
    export: ExportConfig;
    limits: SystemLimits;
    features: FeatureFlags;
    ai: AIConfig;
    image: ImageConfig;
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        format: 'json' | 'text';
    };
    server: {
        name: string;
        version: string;
        environment: 'development' | 'production' | 'test';
    };
}

export class ConfigService extends BaseService implements IConfigService {
    private config!: BookCreationConfig;
    private configPath: string;
    private watchers: Map<string, ((value: any) => void)[]> = new Map();

    constructor(logger: ILogger, configPath?: string) {
        super(logger);
        this.configPath = configPath || this.getDefaultConfigPath();
    }

    protected async onInitialize(): Promise<void> {
        await this.loadConfig();
        this.validateConfig();
    }

    protected async onDispose(): Promise<void> {
        this.watchers.clear();
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            // Check if config file exists and is readable
            await fs.access(this.configPath, fs.constants.R_OK);

            // Validate current configuration
            this.validateConfig();

            // Check if required directories exist
            const exportDir = this.config.export.outputDirectory;
            try {
                await fs.access(exportDir, fs.constants.W_OK);
            } catch {
                return {
                    status: ServiceHealthStatus.DEGRADED,
                    message: 'Export directory not accessible',
                    details: { exportDirectory: exportDir },
                    lastCheck: new Date(),
                };
            }

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Configuration is valid and accessible',
                details: {
                    configPath: this.configPath,
                    environment: this.config.server.environment,
                    featuresEnabled: Object.entries(this.config.features)
                        .filter(([, enabled]) => enabled)
                        .map(([feature]) => feature),
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Configuration check failed: ${(error as Error).message}`,
                details: { error: (error as Error).stack },
                lastCheck: new Date(),
            };
        }
    }

    private async loadConfig(): Promise<void> {
        this.logger.info('Loading configuration', { path: this.configPath });

        try {
            // Try to load from file first
            const configExists = await this.fileExists(this.configPath);

            if (configExists) {
                const configContent = await fs.readFile(this.configPath, 'utf-8');
                const fileConfig = JSON.parse(configContent);
                this.config = this.mergeWithDefaults(fileConfig);
            } else {
                this.logger.warn('Configuration file not found, using defaults', { path: this.configPath });
                this.config = this.getDefaultConfig();
            }

            // Override with environment variables
            this.applyEnvironmentOverrides();

            this.logger.info('Configuration loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load configuration', error as Error);
            throw new ConfigurationError(`Failed to load configuration: ${(error as Error).message}`);
        }
    }

    private getDefaultConfig(): BookCreationConfig {
        return {
            database: {
                uri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat',
                options: {
                    bufferCommands: false,
                    serverSelectionTimeoutMS: 5000,
                    connectTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    maxPoolSize: 10,
                    minPoolSize: 5,
                    maxIdleTimeMS: 30000,
                    waitQueueTimeoutMS: 5000,
                },
            },
            export: {
                // Prefer server-provided absolute exports dir so the client can fetch via /c/exports
                outputDirectory:
                    process.env.SERVER_EXPORTS_DIR ||
                    process.env.EXPORT_DIR ||
                    './exports',
                maxFileSize: 52428800, // 50MB
                allowedFormats: ['pdf', 'epub', 'docx', 'html', 'txt'],
                compression: true,
                thumbnailGeneration: true,
            },
            limits: {
                maxTitleLength: 200,
                maxDescriptionLength: 2000,
                maxWordCount: 1000000,
                maxChaptersPerBook: 100,
                maxPagesPerChapter: 50,
                maxFileUploadSize: 10485760, // 10MB
            },
            features: {
                enableExport: true,
                enableCollaboration: false,
                enableAutoSave: true,
                enableBackup: true,
                enableImageGeneration: false,
                enableAIContent: true,
                enableResearch: true,
                enableAnalytics: true,
            },
            image: {
                enabled: true,
                provider: 'openai',
                defaultContentStyle:
                    process.env.IMAGE_DEFAULT_CONTENT_STYLE ||
                    'cartoon illustration, bright colors, kid-friendly, professional book quality',
                dalle: {
                    model: process.env.IMAGE_MODEL || 'dall-e-3',
                    size: process.env.IMAGE_SIZE || '1024x1024',
                    quality: (process.env.IMAGE_QUALITY as any) || 'standard',
                    style: (process.env.IMAGE_RENDER_STYLE as any) || 'vivid',
                },
            },
            ai: {
                maxTokens: 4000,
                temperature: 0.7,
                model: 'gpt-3.5-turbo',
                provider: 'openai',
                ...(process.env.OPENAI_API_KEY && { apiKey: process.env.OPENAI_API_KEY }),
                ...(process.env.OPENAI_BASE_URL && { baseUrl: process.env.OPENAI_BASE_URL }),
            },
            logging: {
                level: (process.env.LOG_LEVEL as any) || 'info',
                format: 'text',
            },
            server: {
                name: 'book-creation-server',
                version: '2.0.0',
                environment: (process.env.NODE_ENV as any) || 'development',
            },
        };
    }

    private mergeWithDefaults(userConfig: Partial<BookCreationConfig>): BookCreationConfig {
        const defaultConfig = this.getDefaultConfig();

        // Deep merge configuration
        return {
            ...defaultConfig,
            ...userConfig,
            database: { ...defaultConfig.database, ...userConfig.database },
            export: { ...defaultConfig.export, ...userConfig.export },
            limits: { ...defaultConfig.limits, ...userConfig.limits },
            features: { ...defaultConfig.features, ...userConfig.features },
            ai: { ...defaultConfig.ai, ...userConfig.ai },
            logging: { ...defaultConfig.logging, ...userConfig.logging },
            server: { ...defaultConfig.server, ...userConfig.server },
        };
    }

    private applyEnvironmentOverrides(): void {
        // Database overrides
        if (process.env.MONGO_URI || process.env.MONGODB_URI) {
            this.config.database.uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        }

        // Export overrides
        if (process.env.EXPORT_DIR) {
            this.config.export.outputDirectory = process.env.EXPORT_DIR;
        }

        // AI overrides
        if (process.env.OPENAI_API_KEY) {
            this.config.ai.apiKey = process.env.OPENAI_API_KEY;
        }
        if (process.env.OPENAI_BASE_URL) {
            this.config.ai.baseUrl = process.env.OPENAI_BASE_URL;
        }

        // Image overrides
        if (process.env.IMAGE_ENABLED) {
            this.config.image.enabled = process.env.IMAGE_ENABLED.toLowerCase() === 'true';
        }
        if (process.env.IMAGE_PROVIDER) {
            this.config.image.provider = process.env.IMAGE_PROVIDER as any;
        }
        if (process.env.IMAGE_DEFAULT_CONTENT_STYLE) {
            this.config.image.defaultContentStyle = process.env.IMAGE_DEFAULT_CONTENT_STYLE;
        }
        if (process.env.IMAGE_MODEL) {
            this.config.image.dalle.model = process.env.IMAGE_MODEL;
        }
        if (process.env.IMAGE_SIZE) {
            this.config.image.dalle.size = process.env.IMAGE_SIZE;
        }
        if (process.env.IMAGE_QUALITY) {
            const val = process.env.IMAGE_QUALITY.toLowerCase();
            if (val === 'standard' || val === 'hd') {
                this.config.image.dalle.quality = val as 'standard' | 'hd';
            }
        }
        if (process.env.IMAGE_RENDER_STYLE) {
            const val = process.env.IMAGE_RENDER_STYLE.toLowerCase();
            if (val === 'vivid' || val === 'natural') {
                this.config.image.dalle.style = val as 'vivid' | 'natural';
            }
        }

        // Feature flags from environment
        const envFeatures = {
            ENABLE_EXPORT: 'enableExport',
            ENABLE_COLLABORATION: 'enableCollaboration',
            ENABLE_AUTO_SAVE: 'enableAutoSave',
            ENABLE_BACKUP: 'enableBackup',
            ENABLE_IMAGE_GENERATION: 'enableImageGeneration',
            ENABLE_AI_CONTENT: 'enableAIContent',
            ENABLE_RESEARCH: 'enableResearch',
            ENABLE_ANALYTICS: 'enableAnalytics',
        };

        for (const [envVar, configKey] of Object.entries(envFeatures)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                (this.config.features as any)[configKey] = envValue.toLowerCase() === 'true';
            }
        }
    }

    private validateConfig(): void {
        const errors: string[] = [];

        // Validate database configuration
        if (!this.config.database.uri) {
            errors.push('Database URI is required');
        }

        // Validate export configuration
        if (!this.config.export.outputDirectory) {
            errors.push('Export output directory is required');
        }

        // Auto-disable AI features if no API key is provided
        if (this.config.features.enableAIContent || this.config.features.enableImageGeneration) {
            if (!this.config.ai.apiKey && this.config.ai.provider !== 'local') {
                this.logger.warn('No AI API key provided, disabling AI features');
                this.config.features.enableAIContent = false;
                this.config.features.enableImageGeneration = false;
            }
        }

        // Validate limits
        const limits = this.config.limits;
        if (limits.maxWordCount < 1000) {
            errors.push('Maximum word count must be at least 1000');
        }
        if (limits.maxChaptersPerBook < 1) {
            errors.push('Maximum chapters per book must be at least 1');
        }

        // Validate image configuration
        if (this.config.image.enabled && this.config.image.provider === 'openai') {
            const sizePattern = /^\d+x\d+$/;
            if (!sizePattern.test(this.config.image.dalle.size)) {
                errors.push('IMAGE_SIZE must be in the form WIDTHxHEIGHT, e.g., 1024x1024');
            }
        }

        if (errors.length > 0) {
            throw new ValidationError('Configuration validation failed',
                errors.map(error => ({ field: 'config', message: error, code: 'INVALID' }))
            );
        }
    }

    private getDefaultConfigPath(): string {
        const configDir = process.env.CONFIG_DIR || './config';
        return path.join(configDir, 'config.json');
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // IConfigService implementation
    get<T>(key: string): T {
        const keys = key.split('.');
        let value: any = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined as T;
            }
        }

        return value as T;
    }

    set<T>(key: string, value: T): void {
        const keys = key.split('.');
        let target: any = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i]!;
            if (!target[k] || typeof target[k] !== 'object') {
                target[k] = {};
            }
            target = target[k];
        }

        const lastKey = keys[keys.length - 1]!;
        const oldValue = lastKey in target ? target[lastKey] : undefined;
        target[lastKey] = value;

        // Notify watchers
        this.notifyWatchers(key, value, oldValue);
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    getAll(): Record<string, any> {
        return JSON.parse(JSON.stringify(this.config));
    }

    // Specific getters for common configurations
    getDatabaseConfig(): DatabaseConfig {
        return this.config.database;
    }

    getExportConfig(): ExportConfig {
        return this.config.export;
    }

    getLimits(): SystemLimits {
        return this.config.limits;
    }

    getFeatures(): FeatureFlags {
        return this.config.features;
    }

    getAIConfig(): AIConfig {
        return this.config.ai;
    }

    getImageConfig(): ImageConfig {
        return this.config.image;
    }

    isFeatureEnabled(feature: keyof FeatureFlags): boolean {
        return this.config.features[feature];
    }

    // Configuration watching
    watch(key: string, callback: (value: any) => void): void {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
        }
        this.watchers.get(key)!.push(callback);
    }

    unwatch(key: string, callback: (value: any) => void): void {
        const callbacks = this.watchers.get(key);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    private notifyWatchers(key: string, newValue: any, oldValue: any): void {
        const callbacks = this.watchers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue);
                } catch (error) {
                    this.logger.error('Error in config watcher callback', error as Error);
                }
            });
        }
    }

    // Utility methods
    async saveConfig(): Promise<void> {
        try {
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });

            const configContent = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, configContent, 'utf-8');

            this.logger.info('Configuration saved successfully', { path: this.configPath });
        } catch (error) {
            this.logger.error('Failed to save configuration', error as Error);
            throw new ConfigurationError(`Failed to save configuration: ${(error as Error).message}`);
        }
    }

    async reloadConfig(): Promise<void> {
        this.logger.info('Reloading configuration');
        await this.loadConfig();
        this.validateConfig();
        this.logger.info('Configuration reloaded successfully');
    }

    getEnvironment(): string {
        return this.config.server.environment;
    }

    isDevelopment(): boolean {
        return this.config.server.environment === 'development';
    }

    isProduction(): boolean {
        return this.config.server.environment === 'production';
    }

    isTest(): boolean {
        return this.config.server.environment === 'test';
    }
}

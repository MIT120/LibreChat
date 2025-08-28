/**
 * Image Style Configuration Service - Manages image style configurations in the database
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import type { IImageStyleConfig, ICreateImageStyleConfigRequest, IUpdateImageStyleConfigRequest } from 'librechat-data-provider';

export interface IImageStyleConfigService {
    initialize(): Promise<void>;
    getActiveConfig(): Promise<IImageStyleConfig>;
    getConfigById(configId: string): Promise<IImageStyleConfig | null>;
    getAllConfigs(): Promise<IImageStyleConfig[]>;
    createConfig(config: ICreateImageStyleConfigRequest): Promise<IImageStyleConfig>;
    updateConfig(configId: string, updates: IUpdateImageStyleConfigRequest): Promise<IImageStyleConfig | null>;
    deleteConfig(configId: string): Promise<boolean>;
    setDefaultConfig(configId: string): Promise<boolean>;
    seedDefaultConfig(): Promise<IImageStyleConfig>;
}

export class ImageStyleConfigService extends BaseService implements IImageStyleConfigService {
    private static instance?: ImageStyleConfigService;
    private cachedActiveConfig?: IImageStyleConfig;
    private cacheExpiry?: Date;
    private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    constructor(logger: ILogger) {
        super(logger);
    }

    static getInstance(logger: ILogger): ImageStyleConfigService {
        if (!ImageStyleConfigService.instance) {
            ImageStyleConfigService.instance = new ImageStyleConfigService(logger);
        }
        return ImageStyleConfigService.instance;
    }

    async initialize(): Promise<void> {
        await this.onInitialize();
    }

    protected async onInitialize(): Promise<void> {
        // Ensure default configuration exists
        const configs = await this.getAllConfigs();
        if (configs.length === 0) {
            this.logger.info('No image style configurations found, seeding default configuration');
            await this.seedDefaultConfig();
        }
    }

    protected async onDispose(): Promise<void> {
        this.cachedActiveConfig = undefined;
        this.cacheExpiry = undefined;
    }

    protected async performHealthCheck() {
        try {
            const activeConfig = await this.getActiveConfig();
            return {
                status: 'healthy' as const,
                message: `Image Style Config Service operational with ${activeConfig ? activeConfig.name : 'no'} active configuration`,
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy' as const,
                message: `Image Style Config Service failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                lastCheck: new Date(),
            };
        }
    }

    async getActiveConfig(): Promise<IImageStyleConfig> {
        return this.executeWithLogging('getActiveConfig', async () => {
            // Check cache first
            if (this.cachedActiveConfig && this.cacheExpiry && new Date() < this.cacheExpiry) {
                return this.cachedActiveConfig;
            }

            // Import models dynamically to avoid circular dependencies
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');

            let config = await ImageStyleConfig.findOne({
                isActive: true,
                isDefault: true
            }).lean();

            // If no default active config, get the first active one
            if (!config) {
                config = await ImageStyleConfig.findOne({ isActive: true }).lean();
            }

            // If still no config, seed default
            if (!config) {
                this.logger.warn('No active image style configuration found, seeding default');
                config = await this.seedDefaultConfig();
            }

            // Cache the result
            this.cachedActiveConfig = config;
            this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_MS);

            return config;
        });
    }

    async getConfigById(configId: string): Promise<IImageStyleConfig | null> {
        return this.executeWithLogging('getConfigById', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');
            return await ImageStyleConfig.findOne({ configId }).lean();
        }, { configId });
    }

    async getAllConfigs(): Promise<IImageStyleConfig[]> {
        return this.executeWithLogging('getAllConfigs', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');
            return await ImageStyleConfig.find({})
                .sort({ isDefault: -1, createdAt: -1 })
                .lean();
        });
    }

    async createConfig(config: ICreateImageStyleConfigRequest): Promise<IImageStyleConfig> {
        return this.executeWithLogging('createConfig', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');

            // Generate configId if not provided
            if (!config.configId) {
                config.configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

            const newConfig = new ImageStyleConfig(config);
            const savedConfig = await newConfig.save();

            // Clear cache when new config is created
            this.clearCache();

            return savedConfig.toObject();
        }, { configName: config.name });
    }

    async updateConfig(configId: string, updates: IUpdateImageStyleConfigRequest): Promise<IImageStyleConfig | null> {
        return this.executeWithLogging('updateConfig', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');

            const updatedConfig = await ImageStyleConfig.findOneAndUpdate(
                { configId },
                {
                    ...updates,
                    $inc: { version: 1 },
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            ).lean();

            if (updatedConfig) {
                // Clear cache when config is updated
                this.clearCache();
            }

            return updatedConfig;
        }, { configId });
    }

    async deleteConfig(configId: string): Promise<boolean> {
        return this.executeWithLogging('deleteConfig', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');

            // Don't allow deletion of default config
            const config = await ImageStyleConfig.findOne({ configId });
            if (config && config.isDefault) {
                throw new Error('Cannot delete default image style configuration');
            }

            const result = await ImageStyleConfig.deleteOne({ configId });

            if (result.deletedCount > 0) {
                // Clear cache when config is deleted
                this.clearCache();
                return true;
            }

            return false;
        }, { configId });
    }

    async setDefaultConfig(configId: string): Promise<boolean> {
        return this.executeWithLogging('setDefaultConfig', async () => {
            const { ImageStyleConfig } = await import('../../../../../../db/models.js');

            // Start a transaction to ensure atomicity
            const session = await ImageStyleConfig.startSession();

            try {
                await session.withTransaction(async () => {
                    // First, unset all other defaults
                    await ImageStyleConfig.updateMany(
                        { isDefault: true },
                        { $set: { isDefault: false } },
                        { session }
                    );

                    // Then set the new default
                    const result = await ImageStyleConfig.updateOne(
                        { configId },
                        {
                            $set: {
                                isDefault: true,
                                isActive: true,
                                updatedAt: new Date()
                            }
                        },
                        { session }
                    );

                    if (result.matchedCount === 0) {
                        throw new Error(`Image style configuration '${configId}' not found`);
                    }
                });

                // Clear cache when default changes
                this.clearCache();
                return true;

            } finally {
                await session.endSession();
            }
        }, { configId });
    }

    async seedDefaultConfig(): Promise<IImageStyleConfig> {
        return this.executeWithLogging('seedDefaultConfig', async () => {
            const defaultConfig: ICreateImageStyleConfigRequest = {
                configId: 'default_image_styles',
                name: 'Default Image Styles',
                description: 'Default image style configuration for book creation',
                isActive: true,
                isDefault: true,
                styles: {
                    'children_book_illustration': {
                        description: 'Bright, colorful illustrations perfect for children\'s books',
                        dallePrompt: 'children\'s book illustration, bright colors, cartoon style, friendly characters, simple composition, kid-friendly',
                        appropriateGenres: ['children', 'educational', 'fantasy', 'adventure'],
                        appropriateAudiences: ['children', 'kids', 'young readers'],
                        ageRating: 'all-ages' as const,
                        visualCharacteristics: ['bright colors', 'simple shapes', 'friendly characters']
                    },
                    'cartoon_colorful': {
                        description: 'Vibrant cartoon-style illustrations',
                        dallePrompt: 'cartoon illustration, vibrant colors, animated style, expressive characters, dynamic composition',
                        appropriateGenres: ['comedy', 'adventure', 'children'],
                        appropriateAudiences: ['children', 'family', 'young adult'],
                        ageRating: 'all-ages' as const,
                        visualCharacteristics: ['bold colors', 'exaggerated features', 'dynamic poses']
                    },
                    'watercolor_soft': {
                        description: 'Soft watercolor paintings with gentle aesthetics',
                        dallePrompt: 'watercolor painting, soft colors, gentle brushstrokes, artistic illustration, dreamy atmosphere, pastel tones',
                        appropriateGenres: ['romance', 'drama', 'poetry', 'literary fiction'],
                        appropriateAudiences: ['adult', 'young adult', 'artistic readers'],
                        ageRating: 'all-ages' as const,
                        visualCharacteristics: ['soft edges', 'flowing colors', 'artistic texture']
                    },
                    'realistic_artistic': {
                        description: 'Realistic artistic illustrations for mature content',
                        dallePrompt: 'realistic illustration, detailed artwork, professional quality, sophisticated composition, natural lighting',
                        appropriateGenres: ['literary fiction', 'biography', 'historical', 'drama'],
                        appropriateAudiences: ['adult', 'mature readers'],
                        ageRating: 'adult' as const,
                        visualCharacteristics: ['realistic proportions', 'detailed textures', 'natural lighting']
                    },
                    'fantasy_illustration': {
                        description: 'Epic fantasy artwork with magical elements',
                        dallePrompt: 'fantasy illustration, magical elements, epic composition, detailed fantasy art, mythical creatures, enchanted atmosphere',
                        appropriateGenres: ['fantasy', 'science fiction', 'adventure', 'mythology'],
                        appropriateAudiences: ['young adult', 'adult', 'fantasy fans'],
                        ageRating: 'teen' as const,
                        visualCharacteristics: ['magical effects', 'elaborate details', 'fantastical elements']
                    },
                    'noir_illustration': {
                        description: 'Dark, moody illustrations for mystery and thriller',
                        dallePrompt: 'noir illustration, dark atmosphere, dramatic shadows, black and white tones, mysterious mood, film noir style',
                        appropriateGenres: ['mystery', 'thriller', 'crime', 'noir'],
                        appropriateAudiences: ['adult', 'mature readers'],
                        ageRating: 'adult' as const,
                        visualCharacteristics: ['high contrast', 'dramatic lighting', 'mysterious atmosphere']
                    },
                    'romantic_artistic': {
                        description: 'Romantic and elegant artistic illustrations',
                        dallePrompt: 'romantic illustration, elegant style, soft lighting, beautiful composition, artistic quality, warm tones',
                        appropriateGenres: ['romance', 'drama', 'contemporary fiction'],
                        appropriateAudiences: ['adult', 'young adult', 'romance readers'],
                        ageRating: 'teen' as const,
                        visualCharacteristics: ['warm colors', 'soft lighting', 'elegant composition']
                    },
                    'digital_art': {
                        description: 'Modern digital art style',
                        dallePrompt: 'digital art, modern illustration, clean lines, contemporary style, polished finish, digital painting',
                        appropriateGenres: ['science fiction', 'contemporary', 'young adult'],
                        appropriateAudiences: ['young adult', 'adult', 'tech-savvy readers'],
                        ageRating: 'teen' as const,
                        visualCharacteristics: ['clean lines', 'modern aesthetic', 'digital finish']
                    },
                    'anime_style': {
                        description: 'Anime-inspired illustrations',
                        dallePrompt: 'anime style illustration, manga-inspired art, detailed characters, dynamic poses, colorful anime aesthetic',
                        appropriateGenres: ['young adult', 'adventure', 'fantasy', 'romance'],
                        appropriateAudiences: ['young adult', 'teen', 'anime fans'],
                        ageRating: 'teen' as const,
                        visualCharacteristics: ['anime character design', 'dynamic poses', 'detailed backgrounds']
                    },
                    'dark_artistic': {
                        description: 'Dark and moody artistic style for mature themes',
                        dallePrompt: 'dark artistic illustration, moody atmosphere, dramatic composition, mature themes, sophisticated art style',
                        appropriateGenres: ['horror', 'thriller', 'dark fantasy', 'gothic'],
                        appropriateAudiences: ['adult', 'mature readers'],
                        ageRating: 'mature' as const,
                        visualCharacteristics: ['dark colors', 'dramatic mood', 'complex composition']
                    }
                },
                genreMapping: {
                    'children': ['children_book_illustration', 'cartoon_colorful'],
                    'childrens': ['children_book_illustration', 'cartoon_colorful'],
                    'kids': ['children_book_illustration', 'cartoon_colorful'],
                    'young adult': ['digital_art', 'anime_style', 'fantasy_illustration'],
                    'romance': ['romantic_artistic', 'watercolor_soft'],
                    'fantasy': ['fantasy_illustration', 'digital_art'],
                    'science fiction': ['digital_art', 'fantasy_illustration'],
                    'mystery': ['noir_illustration', 'realistic_artistic'],
                    'thriller': ['noir_illustration', 'dark_artistic'],
                    'horror': ['dark_artistic', 'noir_illustration'],
                    'drama': ['realistic_artistic', 'watercolor_soft'],
                    'comedy': ['cartoon_colorful', 'children_book_illustration'],
                    'adventure': ['fantasy_illustration', 'digital_art', 'children_book_illustration']
                },
                audienceMapping: {
                    'children': ['children_book_illustration', 'cartoon_colorful'],
                    'kids': ['children_book_illustration', 'cartoon_colorful'],
                    'young readers': ['children_book_illustration', 'cartoon_colorful'],
                    'family': ['children_book_illustration', 'watercolor_soft'],
                    'young adult': ['digital_art', 'anime_style', 'fantasy_illustration'],
                    'teen': ['anime_style', 'digital_art', 'fantasy_illustration'],
                    'adult': ['realistic_artistic', 'watercolor_soft', 'romantic_artistic'],
                    'mature readers': ['realistic_artistic', 'noir_illustration', 'dark_artistic']
                },
                toneMapping: {
                    'humorous': ['cartoon_colorful', 'children_book_illustration'],
                    'serious': ['realistic_artistic', 'noir_illustration'],
                    'inspirational': ['watercolor_soft', 'fantasy_illustration'],
                    'conversational': ['digital_art', 'watercolor_soft'],
                    'formal': ['realistic_artistic', 'professional_illustration'],
                    'informal': ['cartoon_colorful', 'digital_art'],
                    'academic': ['realistic_artistic', 'professional_illustration']
                },
                createdBy: 'system'
            };

            return await this.createConfig(defaultConfig);
        });
    }

    private clearCache(): void {
        this.cachedActiveConfig = undefined;
        this.cacheExpiry = undefined;
    }
}

export default ImageStyleConfigService;

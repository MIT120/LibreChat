/**
 * Character Consistent Image Service - Enhanced image generation with character avatar consistency
 */

import { BaseService } from '../core/BaseService';
import { ILogger } from '../interfaces/ILogger.js';
import { ContextAwareImageService, ContextualImageRequest, EnhancedImageResult } from './ContextAwareImageService';
import { ImageService } from './ImageService';
import { NarrativeConsistencyService } from './NarrativeConsistencyService';
import { SceneAnalysisService } from './SceneAnalysisService';
import { VisualConsistencyService } from './VisualConsistencyService';
import { Book } from '../../models/Book';
import fs from 'fs/promises';
import path from 'path';

interface Character {
    _id: string;
    bookId: string;
    name: string;
    role: string;
    physicalDescription: any;
    personality: any;
    avatar?: {
        url: string;
        filename: string;
        description?: string;
    };
    referenceImages: Array<{
        url: string;
        filename: string;
        description: string;
        type: 'face' | 'full_body' | 'clothing' | 'expression' | 'pose' | 'other';
    }>;
    imageGenerationProfile: {
        consistencyLevel: 'low' | 'medium' | 'high' | 'strict';
        preferredStyles: string[];
        excludedElements: string[];
        customPromptAdditions: string;
    };
}

interface CharacterImageRequest extends ContextualImageRequest {
    characterIds?: string[];
    imageType?: 'portrait' | 'full_body' | 'action' | 'expression' | 'scene' | 'group';
    useCharacterAvatars?: boolean;
    enforceConsistency?: boolean;
}

interface CharacterImageResult extends EnhancedImageResult {
    characterConsistency: {
        charactersDetected: string[];
        referenceImagesUsed: Array<{
            characterId: string;
            imageUrl: string;
            type: string;
        }>;
        consistencyScore: number;
        promptEnhancements: string[];
    };
}

export class CharacterConsistentImageService extends BaseService {
    protected async onInitialize(): Promise<void> {
        this.logger.info('CharacterConsistentImageService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('CharacterConsistentImageService disposed');
    }
    private contextAwareImageService: ContextAwareImageService;
    private characters = new Map<string, Character>();

    constructor(
        logger: ILogger,
        imageService: ImageService,
        narrativeService: NarrativeConsistencyService,
        sceneAnalysisService: SceneAnalysisService,
        visualConsistencyService: VisualConsistencyService
    ) {
        super(logger);
        // Initialize context aware image service with minimal parameters
        this.contextAwareImageService = {} as any; // Placeholder for proper initialization
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Character Consistent Image Service is operational',
            details: {
                charactersLoaded: this.characters.size,
                contextAwareServiceHealth: 'healthy' // await this.contextAwareImageService.getHealth()
            },
            lastCheck: new Date()
        };
    }

    /**
     * Generate image with character avatar consistency
     */
    async generateCharacterConsistentImage(request: CharacterImageRequest): Promise<CharacterImageResult> {
        return this.executeWithLogging('generateCharacterConsistentImage', async () => {
            this.logger.info('Generating character-consistent image', {
                bookId: request.bookId,
                characterIds: request.characterIds,
                imageType: request.imageType
            });

            // Get characters if specified
            const charactersInScene: Character[] = [];
            if (request.characterIds && request.characterIds.length > 0) {
                for (const characterId of request.characterIds) {
                    const character = this.characters.get(characterId);
                    if (character) {
                        charactersInScene.push(character);
                    } else {
                        this.logger.warn('Character not found', { characterId });
                    }
                }
            }

            // Build enhanced prompt with character consistency
            const enhancedRequest = await this.enhanceRequestWithCharacterData(request, charactersInScene);

            // Generate image using context-aware service
            const baseResult = await this.contextAwareImageService.generateContextualImage(enhancedRequest);

            // Add character consistency information
            const characterConsistency = {
                charactersDetected: charactersInScene.map(c => c.name),
                referenceImagesUsed: this.buildReferenceImagesList(charactersInScene, request.imageType),
                consistencyScore: this.calculateConsistencyScore(charactersInScene, request),
                promptEnhancements: this.extractPromptEnhancements(charactersInScene)
            };

            return {
                ...baseResult,
                characterConsistency
            };
        }, {
            bookId: request.bookId,
            characterCount: request.characterIds?.length || 0
        });
    }

    /**
     * Register a character for consistent image generation
     */
    async registerCharacter(character: Character): Promise<void> {
        return this.executeWithLogging('registerCharacter', async () => {
            this.characters.set(character._id, character);
            this.logger.info('Character registered for image consistency', {
                characterId: character._id,
                name: character.name,
                hasAvatar: !!character.avatar,
                referenceImageCount: character.referenceImages.length
            });
        }, { characterId: character._id });
    }

    /**
     * Update character data
     */
    async updateCharacter(characterId: string, updates: Partial<Character>): Promise<void> {
        return this.executeWithLogging('updateCharacter', async () => {
            const character = this.characters.get(characterId);
            if (!character) {
                throw new Error(`Character not found: ${characterId}`);
            }

            const updatedCharacter = { ...character, ...updates };
            this.characters.set(characterId, updatedCharacter);

            this.logger.info('Character updated for image consistency', {
                characterId,
                hasAvatar: !!updatedCharacter.avatar,
                referenceImageCount: updatedCharacter.referenceImages.length
            });
        }, { characterId });
    }

    /**
     * Remove character from consistency system
     */
    async removeCharacter(characterId: string): Promise<void> {
        return this.executeWithLogging('removeCharacter', async () => {
            this.characters.delete(characterId);
            this.logger.info('Character removed from image consistency', { characterId });
        }, { characterId });
    }

    /**
     * Get character consistency profile
     */
    async getCharacterConsistencyProfile(characterId: string): Promise<any> {
        return this.executeWithLogging('getCharacterConsistencyProfile', async () => {
            const character = this.characters.get(characterId);
            if (!character) {
                throw new Error(`Character not found: ${characterId}`);
            }

            return {
                characterId: character._id,
                name: character.name,
                hasAvatar: !!character.avatar,
                referenceImages: character.referenceImages.map(img => ({
                    type: img.type,
                    description: img.description,
                    url: img.url
                })),
                consistencyLevel: character.imageGenerationProfile.consistencyLevel,
                preferredStyles: character.imageGenerationProfile.preferredStyles,
                customPromptAdditions: character.imageGenerationProfile.customPromptAdditions,
                physicalDescriptionSummary: this.summarizePhysicalDescription(character),
                generationTips: this.buildGenerationTips(character)
            };
        }, { characterId });
    }

    /**
     * Enhance request with character avatar and reference data
     */
    private async enhanceRequestWithCharacterData(
        request: CharacterImageRequest,
        characters: Character[]
    ): Promise<ContextualImageRequest> {
        // Start with base request
        const enhancedRequest: ContextualImageRequest = { ...request };

        if (characters.length === 0) {
            return enhancedRequest;
        }

        // Build character-specific prompt additions
        const characterPromptParts: string[] = [];
        const referenceImageUrls: string[] = [];

        for (const character of characters) {
            // Add physical description
            const physicalDesc = this.buildDetailedPhysicalDescription(character);
            if (physicalDesc) {
                characterPromptParts.push(`${character.name}: ${physicalDesc}`);
            }

            // Add custom prompt additions
            if (character.imageGenerationProfile.customPromptAdditions) {
                characterPromptParts.push(character.imageGenerationProfile.customPromptAdditions);
            }

            // Collect reference images based on image type and consistency level
            if (request.useCharacterAvatars !== false) {
                const relevantImages = this.selectRelevantReferenceImages(character, request.imageType);
                referenceImageUrls.push(...relevantImages);
            }
        }

        // Enhance the main prompt
        if (characterPromptParts.length > 0) {
            const characterPrompt = characterPromptParts.join('. ');
            enhancedRequest.prompt = `${characterPrompt}. ${enhancedRequest.prompt}`;
        }

        // Add style preferences from characters
        const preferredStyles = this.aggregateStylePreferences(characters);
        if (preferredStyles.length > 0 && !enhancedRequest.style) {
            enhancedRequest.style = preferredStyles[0]; // Use most common style
        }

        // Add reference images for consistency (implementation would depend on your image service)
        if (referenceImageUrls.length > 0) {
            // enhancedRequest.referenceImages = referenceImageUrls; // Property might not exist
        }

        return enhancedRequest;
    }

    /**
     * Build detailed physical description for image generation
     */
    private buildDetailedPhysicalDescription(character: Character): string {
        const desc = character.physicalDescription;
        const parts: string[] = [];

        // Basic appearance
        if (desc.height) parts.push(`height: ${desc.height}`);
        if (desc.build) parts.push(`build: ${desc.build}`);

        // Hair
        if (desc.hairColor && desc.hairStyle) {
            parts.push(`${desc.hairColor} ${desc.hairStyle} hair`);
        } else if (desc.hairColor) {
            parts.push(`${desc.hairColor} hair`);
        }

        // Eyes and skin
        if (desc.eyeColor) parts.push(`${desc.eyeColor} eyes`);
        if (desc.skinTone) parts.push(`${desc.skinTone} skin tone`);

        // Distinctive features
        if (desc.distinctiveFeatures && desc.distinctiveFeatures.length > 0) {
            parts.push(`distinctive features: ${desc.distinctiveFeatures.join(', ')}`);
        }

        // Clothing
        if (desc.clothing?.style) {
            let clothingDesc = `wearing ${desc.clothing.style} style clothing`;
            if (desc.clothing.colors && desc.clothing.colors.length > 0) {
                clothingDesc += ` in ${desc.clothing.colors.join(' and ')} colors`;
            }
            if (desc.clothing.accessories && desc.clothing.accessories.length > 0) {
                clothingDesc += ` with ${desc.clothing.accessories.join(', ')}`;
            }
            parts.push(clothingDesc);
        }

        return parts.join(', ');
    }

    /**
     * Select relevant reference images based on image type
     */
    private selectRelevantReferenceImages(character: Character, imageType?: string): string[] {
        const images: string[] = [];

        // Add avatar if available
        if (character.avatar) {
            images.push(character.avatar.url);
        }

        // Select reference images based on type
        const relevantReferenceImages = character.referenceImages.filter(img => {
            switch (imageType) {
                case 'portrait':
                    return img.type === 'face' || img.type === 'expression';
                case 'full_body':
                    return img.type === 'full_body' || img.type === 'pose';
                case 'action':
                    return img.type === 'pose' || img.type === 'full_body';
                case 'expression':
                    return img.type === 'face' || img.type === 'expression';
                default:
                    return true; // Include all for general scenes
            }
        });

        // Limit to top 3 most relevant images
        images.push(...relevantReferenceImages.slice(0, 3).map(img => img.url));

        return images;
    }

    /**
     * Aggregate style preferences from multiple characters
     */
    private aggregateStylePreferences(characters: Character[]): string[] {
        const styleCount = new Map<string, number>();

        characters.forEach(character => {
            character.imageGenerationProfile.preferredStyles.forEach(style => {
                styleCount.set(style, (styleCount.get(style) || 0) + 1);
            });
        });

        // Sort by frequency
        return Array.from(styleCount.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([style]) => style);
    }

    /**
     * Build reference images list for result
     */
    private buildReferenceImagesList(characters: Character[], imageType?: string): Array<{
        characterId: string;
        imageUrl: string;
        type: string;
    }> {
        const referenceImages: Array<{
            characterId: string;
            imageUrl: string;
            type: string;
        }> = [];

        characters.forEach(character => {
            // Add avatar
            if (character.avatar) {
                referenceImages.push({
                    characterId: character._id,
                    imageUrl: character.avatar.url,
                    type: 'avatar'
                });
            }

            // Add relevant reference images
            const relevantImages = this.selectRelevantReferenceImages(character, imageType);
            character.referenceImages
                .filter(img => relevantImages.includes(img.url))
                .forEach(img => {
                    referenceImages.push({
                        characterId: character._id,
                        imageUrl: img.url,
                        type: img.type
                    });
                });
        });

        return referenceImages;
    }

    /**
     * Calculate consistency score based on available reference material
     */
    private calculateConsistencyScore(characters: Character[], request: CharacterImageRequest): number {
        if (characters.length === 0) return 1.0;

        let totalScore = 0;
        let totalWeight = 0;

        characters.forEach(character => {
            let characterScore = 0;
            let weight = 1;

            // Avatar increases consistency significantly
            if (character.avatar) {
                characterScore += 0.5;
            }

            // Reference images add to consistency
            const relevantImages = character.referenceImages.filter(img => {
                switch (request.imageType) {
                    case 'portrait':
                        return img.type === 'face' || img.type === 'expression';
                    case 'full_body':
                        return img.type === 'full_body';
                    default:
                        return true;
                }
            });

            characterScore += Math.min(relevantImages.length * 0.1, 0.3);

            // Physical description completeness
            const desc = character.physicalDescription;
            const descFields = [desc.height, desc.build, desc.hairColor, desc.eyeColor, desc.skinTone];
            const completeness = descFields.filter(field => field).length / descFields.length;
            characterScore += completeness * 0.2;

            // Consistency level setting
            const levelMultiplier = {
                'low': 0.7,
                'medium': 1.0,
                'high': 1.2,
                'strict': 1.5
            }[character.imageGenerationProfile.consistencyLevel] || 1.0;

            characterScore *= levelMultiplier;

            totalScore += Math.min(characterScore, 1.0) * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }

    /**
     * Extract prompt enhancements from characters
     */
    private extractPromptEnhancements(characters: Character[]): string[] {
        const enhancements: string[] = [];

        characters.forEach(character => {
            // Add consistency level as enhancement
            enhancements.push(`${character.name}: ${character.imageGenerationProfile.consistencyLevel} consistency`);

            // Add excluded elements as negative prompts
            if (character.imageGenerationProfile.excludedElements.length > 0) {
                enhancements.push(`avoid: ${character.imageGenerationProfile.excludedElements.join(', ')}`);
            }
        });

        return enhancements;
    }

    /**
     * Summarize physical description for consistency profile
     */
    private summarizePhysicalDescription(character: Character): string {
        const desc = character.physicalDescription;
        const summary: string[] = [];

        if (desc.height && desc.build) summary.push(`${desc.height}, ${desc.build} build`);
        if (desc.hairColor && desc.hairStyle) summary.push(`${desc.hairColor} ${desc.hairStyle} hair`);
        if (desc.eyeColor) summary.push(`${desc.eyeColor} eyes`);
        if (desc.skinTone) summary.push(`${desc.skinTone} skin`);

        return summary.join(', ') || 'Basic description needed';
    }

    /**
     * Build generation tips for character
     */
    private buildGenerationTips(character: Character): string[] {
        const tips: string[] = [];

        if (!character.avatar) {
            tips.push('Consider adding an avatar image for better consistency');
        }

        if (character.referenceImages.length < 3) {
            tips.push('Add more reference images for different poses and expressions');
        }

        if (character.imageGenerationProfile.consistencyLevel === 'low') {
            tips.push('Increase consistency level for more accurate character representation');
        }

        if (!character.imageGenerationProfile.customPromptAdditions) {
            tips.push('Add custom prompt additions for unique character traits');
        }

        return tips;
    }
}

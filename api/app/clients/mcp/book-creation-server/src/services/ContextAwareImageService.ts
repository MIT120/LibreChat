/**
 * Context-Aware Image Service - Enhanced image generation with full narrative context
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { ImageService } from './ImageService.js';
import { NarrativeConsistencyService } from './NarrativeConsistencyService.js';
import { SceneAnalysisService } from './SceneAnalysisService.js';
import { VisualConsistencyService } from './VisualConsistencyService.js';
import { Book } from '../../models/Book.js';

export interface ContextualImageRequest {
    bookId: string;
    chapterId: string;
    pageId?: string;
    pageNumber?: string;
    prompt: string;
    style?: string;
    userStylePreference?: string;
    forceUserPrompt?: boolean;
    userId?: string;
    
    // Enhanced context options
    includeCharacterContext?: boolean;
    includeWorldContext?: boolean;
    includeTimelineContext?: boolean;
    includeSpecContext?: boolean;
    specificCharacters?: string[]; // Character IDs to emphasize
    specificWorldElements?: string[]; // World element IDs to include
}

export interface EnhancedImageResult {
    imageUrl: string;
    imageBase64?: string;
    attachedToPageId?: string;
    styleAnalysis?: any;
    needsUserStyleInput?: boolean;
    availableStyles?: Array<{ name: string; description: string; ageRating: string }>;
    
    // Enhanced context information
    contextUsed?: {
        characters: Array<{ name: string; traits: string[] }>;
        worldElements: Array<{ name: string; visualDetails: string }>;
        timelineContext: string;
        bookSpec: any;
    };
    enhancedPrompt?: string;
    originalPrompt?: string;
}

export class ContextAwareImageService extends BaseService {
    private imageService: ImageService;
    private narrativeService: NarrativeConsistencyService;
    private sceneAnalysisService: SceneAnalysisService;
    private visualConsistencyService: VisualConsistencyService;

    constructor(logger: ILogger, imageService: ImageService, narrativeService: NarrativeConsistencyService) {
        super(logger);
        this.imageService = imageService;
        this.narrativeService = narrativeService;
        this.sceneAnalysisService = new SceneAnalysisService(logger);
        this.visualConsistencyService = new VisualConsistencyService(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('ContextAwareImageService initialized');
        await this.sceneAnalysisService.initialize();
        await this.visualConsistencyService.initialize();
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('ContextAwareImageService disposed');
        await this.sceneAnalysisService.dispose();
        await this.visualConsistencyService.dispose();
    }

    /**
     * Generate image with full narrative context awareness
     */
    async generateContextualImage(request: ContextualImageRequest): Promise<EnhancedImageResult> {
        return this.executeWithLogging('generateContextualImage', async () => {
            // Get narrative context
            const narrativeContext = await this.narrativeService.getNarrativeContext(
                request.bookId,
                request.chapterId,
                request.pageId
            );

            // Get book for spec information
            const book = await Book.findById(request.bookId);
            if (!book) {
                throw new Error(`Book not found: ${request.bookId}`);
            }

            // Get scene analysis if pageId is provided
            let sceneAnalysis = null;
            if (request.pageId) {
                try {
                    sceneAnalysis = await this.sceneAnalysisService.analyzePageScene(request.pageId);
                } catch (error) {
                    this.logger.warn('Scene analysis failed, continuing without it', { pageId: request.pageId, error });
                }
            }

            // Get visual consistency data
            let consistencyPrompt = '';
            if (request.specificCharacters) {
                const characterTypes = request.specificCharacters.map(() => 'character');
                consistencyPrompt = await this.visualConsistencyService.buildConsistencyPrompt(
                    request.bookId,
                    request.specificCharacters,
                    characterTypes
                );
            }

            // Build enhanced prompt with all context
            const enhancedPrompt = await this.buildEnhancedPrompt(
                request.prompt,
                narrativeContext,
                book,
                request,
                sceneAnalysis,
                consistencyPrompt
            );

            // Use original image service with enhanced prompt
            const originalResult = await this.imageService.generateContextualImage({
                bookId: request.bookId,
                chapterId: request.chapterId,
                pageId: request.pageId,
                pageNumber: request.pageNumber,
                prompt: enhancedPrompt,
                style: request.style,
                userStylePreference: request.userStylePreference,
                forceUserPrompt: request.forceUserPrompt,
                userId: request.userId
            });

            // Prepare context information
            const contextUsed = {
                characters: narrativeContext.characters
                    .filter(char => request.specificCharacters?.includes(char.characterId) || !request.specificCharacters)
                    .map(char => ({
                        name: char.name,
                        traits: this.extractVisualTraits(char.currentState.physicalTraits)
                    })),
                worldElements: narrativeContext.worldElements
                    .filter(element => request.specificWorldElements?.includes(element.elementId) || !request.specificWorldElements)
                    .map(element => ({
                        name: element.name,
                        visualDetails: this.formatVisualDetails(element.currentState.visualDetails)
                    })),
                timelineContext: this.formatTimelineContext(narrativeContext.timeline),
                bookSpec: book.spec || {}
            };

            // Record image generation for visual consistency tracking
            if (originalResult.imageUrl && request.specificCharacters) {
                for (const characterId of request.specificCharacters) {
                    try {
                        await this.visualConsistencyService.recordImageGeneration(
                            request.bookId,
                            characterId,
                            'character',
                            {
                                imageUrl: originalResult.imageUrl,
                                imageBase64: originalResult.imageBase64,
                                pageId: request.pageId || '',
                                chapterId: request.chapterId,
                                prompt: enhancedPrompt
                            }
                        );
                    } catch (error) {
                        this.logger.warn('Failed to record image generation for consistency tracking', { 
                            characterId, 
                            error: (error as Error).message 
                        });
                    }
                }
            }

            return {
                ...originalResult,
                contextUsed,
                enhancedPrompt,
                originalPrompt: request.prompt
            };
        }, { bookId: request.bookId, chapterId: request.chapterId });
    }

    /**
     * Build enhanced prompt with narrative context, scene analysis, and visual consistency
     */
    private async buildEnhancedPrompt(
        originalPrompt: string,
        narrativeContext: any,
        book: any,
        request: ContextualImageRequest,
        sceneAnalysis?: any,
        consistencyPrompt?: string
    ): Promise<string> {
        let enhancedPrompt = originalPrompt;

        // Add book spec style information
        if (request.includeSpecContext !== false && book.spec?.imageStyle) {
            const imageStyle = book.spec.imageStyle;
            
            if (imageStyle.style) {
                enhancedPrompt += `, in ${imageStyle.style} style`;
            }
            
            if (imageStyle.rendering) {
                enhancedPrompt += `, ${imageStyle.rendering}`;
            }
            
            if (imageStyle.camera) {
                enhancedPrompt += `, ${imageStyle.camera}`;
            }
        }

        // Add color palette from book spec
        if (request.includeSpecContext !== false && book.spec?.colorPalette) {
            const palette = book.spec.colorPalette;
            let colorInfo = '';
            
            if (palette.primary) {
                colorInfo += `primary color ${palette.primary}`;
            }
            
            if (palette.accents && palette.accents.length > 0) {
                colorInfo += colorInfo ? `, accent colors ${palette.accents.join(', ')}` : `accent colors ${palette.accents.join(', ')}`;
            }
            
            if (palette.mood) {
                colorInfo += colorInfo ? `, ${palette.mood} mood` : `${palette.mood} mood`;
            }
            
            if (colorInfo) {
                enhancedPrompt += `, with ${colorInfo}`;
            }
        }

        // Add character context with enhanced details
        if (request.includeCharacterContext !== false) {
            const relevantCharacters = narrativeContext.characters.filter((char: any) => 
                !request.specificCharacters || request.specificCharacters.includes(char.characterId)
            );

            if (relevantCharacters.length > 0) {
                enhancedPrompt += `. Characters present: `;
                
                const characterDescriptions = relevantCharacters.map((char: any) => {
                    return this.buildDetailedCharacterDescription(char);
                });
                
                enhancedPrompt += characterDescriptions.join('; ');

                // Add character relationship dynamics if multiple characters
                if (relevantCharacters.length > 1) {
                    const relationshipContext = this.buildRelationshipContext(relevantCharacters, narrativeContext);
                    if (relationshipContext) {
                        enhancedPrompt += `. ${relationshipContext}`;
                    }
                }
            }
        }

        // Add enhanced world/location context
        if (request.includeWorldContext !== false) {
            const worldContext = this.buildWorldContext(narrativeContext, request);
            if (worldContext) {
                enhancedPrompt += `. ${worldContext}`;
            }
        }

        // Add enhanced timeline/mood context
        if (request.includeTimelineContext !== false) {
            const timelineContext = this.buildTimelineContext(narrativeContext);
            if (timelineContext) {
                enhancedPrompt += `. ${timelineContext}`;
            }
        }

        // Add emotional and atmospheric context
        const relevantCharacters = narrativeContext.characters.filter((char: any) => 
            !request.specificCharacters || request.specificCharacters.includes(char.characterId)
        );
        const emotionalContext = this.buildEmotionalContext(narrativeContext, relevantCharacters);
        if (emotionalContext) {
            enhancedPrompt += `. ${emotionalContext}`;
        }

        // Add scene analysis context
        if (sceneAnalysis) {
            const sceneContext = this.buildSceneAnalysisContext(sceneAnalysis, originalPrompt);
            if (sceneContext) {
                enhancedPrompt += `. ${sceneContext}`;
            }
        }

        // Add visual consistency context
        if (consistencyPrompt) {
            enhancedPrompt += `. ${consistencyPrompt}`;
        }

        // Add negative cues from book spec
        if (request.includeSpecContext !== false && book.spec?.imageStyle?.negativeCues && book.spec.imageStyle.negativeCues.length > 0) {
            enhancedPrompt += `. Avoid: ${book.spec.imageStyle.negativeCues.join(', ')}`;
        }

        this.logger.debug('Enhanced prompt created', {
            originalLength: originalPrompt.length,
            enhancedLength: enhancedPrompt.length,
            bookId: request.bookId
        });

        return enhancedPrompt;
    }

    /**
     * Build detailed character description including physical, emotional, and contextual details
     */
    private buildDetailedCharacterDescription(char: any): string {
        let desc = char.name;
        
        // Physical traits
        const traits = char.currentState.physicalTraits;
        const visualDetails: string[] = [];
        
        // Basic physical features
        if (traits.age) visualDetails.push(`${traits.age} years old`);
        if (traits.gender) visualDetails.push(traits.gender);
        if (traits.height) visualDetails.push(traits.height);
        if (traits.build) visualDetails.push(`${traits.build} build`);
        
        // Facial features
        if (traits.hairColor && traits.hairStyle) {
            visualDetails.push(`${traits.hairColor} ${traits.hairStyle} hair`);
        } else if (traits.hairColor) {
            visualDetails.push(`${traits.hairColor} hair`);
        }
        if (traits.eyeColor) visualDetails.push(`${traits.eyeColor} eyes`);
        if (traits.skinTone) visualDetails.push(`${traits.skinTone} skin`);
        
        // Distinctive features and scars
        if (traits.distinctiveFeatures && traits.distinctiveFeatures.length > 0) {
            visualDetails.push(traits.distinctiveFeatures.join(', '));
        }
        if (traits.scars && traits.scars.length > 0) {
            const visibleScars = traits.scars.filter((scar: any) => scar.location && scar.description);
            if (visibleScars.length > 0) {
                visualDetails.push(`scars: ${visibleScars.map((s: any) => `${s.description} on ${s.location}`).join(', ')}`);
            }
        }
        
        // Clothing and accessories
        if (traits.clothing) {
            const clothingParts: string[] = [];
            if (traits.clothing.style) clothingParts.push(traits.clothing.style);
            if (traits.clothing.colors && traits.clothing.colors.length > 0) {
                clothingParts.push(`in ${traits.clothing.colors.join(' and ')}`);
            }
            if (traits.clothing.accessories && traits.clothing.accessories.length > 0) {
                clothingParts.push(`with ${traits.clothing.accessories.join(', ')}`);
            }
            if (clothingParts.length > 0) {
                visualDetails.push(`wearing ${clothingParts.join(' ')}`);
            }
        }

        // Current emotional state
        if (char.currentState.personality?.currentMood) {
            visualDetails.push(`${char.currentState.personality.currentMood} mood`);
        }

        // Body language based on personality
        if (char.currentState.personality?.coreTraits) {
            const bodyLanguage = this.inferBodyLanguageFromTraits(char.currentState.personality.coreTraits);
            if (bodyLanguage) {
                visualDetails.push(bodyLanguage);
            }
        }
        
        if (visualDetails.length > 0) {
            desc += ` (${visualDetails.join(', ')})`;
        }
        
        return desc;
    }

    /**
     * Build relationship context to influence character positioning and interaction
     */
    private buildRelationshipContext(characters: any[], narrativeContext: any): string | null {
        if (characters.length < 2) return null;

        const relationships: string[] = [];
        
        for (let i = 0; i < characters.length; i++) {
            for (let j = i + 1; j < characters.length; j++) {
                const char1 = characters[i];
                const char2 = characters[j];
                
                // Find relationship between these characters
                const relationship = char1.currentState.relationships?.find((rel: any) => 
                    rel.targetCharacterId === char2.characterId
                );
                
                if (relationship) {
                    const relationshipDesc = this.describeRelationshipVisually(
                        char1.name, 
                        char2.name, 
                        relationship
                    );
                    if (relationshipDesc) {
                        relationships.push(relationshipDesc);
                    }
                }
            }
        }

        return relationships.length > 0 ? `Character dynamics: ${relationships.join(', ')}` : null;
    }

    /**
     * Describe relationship in visual terms
     */
    private describeRelationshipVisually(name1: string, name2: string, relationship: any): string | null {
        const type = relationship.relationshipType;
        const strength = relationship.strength || 0;
        const status = relationship.status;

        let description = '';

        switch (type) {
            case 'romantic':
                if (strength > 7) description = `${name1} and ${name2} gazing lovingly at each other`;
                else if (strength > 3) description = `${name1} and ${name2} standing close together`;
                else description = `${name1} and ${name2} with romantic tension`;
                break;
            case 'family':
                description = `${name1} and ${name2} with familial closeness`;
                break;
            case 'friendship':
                if (strength > 5) description = `${name1} and ${name2} as close friends`;
                else description = `${name1} and ${name2} in friendly interaction`;
                break;
            case 'rivalry':
                description = `${name1} and ${name2} with competitive tension`;
                break;
            case 'enemy':
                description = `${name1} and ${name2} with hostile body language`;
                break;
            case 'mentor':
                description = `${name1} in teaching/guiding position with ${name2}`;
                break;
        }

        if (status === 'deteriorating') {
            description += ', showing strain in their relationship';
        } else if (status === 'developing') {
            description += ', with growing connection';
        }

        return description;
    }

    /**
     * Build comprehensive world context
     */
    private buildWorldContext(narrativeContext: any, request: ContextualImageRequest): string | null {
        const relevantElements = narrativeContext.worldElements.filter((element: any) => 
            (!request.specificWorldElements || request.specificWorldElements.includes(element.elementId))
        );

        if (relevantElements.length === 0) return null;

        const contextParts: string[] = [];

        // Categorize elements
        const locations = relevantElements.filter((e: any) => e.type === 'location');
        const cultures = relevantElements.filter((e: any) => e.type === 'culture');
        const technology = relevantElements.filter((e: any) => e.type === 'technology');
        const magicSystems = relevantElements.filter((e: any) => e.type === 'magic_system');
        const artifacts = relevantElements.filter((e: any) => e.type === 'artifact');

        // Build location context
        if (locations.length > 0) {
            const locationDescs = locations.map((loc: any) => {
                return this.buildLocationDescription(loc);
            });
            contextParts.push(`Setting: ${locationDescs.join(', ')}`);
        }

        // Add cultural context
        if (cultures.length > 0) {
            const culturalElements = cultures.map((culture: any) => {
                const details: string[] = [];
                if (culture.currentState.visualDetails?.atmosphere) {
                    details.push(culture.currentState.visualDetails.atmosphere);
                }
                if (culture.currentState.visualDetails?.colors) {
                    details.push(`cultural colors: ${culture.currentState.visualDetails.colors.join(', ')}`);
                }
                return details.length > 0 ? `${culture.name} (${details.join(', ')})` : culture.name;
            });
            contextParts.push(`Cultural influence: ${culturalElements.join(', ')}`);
        }

        // Add technology/magic context
        if (technology.length > 0 || magicSystems.length > 0) {
            const techMagic = [...technology, ...magicSystems].map((element: any) => {
                return this.buildTechnologyMagicDescription(element);
            });
            contextParts.push(`Technological/Magical elements: ${techMagic.join(', ')}`);
        }

        // Add visible artifacts
        if (artifacts.length > 0) {
            const artifactDescs = artifacts.map((artifact: any) => {
                return this.buildArtifactDescription(artifact);
            });
            contextParts.push(`Artifacts present: ${artifactDescs.join(', ')}`);
        }

        return contextParts.join('. ');
    }

    /**
     * Build detailed location description
     */
    private buildLocationDescription(location: any): string {
        const visualDetails = location.currentState.visualDetails;
        const details: string[] = [];
        
        if (visualDetails.appearance) details.push(visualDetails.appearance);
        if (visualDetails.size) details.push(visualDetails.size);
        if (visualDetails.atmosphere) details.push(visualDetails.atmosphere);
        if (visualDetails.colors && visualDetails.colors.length > 0) {
            details.push(`dominated by ${visualDetails.colors.join(' and ')} colors`);
        }
        if (visualDetails.materials && visualDetails.materials.length > 0) {
            details.push(`constructed of ${visualDetails.materials.join(' and ')}`);
        }
        if (visualDetails.landmarks && visualDetails.landmarks.length > 0) {
            details.push(`featuring ${visualDetails.landmarks.join(', ')}`);
        }

        return details.length > 0 ? `${location.name} (${details.join(', ')})` : location.name;
    }

    /**
     * Build technology/magic system description
     */
    private buildTechnologyMagicDescription(element: any): string {
        const visualDetails = element.currentState.visualDetails;
        const details: string[] = [];
        
        if (visualDetails.appearance) details.push(visualDetails.appearance);
        if (visualDetails.colors && visualDetails.colors.length > 0) {
            details.push(`glowing with ${visualDetails.colors.join(' and ')} light`);
        }
        if (element.currentState.properties) {
            const activeProps = element.currentState.properties.filter((prop: any) => 
                prop.name.includes('visual') || prop.name.includes('appearance') || prop.name.includes('glow')
            );
            if (activeProps.length > 0) {
                details.push(activeProps.map((prop: any) => prop.value).join(', '));
            }
        }

        return details.length > 0 ? `${element.name} (${details.join(', ')})` : element.name;
    }

    /**
     * Build artifact description
     */
    private buildArtifactDescription(artifact: any): string {
        const visualDetails = artifact.currentState.visualDetails;
        const details: string[] = [];
        
        if (visualDetails.appearance) details.push(visualDetails.appearance);
        if (visualDetails.size) details.push(visualDetails.size);
        if (visualDetails.materials && visualDetails.materials.length > 0) {
            details.push(`made of ${visualDetails.materials.join(' and ')}`);
        }
        if (visualDetails.colors && visualDetails.colors.length > 0) {
            details.push(`${visualDetails.colors.join(' and ')} colored`);
        }

        return details.length > 0 ? `${artifact.name} (${details.join(', ')})` : artifact.name;
    }

    /**
     * Build timeline and temporal context
     */
    private buildTimelineContext(narrativeContext: any): string | null {
        const contextParts: string[] = [];

        // Recent events mood
        if (narrativeContext.timeline.recentEvents.length > 0) {
            const recentEvent = narrativeContext.timeline.recentEvents[narrativeContext.timeline.recentEvents.length - 1];
            
            if (recentEvent.significance === 'major') {
                contextParts.push('atmosphere reflecting recent major events');
            }
            
            // Extract specific time context
            if (recentEvent.timing?.timeOfDay) {
                contextParts.push(`${recentEvent.timing.timeOfDay} lighting`);
            }
            if (recentEvent.timing?.weather) {
                contextParts.push(`${recentEvent.timing.weather} weather`);
            }
            if (recentEvent.timing?.season) {
                contextParts.push(`${recentEvent.timing.season} season`);
            }
        }

        // Timeline position context
        if (narrativeContext.timeline.timelinePosition) {
            const position = narrativeContext.timeline.timelinePosition;
            if (position.relativeTime) {
                contextParts.push(`time period: ${position.relativeTime}`);
            }
        }

        return contextParts.length > 0 ? `Temporal context: ${contextParts.join(', ')}` : null;
    }

    /**
     * Build emotional and atmospheric context
     */
    private buildEmotionalContext(narrativeContext: any, characters: any[]): string | null {
        const contextParts: string[] = [];

        // Overall scene mood from characters
        if (characters && characters.length > 0) {
            const moods = characters
                .map((char: any) => char.currentState.personality?.currentMood)
                .filter(Boolean);
            
            if (moods.length > 0) {
                const dominantMood = this.getDominantMood(moods);
                if (dominantMood) {
                    contextParts.push(`overall mood: ${dominantMood}`);
                }
            }

            // Tension level from relationships
            const tensionLevel = this.calculateSceneTension(characters);
            if (tensionLevel) {
                contextParts.push(`tension level: ${tensionLevel}`);
            }
        }

        // Active conflicts
        if (narrativeContext.activeRelationships) {
            const conflictualRels = narrativeContext.activeRelationships.filter((rel: any) => 
                rel.type === 'rivalry' || rel.type === 'enemy' || rel.strength < -3
            );
            if (conflictualRels.length > 0) {
                contextParts.push('underlying conflict present');
            }
        }

        return contextParts.length > 0 ? `Emotional atmosphere: ${contextParts.join(', ')}` : null;
    }

    /**
     * Infer body language from personality traits
     */
    private inferBodyLanguageFromTraits(traits: string[]): string | null {
        if (!traits || traits.length === 0) return null;

        const bodyLanguageMap: Record<string, string> = {
            'confident': 'confident posture',
            'shy': 'reserved body language',
            'aggressive': 'assertive stance',
            'nervous': 'fidgeting or tense posture',
            'calm': 'relaxed posture',
            'arrogant': 'haughty bearing',
            'friendly': 'open body language',
            'suspicious': 'guarded stance',
            'cheerful': 'animated gestures',
            'melancholy': 'subdued posture'
        };

        for (const trait of traits) {
            const lowerTrait = trait.toLowerCase();
            if (bodyLanguageMap[lowerTrait]) {
                return bodyLanguageMap[lowerTrait];
            }
        }

        return null;
    }

    /**
     * Get dominant mood from multiple character moods
     */
    private getDominantMood(moods: string[]): string | null {
        if (moods.length === 0) return null;
        
        // Count mood frequencies
        const moodCounts: Record<string, number> = {};
        moods.forEach(mood => {
            moodCounts[mood] = (moodCounts[mood] || 0) + 1;
        });

        // Return most frequent mood
        const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
        return sortedMoods[0][0];
    }

    /**
     * Calculate scene tension level
     */
    private calculateSceneTension(characters: any[]): string | null {
        if (characters.length < 2) return null;

        let totalTension = 0;
        let relationshipCount = 0;

        for (let i = 0; i < characters.length; i++) {
            for (let j = i + 1; j < characters.length; j++) {
                const char1 = characters[i];
                const relationship = char1.currentState.relationships?.find((rel: any) => 
                    rel.targetCharacterId === characters[j].characterId
                );
                
                if (relationship) {
                    const strength = relationship.strength || 0;
                    if (relationship.relationshipType === 'enemy' || relationship.relationshipType === 'rivalry') {
                        totalTension += Math.abs(strength);
                    } else if (strength < 0) {
                        totalTension += Math.abs(strength);
                    }
                    relationshipCount++;
                }
            }
        }

        if (relationshipCount === 0) return null;

        const avgTension = totalTension / relationshipCount;
        if (avgTension > 7) return 'high tension';
        if (avgTension > 4) return 'moderate tension';
        if (avgTension > 1) return 'low tension';
        return 'peaceful';
    }

    /**
     * Build scene analysis context for image prompt
     */
    private buildSceneAnalysisContext(sceneAnalysis: any, originalPrompt: string): string | null {
        const contextParts: string[] = [];

        // Add atmospheric elements from scene analysis
        if (sceneAnalysis.timeOfDay) {
            contextParts.push(`${sceneAnalysis.timeOfDay} time`);
        }
        if (sceneAnalysis.weather) {
            contextParts.push(`${sceneAnalysis.weather} weather`);
        }
        if (sceneAnalysis.lighting) {
            contextParts.push(`${sceneAnalysis.lighting} lighting`);
        }
        if (sceneAnalysis.mood) {
            contextParts.push(`${sceneAnalysis.mood} atmosphere`);
        }

        // Add key objects that aren't already in the prompt
        if (sceneAnalysis.objects) {
            const primaryObjects = sceneAnalysis.objects
                .filter((obj: any) => obj.importance === 'primary')
                .filter((obj: any) => !originalPrompt.toLowerCase().includes(obj.name.toLowerCase()));
            
            if (primaryObjects.length > 0) {
                const objectDescs = primaryObjects.map((obj: any) => {
                    const keywords = obj.visualKeywords.length > 0 ? ` (${obj.visualKeywords.join(', ')})` : '';
                    return `${obj.name}${keywords}`;
                });
                contextParts.push(`featuring ${objectDescs.join(', ')}`);
            }
        }

        // Add actions for dynamic composition
        if (sceneAnalysis.actions) {
            const primaryActions = sceneAnalysis.actions
                .filter((action: any) => action.importance === 'primary')
                .filter((action: any) => !originalPrompt.toLowerCase().includes(action.name.toLowerCase()));
            
            if (primaryActions.length > 0 && primaryActions.length <= 2) {
                contextParts.push(`action: ${primaryActions.map((a: any) => a.name).join(' and ')}`);
            }
        }

        // Add visual keywords for style enhancement
        if (sceneAnalysis.visualKeywords && sceneAnalysis.visualKeywords.length > 0) {
            const keywords = sceneAnalysis.visualKeywords
                .filter((keyword: string) => !originalPrompt.toLowerCase().includes(keyword.toLowerCase()))
                .slice(0, 3); // Limit to avoid overwhelming the prompt
            
            if (keywords.length > 0) {
                contextParts.push(`visual style: ${keywords.join(', ')}`);
            }
        }

        // Add focus point if identified
        if (sceneAnalysis.focusPoint && !originalPrompt.toLowerCase().includes(sceneAnalysis.focusPoint.toLowerCase())) {
            contextParts.push(`focus on ${sceneAnalysis.focusPoint}`);
        }

        // Add composition guidance based on complexity
        if (sceneAnalysis.sceneComplexity === 'complex') {
            contextParts.push('detailed composition with multiple elements');
        } else if (sceneAnalysis.sceneComplexity === 'simple') {
            contextParts.push('clean, focused composition');
        }

        return contextParts.length > 0 ? `Scene details: ${contextParts.join(', ')}` : null;
    }

    /**
     * Extract visual traits from character physical traits
     */
    private extractVisualTraits(physicalTraits: any): string[] {
        const traits: string[] = [];
        
        if (physicalTraits.hairColor) traits.push(`${physicalTraits.hairColor} hair`);
        if (physicalTraits.eyeColor) traits.push(`${physicalTraits.eyeColor} eyes`);
        if (physicalTraits.height) traits.push(physicalTraits.height);
        if (physicalTraits.build) traits.push(physicalTraits.build);
        if (physicalTraits.distinctiveFeatures) traits.push(...physicalTraits.distinctiveFeatures);
        
        return traits;
    }

    /**
     * Format visual details from world elements
     */
    private formatVisualDetails(visualDetails: any): string {
        const details: string[] = [];
        
        if (visualDetails.appearance) details.push(visualDetails.appearance);
        if (visualDetails.colors) details.push(`colors: ${visualDetails.colors.join(', ')}`);
        if (visualDetails.materials) details.push(`materials: ${visualDetails.materials.join(', ')}`);
        if (visualDetails.atmosphere) details.push(`atmosphere: ${visualDetails.atmosphere}`);
        
        return details.join('; ');
    }

    /**
     * Format timeline context for image generation
     */
    private formatTimelineContext(timeline: any): string {
        if (timeline.recentEvents.length === 0) return '';
        
        const recentEvent = timeline.recentEvents[timeline.recentEvents.length - 1];
        return `recent ${recentEvent.significance} event: ${recentEvent.name}`;
    }

    /**
     * Extract time context from timeline
     */
    private extractTimeContext(timeline: any): string | null {
        if (timeline.recentEvents.length === 0) return null;
        
        const recentEvent = timeline.recentEvents[timeline.recentEvents.length - 1];
        
        // Look for time of day indicators
        if (recentEvent.timing?.timeOfDay) {
            return `${recentEvent.timing.timeOfDay} lighting`;
        }
        
        return null;
    }

    /**
     * Generate image prompt that maintains character consistency
     */
    async generateCharacterConsistentPrompt(
        basePrompt: string,
        characterIds: string[],
        bookId: string,
        chapterId: string
    ): Promise<string> {
        const narrativeContext = await this.narrativeService.getNarrativeContext(bookId, chapterId);
        
        const characters = narrativeContext.characters.filter(char => 
            characterIds.includes(char.characterId)
        );

        let enhancedPrompt = basePrompt;

        for (const character of characters) {
            const visualDescription = this.buildCharacterVisualDescription(character);
            enhancedPrompt += `. ${character.name}: ${visualDescription}`;
        }

        return enhancedPrompt;
    }

    /**
     * Build complete visual description for a character
     */
    private buildCharacterVisualDescription(character: any): string {
        const traits = character.currentState.physicalTraits;
        const parts: string[] = [];

        if (traits.age) parts.push(`${traits.age} years old`);
        if (traits.gender) parts.push(traits.gender);
        if (traits.height) parts.push(traits.height);
        if (traits.build) parts.push(traits.build);
        if (traits.hairColor && traits.hairStyle) {
            parts.push(`${traits.hairColor} ${traits.hairStyle} hair`);
        } else if (traits.hairColor) {
            parts.push(`${traits.hairColor} hair`);
        }
        if (traits.eyeColor) parts.push(`${traits.eyeColor} eyes`);
        if (traits.skinTone) parts.push(`${traits.skinTone} skin`);
        
        if (traits.clothing) {
            const clothingParts: string[] = [];
            if (traits.clothing.style) clothingParts.push(traits.clothing.style);
            if (traits.clothing.colors && traits.clothing.colors.length > 0) {
                clothingParts.push(`in ${traits.clothing.colors.join(' and ')}`);
            }
            if (clothingParts.length > 0) {
                parts.push(`wearing ${clothingParts.join(' ')}`);
            }
        }

        if (traits.distinctiveFeatures && traits.distinctiveFeatures.length > 0) {
            parts.push(`distinctive features: ${traits.distinctiveFeatures.join(', ')}`);
        }

        return parts.join(', ');
    }

    /**
     * Generate location-aware image with world consistency
     */
    async generateLocationAwareImage(
        prompt: string,
        worldElementIds: string[],
        bookId: string,
        chapterId: string,
        additionalOptions?: Partial<ContextualImageRequest>
    ): Promise<EnhancedImageResult> {
        return this.generateContextualImage({
            bookId,
            chapterId,
            prompt,
            includeWorldContext: true,
            includeSpecContext: true,
            specificWorldElements: worldElementIds,
            ...additionalOptions
        });
    }
}

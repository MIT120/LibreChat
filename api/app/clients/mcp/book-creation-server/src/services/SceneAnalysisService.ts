/**
 * Scene Analysis Service - Extracts visual elements from page content
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { Page } from '../../models/Page.js';
import { Chapter } from '../../models/Chapter.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';

export interface SceneElement {
    type: 'character' | 'location' | 'object' | 'action' | 'atmosphere' | 'lighting' | 'weather';
    name: string;
    description: string;
    importance: 'primary' | 'secondary' | 'background';
    visualKeywords: string[];
}

export interface SceneAnalysis {
    pageId: string;
    chapterId: string;
    bookId: string;

    // Extracted elements
    characters: SceneElement[];
    locations: SceneElement[];
    objects: SceneElement[];
    actions: SceneElement[];

    // Atmospheric elements
    timeOfDay?: string;
    weather?: string;
    season?: string;
    lighting?: string;
    mood?: string;

    // Scene composition
    perspective?: 'first_person' | 'third_person' | 'omniscient';
    focusPoint?: string;
    visualStyle?: string;

    // Technical details
    suggestedImagePrompts: string[];
    visualKeywords: string[];
    sceneComplexity: 'simple' | 'moderate' | 'complex';
}

export class SceneAnalysisService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('SceneAnalysisService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('SceneAnalysisService disposed');
    }

    /**
     * Analyze page content to extract visual scene elements
     */
    async analyzePageScene(pageId: string): Promise<SceneAnalysis> {
        return this.executeWithLogging('analyzePageScene', async () => {
            const page = await Page.findOne({ pageId: pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            // Get the chapter to access bookId
            const chapter = await Chapter.findById(page.chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', page.chapterId);
            }

            const content = page.content || '';

            // Extract basic scene elements
            const characters = this.extractCharacters(content);
            const locations = this.extractLocations(content);
            const objects = this.extractObjects(content);
            const actions = this.extractActions(content);

            // Extract atmospheric elements
            const atmospheric = this.extractAtmosphericElements(content);

            // Analyze scene composition
            const composition = this.analyzeComposition(content);

            // Generate image prompts
            const imagePrompts = this.generateImagePrompts(content, characters, locations, objects);

            // Extract visual keywords
            const visualKeywords = this.extractVisualKeywords(content);

            // Calculate complexity
            const complexity = this.calculateSceneComplexity(characters, locations, objects, actions);

            return {
                pageId,
                chapterId: page.chapterId,
                bookId: chapter.bookId,
                characters,
                locations,
                objects,
                actions,
                timeOfDay: atmospheric.timeOfDay,
                weather: atmospheric.weather,
                season: atmospheric.season,
                lighting: atmospheric.lighting,
                mood: atmospheric.mood,
                perspective: composition.perspective,
                focusPoint: composition.focusPoint,
                visualStyle: composition.visualStyle,
                suggestedImagePrompts: imagePrompts,
                visualKeywords,
                sceneComplexity: complexity
            };
        }, { pageId });
    }

    /**
     * Extract character mentions from content
     */
    private extractCharacters(content: string): SceneElement[] {
        const characters: SceneElement[] = [];

        // Look for character names (capitalized words that appear multiple times)
        const words = content.split(/\s+/);
        const capitalizedWords = words.filter(word => /^[A-Z][a-z]+$/.test(word));
        const wordCounts: Record<string, number> = {};

        capitalizedWords.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        });

        // Characters likely appear multiple times
        Object.entries(wordCounts)
            .filter(([word, count]) => count >= 2 && word.length > 2)
            .forEach(([name, count]) => {
                const importance = count >= 5 ? 'primary' : count >= 3 ? 'secondary' : 'background';
                const description = this.extractCharacterDescription(content, name);
                const visualKeywords = this.extractCharacterVisualKeywords(content, name);

                characters.push({
                    type: 'character',
                    name,
                    description,
                    importance,
                    visualKeywords
                });
            });

        return characters;
    }

    /**
     * Extract location mentions from content
     */
    private extractLocations(content: string): SceneElement[] {
        const locations: SceneElement[] = [];

        // Common location indicators
        const locationPatterns = [
            /\b(?:in|at|inside|outside|within|beside|near|under|above|beneath|behind|before)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:room|hall|chamber|garden|forest|mountain|river|castle|house|building|street|square)/gi,
            /\bthe\s+([a-z]+\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
        ];

        const locationSet = new Set<string>();

        locationPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const location = match[1] || match[2];
                if (location && location.length > 2) {
                    locationSet.add(location);
                }
            }
        });

        locationSet.forEach(name => {
            const description = this.extractLocationDescription(content, name);
            const visualKeywords = this.extractLocationVisualKeywords(content, name);
            const importance = this.determineLocationImportance(content, name);

            locations.push({
                type: 'location',
                name,
                description,
                importance,
                visualKeywords
            });
        });

        return locations;
    }

    /**
     * Extract object mentions from content
     */
    private extractObjects(content: string): SceneElement[] {
        const objects: SceneElement[] = [];

        // Look for objects with descriptive words
        const objectPatterns = [
            /\b(?:a|an|the)\s+([a-z]+\s+)?([a-z]+)\b/gi,
            /\b(?:holding|carrying|wearing|wielding)\s+(?:a|an|the)?\s*([a-z]+(?:\s+[a-z]+)*)/gi,
            /\b([a-z]+)\s+(?:gleamed|glowed|sparkled|shone|reflected)/gi
        ];

        const commonObjects = new Set([
            'sword', 'shield', 'armor', 'cloak', 'ring', 'crown', 'staff', 'wand',
            'book', 'scroll', 'map', 'key', 'door', 'window', 'table', 'chair',
            'candle', 'torch', 'fire', 'crystal', 'gem', 'jewel', 'chain',
            'horse', 'dragon', 'bird', 'flower', 'tree', 'stone', 'rock'
        ]);

        const foundObjects = new Set<string>();

        objectPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const obj = (match[2] || match[1]).toLowerCase();
                if (commonObjects.has(obj) || obj.length > 4) {
                    foundObjects.add(obj);
                }
            }
        });

        foundObjects.forEach(name => {
            const description = this.extractObjectDescription(content, name);
            const visualKeywords = this.extractObjectVisualKeywords(content, name);
            const importance = this.determineObjectImportance(content, name);

            objects.push({
                type: 'object',
                name,
                description,
                importance,
                visualKeywords
            });
        });

        return objects;
    }

    /**
     * Extract action elements from content
     */
    private extractActions(content: string): SceneElement[] {
        const actions: SceneElement[] = [];

        // Look for action verbs
        const actionPatterns = [
            /\b(\w+ed)\b/g,  // Past tense verbs
            /\b(\w+ing)\b/g, // Present participle
            /\b(?:was|were|is|are)\s+(\w+ing)\b/g // Progressive tense
        ];

        const importantActions = new Set([
            'fighting', 'running', 'walking', 'standing', 'sitting', 'lying',
            'speaking', 'shouting', 'whispering', 'singing', 'dancing',
            'flying', 'falling', 'climbing', 'jumping', 'swimming',
            'crying', 'laughing', 'smiling', 'frowning', 'glaring',
            'attacking', 'defending', 'hiding', 'searching', 'watching'
        ]);

        const foundActions = new Set<string>();

        actionPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const action = match[1].toLowerCase();
                if (importantActions.has(action)) {
                    foundActions.add(action);
                }
            }
        });

        foundActions.forEach(name => {
            const description = this.extractActionDescription(content, name);
            const visualKeywords = this.extractActionVisualKeywords(content, name);
            const importance = this.determineActionImportance(content, name);

            actions.push({
                type: 'action',
                name,
                description,
                importance,
                visualKeywords
            });
        });

        return actions;
    }

    /**
     * Extract atmospheric elements from content
     */
    private extractAtmosphericElements(content: string): {
        timeOfDay?: string;
        weather?: string;
        season?: string;
        lighting?: string;
        mood?: string;
    } {
        const atmospheric: any = {};

        // Time of day
        const timePatterns = [
            /\b(dawn|morning|noon|afternoon|evening|dusk|night|midnight)\b/gi,
            /\b(sunrise|sunset)\b/gi
        ];

        timePatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                atmospheric.timeOfDay = match[0].toLowerCase();
            }
        });

        // Weather
        const weatherPatterns = [
            /\b(rain|snow|storm|wind|fog|mist|cloud|sunny|clear|overcast)\b/gi,
            /\bit was (raining|snowing|stormy|windy|foggy|misty|cloudy|sunny|clear)/gi
        ];

        weatherPatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                atmospheric.weather = match[0].toLowerCase();
            }
        });

        // Season
        const seasonPatterns = [
            /\b(spring|summer|autumn|fall|winter)\b/gi
        ];

        seasonPatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                atmospheric.season = match[0].toLowerCase();
            }
        });

        // Lighting
        const lightingPatterns = [
            /\b(bright|dim|dark|shadowy|luminous|glowing|flickering|blazing)\b/gi,
            /\b(candlelight|firelight|moonlight|sunlight|torchlight)\b/gi
        ];

        lightingPatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                atmospheric.lighting = match[0].toLowerCase();
            }
        });

        // Mood
        const moodPatterns = [
            /\b(peaceful|tense|ominous|cheerful|melancholy|mysterious|dramatic|serene)\b/gi,
            /\batmosphere was (calm|intense|eerie|joyful|sad|strange|exciting|tranquil)/gi
        ];

        moodPatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                atmospheric.mood = match[0].toLowerCase();
            }
        });

        return atmospheric;
    }

    /**
     * Analyze scene composition
     */
    private analyzeComposition(content: string): {
        perspective?: 'first_person' | 'third_person' | 'omniscient';
        focusPoint?: string;
        visualStyle?: string;
    } {
        const composition: any = {};

        // Perspective
        if (content.includes(' I ') || content.includes('I ')) {
            composition.perspective = 'first_person';
        } else if (content.includes(' he ') || content.includes(' she ') || content.includes(' they ')) {
            composition.perspective = 'third_person';
        }

        // Focus point (look for emphasis)
        const emphasisPatterns = [
            /(?:focus|attention|gaze|eyes|look)\s+(?:on|at|toward)\s+([^.!?]+)/gi,
            /\b(suddenly|immediately|instantly)\s+([^.!?]+)/gi
        ];

        emphasisPatterns.forEach(pattern => {
            const match = content.match(pattern);
            if (match) {
                composition.focusPoint = match[1] || match[2];
            }
        });

        return composition;
    }

    /**
     * Generate image prompts based on analyzed content
     */
    private generateImagePrompts(
        content: string,
        characters: SceneElement[],
        locations: SceneElement[],
        objects: SceneElement[]
    ): string[] {
        const prompts: string[] = [];

        // Main scene prompt
        let mainPrompt = '';
        if (characters.length > 0) {
            const primaryChars = characters.filter(c => c.importance === 'primary');
            if (primaryChars.length > 0) {
                mainPrompt += primaryChars.map(c => c.name).join(' and ');
            }
        }

        if (locations.length > 0) {
            const primaryLocs = locations.filter(l => l.importance === 'primary');
            if (primaryLocs.length > 0) {
                mainPrompt += mainPrompt ? ` in ${primaryLocs[0].name}` : primaryLocs[0].name;
            }
        }

        if (mainPrompt) {
            prompts.push(mainPrompt);
        }

        // Character-focused prompts
        characters
            .filter(c => c.importance === 'primary')
            .forEach(char => {
                prompts.push(`Portrait of ${char.name}, ${char.description}`);
            });

        // Location-focused prompts
        locations
            .filter(l => l.importance === 'primary')
            .forEach(loc => {
                prompts.push(`${loc.name}, ${loc.description}`);
            });

        return prompts;
    }

    /**
     * Extract visual keywords from content
     */
    private extractVisualKeywords(content: string): string[] {
        const visualWords = [
            // Colors
            'red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'orange',
            'golden', 'silver', 'crimson', 'azure', 'emerald', 'amber',
            // Textures
            'smooth', 'rough', 'soft', 'hard', 'silky', 'coarse', 'polished',
            // Lighting
            'bright', 'dim', 'glowing', 'shining', 'sparkling', 'gleaming',
            // Sizes
            'large', 'small', 'huge', 'tiny', 'massive', 'delicate',
            // Shapes
            'round', 'square', 'tall', 'short', 'wide', 'narrow'
        ];

        const keywords: Set<string> = new Set();
        const contentLower = content.toLowerCase();

        visualWords.forEach(word => {
            if (contentLower.includes(word)) {
                keywords.add(word);
            }
        });

        return Array.from(keywords);
    }

    /**
     * Calculate scene complexity based on elements
     */
    private calculateSceneComplexity(
        characters: SceneElement[],
        locations: SceneElement[],
        objects: SceneElement[],
        actions: SceneElement[]
    ): 'simple' | 'moderate' | 'complex' {
        const totalElements = characters.length + locations.length + objects.length + actions.length;
        const primaryElements = [characters, locations, objects, actions]
            .flat()
            .filter(e => e.importance === 'primary').length;

        if (totalElements <= 3 && primaryElements <= 2) return 'simple';
        if (totalElements <= 8 && primaryElements <= 4) return 'moderate';
        return 'complex';
    }

    // Helper methods for extracting descriptions and determining importance
    private extractCharacterDescription(content: string, name: string): string {
        // Look for descriptions near character name
        const regex = new RegExp(`${name}[^.!?]*([^.!?]*(?:was|looked|appeared|seemed)[^.!?]*)`, 'gi');
        const match = content.match(regex);
        return match ? match[0].substring(name.length).trim() : '';
    }

    private extractCharacterVisualKeywords(content: string, name: string): string[] {
        const keywords: string[] = [];
        const regex = new RegExp(`${name}[^.!?]*`, 'gi');
        const matches = content.match(regex) || [];

        const visualWords = ['tall', 'short', 'beautiful', 'handsome', 'young', 'old', 'strong', 'weak'];
        matches.forEach((match: any) => {
            visualWords.forEach(word => {
                if (match && typeof match === 'string' && match.toLowerCase().includes(word)) {
                    keywords.push(word);
                }
            });
        });

        return keywords;
    }

    private extractLocationDescription(content: string, name: string): string {
        const regex = new RegExp(`${name}[^.!?]*`, 'gi');
        const match = content.match(regex);
        return match ? match[0] : '';
    }

    private extractLocationVisualKeywords(content: string, name: string): string[] {
        const keywords: string[] = [];
        const regex = new RegExp(`${name}[^.!?]*`, 'gi');
        const matches = content.match(regex) || [];

        const visualWords = ['beautiful', 'dark', 'bright', 'ancient', 'modern', 'large', 'small'];
        matches.forEach((match: any) => {
            visualWords.forEach(word => {
                if (match && typeof match === 'string' && match.toLowerCase().includes(word)) {
                    keywords.push(word);
                }
            });
        });

        return keywords;
    }

    private extractObjectDescription(content: string, name: string): string {
        const regex = new RegExp(`(?:a|an|the)\\s+[^\\s]*\\s*${name}[^.!?]*`, 'gi');
        const match = content.match(regex);
        return match ? match[0] : '';
    }

    private extractObjectVisualKeywords(content: string, name: string): string[] {
        const keywords: string[] = [];
        const regex = new RegExp(`${name}[^.!?]*`, 'gi');
        const matches = content.match(regex) || [];

        const visualWords = ['shiny', 'dull', 'ornate', 'simple', 'heavy', 'light'];
        matches.forEach((match: any) => {
            visualWords.forEach(word => {
                if (match && typeof match === 'string' && match.toLowerCase().includes(word)) {
                    keywords.push(word);
                }
            });
        });

        return keywords;
    }

    private extractActionDescription(content: string, name: string): string {
        const regex = new RegExp(`[^.!?]*${name}[^.!?]*`, 'gi');
        const match = content.match(regex);
        return match ? match[0] : '';
    }

    private extractActionVisualKeywords(content: string, name: string): string[] {
        const keywords: string[] = [];
        const regex = new RegExp(`${name}[^.!?]*`, 'gi');
        const matches = content.match(regex) || [];

        const visualWords = ['quickly', 'slowly', 'gracefully', 'clumsily', 'violently', 'gently'];
        matches.forEach((match: any) => {
            visualWords.forEach(word => {
                if (match && typeof match === 'string' && match.toLowerCase().includes(word)) {
                    keywords.push(word);
                }
            });
        });

        return keywords;
    }

    private determineLocationImportance(content: string, name: string): 'primary' | 'secondary' | 'background' {
        const occurrences = (content.match(new RegExp(name, 'gi')) || []).length;
        if (occurrences >= 3) return 'primary';
        if (occurrences >= 2) return 'secondary';
        return 'background';
    }

    private determineObjectImportance(content: string, name: string): 'primary' | 'secondary' | 'background' {
        const occurrences = (content.match(new RegExp(name, 'gi')) || []).length;
        const hasDescription = content.toLowerCase().includes(`${name} was`) ||
            content.toLowerCase().includes(`${name} looked`) ||
            content.toLowerCase().includes(`the ${name}`);

        if (occurrences >= 2 && hasDescription) return 'primary';
        if (occurrences >= 2 || hasDescription) return 'secondary';
        return 'background';
    }

    private determineActionImportance(content: string, name: string): 'primary' | 'secondary' | 'background' {
        const occurrences = (content.match(new RegExp(name, 'gi')) || []).length;
        if (occurrences >= 3) return 'primary';
        if (occurrences >= 2) return 'secondary';
        return 'background';
    }
}

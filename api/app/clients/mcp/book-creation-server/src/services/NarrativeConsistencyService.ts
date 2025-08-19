/**
 * Narrative Consistency Service - Central hub for story element management and validation
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import {
    CharacterEvolution,
    WorldElement,
    TimelineEvent,
    ConsistencyViolation
} from '../../models/NarrativeElements.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';

// Service interfaces
export interface CharacterReference {
    characterId: string;
    name: string;
    currentState: {
        physicalTraits: Record<string, any>;
        personality: Record<string, any>;
        relationships: Array<{ targetCharacterId: string; type: string; strength: number }>;
        abilities: Record<string, any>;
        location?: string;
        currentGoals: string[];
    };
    lastAppearance?: {
        chapterId: string;
        pageId: string;
        context: string;
    };
}

export interface WorldElementReference {
    elementId: string;
    name: string;
    type: string;
    currentState: {
        description: string;
        visualDetails: Record<string, any>;
        properties: Array<{ name: string; value: string }>;
        status: string;
        controlledBy?: string;
    };
    connections: Array<{ targetElementId: string; relationshipType: string }>;
    consistencyRules: string[];
}

export interface TimelineContext {
    currentEventId?: string;
    recentEvents: Array<{
        eventId: string;
        name: string;
        timing: Record<string, any>;
        significance: string;
    }>;
    upcomingEvents: Array<{
        eventId: string;
        name: string;
        expectedTiming: string;
    }>;
    timelinePosition: {
        sequenceNumber: number;
        relativeTime: string;
    };
}

export interface ConsistencyCheckResult {
    isConsistent: boolean;
    violations: Array<{
        type: string;
        severity: string;
        description: string;
        suggestions: string[];
    }>;
    warnings: string[];
    suggestions: string[];
}

export interface NarrativeContext {
    bookId: string;
    chapterId: string;
    pageId?: string;
    characters: CharacterReference[];
    worldElements: WorldElementReference[];
    timeline: TimelineContext;
    activeRelationships: Array<{
        character1: string;
        character2: string;
        type: string;
        strength: number;
        recentChanges: string[];
    }>;
    consistencyGuidelines: string[];
}

export class NarrativeConsistencyService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('NarrativeConsistencyService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('NarrativeConsistencyService disposed');
    }

    /**
     * Get comprehensive narrative context for a specific book location
     */
    async getNarrativeContext(
        bookId: string,
        chapterId: string,
        pageId?: string
    ): Promise<NarrativeContext> {
        return this.executeWithLogging('getNarrativeContext', async () => {
            try {
                // Get all characters for this book
                const characters = await this.getBookCharacters(bookId);

                // Get world elements
                const worldElements = await this.getBookWorldElements(bookId);

                // Get timeline context
                const timeline = await this.getTimelineContext(bookId, chapterId, pageId);

                // Get active relationships
                const activeRelationships = await this.getActiveRelationships(bookId);

                // Get consistency guidelines from book spec
                const consistencyGuidelines = await this.getConsistencyGuidelines(bookId);

                return {
                    bookId,
                    chapterId,
                    pageId,
                    characters,
                    worldElements,
                    timeline,
                    activeRelationships,
                    consistencyGuidelines
                };
            } catch (error) {
                throw new DatabaseError(`Failed to get narrative context: ${(error as Error).message}`);
            }
        }, { bookId, chapterId, pageId });
    }

    /**
     * Create or update a character in the consistency database
     */
    async upsertCharacter(
        bookId: string,
        conversationId: string,
        characterData: {
            characterId?: string;
            name: string;
            role: string;
            physicalTraits?: Record<string, any>;
            personality?: Record<string, any>;
            abilities?: Record<string, any>;
            relationships?: Array<{ targetCharacterId: string; type: string; strength: number }>;
        },
        context?: { chapterId: string; pageId: string; sceneType: string }
    ): Promise<CharacterReference> {
        return this.executeWithLogging('upsertCharacter', async () => {
            try {
                const characterId = characterData.characterId || uuidv4();

                // Check if character already exists
                const existingCharacter = await CharacterEvolution.findOne({
                    bookId,
                    characterId
                }).sort({ version: -1 });

                let newVersion = 1;
                let changes: Array<{ field: string; oldValue: string; newValue: string; reason: string }> = [];

                if (existingCharacter) {
                    newVersion = existingCharacter.version + 1;
                    // Track changes
                    changes = this.detectCharacterChanges(existingCharacter, characterData);
                }

                // Create new character version
                const characterEvolution = new CharacterEvolution({
                    characterId,
                    bookId,
                    conversationId,
                    version: newVersion,
                    coreIdentity: {
                        name: characterData.name,
                        role: characterData.role,
                        ...characterData.physicalTraits?.coreIdentity
                    },
                    physicalTraits: characterData.physicalTraits || {},
                    personality: characterData.personality || {},
                    relationships: characterData.relationships || [],
                    abilities: characterData.abilities || {},
                    appearances: context ? [{
                        chapterId: context.chapterId,
                        pageId: context.pageId,
                        sceneType: context.sceneType,
                        description: `Character ${existingCharacter ? 'updated' : 'introduced'}`,
                        significantEvents: []
                    }] : [],
                    changes,
                    modifiedBy: 'ai_generation'
                });

                await characterEvolution.save();

                // Return character reference
                return this.buildCharacterReference(characterEvolution);
            } catch (error) {
                throw new DatabaseError(`Failed to upsert character: ${(error as Error).message}`);
            }
        }, { bookId, characterName: characterData.name });
    }

    /**
     * Create or update a world element
     */
    async upsertWorldElement(
        bookId: string,
        conversationId: string,
        elementData: {
            elementId?: string;
            name: string;
            type: string;
            description: string;
            visualDetails?: Record<string, any>;
            properties?: Array<{ name: string; value: string; description?: string }>;
            connections?: Array<{ targetElementId: string; relationshipType: string; description?: string }>;
            consistencyRules?: string[];
        },
        context?: { chapterId: string; pageId: string; functionalRole: string }
    ): Promise<WorldElementReference> {
        return this.executeWithLogging('upsertWorldElement', async () => {
            try {
                const elementId = elementData.elementId || uuidv4();

                // Check if element exists
                const existingElement = await WorldElement.findOne({ elementId });

                if (existingElement) {
                    // Update existing element
                    Object.assign(existingElement, {
                        description: elementData.description,
                        visualDetails: { ...existingElement.visualDetails, ...elementData.visualDetails },
                        properties: elementData.properties || existingElement.properties,
                        connections: elementData.connections || existingElement.connections,
                        consistencyRules: elementData.consistencyRules || existingElement.consistencyRules
                    });

                    if (context) {
                        existingElement.appearances.push({
                            chapterId: context.chapterId,
                            pageId: context.pageId,
                            context: context.functionalRole,
                            description: elementData.description,
                            functionalRole: context.functionalRole
                        });
                    }

                    await existingElement.save();
                    return this.buildWorldElementReference(existingElement);
                } else {
                    // Create new element
                    const worldElement = new WorldElement({
                        elementId,
                        bookId,
                        conversationId,
                        name: elementData.name,
                        type: elementData.type,
                        description: elementData.description,
                        visualDetails: elementData.visualDetails || {},
                        properties: elementData.properties || [],
                        connections: elementData.connections || [],
                        consistencyRules: elementData.consistencyRules || [],
                        currentState: {
                            status: 'active',
                            significance: 'moderate'
                        },
                        appearances: context ? [{
                            chapterId: context.chapterId,
                            pageId: context.pageId,
                            context: context.functionalRole,
                            description: elementData.description,
                            functionalRole: context.functionalRole
                        }] : []
                    });

                    await worldElement.save();
                    return this.buildWorldElementReference(worldElement);
                }
            } catch (error) {
                throw new DatabaseError(`Failed to upsert world element: ${(error as Error).message}`);
            }
        }, { bookId, elementName: elementData.name });
    }

    /**
     * Record a timeline event
     */
    async recordTimelineEvent(
        bookId: string,
        conversationId: string,
        eventData: {
            name: string;
            description: string;
            type: string;
            timing: {
                sequenceNumber: number;
                relativeTime?: string;
                absoluteTime?: string;
                timeOfDay?: string;
            };
            participants: Array<{ characterId: string; characterName: string; role: string }>;
            location?: { elementId?: string; locationName: string };
            impact?: {
                plotSignificance: string;
                characterChanges?: Array<{ characterId: string; changeType: string; description: string }>;
                worldChanges?: Array<{ elementId: string; changeType: string; description: string }>;
            };
        },
        storyPlacement: { chapterId: string; pageId?: string; scenePosition?: string }
    ): Promise<void> {
        return this.executeWithLogging('recordTimelineEvent', async () => {
            try {
                const eventId = uuidv4();

                const timelineEvent = new TimelineEvent({
                    eventId,
                    bookId,
                    conversationId,
                    name: eventData.name,
                    description: eventData.description,
                    type: eventData.type,
                    timing: eventData.timing,
                    location: eventData.location,
                    participants: eventData.participants,
                    impact: eventData.impact || { plotSignificance: 'minor' },
                    storyPlacement: {
                        chapterId: storyPlacement.chapterId,
                        pageId: storyPlacement.pageId || undefined,
                        scenePosition: storyPlacement.scenePosition || 'middle'
                    },
                    causality: { causes: [], effects: [] },
                    narrativeConnections: { foreshadowedBy: [], foreshadows: [], callbacks: [] }
                });

                await timelineEvent.save();

                // Update character appearances (only if pageId is provided)
                if (storyPlacement.pageId) {
                    for (const participant of eventData.participants) {
                        await this.updateCharacterAppearance(
                            participant.characterId,
                            storyPlacement.chapterId,
                            storyPlacement.pageId,
                            'major',
                            eventData.description
                        );
                    }
                }
            } catch (error) {
                throw new DatabaseError(`Failed to record timeline event: ${(error as Error).message}`);
            }
        }, { bookId, eventName: eventData.name });
    }

    /**
     * Validate content against narrative consistency
     */
    async validateConsistency(
        bookId: string,
        content: string,
        context: { chapterId: string; pageId?: string; title?: string }
    ): Promise<ConsistencyCheckResult> {
        return this.executeWithLogging('validateConsistency', async () => {
            try {
                // Get narrative context
                const narrativeContext = await this.getNarrativeContext(
                    bookId,
                    context.chapterId,
                    context.pageId
                );

                const violations: Array<{ type: string; severity: string; description: string; suggestions: string[] }> = [];
                const warnings: string[] = [];
                const suggestions: string[] = [];

                // Check character consistency
                for (const character of narrativeContext.characters) {
                    const characterMentions = this.findCharacterMentions(content, character.name);
                    if (characterMentions.length > 0) {
                        const characterViolations = await this.validateCharacterConsistency(
                            character,
                            content,
                            characterMentions
                        );
                        violations.push(...characterViolations);
                    }
                }

                // Check world element consistency
                for (const element of narrativeContext.worldElements) {
                    const elementMentions = this.findElementMentions(content, element.name);
                    if (elementMentions.length > 0) {
                        const elementViolations = await this.validateWorldElementConsistency(
                            element,
                            content,
                            elementMentions
                        );
                        violations.push(...elementViolations);
                    }
                }

                // Check timeline consistency
                const timelineViolations = await this.validateTimelineConsistency(
                    narrativeContext.timeline,
                    content
                );
                violations.push(...timelineViolations);

                // Generate suggestions based on context
                suggestions.push(...this.generateConsistencySuggestions(narrativeContext, content));

                return {
                    isConsistent: violations.filter(v => v.severity === 'critical').length === 0,
                    violations,
                    warnings,
                    suggestions
                };
            } catch (error) {
                throw new DatabaseError(`Failed to validate consistency: ${(error as Error).message}`);
            }
        }, { bookId, chapterId: context.chapterId });
    }

    /**
     * Get all characters for a book
     */
    private async getBookCharacters(bookId: string): Promise<CharacterReference[]> {
        const characters = await CharacterEvolution.aggregate([
            { $match: { bookId } },
            { $sort: { characterId: 1, version: -1 } },
            { $group: { _id: '$characterId', latest: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latest' } }
        ]);

        return characters.map(char => this.buildCharacterReference(char));
    }

    /**
     * Get all world elements for a book
     */
    private async getBookWorldElements(bookId: string): Promise<WorldElementReference[]> {
        const elements = await WorldElement.find({ bookId });
        return elements.map(element => this.buildWorldElementReference(element));
    }

    /**
     * Get timeline context for a specific location in the story
     */
    private async getTimelineContext(
        bookId: string,
        chapterId: string,
        pageId?: string
    ): Promise<TimelineContext> {
        // Get current and nearby events
        const allEvents = await TimelineEvent.find({ bookId })
            .sort({ 'timing.sequenceNumber': 1 });

        // Find current position in timeline
        let currentPosition = 0;
        if (pageId) {
            const currentEvent = allEvents.find(e =>
                e.storyPlacement.chapterId === chapterId &&
                e.storyPlacement.pageId === pageId
            );
            if (currentEvent) {
                currentPosition = currentEvent.timing.sequenceNumber;
            }
        }

        // Get recent and upcoming events
        const recentEvents = allEvents
            .filter(e => e.timing.sequenceNumber <= currentPosition)
            .slice(-5)
            .map(e => ({
                eventId: e.eventId,
                name: e.name,
                timing: e.timing,
                significance: e.impact.plotSignificance
            }));

        const upcomingEvents = allEvents
            .filter(e => e.timing.sequenceNumber > currentPosition)
            .slice(0, 3)
            .map(e => ({
                eventId: e.eventId,
                name: e.name,
                expectedTiming: e.timing.relativeTime || 'upcoming'
            }));

        return {
            recentEvents,
            upcomingEvents,
            timelinePosition: {
                sequenceNumber: currentPosition,
                relativeTime: `Event ${currentPosition} in timeline`
            }
        };
    }

    /**
     * Get active relationships between characters
     */
    private async getActiveRelationships(bookId: string): Promise<Array<{
        character1: string;
        character2: string;
        type: string;
        strength: number;
        recentChanges: string[];
    }>> {
        const characters = await CharacterEvolution.aggregate([
            { $match: { bookId } },
            { $sort: { characterId: 1, version: -1 } },
            { $group: { _id: '$characterId', latest: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latest' } }
        ]);

        const relationships: Array<{
            character1: string;
            character2: string;
            type: string;
            strength: number;
            recentChanges: string[];
        }> = [];

        for (const character of characters) {
            for (const relationship of character.relationships || []) {
                relationships.push({
                    character1: character.characterId,
                    character2: relationship.targetCharacterId,
                    type: relationship.relationshipType,
                    strength: relationship.strength,
                    recentChanges: relationship.history?.slice(-2).map((h: any) => h.event) || []
                });
            }
        }

        return relationships;
    }

    /**
     * Get consistency guidelines from book spec
     */
    private async getConsistencyGuidelines(bookId: string): Promise<string[]> {
        // This would integrate with your existing Book model to get spec.narrativeRules
        // For now, return default guidelines
        return [
            'Maintain character personality consistency',
            'Follow established world rules',
            'Respect timeline chronology',
            'Honor relationship dynamics',
            'Preserve visual descriptions'
        ];
    }

    /**
     * Helper methods for building references and validating consistency
     */
    private buildCharacterReference(characterEvolution: any): CharacterReference {
        return {
            characterId: characterEvolution.characterId,
            name: characterEvolution.coreIdentity.name,
            currentState: {
                physicalTraits: characterEvolution.physicalTraits,
                personality: characterEvolution.personality,
                relationships: characterEvolution.relationships,
                abilities: characterEvolution.abilities,
                currentGoals: characterEvolution.personality?.goals?.filter((g: any) => g.status === 'active').map((g: any) => g.description) || []
            },
            lastAppearance: characterEvolution.appearances?.slice(-1)[0]
        };
    }

    private buildWorldElementReference(worldElement: any): WorldElementReference {
        return {
            elementId: worldElement.elementId,
            name: worldElement.name,
            type: worldElement.type,
            currentState: {
                description: worldElement.description,
                visualDetails: worldElement.visualDetails,
                properties: worldElement.properties,
                status: worldElement.currentState?.status || 'active',
                controlledBy: worldElement.currentState?.controlledBy
            },
            connections: worldElement.connections,
            consistencyRules: worldElement.consistencyRules
        };
    }

    private detectCharacterChanges(existing: any, updated: any): Array<{ field: string; oldValue: string; newValue: string; reason: string }> {
        // Implementation would compare character data and detect meaningful changes
        return [];
    }

    private findCharacterMentions(content: string, characterName: string): string[] {
        // Simple implementation - would be enhanced with NLP
        const regex = new RegExp(`\\b${characterName}\\b`, 'gi');
        return content.match(regex) || [];
    }

    private findElementMentions(content: string, elementName: string): string[] {
        const regex = new RegExp(`\\b${elementName}\\b`, 'gi');
        return content.match(regex) || [];
    }

    private async validateCharacterConsistency(character: CharacterReference, content: string, mentions: string[]): Promise<Array<{ type: string; severity: string; description: string; suggestions: string[] }>> {
        // Implementation would check character traits against content
        return [];
    }

    private async validateWorldElementConsistency(element: WorldElementReference, content: string, mentions: string[]): Promise<Array<{ type: string; severity: string; description: string; suggestions: string[] }>> {
        // Implementation would validate world element usage
        return [];
    }

    private async validateTimelineConsistency(timeline: TimelineContext, content: string): Promise<Array<{ type: string; severity: string; description: string; suggestions: string[] }>> {
        // Implementation would check temporal consistency
        return [];
    }

    private generateConsistencySuggestions(context: NarrativeContext, content: string): string[] {
        // Implementation would generate helpful suggestions
        return [];
    }

    private async updateCharacterAppearance(characterId: string, chapterId: string, pageId: string, sceneType: string, description: string): Promise<void> {
        await CharacterEvolution.updateOne(
            { characterId },
            { $push: { appearances: { chapterId, pageId, sceneType, description, significantEvents: [] } } }
        );
    }
}

/**
 * Codex RAG Service - Integrates story bible elements with LibreChat's RAG system
 * Provides context-aware retrieval for characters, world elements, and timeline events
 */

import axios from 'axios';
import FormData from 'form-data';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { CharacterReference, WorldElementReference, TimelineEvent } from '../../models/NarrativeElements.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CodexEntry {
    id: string;
    type: 'character' | 'world_element' | 'timeline_event' | 'story_note';
    name: string;
    content: string;
    metadata: Record<string, any>;
    bookId: string;
    conversationId: string;
}

export interface ContextPreview {
    type: 'character' | 'world_element' | 'timeline_event';
    name: string;
    summary: string;
    details: string;
    relevance: number;
    lastAppeared?: string;
    relationships?: string[];
}

export interface ReferenceDetection {
    text: string;
    position: { start: number; end: number };
    type: 'character' | 'location' | 'event' | 'object';
    confidence: number;
    preview: ContextPreview;
}

export class CodexRagService extends BaseService {
    private ragApiUrl: string;
    private tempDir: string;
    private codexCollection: string;

    constructor(logger: ILogger) {
        super(logger);
        this.ragApiUrl = process.env.RAG_API_URL || 'http://rag_api:8000';
        this.tempDir = path.join(__dirname, '../temp/codex');
        this.codexCollection = 'book_codex';
        this.ensureTempDir();
    }

    protected async performHealthCheck() {
        try {
            const response = await axios.get(`${this.ragApiUrl}/health`);
            return {
                status: 'healthy',
                ragApiConnected: response.status === 200,
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                ragApiConnected: false,
                error: (error as Error).message,
                lastCheck: new Date(),
            };
        }
    }

    private async ensureTempDir() {
        try {
            await fsPromises.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            this.logger.warn('Could not create codex temp directory:', error as Error);
        }
    }

    /**
     * Sync all narrative elements for a book to RAG
     */
    async syncBookToCodex(bookId: string, conversationId: string): Promise<{
        success: boolean;
        syncedElements: number;
        errors: string[];
    }> {
        return this.executeWithLogging('syncBookToCodex', async () => {
            const errors: string[] = [];
            let syncedElements = 0;

            try {
                // Sync characters
                const characters = await CharacterReference.find({ bookId }).lean();
                for (const character of characters) {
                    try {
                        await this.storeCharacterInCodex(character, conversationId);
                        syncedElements++;
                    } catch (error) {
                        errors.push(`Character ${character.coreIdentity?.name}: ${(error as Error).message}`);
                    }
                }

                // Sync world elements
                const worldElements = await WorldElementReference.find({ bookId }).lean();
                for (const element of worldElements) {
                    try {
                        await this.storeWorldElementInCodex(element, conversationId);
                        syncedElements++;
                    } catch (error) {
                        errors.push(`World element ${element.name}: ${(error as Error).message}`);
                    }
                }

                // Sync timeline events
                const timelineEvents = await TimelineEvent.find({ bookId }).lean();
                for (const event of timelineEvents) {
                    try {
                        await this.storeTimelineEventInCodex(event, conversationId);
                        syncedElements++;
                    } catch (error) {
                        errors.push(`Timeline event ${event.name}: ${(error as Error).message}`);
                    }
                }

                return {
                    success: errors.length === 0,
                    syncedElements,
                    errors,
                };
            } catch (error) {
                throw new Error(`Failed to sync book to codex: ${(error as Error).message}`);
            }
        }, { bookId });
    }

    /**
     * Store character data in RAG
     */
    private async storeCharacterInCodex(character: any, conversationId: string): Promise<void> {
        const codexEntry = this.formatCharacterForCodex(character, conversationId);
        await this.storeCodexEntry(codexEntry);
    }

    /**
     * Store world element in RAG
     */
    private async storeWorldElementInCodex(element: any, conversationId: string): Promise<void> {
        const codexEntry = this.formatWorldElementForCodex(element, conversationId);
        await this.storeCodexEntry(codexEntry);
    }

    /**
     * Store timeline event in RAG
     */
    private async storeTimelineEventInCodex(event: any, conversationId: string): Promise<void> {
        const codexEntry = this.formatTimelineEventForCodex(event, conversationId);
        await this.storeCodexEntry(codexEntry);
    }

    /**
     * Format character data for RAG storage
     */
    private formatCharacterForCodex(character: any, conversationId: string): CodexEntry {
        const identity = character.coreIdentity || {};
        const physical = character.physicalTraits || {};
        const personality = character.personality || {};
        const relationships = character.relationships || [];

        const content = `CHARACTER: ${identity.name || 'Unknown'}

ROLE: ${identity.role || 'Unknown'}
AGE: ${identity.age || 'Unknown'}
GENDER: ${identity.gender || 'Unknown'}

PHYSICAL DESCRIPTION:
- Height: ${physical.height || 'Unknown'}
- Build: ${physical.build || 'Unknown'}
- Hair: ${physical.hairColor || 'Unknown'} ${physical.hairStyle || ''}
- Eyes: ${physical.eyeColor || 'Unknown'}
- Skin: ${physical.skinTone || 'Unknown'}
- Distinctive Features: ${physical.distinctiveFeatures?.join(', ') || 'None noted'}

PERSONALITY:
- Core Traits: ${personality.coreTraits?.join(', ') || 'None noted'}
- Values: ${personality.values?.join(', ') || 'None noted'}
- Fears: ${personality.fears?.join(', ') || 'None noted'}
- Goals: ${personality.goals?.map((g: any) => `${g.description} (${g.status})`).join('; ') || 'None noted'}

RELATIONSHIPS:
${relationships.map((rel: any) => 
    `- ${rel.targetName}: ${rel.relationshipType} (strength: ${rel.strength}/10)`
).join('\n') || 'No relationships noted'}

APPEARANCES:
${character.appearances?.map((app: any) => 
    `- Chapter ${app.chapterId}, Page ${app.pageId}: ${app.description || 'General appearance'}`
).join('\n') || 'No appearances tracked'}

BACKGROUND: ${character.background?.origin || 'No background information'}`;

        return {
            id: `char_${character.characterId}`,
            type: 'character',
            name: identity.name || 'Unknown Character',
            content,
            metadata: {
                characterId: character.characterId,
                role: identity.role,
                bookId: character.bookId,
                conversationId,
                type: 'character',
                lastAppeared: character.appearances?.[character.appearances.length - 1]?.chapterId,
                relationships: relationships.map((r: any) => r.targetName),
            },
            bookId: character.bookId,
            conversationId,
        };
    }

    /**
     * Format world element for RAG storage
     */
    private formatWorldElementForCodex(element: any, conversationId: string): CodexEntry {
        const visual = element.visualDetails || {};
        const properties = element.properties || [];
        const connections = element.connections || [];

        const content = `WORLD ELEMENT: ${element.name}

TYPE: ${element.type}
CATEGORY: ${element.category || 'General'}

DESCRIPTION: ${element.description}

VISUAL DETAILS:
- Appearance: ${visual.appearance || 'Not described'}
- Size: ${visual.size || 'Unknown'}
- Colors: ${visual.colors?.join(', ') || 'Not specified'}
- Materials: ${visual.materials?.join(', ') || 'Not specified'}
- Atmosphere: ${visual.atmosphere || 'Not described'}

PROPERTIES:
${properties.map((prop: any) => 
    `- ${prop.name}: ${prop.value} ${prop.description ? `(${prop.description})` : ''}`
).join('\n') || 'No properties defined'}

CONNECTIONS:
${connections.map((conn: any) => 
    `- ${conn.relationshipType} ${conn.targetName}: ${conn.description || 'No description'}`
).join('\n') || 'No connections defined'}

CURRENT STATE: ${element.currentState?.status || 'Unknown'} - ${element.currentState?.condition || 'No condition noted'}

CONSISTENCY RULES:
${element.consistencyRules?.map((rule: any) => 
    `- ${rule.rule} (${rule.importance})`
).join('\n') || 'No specific rules defined'}`;

        return {
            id: `world_${element.elementId}`,
            type: 'world_element',
            name: element.name,
            content,
            metadata: {
                elementId: element.elementId,
                type: element.type,
                category: element.category,
                bookId: element.bookId,
                conversationId,
                lastAppeared: element.appearances?.[element.appearances.length - 1]?.chapterId,
                connections: connections.map((c: any) => c.targetName),
            },
            bookId: element.bookId,
            conversationId,
        };
    }

    /**
     * Format timeline event for RAG storage
     */
    private formatTimelineEventForCodex(event: any, conversationId: string): CodexEntry {
        const timing = event.timing || {};
        const participants = event.participants || [];
        const impact = event.impact || {};

        const content = `TIMELINE EVENT: ${event.name}

TYPE: ${event.type}
DESCRIPTION: ${event.description}

TIMING:
- Sequence: ${timing.sequenceNumber}
- Absolute Time: ${timing.absoluteTime || 'Unknown'}
- Relative Time: ${timing.relativeTime || 'Unknown'}
- Time of Day: ${timing.timeOfDay || 'Unknown'}

LOCATION: ${event.location?.locationName || 'Unknown location'}
${event.location?.specificPlace ? `Specific Place: ${event.location.specificPlace}` : ''}

PARTICIPANTS:
${participants.map((p: any) => 
    `- ${p.characterName} (${p.role}, ${p.presence})`
).join('\n') || 'No participants recorded'}

PLOT SIGNIFICANCE: ${impact.plotSignificance || 'Unknown'}

CHARACTER CHANGES:
${impact.characterChanges?.map((change: any) => 
    `- ${change.characterId}: ${change.changeType} - ${change.description}`
).join('\n') || 'No character changes noted'}

CAUSALITY:
${event.causality?.causes?.map((cause: any) => 
    `Caused by: ${cause.description} (${cause.strength})`
).join('\n') || 'No causes recorded'}

${event.causality?.effects?.map((effect: any) => 
    `Causes: ${effect.description} (${effect.certainty}, ${effect.timeframe})`
).join('\n') || 'No effects recorded'}`;

        return {
            id: `event_${event.eventId}`,
            type: 'timeline_event',
            name: event.name,
            content,
            metadata: {
                eventId: event.eventId,
                type: event.type,
                sequenceNumber: timing.sequenceNumber,
                bookId: event.bookId,
                conversationId,
                participants: participants.map((p: any) => p.characterName),
                plotSignificance: impact.plotSignificance,
            },
            bookId: event.bookId,
            conversationId,
        };
    }

    /**
     * Store codex entry in RAG system
     */
    private async storeCodexEntry(entry: CodexEntry): Promise<void> {
        try {
            // Create temporary file
            const tempFileName = `${entry.id}_${Date.now()}.txt`;
            const tempFilePath = path.join(this.tempDir, tempFileName);

            await fsPromises.writeFile(tempFilePath, entry.content, 'utf8');

            // Upload to RAG
            const formData = new FormData();
            formData.append('file_id', entry.id);
            formData.append('file', fs.createReadStream(tempFilePath));
            formData.append('entity_id', `${this.codexCollection}_${entry.bookId}`);
            formData.append('metadata', JSON.stringify(entry.metadata));

            await axios.post(`${this.ragApiUrl}/embed`, formData, {
                headers: {
                    Authorization: `Bearer codex-${Date.now()}`,
                    accept: 'application/json',
                    ...formData.getHeaders(),
                },
                timeout: 30000,
            });

            // Clean up temp file
            await fsPromises.unlink(tempFilePath);
        } catch (error) {
            throw new Error(`Failed to store ${entry.type} ${entry.name}: ${(error as Error).message}`);
        }
    }

    /**
     * Query codex for relevant context
     */
    async queryCodexContext(
        query: string,
        bookId: string,
        options: {
            limit?: number;
            types?: ('character' | 'world_element' | 'timeline_event')[];
            minRelevance?: number;
        } = {}
    ): Promise<ContextPreview[]> {
        return this.executeWithLogging('queryCodexContext', async () => {
            const { limit = 5, types = ['character', 'world_element', 'timeline_event'], minRelevance = 0.7 } = options;

            try {
                const response = await axios.post(`${this.ragApiUrl}/query`, {
                    query,
                    k: limit * 2, // Get more results to filter
                    filter: {
                        collection: `${this.codexCollection}_${bookId}`,
                    },
                });

                const results = response.data.results || [];
                const previews: ContextPreview[] = [];

                for (const result of results) {
                    if (result.score < minRelevance) continue;

                    const metadata = result.metadata || {};
                    if (types.length > 0 && !types.includes(metadata.type)) continue;

                    previews.push({
                        type: metadata.type,
                        name: metadata.characterId ? metadata.characterId : 
                              metadata.elementId ? metadata.elementId : 
                              metadata.eventId || 'Unknown',
                        summary: this.extractSummary(result.content),
                        details: result.content,
                        relevance: result.score,
                        lastAppeared: metadata.lastAppeared,
                        relationships: metadata.relationships || metadata.connections || metadata.participants,
                    });

                    if (previews.length >= limit) break;
                }

                return previews;
            } catch (error) {
                this.logger.error('Failed to query codex context', error as Error);
                return [];
            }
        }, { query, bookId });
    }

    /**
     * Detect references in text content
     */
    async detectReferences(
        content: string,
        bookId: string,
        conversationId: string
    ): Promise<ReferenceDetection[]> {
        return this.executeWithLogging('detectReferences', async () => {
            const detections: ReferenceDetection[] = [];

            // Get all codex entries for the book
            const allContext = await this.queryCodexContext('', bookId, { limit: 100, minRelevance: 0.1 });

            // Simple name-based detection (can be enhanced with NLP)
            for (const contextItem of allContext) {
                const regex = new RegExp(`\\b${contextItem.name}\\b`, 'gi');
                let match;

                while ((match = regex.exec(content)) !== null) {
                    detections.push({
                        text: match[0],
                        position: { start: match.index, end: match.index + match[0].length },
                        type: contextItem.type === 'timeline_event' ? 'event' : 
                              contextItem.type === 'world_element' ? 'location' : 'character',
                        confidence: 0.8, // Simple name matching confidence
                        preview: contextItem,
                    });
                }
            }

            return detections.sort((a, b) => a.position.start - b.position.start);
        }, { bookId, contentLength: content.length });
    }

    /**
     * Extract summary from full content
     */
    private extractSummary(content: string): string {
        const lines = content.split('\n');
        const titleLine = lines.find(line => line.startsWith('CHARACTER:') || line.startsWith('WORLD ELEMENT:') || line.startsWith('TIMELINE EVENT:'));
        const descriptionLine = lines.find(line => line.startsWith('DESCRIPTION:'));
        
        let summary = titleLine || '';
        if (descriptionLine) {
            const desc = descriptionLine.replace('DESCRIPTION:', '').trim();
            summary += desc.length > 100 ? ` - ${desc.substring(0, 100)}...` : ` - ${desc}`;
        }
        
        return summary;
    }

    protected async onDispose(): Promise<void> {
        // Clean up temp directory
        try {
            await fsPromises.rmdir(this.tempDir, { recursive: true });
        } catch (error) {
            this.logger.warn('Failed to clean up codex temp directory', error as Error);
        }
    }
}

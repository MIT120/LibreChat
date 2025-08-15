/**
 * Narrative Consistency Tool Handlers - MCP tools for managing story consistency
 */

import { z } from 'zod';
import { ILogger } from '../../core/Logger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService.js';
import { BaseToolHandler } from '../../core/BaseToolHandler.js';

export class NarrativeConsistencyToolHandlers extends BaseToolHandler {
    private narrativeService: NarrativeConsistencyService;

    constructor(logger: ILogger, narrativeService: NarrativeConsistencyService) {
        super(logger, 'NarrativeConsistencyToolHandlers');
        this.narrativeService = narrativeService;
        this.initialize();
    }

    protected defineTools(): void {
        // Will use getTools() method instead
    }

    override getTools(): IToolHandler[] {
        return [
            // Get narrative context for current writing location
            {
                name: 'get_narrative_context',
                description: 'Get comprehensive narrative context including characters, world elements, and timeline for current writing location',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        chapterId: { type: 'string', description: 'Chapter identifier' },
                        pageId: { type: 'string', description: 'Page identifier (optional)' },
                        includeDetails: {
                            type: 'object',
                            properties: {
                                characters: { type: 'boolean', default: true, description: 'Include character details' },
                                worldElements: { type: 'boolean', default: true, description: 'Include world elements' },
                                timeline: { type: 'boolean', default: true, description: 'Include timeline context' },
                                relationships: { type: 'boolean', default: true, description: 'Include relationship dynamics' }
                            }
                        }
                    },
                    required: ['bookId', 'chapterId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        chapterId: z.string(),
                        pageId: z.string().optional(),
                        includeDetails: z.object({
                            characters: z.boolean().default(true),
                            worldElements: z.boolean().default(true),
                            timeline: z.boolean().default(true),
                            relationships: z.boolean().default(true)
                        }).optional()
                    });

                    const { bookId, chapterId, pageId, includeDetails = {} } = schema.parse(args);

                    try {
                        const context = await this.narrativeService.getNarrativeContext(bookId, chapterId, pageId);
                        
                        // Filter context based on includeDetails preferences
                        const filteredContext = {
                            bookId: context.bookId,
                            chapterId: context.chapterId,
                            pageId: context.pageId,
                            characters: includeDetails.characters !== false ? context.characters : [],
                            worldElements: includeDetails.worldElements !== false ? context.worldElements : [],
                            timeline: includeDetails.timeline !== false ? context.timeline : null,
                            activeRelationships: includeDetails.relationships !== false ? context.activeRelationships : [],
                            consistencyGuidelines: context.consistencyGuidelines
                        };

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    context: filteredContext,
                                    message: `Retrieved narrative context for chapter ${chapterId}${pageId ? `, page ${pageId}` : ''}`
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error getting narrative context: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Register or update a character
            {
                name: 'register_character',
                description: 'Register a new character or update existing character in the narrative consistency database',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        characterId: { type: 'string', description: 'Character identifier (optional for new characters)' },
                        name: { type: 'string', description: 'Character name' },
                        role: { 
                            type: 'string', 
                            enum: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief'],
                            description: 'Character role in story' 
                        },
                        physicalTraits: {
                            type: 'object',
                            properties: {
                                age: { type: 'number' },
                                height: { type: 'string' },
                                build: { type: 'string' },
                                hairColor: { type: 'string' },
                                eyeColor: { type: 'string' },
                                distinctiveFeatures: { type: 'array', items: { type: 'string' } },
                                clothing: {
                                    type: 'object',
                                    properties: {
                                        style: { type: 'string' },
                                        colors: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            },
                            description: 'Physical appearance details'
                        },
                        personality: {
                            type: 'object',
                            properties: {
                                coreTraits: { type: 'array', items: { type: 'string' } },
                                values: { type: 'array', items: { type: 'string' } },
                                fears: { type: 'array', items: { type: 'string' } },
                                goals: { 
                                    type: 'array', 
                                    items: { 
                                        type: 'object',
                                        properties: {
                                            description: { type: 'string' },
                                            priority: { type: 'string', enum: ['primary', 'secondary', 'minor'] }
                                        }
                                    }
                                }
                            },
                            description: 'Personality and motivation details'
                        },
                        relationships: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    targetCharacterId: { type: 'string' },
                                    targetName: { type: 'string' },
                                    type: { 
                                        type: 'string', 
                                        enum: ['family', 'romantic', 'friendship', 'rivalry', 'mentor', 'enemy', 'alliance', 'neutral']
                                    },
                                    strength: { type: 'number', minimum: -10, maximum: 10 }
                                }
                            },
                            description: 'Character relationships'
                        },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string' },
                                pageId: { type: 'string' },
                                sceneType: { type: 'string', enum: ['major', 'minor', 'mention', 'flashback'] }
                            },
                            description: 'Context where character is introduced/updated'
                        }
                    },
                    required: ['bookId', 'conversationId', 'name', 'role']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        conversationId: z.string(),
                        characterId: z.string().optional(),
                        name: z.string(),
                        role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief']),
                        physicalTraits: z.object({}).passthrough().optional(),
                        personality: z.object({}).passthrough().optional(),
                        relationships: z.array(z.object({
                            targetCharacterId: z.string(),
                            targetName: z.string(),
                            type: z.enum(['family', 'romantic', 'friendship', 'rivalry', 'mentor', 'enemy', 'alliance', 'neutral']),
                            strength: z.number().min(-10).max(10)
                        })).optional(),
                        context: z.object({
                            chapterId: z.string(),
                            pageId: z.string(),
                            sceneType: z.enum(['major', 'minor', 'mention', 'flashback'])
                        }).optional()
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        const characterRef = await this.narrativeService.upsertCharacter(
                            validatedArgs.bookId,
                            validatedArgs.conversationId,
                            {
                                characterId: validatedArgs.characterId,
                                name: validatedArgs.name,
                                role: validatedArgs.role,
                                physicalTraits: validatedArgs.physicalTraits,
                                personality: validatedArgs.personality,
                                relationships: validatedArgs.relationships?.filter(r => r.targetCharacterId && r.type && r.strength !== undefined).map(r => ({
                                    targetCharacterId: r.targetCharacterId!,
                                    type: r.type!,
                                    strength: r.strength!
                                })) || []
                            },
                            {
                                chapterId: validatedArgs.context.chapterId || '',
                                pageId: validatedArgs.context.pageId || '',
                                sceneType: validatedArgs.context.sceneType || 'mention'
                            }
                        );

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    character: characterRef,
                                    message: `Character "${validatedArgs.name}" registered successfully`
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error registering character: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Register or update a world element
            {
                name: 'register_world_element',
                description: 'Register a new world element or update existing one in the narrative consistency database',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        elementId: { type: 'string', description: 'Element identifier (optional for new elements)' },
                        name: { type: 'string', description: 'Element name' },
                        type: { 
                            type: 'string', 
                            enum: ['location', 'culture', 'organization', 'rule', 'technology', 'magic_system', 'religion', 'language', 'currency', 'artifact'],
                            description: 'Type of world element' 
                        },
                        description: { type: 'string', description: 'Detailed description' },
                        visualDetails: {
                            type: 'object',
                            properties: {
                                appearance: { type: 'string' },
                                size: { type: 'string' },
                                colors: { type: 'array', items: { type: 'string' } },
                                materials: { type: 'array', items: { type: 'string' } },
                                atmosphere: { type: 'string' }
                            },
                            description: 'Visual description details'
                        },
                        properties: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    value: { type: 'string' },
                                    description: { type: 'string' }
                                }
                            },
                            description: 'Element properties and rules'
                        },
                        connections: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    targetElementId: { type: 'string' },
                                    relationshipType: { 
                                        type: 'string', 
                                        enum: ['contains', 'adjacent_to', 'part_of', 'governed_by', 'conflicts_with', 'allied_with', 'depends_on']
                                    },
                                    description: { type: 'string' }
                                }
                            },
                            description: 'Connections to other world elements'
                        },
                        consistencyRules: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Rules that must be followed when using this element'
                        },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string' },
                                pageId: { type: 'string' },
                                functionalRole: { type: 'string' }
                            },
                            description: 'Context where element is introduced/updated'
                        }
                    },
                    required: ['bookId', 'conversationId', 'name', 'type', 'description']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        conversationId: z.string(),
                        elementId: z.string().optional(),
                        name: z.string(),
                        type: z.enum(['location', 'culture', 'organization', 'rule', 'technology', 'magic_system', 'religion', 'language', 'currency', 'artifact']),
                        description: z.string(),
                        visualDetails: z.object({}).passthrough().optional(),
                        properties: z.array(z.object({
                            name: z.string(),
                            value: z.string(),
                            description: z.string().optional()
                        })).optional(),
                        connections: z.array(z.object({
                            targetElementId: z.string(),
                            relationshipType: z.enum(['contains', 'adjacent_to', 'part_of', 'governed_by', 'conflicts_with', 'allied_with', 'depends_on']),
                            description: z.string().optional()
                        })).optional(),
                        consistencyRules: z.array(z.string()).optional(),
                        context: z.object({
                            chapterId: z.string(),
                            pageId: z.string(),
                            functionalRole: z.string()
                        }).optional()
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        const elementRef = await this.narrativeService.upsertWorldElement(
                            validatedArgs.bookId,
                            validatedArgs.conversationId,
                            {
                                elementId: validatedArgs.elementId,
                                name: validatedArgs.name,
                                type: validatedArgs.type,
                                description: validatedArgs.description,
                                visualDetails: validatedArgs.visualDetails,
                                properties: validatedArgs.properties?.filter(p => p.name && p.value).map(p => ({
                                    name: p.name!,
                                    value: p.value!,
                                    description: p.description
                                })) || [],
                                connections: validatedArgs.connections?.filter(c => c.targetElementId && c.relationshipType).map(c => ({
                                    targetElementId: c.targetElementId!,
                                    relationshipType: c.relationshipType!,
                                    description: c.description
                                })) || [],
                                consistencyRules: validatedArgs.consistencyRules
                            },
                            {
                                chapterId: validatedArgs.context.chapterId || '',
                                pageId: validatedArgs.context.pageId || '',
                                functionalRole: validatedArgs.context.functionalRole || 'background'
                            }
                        );

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    element: elementRef,
                                    message: `World element "${validatedArgs.name}" registered successfully`
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error registering world element: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Record a timeline event
            {
                name: 'record_timeline_event',
                description: 'Record a significant event in the story timeline for consistency tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        name: { type: 'string', description: 'Event name' },
                        description: { type: 'string', description: 'Event description' },
                        type: { 
                            type: 'string', 
                            enum: ['plot_point', 'character_development', 'world_change', 'relationship_change', 'conflict', 'resolution'],
                            description: 'Type of event' 
                        },
                        timing: {
                            type: 'object',
                            properties: {
                                sequenceNumber: { type: 'number', description: 'Position in story sequence' },
                                relativeTime: { type: 'string', description: 'Relative timing (e.g., "three days later")' },
                                absoluteTime: { type: 'string', description: 'Absolute time in story world' },
                                timeOfDay: { 
                                    type: 'string', 
                                    enum: ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night', 'midnight']
                                }
                            },
                            required: ['sequenceNumber']
                        },
                        participants: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    characterId: { type: 'string' },
                                    characterName: { type: 'string' },
                                    role: { type: 'string', enum: ['protagonist', 'instigator', 'victim', 'witness', 'catalyst'] }
                                }
                            },
                            description: 'Characters involved in the event'
                        },
                        location: {
                            type: 'object',
                            properties: {
                                elementId: { type: 'string' },
                                locationName: { type: 'string' },
                                specificPlace: { type: 'string' }
                            },
                            description: 'Where the event takes place'
                        },
                        impact: {
                            type: 'object',
                            properties: {
                                plotSignificance: { type: 'string', enum: ['major', 'moderate', 'minor'] },
                                characterChanges: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            characterId: { type: 'string' },
                                            changeType: { type: 'string' },
                                            description: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        },
                        storyPlacement: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string' },
                                pageId: { type: 'string' },
                                scenePosition: { type: 'string', enum: ['opening', 'middle', 'climax', 'resolution'] }
                            },
                            required: ['chapterId', 'pageId']
                        }
                    },
                    required: ['bookId', 'conversationId', 'name', 'description', 'type', 'timing', 'storyPlacement']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        conversationId: z.string(),
                        name: z.string(),
                        description: z.string(),
                        type: z.enum(['plot_point', 'character_development', 'world_change', 'relationship_change', 'conflict', 'resolution']),
                        timing: z.object({
                            sequenceNumber: z.number(),
                            relativeTime: z.string().optional(),
                            absoluteTime: z.string().optional(),
                            timeOfDay: z.enum(['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night', 'midnight']).optional()
                        }),
                        participants: z.array(z.object({
                            characterId: z.string(),
                            characterName: z.string(),
                            role: z.enum(['protagonist', 'instigator', 'victim', 'witness', 'catalyst'])
                        })).optional().default([]),
                        location: z.object({
                            elementId: z.string().optional(),
                            locationName: z.string(),
                            specificPlace: z.string().optional()
                        }).optional(),
                        impact: z.object({
                            plotSignificance: z.enum(['major', 'moderate', 'minor']).default('minor'),
                            characterChanges: z.array(z.object({
                                characterId: z.string(),
                                changeType: z.string(),
                                description: z.string()
                            })).optional()
                        }).optional(),
                        storyPlacement: z.object({
                            chapterId: z.string(),
                            pageId: z.string(),
                            scenePosition: z.enum(['opening', 'middle', 'climax', 'resolution']).optional()
                        })
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        await this.narrativeService.recordTimelineEvent(
                            validatedArgs.bookId,
                            validatedArgs.conversationId,
                            {
                                name: validatedArgs.name,
                                description: validatedArgs.description,
                                type: validatedArgs.type,
                                timing: {
                                    sequenceNumber: validatedArgs.timing.sequenceNumber || 1,
                                    relativeTime: validatedArgs.timing.relativeTime,
                                    absoluteTime: validatedArgs.timing.absoluteTime,
                                    timeOfDay: validatedArgs.timing.timeOfDay
                                },
                                participants: validatedArgs.participants.filter(p => p.characterId && p.characterName && p.role).map(p => ({
                                    characterId: p.characterId!,
                                    characterName: p.characterName!,
                                    role: p.role!
                                })) || [],
                                location: validatedArgs.location?.locationName ? {
                                    elementId: validatedArgs.location.elementId,
                                    locationName: validatedArgs.location.locationName!
                                } : undefined,
                                impact: {
                                    plotSignificance: validatedArgs.impact?.plotSignificance || 'minor',
                                    characterChanges: validatedArgs.impact?.characterChanges?.filter(c => c.characterId && c.changeType && c.description).map(c => ({
                                        characterId: c.characterId!,
                                        changeType: c.changeType!,
                                        description: c.description!
                                    })) || []
                                }
                            },
                            {
                                chapterId: validatedArgs.storyPlacement.chapterId || '',
                                pageId: validatedArgs.storyPlacement.pageId || '',
                                scenePosition: validatedArgs.storyPlacement.scenePosition
                            }
                        );

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: `Timeline event "${validatedArgs.name}" recorded successfully`
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error recording timeline event: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Validate content consistency
            {
                name: 'validate_consistency',
                description: 'Validate content against established narrative consistency rules and detect potential violations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        content: { type: 'string', description: 'Content to validate' },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string' },
                                pageId: { type: 'string' },
                                title: { type: 'string' }
                            },
                            required: ['chapterId']
                        },
                        validationLevel: {
                            type: 'string',
                            enum: ['strict', 'moderate', 'lenient'],
                            default: 'moderate',
                            description: 'How strict the validation should be'
                        }
                    },
                    required: ['bookId', 'content', 'context']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        content: z.string(),
                        context: z.object({
                            chapterId: z.string(),
                            pageId: z.string().optional(),
                            title: z.string().optional()
                        }),
                        validationLevel: z.enum(['strict', 'moderate', 'lenient']).default('moderate')
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        const result = await this.narrativeService.validateConsistency(
                            validatedArgs.bookId,
                            validatedArgs.content,
                            {
                                chapterId: validatedArgs.context.chapterId,
                                pageId: validatedArgs.context.pageId,
                                title: validatedArgs.context.title
                            }
                        );

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    consistencyCheck: result,
                                    message: result.isConsistent ? 
                                        'Content passes consistency validation' : 
                                        `Content has ${result.violations.length} consistency issues`
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error validating consistency: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Query character information
            {
                name: 'query_character',
                description: 'Query detailed information about a specific character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        characterId: { type: 'string', description: 'Character identifier (optional if name provided)' },
                        characterName: { type: 'string', description: 'Character name (optional if ID provided)' },
                        includeHistory: { type: 'boolean', default: false, description: 'Include character evolution history' },
                        includeRelationships: { type: 'boolean', default: true, description: 'Include relationship information' }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        characterId: z.string().optional(),
                        characterName: z.string().optional(),
                        includeHistory: z.boolean().default(false),
                        includeRelationships: z.boolean().default(true)
                    });

                    const validatedArgs = schema.parse(args);

                    if (!validatedArgs.characterId && !validatedArgs.characterName) {
                        throw new Error('Either characterId or characterName must be provided');
                    }

                    try {
                        // Implementation would query character details
                        // For now, return a placeholder response
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: 'Character query functionality to be implemented',
                                    note: 'This tool will provide detailed character information including current state, history, and relationships'
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error querying character: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            // Get world element details
            {
                name: 'query_world_element',
                description: 'Query detailed information about a specific world element',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        elementId: { type: 'string', description: 'Element identifier (optional if name provided)' },
                        elementName: { type: 'string', description: 'Element name (optional if ID provided)' },
                        includeConnections: { type: 'boolean', default: true, description: 'Include connected elements' },
                        includeHistory: { type: 'boolean', default: false, description: 'Include element history' }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string(),
                        elementId: z.string().optional(),
                        elementName: z.string().optional(),
                        includeConnections: z.boolean().default(true),
                        includeHistory: z.boolean().default(false)
                    });

                    const validatedArgs = schema.parse(args);

                    if (!validatedArgs.elementId && !validatedArgs.elementName) {
                        throw new Error('Either elementId or elementName must be provided');
                    }

                    try {
                        // Implementation would query world element details
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: 'World element query functionality to be implemented',
                                    note: 'This tool will provide detailed world element information including properties, connections, and consistency rules'
                                }, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error querying world element: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            }
        ];
    }
}

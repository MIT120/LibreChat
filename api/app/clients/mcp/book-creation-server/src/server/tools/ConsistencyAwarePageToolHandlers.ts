/**
 * Consistency-Aware Page Tool Handlers - Enhanced page creation with narrative consistency
 */

import { z } from 'zod';
import { CreatePageRequest, UpdatePageRequest, PageStatus } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IPageService, IToolHandler } from '../../interfaces/index.js';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService.js';
import { BaseToolHandler } from '../../core/BaseToolHandler.js';

export class ConsistencyAwarePageToolHandlers extends BaseToolHandler {
    private pageService: IPageService;
    private narrativeService: NarrativeConsistencyService;

    constructor(logger: ILogger, pageService: IPageService, narrativeService: NarrativeConsistencyService) {
        super(logger, 'ConsistencyAwarePageToolHandlers');
        this.pageService = pageService;
        this.narrativeService = narrativeService;
        this.initialize();
    }

    protected defineTools(): void {
        // Will use getTools() method instead
    }

    override getTools(): IToolHandler[] {
        return [
            {
                name: 'create_page_with_consistency',
                description: 'Create a new page with narrative consistency validation and context injection',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: { type: 'string', description: 'Chapter identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        title: { type: 'string', description: 'Page title' },
                        content: { type: 'string', description: 'Page content' },
                        notes: { type: 'string', description: 'Page notes (optional)' },
                        pageNumber: { type: 'number', description: 'Page number (optional - will auto-increment if not provided)' },
                        
                        // Consistency-related options
                        validateConsistency: { 
                            type: 'boolean', 
                            default: true, 
                            description: 'Whether to validate content against narrative consistency rules' 
                        },
                        autoRegisterElements: { 
                            type: 'boolean', 
                            default: true, 
                            description: 'Automatically register new characters and world elements found in content' 
                        },
                        recordTimelineEvents: { 
                            type: 'boolean', 
                            default: true, 
                            description: 'Automatically record significant events in the timeline' 
                        },
                        
                        // Manual element registration
                        characters: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    role: { type: 'string', enum: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief'] },
                                    description: { type: 'string' },
                                    physicalTraits: { type: 'object' },
                                    personality: { type: 'object' }
                                }
                            },
                            description: 'Characters to register or update'
                        },
                        
                        worldElements: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    type: { type: 'string', enum: ['location', 'culture', 'organization', 'rule', 'technology', 'magic_system', 'religion', 'language', 'currency', 'artifact'] },
                                    description: { type: 'string' },
                                    visualDetails: { type: 'object' },
                                    properties: { type: 'array' }
                                }
                            },
                            description: 'World elements to register or update'
                        },
                        
                        timelineEvents: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    type: { type: 'string', enum: ['plot_point', 'character_development', 'world_change', 'relationship_change', 'conflict', 'resolution'] },
                                    participants: { type: 'array' },
                                    significance: { type: 'string', enum: ['major', 'moderate', 'minor'] }
                                }
                            },
                            description: 'Timeline events to record'
                        }
                    },
                    required: ['chapterId', 'conversationId', 'title', 'content']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        chapterId: z.string().min(1),
                        conversationId: z.string().min(1),
                        title: z.string().min(1),
                        content: z.string().min(1),
                        notes: z.string().optional(),
                        pageNumber: z.number().int().positive().optional(),
                        validateConsistency: z.boolean().default(true),
                        autoRegisterElements: z.boolean().default(true),
                        recordTimelineEvents: z.boolean().default(true),
                        characters: z.array(z.object({
                            name: z.string(),
                            role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief']),
                            description: z.string().optional(),
                            physicalTraits: z.object({}).passthrough().optional(),
                            personality: z.object({}).passthrough().optional()
                        })).optional().default([]),
                        worldElements: z.array(z.object({
                            name: z.string(),
                            type: z.enum(['location', 'culture', 'organization', 'rule', 'technology', 'magic_system', 'religion', 'language', 'currency', 'artifact']),
                            description: z.string(),
                            visualDetails: z.object({}).passthrough().optional(),
                            properties: z.array(z.object({
                                name: z.string(),
                                value: z.string(),
                                description: z.string().optional()
                            })).optional()
                        })).optional().default([]),
                        timelineEvents: z.array(z.object({
                            name: z.string(),
                            description: z.string(),
                            type: z.enum(['plot_point', 'character_development', 'world_change', 'relationship_change', 'conflict', 'resolution']),
                            participants: z.array(z.object({
                                characterId: z.string().optional(),
                                characterName: z.string(),
                                role: z.enum(['protagonist', 'instigator', 'victim', 'witness', 'catalyst'])
                            })).optional().default([]),
                            significance: z.enum(['major', 'moderate', 'minor']).default('minor')
                        })).optional().default([])
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        let consistencyResult = null;
                        let warnings: string[] = [];
                        let registeredElements: any = {
                            characters: [],
                            worldElements: [],
                            timelineEvents: []
                        };

                        // Step 1: Validate consistency if requested
                        if (validatedArgs.validateConsistency) {
                            consistencyResult = await this.narrativeService.validateConsistency(
                                validatedArgs.conversationId, // Using conversationId as bookId
                                validatedArgs.content,
                                { 
                                    chapterId: validatedArgs.chapterId, 
                                    title: validatedArgs.title 
                                }
                            );

                            if (!consistencyResult.isConsistent) {
                                warnings.push(`Content has ${consistencyResult.violations.length} consistency issues`);
                                // Add critical violations as warnings
                                consistencyResult.violations
                                    .filter(v => v.severity === 'critical')
                                    .forEach(v => warnings.push(`CRITICAL: ${v.description}`));
                            }
                        }

                        // Step 2: Register manual elements first
                        for (const character of validatedArgs.characters) {
                            if (character.name && character.role) {
                                const characterRef = await this.narrativeService.upsertCharacter(
                                    validatedArgs.conversationId, // Using conversationId as bookId
                                    validatedArgs.conversationId,
                                    {
                                        name: character.name,
                                        role: character.role,
                                        physicalTraits: character.physicalTraits || {},
                                        personality: character.personality || {}
                                    },
                                    {
                                        chapterId: validatedArgs.chapterId,
                                        pageId: '', // Will be filled after page creation
                                        sceneType: 'major'
                                    }
                                );
                                registeredElements.characters.push(characterRef);
                            }
                        }

                        for (const element of validatedArgs.worldElements) {
                            if (element.name && element.type && element.description) {
                                const elementRef = await this.narrativeService.upsertWorldElement(
                                    validatedArgs.conversationId, // Using conversationId as bookId
                                    validatedArgs.conversationId,
                                    {
                                        name: element.name,
                                        type: element.type,
                                        description: element.description,
                                        visualDetails: element.visualDetails || {},
                                        properties: element.properties?.filter(p => p.name && p.value).map(p => ({
                                            name: p.name!,
                                            value: p.value!,
                                            description: p.description
                                        })) || []
                                    },
                                    {
                                        chapterId: validatedArgs.chapterId,
                                        pageId: '', // Will be filled after page creation
                                        functionalRole: 'setting'
                                    }
                                );
                                registeredElements.worldElements.push(elementRef);
                            }
                        }

                        // Step 3: Create the page
                        const pageRequest: CreatePageRequest = {
                            chapterId: validatedArgs.chapterId,
                            conversationId: validatedArgs.conversationId,
                            title: validatedArgs.title,
                            content: validatedArgs.content,
                            notes: validatedArgs.notes,
                            pageNumber: validatedArgs.pageNumber
                        };

                        const page = await this.pageService.createPage(pageRequest);

                        // Step 4: Record timeline events
                        for (const event of validatedArgs.timelineEvents) {
                            await this.narrativeService.recordTimelineEvent(
                                validatedArgs.conversationId, // Using conversationId as bookId
                                validatedArgs.conversationId,
                                {
                                    name: event.name,
                                    description: event.description,
                                    type: event.type,
                                    timing: {
                                        sequenceNumber: page.pageNumber,
                                        relativeTime: `Page ${page.pageNumber}`
                                    },
                                    participants: event.participants.filter(p => p.characterId && p.characterName && p.role).map(p => ({
                                        characterId: p.characterId!,
                                        characterName: p.characterName!,
                                        role: p.role!
                                    })) || [],
                                    impact: {
                                        plotSignificance: event.significance
                                    }
                                },
                                {
                                    chapterId: validatedArgs.chapterId,
                                    pageId: page.pageId
                                }
                            );
                            registeredElements.timelineEvents.push({
                                name: event.name,
                                significance: event.significance
                            });
                        }

                        // Step 5: Auto-register elements if enabled (simplified implementation)
                        if (validatedArgs.autoRegisterElements) {
                            // This would analyze content for new characters/elements
                            // For now, just add a note about this feature
                            warnings.push('Auto-registration of elements from content is planned for future implementation');
                        }

                        // Format response
                        const response = {
                            success: true,
                            page: {
                                pageId: page.pageId,
                                chapterId: page.chapterId,
                                pageNumber: page.pageNumber,
                                title: page.title,
                                wordCount: page.wordCount,
                                status: page.status,
                                createdAt: page.createdAt
                            },
                            consistency: consistencyResult ? {
                                isConsistent: consistencyResult.isConsistent,
                                violationCount: consistencyResult.violations.length,
                                criticalIssues: consistencyResult.violations.filter(v => v.severity === 'critical').length,
                                suggestions: consistencyResult.suggestions
                            } : null,
                            registeredElements,
                            warnings,
                            message: `Page "${validatedArgs.title}" created successfully with narrative consistency tracking`
                        };

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(response, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error creating page with consistency: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            {
                name: 'generate_context_aware_page',
                description: 'Generate page content with full narrative context awareness',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: { type: 'string', description: 'Chapter identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        title: { type: 'string', description: 'Page title' },
                        contentPrompt: { type: 'string', description: 'Prompt for content generation' },
                        targetWordCount: { type: 'number', default: 800, description: 'Target word count for generated content' },
                        
                        // Context preferences
                        includeCharacters: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Specific character IDs to include context for'
                        },
                        includeWorldElements: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Specific world element IDs to include context for'
                        },
                        
                        // Generation style
                        mood: {
                            type: 'string',
                            enum: ['dramatic', 'suspenseful', 'romantic', 'humorous', 'melancholic', 'inspiring', 'mysterious', 'action-packed'],
                            description: 'Desired mood for the content'
                        },
                        focusElements: {
                            type: 'array',
                            items: { type: 'string', enum: ['dialogue', 'action', 'description', 'internal_thoughts', 'world_building'] },
                            description: 'Elements to emphasize in generation'
                        }
                    },
                    required: ['chapterId', 'conversationId', 'title', 'contentPrompt']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        chapterId: z.string().min(1),
                        conversationId: z.string().min(1),
                        title: z.string().min(1),
                        contentPrompt: z.string().min(1),
                        targetWordCount: z.number().int().positive().default(800),
                        includeCharacters: z.array(z.string()).optional().default([]),
                        includeWorldElements: z.array(z.string()).optional().default([]),
                        mood: z.enum(['dramatic', 'suspenseful', 'romantic', 'humorous', 'melancholic', 'inspiring', 'mysterious', 'action-packed']).optional(),
                        focusElements: z.array(z.enum(['dialogue', 'action', 'description', 'internal_thoughts', 'world_building'])).optional().default([])
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        // Get narrative context
                        const narrativeContext = await this.narrativeService.getNarrativeContext(
                            validatedArgs.conversationId, // Using conversationId as bookId
                            validatedArgs.chapterId
                        );

                        // Build context-aware prompt
                        let contextPrompt = `Generate page content with the following context:\n\n`;
                        
                        contextPrompt += `**Story Context:**\n`;
                        contextPrompt += `- Title: ${validatedArgs.title}\n`;
                        contextPrompt += `- Target Word Count: ${validatedArgs.targetWordCount}\n`;
                        if (validatedArgs.mood) {
                            contextPrompt += `- Desired Mood: ${validatedArgs.mood}\n`;
                        }
                        if (validatedArgs.focusElements.length > 0) {
                            contextPrompt += `- Focus Elements: ${validatedArgs.focusElements.join(', ')}\n`;
                        }
                        
                        contextPrompt += `\n**Available Characters:**\n`;
                        narrativeContext.characters.forEach(char => {
                            if (validatedArgs.includeCharacters.length === 0 || 
                                validatedArgs.includeCharacters.includes(char.characterId)) {
                                contextPrompt += `- ${char.name}: ${JSON.stringify(char.currentState.physicalTraits)}\n`;
                            }
                        });
                        
                        contextPrompt += `\n**World Elements:**\n`;
                        narrativeContext.worldElements.forEach(element => {
                            if (validatedArgs.includeWorldElements.length === 0 || 
                                validatedArgs.includeWorldElements.includes(element.elementId)) {
                                contextPrompt += `- ${element.name} (${element.type}): ${element.currentState.description}\n`;
                            }
                        });
                        
                        contextPrompt += `\n**Timeline Context:**\n`;
                        if (narrativeContext.timeline.recentEvents.length > 0) {
                            contextPrompt += `Recent Events:\n`;
                            narrativeContext.timeline.recentEvents.slice(-3).forEach(event => {
                                contextPrompt += `- ${event.name}: ${event.significance} significance\n`;
                            });
                        }
                        
                        contextPrompt += `\n**Consistency Guidelines:**\n`;
                        narrativeContext.consistencyGuidelines.forEach(guideline => {
                            contextPrompt += `- ${guideline}\n`;
                        });
                        
                        contextPrompt += `\n**Content Prompt:**\n${validatedArgs.contentPrompt}\n`;
                        
                        // For now, return the context-aware prompt for the AI to use
                        // In a full implementation, this would call an AI content generation service
                        const response = {
                            success: true,
                            contextAwarePrompt: contextPrompt,
                            narrativeContext: {
                                charactersAvailable: narrativeContext.characters.length,
                                worldElementsAvailable: narrativeContext.worldElements.length,
                                recentEventsCount: narrativeContext.timeline.recentEvents.length,
                                consistencyGuidelines: narrativeContext.consistencyGuidelines.length
                            },
                            message: 'Context-aware prompt generated. Use this prompt with your AI content generation to create consistent narrative content.',
                            nextStep: 'Use the generated contextAwarePrompt with an AI service to generate content, then use create_page_with_consistency to create the page with validation.'
                        };

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(response, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error generating context-aware page: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            },

            {
                name: 'update_page_with_consistency',
                description: 'Update page content with consistency validation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'Page identifier' },
                        updates: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                content: { type: 'string' },
                                notes: { type: 'string' },
                                status: { type: 'string', enum: ['draft', 'review', 'approved', 'published'] }
                            }
                        },
                        validateConsistency: { 
                            type: 'boolean', 
                            default: true, 
                            description: 'Whether to validate updated content against narrative consistency rules' 
                        },
                        updateElements: {
                            type: 'boolean',
                            default: false,
                            description: 'Whether to update narrative elements based on content changes'
                        }
                    },
                    required: ['pageId', 'updates']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        pageId: z.string(),
                        updates: z.object({
                            title: z.string().optional(),
                            content: z.string().optional(),
                            notes: z.string().optional(),
                            status: z.enum(['draft', 'review', 'approved', 'published']).optional()
                        }),
                        validateConsistency: z.boolean().default(true),
                        updateElements: z.boolean().default(false)
                    });

                    const validatedArgs = schema.parse(args);

                    try {
                        // Get existing page to access chapter/book context
                        const existingPage = await this.pageService.getPage(validatedArgs.pageId);
                        
                        let consistencyResult = null;
                        let warnings: string[] = [];

                        // Validate consistency if content is being updated
                        if (validatedArgs.validateConsistency && validatedArgs.updates.content) {
                            consistencyResult = await this.narrativeService.validateConsistency(
                                existingPage.conversationId, // Using conversationId as bookId
                                validatedArgs.updates.content,
                                { 
                                    chapterId: existingPage.chapterId,
                                    pageId: existingPage.pageId,
                                    title: validatedArgs.updates.title || existingPage.title
                                }
                            );

                            if (!consistencyResult.isConsistent) {
                                warnings.push(`Updated content has ${consistencyResult.violations.length} consistency issues`);
                            }
                        }

                        // Update the page
                        // Type assertion needed for PageStatus enum compatibility
                        const updates = {
                            ...validatedArgs.updates,
                            ...(validatedArgs.updates.status && { status: validatedArgs.updates.status as PageStatus })
                        };
                        const updatedPage = await this.pageService.updatePage(validatedArgs.pageId, updates);

                        const response = {
                            success: true,
                            page: {
                                pageId: updatedPage.pageId,
                                chapterId: updatedPage.chapterId,
                                pageNumber: updatedPage.pageNumber,
                                title: updatedPage.title,
                                wordCount: updatedPage.wordCount,
                                status: updatedPage.status,
                                updatedAt: updatedPage.updatedAt
                            },
                            consistency: consistencyResult ? {
                                isConsistent: consistencyResult.isConsistent,
                                violationCount: consistencyResult.violations.length,
                                suggestions: consistencyResult.suggestions
                            } : null,
                            warnings,
                            message: `Page updated successfully with consistency ${consistencyResult?.isConsistent ? 'validation passed' : 'issues detected'}`
                        };

                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(response, null, 2)
                            }]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: 'text',
                                text: `❌ Error updating page with consistency: ${(error as Error).message}`
                            }]
                        };
                    }
                }
            }
        ];
    }
}

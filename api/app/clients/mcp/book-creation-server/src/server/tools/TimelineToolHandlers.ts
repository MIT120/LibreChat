/**
 * Timeline Tool Handlers - Provides tools for managing story timelines, plot arcs, and character development
 */

import { z } from 'zod';
// Remove unused import - using inline interface definition
import { TimelineService, PlotArc, TimelineEvent, CharacterArcMarker } from '../../services/TimelineService.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { ILogger } from '../../interfaces/ILogger.js';

export class TimelineToolHandlers {
    private logger: ILogger;
    private timelineService: TimelineService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.timelineService = new TimelineService(this.logger);
    }

    getTools(): any[] {
        return [
            {
                name: 'create_timeline',
                description: 'Create a new story timeline for tracking plot progression and character arcs',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book' },
                        name: { type: 'string', description: 'Timeline name' },
                        description: { type: 'string', description: 'Timeline description' },
                        templateCategory: { type: 'string', description: 'Template category (optional)' }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        name: z.string().optional(),
                        description: z.string().optional(),
                        templateCategory: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'create_timeline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const timeline = await this.timelineService.createTimeline({
                                bookId: data.bookId,
                                name: data.name,
                                description: data.description,
                                templateCategory: data.templateCategory
                            });

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        timeline: {
                                            id: timeline._id,
                                            name: timeline.name,
                                            description: timeline.description,
                                            bookId: timeline.bookId
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'add_timeline_event',
                description: 'Add an event to the timeline to track plot points and character developments',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timelineId: { type: 'string', description: 'ID of the timeline' },
                        type: {
                            type: 'string',
                            enum: ['plot_point', 'character_event', 'world_event', 'conflict', 'resolution', 'milestone'],
                            description: 'Type of timeline event'
                        },
                        title: { type: 'string', description: 'Event title' },
                        description: { type: 'string', description: 'Event description' },
                        chapterId: { type: 'string', description: 'Chapter ID (optional)' },
                        pageId: { type: 'string', description: 'Page ID (optional)' },
                        position: { type: 'number', minimum: 0, maximum: 100, description: 'Position in timeline (0-100)' },
                        color: { type: 'string', description: 'Event color' },
                        importance: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'critical'],
                            default: 'medium',
                            description: 'Event importance level'
                        },
                        participants: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    characterId: { type: 'string' },
                                    role: { type: 'string', enum: ['protagonist', 'antagonist', 'witness', 'catalyst', 'victim', 'instigator'] }
                                },
                                required: ['characterId']
                            },
                            description: 'Characters involved in this event'
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Event tags'
                        }
                    },
                    required: ['timelineId', 'type', 'title', 'position']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        timelineId: z.string().min(1),
                        type: z.enum(['plot_point', 'character_event', 'world_event', 'conflict', 'resolution', 'milestone']),
                        title: z.string().min(1),
                        description: z.string().optional(),
                        chapterId: z.string().optional(),
                        pageId: z.string().optional(),
                        position: z.number().min(0).max(100),
                        color: z.string().optional(),
                        importance: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
                        participants: z.array(z.object({
                            characterId: z.string().min(1),
                            role: z.enum(['protagonist', 'antagonist', 'witness', 'catalyst', 'victim', 'instigator']).optional()
                        })).optional().default([]).transform(participants =>
                            participants.map(p => ({ characterId: p.characterId, role: p.role }))
                        ),
                        tags: z.array(z.string()).optional().default([])
                    });

                    return ToolExecutor.run({
                        name: 'add_timeline_event',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const eventData: TimelineEvent = {
                                type: data.type,
                                title: data.title,
                                description: data.description,
                                chapterId: data.chapterId,
                                pageId: data.pageId,
                                position: data.position,
                                color: data.color,
                                importance: data.importance,
                                participants: data.participants?.filter(p => p.characterId).map(p => ({
                                    characterId: p.characterId!,
                                    role: p.role as 'protagonist' | 'antagonist' | 'witness' | 'catalyst' | 'victim' | 'instigator' | undefined
                                })),
                                tags: data.tags
                            };

                            const timeline = await this.timelineService.addEvent(data.timelineId, eventData);

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Timeline event "${data.title}" added successfully`,
                                        event: {
                                            title: data.title,
                                            type: data.type,
                                            position: data.position,
                                            importance: data.importance
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            // IMPROVED: Plot Arc Creation with Better Error Handling
            {
                name: 'create_plot_arc_structure',
                description: 'Create a plot arc structure using individual timeline events (WORKAROUND for add_plot_arc issues)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timelineId: { type: 'string', description: 'ID of the timeline' },
                        arcName: { type: 'string', description: 'Name of the plot arc' },
                        arcDescription: { type: 'string', description: 'Description of the plot arc' },
                        arcType: {
                            type: 'string',
                            enum: ['main', 'subplot', 'character_arc', 'relationship_arc', 'mystery', 'romance'],
                            default: 'main',
                            description: 'Type of plot arc'
                        },
                        milestones: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    position: { type: 'number', minimum: 0, maximum: 100 },
                                    importance: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
                                },
                                required: ['title', 'position']
                            },
                            description: 'Key milestones for this arc'
                        }
                    },
                    required: ['timelineId', 'arcName', 'milestones']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        timelineId: z.string().min(1),
                        arcName: z.string().min(1),
                        arcDescription: z.string().optional(),
                        arcType: z.enum(['main', 'subplot', 'character_arc', 'relationship_arc', 'mystery', 'romance']).default('main'),
                        milestones: z.array(z.object({
                            title: z.string().min(1),
                            description: z.string().optional(),
                            position: z.number().min(0).max(100),
                            importance: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
                        })).min(1)
                    });

                    return ToolExecutor.run({
                        name: 'create_plot_arc_structure',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const createdEvents = [];

                            // Create timeline events for each milestone
                            for (const milestone of data.milestones) {
                                const eventData: TimelineEvent = {
                                    type: 'plot_point',
                                    title: `${data.arcName}: ${milestone.title}`,
                                    description: milestone.description || `${data.arcType} milestone: ${milestone.title}`,
                                    position: milestone.position,
                                    importance: milestone.importance,
                                    tags: [data.arcName, data.arcType, 'plot_arc_milestone']
                                };

                                await this.timelineService.addEvent(data.timelineId, eventData);
                                createdEvents.push({
                                    title: eventData.title,
                                    position: eventData.position,
                                    importance: eventData.importance
                                });
                            }

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Plot arc "${data.arcName}" created successfully with ${createdEvents.length} milestones`,
                                        arc: {
                                            name: data.arcName,
                                            type: data.arcType,
                                            description: data.arcDescription,
                                            milestones: createdEvents
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'get_timeline',
                description: 'Retrieve timeline information with all events and arcs',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timelineId: { type: 'string', description: 'ID of the timeline' }
                    },
                    required: ['timelineId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        timelineId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_timeline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const timeline = await this.timelineService.getTimeline(data.timelineId);

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        timeline: {
                                            id: timeline._id,
                                            name: timeline.name,
                                            description: timeline.description,
                                            bookId: timeline.bookId,
                                            events: timeline.events?.map(event => ({
                                                id: event.id,
                                                title: event.title,
                                                type: event.type,
                                                position: event.position,
                                                importance: event.importance
                                            })) || [],
                                            plotArcs: timeline.plotArcs?.map(arc => ({
                                                id: arc.id,
                                                name: arc.name,
                                                type: arc.type,
                                                startPosition: arc.startPosition,
                                                endPosition: arc.endPosition
                                            })) || []
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'list_timelines',
                description: 'List all timelines for a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book' }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'list_timelines',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const timeline = await this.timelineService.getTimelineByBook(data.bookId);
                            const timelines = timeline ? [timeline] : [];

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        timelines: timelines.map(timeline => ({
                                            id: timeline._id,
                                            name: timeline.name,
                                            description: timeline.description,
                                            eventCount: timeline.events?.length || 0,
                                            plotArcCount: timeline.plotArcs?.length || 0
                                        }))
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            }
        ];
    }
}
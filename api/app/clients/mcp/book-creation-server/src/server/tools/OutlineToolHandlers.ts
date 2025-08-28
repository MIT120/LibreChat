/**
 * Outline Tool Handlers - MCP tools for managing story outlines
 */

import { z } from 'zod';
import { ILogger } from '../../interfaces/ILogger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { OutlineService, CreateOutlineRequest, UpdateOutlineRequest, CreateSceneRequest, UpdateSceneRequest, CreateChapterRequest, ReorderRequest } from '../../services/OutlineService.js';

export class OutlineToolHandlers {
    private logger: ILogger;
    private outlineService: OutlineService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.outlineService = new OutlineService(logger);
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_outline',
                description: 'Create a new story outline for a book with customizable structure',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book' },
                        title: { type: 'string', description: 'Title of the outline' },
                        description: { type: 'string', description: 'Optional description of the outline' },
                        structure: {
                            type: 'string',
                            enum: ['three-act', 'four-act', 'five-act', 'hero-journey', 'custom'],
                            description: 'Story structure template to use'
                        },
                        authorId: { type: 'string', description: 'ID of the author' },
                        conversationId: { type: 'string', description: 'ID of the conversation' }
                    },
                    required: ['bookId', 'title', 'structure', 'authorId', 'conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        title: z.string().min(1).max(200),
                        description: z.string().max(1000).optional(),
                        structure: z.enum(['three-act', 'four-act', 'five-act', 'hero-journey', 'custom']),
                        authorId: z.string().min(1),
                        conversationId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'create_outline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data: CreateOutlineRequest) => {
                            const outline = await this.outlineService.createOutline(data);
                            return {
                                success: true,
                                message: `Outline "${data.title}" created successfully`,
                                outline: {
                                    id: outline._id,
                                    title: outline.title,
                                    structure: outline.structure,
                                    totalScenes: outline.metadata.totalScenes,
                                    totalChapters: outline.metadata.totalChapters,
                                    acts: outline.acts.map(act => ({
                                        id: act._id,
                                        title: act.title,
                                        description: act.description,
                                        order: act.order
                                    }))
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'get_outline',
                description: 'Get outline details by ID or book ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline (optional if bookId provided)' },
                        bookId: { type: 'string', description: 'ID of the book (optional if outlineId provided)' }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().optional(),
                        bookId: z.string().optional()
                    }).refine(data => data.outlineId || data.bookId, {
                        message: "Either outlineId or bookId must be provided"
                    });

                    return ToolExecutor.run({
                        name: 'get_outline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            let outline;
                            if (data.outlineId) {
                                outline = await this.outlineService.getOutline(data.outlineId);
                            } else {
                                outline = await this.outlineService.getOutlineByBookId(data.bookId!);
                                if (!outline) {
                                    return {
                                        success: false,
                                        message: 'No outline found for this book'
                                    };
                                }
                            }

                            return {
                                success: true,
                                outline: {
                                    id: outline._id,
                                    bookId: outline.bookId,
                                    title: outline.title,
                                    description: outline.description,
                                    structure: outline.structure,
                                    settings: outline.settings,
                                    metadata: outline.metadata,
                                    acts: outline.acts,
                                    chapters: outline.chapters,
                                    scenes: outline.scenes,
                                    createdAt: outline.createdAt,
                                    updatedAt: outline.updatedAt
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'update_outline',
                description: 'Update outline properties and settings',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        title: { type: 'string', description: 'New title (optional)' },
                        description: { type: 'string', description: 'New description (optional)' },
                        structure: {
                            type: 'string',
                            enum: ['three-act', 'four-act', 'five-act', 'hero-journey', 'custom'],
                            description: 'New story structure (optional)'
                        },
                        settings: {
                            type: 'object',
                            properties: {
                                defaultView: { type: 'string', enum: ['outline', 'grid', 'matrix'] },
                                gridColumns: { type: 'number', minimum: 1, maximum: 10 },
                                matrixRows: { type: 'number', minimum: 1, maximum: 10 },
                                showWordCounts: { type: 'boolean' },
                                showStatus: { type: 'boolean' },
                                showTags: { type: 'boolean' },
                                colorCoding: { type: 'string', enum: ['none', 'status', 'pov', 'importance', 'custom'] },
                                autoSave: { type: 'boolean' }
                            },
                            description: 'Outline view settings (optional)'
                        }
                    },
                    required: ['outlineId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        title: z.string().min(1).max(200).optional(),
                        description: z.string().max(1000).optional(),
                        structure: z.enum(['three-act', 'four-act', 'five-act', 'hero-journey', 'custom']).optional(),
                        settings: z.object({
                            defaultView: z.enum(['outline', 'grid', 'matrix']).optional(),
                            gridColumns: z.number().min(1).max(10).optional(),
                            matrixRows: z.number().min(1).max(10).optional(),
                            showWordCounts: z.boolean().optional(),
                            showStatus: z.boolean().optional(),
                            showTags: z.boolean().optional(),
                            colorCoding: z.enum(['none', 'status', 'pov', 'importance', 'custom']).optional(),
                            autoSave: z.boolean().optional()
                        }).optional()
                    });

                    return ToolExecutor.run({
                        name: 'update_outline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { outlineId, ...updateData } = data;
                            const outline = await this.outlineService.updateOutline(outlineId, updateData);

                            return {
                                success: true,
                                message: 'Outline updated successfully',
                                outline: {
                                    id: outline._id,
                                    title: outline.title,
                                    structure: outline.structure,
                                    settings: outline.settings,
                                    metadata: outline.metadata
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'add_scene',
                description: 'Add a new scene to the outline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        title: { type: 'string', description: 'Scene title' },
                        description: { type: 'string', description: 'Scene description (optional)' },
                        summary: { type: 'string', description: 'Brief scene summary (optional)' },
                        chapterId: { type: 'string', description: 'ID of the chapter this scene belongs to (optional)' },
                        order: { type: 'number', description: 'Scene order (optional, defaults to end)' },
                        status: {
                            type: 'string',
                            enum: ['planned', 'writing', 'draft', 'review', 'completed'],
                            description: 'Scene status (optional)'
                        },
                        wordCount: { type: 'number', description: 'Current word count (optional)' },
                        targetWordCount: { type: 'number', description: 'Target word count (optional)' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Scene tags (optional)' },
                        notes: { type: 'string', description: 'Scene notes (optional)' },
                        pov: { type: 'string', description: 'Point of view character (optional)' },
                        setting: { type: 'string', description: 'Scene setting (optional)' },
                        timeOfDay: { type: 'string', description: 'Time of day (optional)' },
                        conflict: { type: 'string', description: 'Main conflict (optional)' },
                        goal: { type: 'string', description: 'Scene goal (optional)' },
                        outcome: { type: 'string', description: 'Scene outcome (optional)' },
                        tension: { type: 'number', minimum: 1, maximum: 10, description: 'Tension level 1-10 (optional)' },
                        importance: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'critical'],
                            description: 'Scene importance (optional)'
                        },
                        position: {
                            type: 'object',
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' }
                            },
                            description: 'Position for grid/matrix views (optional)'
                        },
                        color: { type: 'string', description: 'Scene color (hex code, optional)' },
                        authorId: { type: 'string', description: 'ID of the author creating the scene' }
                    },
                    required: ['outlineId', 'title', 'authorId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        title: z.string().min(1).max(200),
                        description: z.string().max(1000).optional(),
                        summary: z.string().max(500).optional(),
                        chapterId: z.string().optional(),
                        order: z.number().min(0).optional(),
                        status: z.enum(['planned', 'writing', 'draft', 'review', 'completed']).optional(),
                        wordCount: z.number().min(0).optional(),
                        targetWordCount: z.number().min(0).optional(),
                        tags: z.array(z.string().max(50)).optional(),
                        notes: z.string().max(2000).optional(),
                        pov: z.string().max(100).optional(),
                        setting: z.string().max(200).optional(),
                        timeOfDay: z.string().max(50).optional(),
                        conflict: z.string().max(500).optional(),
                        goal: z.string().max(300).optional(),
                        outcome: z.string().max(300).optional(),
                        tension: z.number().min(1).max(10).optional(),
                        importance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
                        position: z.object({
                            x: z.number(),
                            y: z.number()
                        }).optional(),
                        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
                        authorId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'add_scene',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { outlineId, ...sceneData } = data;
                            const scene = await this.outlineService.addScene(outlineId, sceneData);

                            return {
                                success: true,
                                message: `Scene "${scene.title}" added successfully`,
                                scene: {
                                    id: scene._id,
                                    title: scene.title,
                                    description: scene.description,
                                    order: scene.order,
                                    status: scene.status,
                                    wordCount: scene.wordCount,
                                    chapterId: scene.chapterId
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'update_scene',
                description: 'Update an existing scene in the outline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        sceneId: { type: 'string', description: 'ID of the scene to update' },
                        title: { type: 'string', description: 'New scene title (optional)' },
                        description: { type: 'string', description: 'New scene description (optional)' },
                        summary: { type: 'string', description: 'New scene summary (optional)' },
                        chapterId: { type: 'string', description: 'New chapter ID (optional)' },
                        status: {
                            type: 'string',
                            enum: ['planned', 'writing', 'draft', 'review', 'completed'],
                            description: 'New scene status (optional)'
                        },
                        wordCount: { type: 'number', description: 'Updated word count (optional)' },
                        targetWordCount: { type: 'number', description: 'Updated target word count (optional)' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags (optional)' },
                        notes: { type: 'string', description: 'Updated notes (optional)' },
                        pov: { type: 'string', description: 'Updated POV character (optional)' },
                        setting: { type: 'string', description: 'Updated setting (optional)' },
                        timeOfDay: { type: 'string', description: 'Updated time of day (optional)' },
                        conflict: { type: 'string', description: 'Updated conflict (optional)' },
                        goal: { type: 'string', description: 'Updated goal (optional)' },
                        outcome: { type: 'string', description: 'Updated outcome (optional)' },
                        tension: { type: 'number', minimum: 1, maximum: 10, description: 'Updated tension level (optional)' },
                        importance: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'critical'],
                            description: 'Updated importance (optional)'
                        },
                        position: {
                            type: 'object',
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' }
                            },
                            description: 'Updated position (optional)'
                        },
                        color: { type: 'string', description: 'Updated color (optional)' }
                    },
                    required: ['outlineId', 'sceneId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        sceneId: z.string().min(1),
                        title: z.string().min(1).max(200).optional(),
                        description: z.string().max(1000).optional(),
                        summary: z.string().max(500).optional(),
                        chapterId: z.string().optional(),
                        status: z.enum(['planned', 'writing', 'draft', 'review', 'completed']).optional(),
                        wordCount: z.number().min(0).optional(),
                        targetWordCount: z.number().min(0).optional(),
                        tags: z.array(z.string().max(50)).optional(),
                        notes: z.string().max(2000).optional(),
                        pov: z.string().max(100).optional(),
                        setting: z.string().max(200).optional(),
                        timeOfDay: z.string().max(50).optional(),
                        conflict: z.string().max(500).optional(),
                        goal: z.string().max(300).optional(),
                        outcome: z.string().max(300).optional(),
                        tension: z.number().min(1).max(10).optional(),
                        importance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
                        position: z.object({
                            x: z.number(),
                            y: z.number()
                        }).optional(),
                        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
                    });

                    return ToolExecutor.run({
                        name: 'update_scene',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { outlineId, sceneId, ...updateData } = data;
                            const scene = await this.outlineService.updateScene(outlineId, sceneId, updateData);

                            return {
                                success: true,
                                message: `Scene "${scene.title}" updated successfully`,
                                scene: {
                                    id: scene._id,
                                    title: scene.title,
                                    description: scene.description,
                                    status: scene.status,
                                    wordCount: scene.wordCount,
                                    updatedAt: scene.metadata?.updatedAt
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'delete_scene',
                description: 'Delete a scene from the outline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        sceneId: { type: 'string', description: 'ID of the scene to delete' }
                    },
                    required: ['outlineId', 'sceneId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        sceneId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'delete_scene',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            await this.outlineService.deleteScene(data.outlineId, data.sceneId);

                            return {
                                success: true,
                                message: 'Scene deleted successfully'
                            };
                        }
                    });
                }
            },

            {
                name: 'reorder_scenes',
                description: 'Reorder scenes in the outline (for drag-and-drop functionality)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        sceneIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of scene IDs in the new order'
                        }
                    },
                    required: ['outlineId', 'sceneIds']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        sceneIds: z.array(z.string().min(1)).min(1)
                    });

                    return ToolExecutor.run({
                        name: 'reorder_scenes',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const outline = await this.outlineService.reorderScenes(data.outlineId, { sceneIds: data.sceneIds });

                            return {
                                success: true,
                                message: 'Scenes reordered successfully',
                                sceneCount: data.sceneIds.length,
                                scenes: outline.scenes.map(scene => ({
                                    id: scene._id,
                                    title: scene.title,
                                    order: scene.order
                                }))
                            };
                        }
                    });
                }
            },

            {
                name: 'add_chapter',
                description: 'Add a new chapter to the outline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        title: { type: 'string', description: 'Chapter title' },
                        description: { type: 'string', description: 'Chapter description (optional)' },
                        order: { type: 'number', description: 'Chapter order (optional, defaults to end)' },
                        targetWordCount: { type: 'number', description: 'Target word count (optional)' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Chapter tags (optional)' },
                        notes: { type: 'string', description: 'Chapter notes (optional)' },
                        color: { type: 'string', description: 'Chapter color (hex code, optional)' },
                        position: {
                            type: 'object',
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' }
                            },
                            description: 'Position for grid/matrix views (optional)'
                        }
                    },
                    required: ['outlineId', 'title']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        title: z.string().min(1).max(200),
                        description: z.string().max(1000).optional(),
                        order: z.number().min(0).optional(),
                        targetWordCount: z.number().min(0).optional(),
                        tags: z.array(z.string().max(50)).optional(),
                        notes: z.string().max(2000).optional(),
                        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
                        position: z.object({
                            x: z.number(),
                            y: z.number()
                        }).optional()
                    });

                    return ToolExecutor.run({
                        name: 'add_chapter',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { outlineId, ...chapterData } = data;
                            const chapter = await this.outlineService.addChapter(outlineId, chapterData);

                            return {
                                success: true,
                                message: `Chapter "${chapter.title}" added successfully`,
                                chapter: {
                                    id: chapter._id,
                                    title: chapter.title,
                                    description: chapter.description,
                                    order: chapter.order,
                                    targetWordCount: chapter.targetWordCount
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'get_outline_stats',
                description: 'Get statistics and analytics for an outline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' }
                    },
                    required: ['outlineId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_outline_stats',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const stats = await this.outlineService.getOutlineStats(data.outlineId);

                            return {
                                success: true,
                                stats: {
                                    ...stats,
                                    longestScene: stats.longestScene ? {
                                        id: stats.longestScene._id,
                                        title: stats.longestScene.title,
                                        wordCount: stats.longestScene.wordCount
                                    } : null,
                                    shortestScene: stats.shortestScene ? {
                                        id: stats.shortestScene._id,
                                        title: stats.shortestScene.title,
                                        wordCount: stats.shortestScene.wordCount
                                    } : null
                                }
                            };
                        }
                    });
                }
            },

            {
                name: 'export_outline',
                description: 'Export outline in various formats (JSON, CSV, Markdown)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        outlineId: { type: 'string', description: 'ID of the outline' },
                        format: {
                            type: 'string',
                            enum: ['json', 'csv', 'markdown'],
                            description: 'Export format'
                        }
                    },
                    required: ['outlineId', 'format']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        outlineId: z.string().min(1),
                        format: z.enum(['json', 'csv', 'markdown'])
                    });

                    return ToolExecutor.run({
                        name: 'export_outline',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const exportData = await this.outlineService.exportOutline(data.outlineId, data.format);

                            return {
                                success: true,
                                message: `Outline exported successfully as ${data.format.toUpperCase()}`,
                                format: data.format,
                                data: exportData
                            };
                        }
                    });
                }
            }
        ];
    }
}

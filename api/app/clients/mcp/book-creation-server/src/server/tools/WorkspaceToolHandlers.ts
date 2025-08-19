/**
 * Workspace Tool Handlers - MCP tools for workspace management
 */

import { z } from 'zod';
import { ILogger } from '../../interfaces/ILogger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { WorkspaceService } from '../../services/WorkspaceService.js';

export class WorkspaceToolHandlers {
    private logger: ILogger;
    private workspaceService: WorkspaceService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.workspaceService = new WorkspaceService(logger);
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_workspace',
                description: 'Create a new project workspace for organizing books and writing projects',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Name of the workspace' },
                        description: { type: 'string', description: 'Optional description of the workspace' },
                        userId: { type: 'string', description: 'ID of the user creating the workspace' },
                        writingTargets: {
                            type: 'object',
                            properties: {
                                daily: { type: 'number', description: 'Daily word count target' },
                                weekly: { type: 'number', description: 'Weekly word count target' },
                                monthly: { type: 'number', description: 'Monthly word count target' }
                            }
                        },
                        settings: {
                            type: 'object',
                            properties: {
                                theme: { type: 'string', enum: ['light', 'dark', 'auto'], description: 'UI theme preference' },
                                defaultView: { type: 'string', enum: ['timeline', 'outline', 'writing', 'research', 'planning'], description: 'Default view when opening workspace' }
                            }
                        }
                    },
                    required: ['name', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        name: z.string().min(1).max(100),
                        description: z.string().max(500).optional(),
                        userId: z.string().min(1),
                        writingTargets: z.object({
                            daily: z.number().min(0).optional(),
                            weekly: z.number().min(0).optional(),
                            monthly: z.number().min(0).optional()
                        }).optional(),
                        settings: z.object({
                            theme: z.enum(['light', 'dark', 'auto']).optional(),
                            defaultView: z.enum(['timeline', 'outline', 'writing', 'research', 'planning']).optional()
                        }).optional()
                    });

                    return ToolExecutor.run({
                        name: 'create_workspace',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            // Ensure required fields are present
                            const requestData = {
                                ...data,
                                name: data.name || 'Untitled Workspace',
                                userId: data.userId || 'default_user'
                            };
                            const workspace = await this.workspaceService.createWorkspace(requestData);
                            return {
                                success: true,
                                workspaceId: workspace._id,
                                workspace: workspace,
                                message: `Workspace "${workspace.name}" created successfully`
                            };
                        }
                    });
                }
            },
            {
                name: 'get_workspace',
                description: 'Get workspace details including books, settings, and statistics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        userId: { type: 'string', description: 'ID of the user requesting access' },
                        includeStats: { type: 'boolean', description: 'Whether to include detailed statistics', default: false }
                    },
                    required: ['workspaceId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        userId: z.string().min(1),
                        includeStats: z.boolean().default(false)
                    });

                    return ToolExecutor.run({
                        name: 'get_workspace',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ workspaceId, userId, includeStats }) => {
                            const workspace = await this.workspaceService.getWorkspace(workspaceId, userId, includeStats);
                            return {
                                success: true,
                                workspace: workspace
                            };
                        }
                    });
                }
            },
            {
                name: 'get_user_workspaces',
                description: 'Get all workspaces for a user with optional filtering and pagination',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string', description: 'ID of the user' },
                        includeArchived: { type: 'boolean', description: 'Whether to include archived workspaces', default: false },
                        includeStats: { type: 'boolean', description: 'Whether to include statistics for each workspace', default: false },
                        limit: { type: 'number', description: 'Maximum number of workspaces to return' },
                        offset: { type: 'number', description: 'Number of workspaces to skip' },
                        sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt', 'lastActivity'], description: 'Field to sort by' },
                        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' }
                    },
                    required: ['userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        userId: z.string().min(1),
                        includeArchived: z.boolean().default(false),
                        includeStats: z.boolean().default(false),
                        limit: z.number().min(1).max(100).optional(),
                        offset: z.number().min(0).optional(),
                        sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'lastActivity']).optional(),
                        sortOrder: z.enum(['asc', 'desc']).default('desc')
                    });

                    return ToolExecutor.run({
                        name: 'get_user_workspaces',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (options) => {
                            const { userId, ...queryOptions } = options;
                            const workspaces = await this.workspaceService.getUserWorkspaces(userId, queryOptions);
                            return {
                                success: true,
                                workspaces: workspaces,
                                count: workspaces.length
                            };
                        }
                    });
                }
            },
            {
                name: 'update_workspace',
                description: 'Update workspace settings, layout, or writing targets',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        userId: { type: 'string', description: 'ID of the user making the update' },
                        name: { type: 'string', description: 'New workspace name' },
                        description: { type: 'string', description: 'New workspace description' },
                        writingTargets: {
                            type: 'object',
                            properties: {
                                daily: { type: 'number', description: 'Daily word count target' },
                                weekly: { type: 'number', description: 'Weekly word count target' },
                                monthly: { type: 'number', description: 'Monthly word count target' }
                            }
                        },
                        layout: {
                            type: 'object',
                            properties: {
                                sidebar: {
                                    type: 'object',
                                    properties: {
                                        width: { type: 'number', description: 'Sidebar width in pixels' },
                                        collapsed: { type: 'boolean', description: 'Whether sidebar is collapsed' },
                                        position: { type: 'string', enum: ['left', 'right'], description: 'Sidebar position' }
                                    }
                                },
                                panels: {
                                    type: 'object',
                                    additionalProperties: { type: 'boolean' },
                                    description: 'Panel visibility settings'
                                },
                                views: {
                                    type: 'object',
                                    properties: {
                                        defaultView: { type: 'string', description: 'Default view when opening workspace' },
                                        splitView: { type: 'boolean', description: 'Whether to use split view' },
                                        focusMode: { type: 'boolean', description: 'Whether focus mode is enabled' }
                                    }
                                }
                            }
                        },
                        settings: {
                            type: 'object',
                            properties: {
                                theme: { type: 'string', enum: ['light', 'dark', 'auto'], description: 'UI theme' },
                                autoSave: { type: 'boolean', description: 'Whether to auto-save' },
                                notifications: {
                                    type: 'object',
                                    additionalProperties: { type: 'boolean' },
                                    description: 'Notification preferences'
                                }
                            }
                        }
                    },
                    required: ['workspaceId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        userId: z.string().min(1),
                        name: z.string().min(1).max(100).optional(),
                        description: z.string().max(500).optional(),
                        writingTargets: z.object({
                            daily: z.number().min(0).optional(),
                            weekly: z.number().min(0).optional(),
                            monthly: z.number().min(0).optional()
                        }).optional(),
                        layout: z.object({
                            sidebar: z.object({
                                width: z.number().min(200).max(600).optional(),
                                collapsed: z.boolean().optional(),
                                position: z.enum(['left', 'right']).optional()
                            }).optional(),
                            panels: z.record(z.boolean()).optional(),
                            views: z.object({
                                defaultView: z.string().optional(),
                                splitView: z.boolean().optional(),
                                focusMode: z.boolean().optional()
                            }).optional()
                        }).optional(),
                        settings: z.object({
                            theme: z.enum(['light', 'dark', 'auto']).optional(),
                            autoSave: z.boolean().optional(),
                            notifications: z.record(z.boolean()).optional()
                        }).optional()
                    });

                    return ToolExecutor.run({
                        name: 'update_workspace',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { workspaceId, userId, ...updates } = data;
                            const workspace = await this.workspaceService.updateWorkspace(workspaceId, userId, updates);
                            return {
                                success: true,
                                workspace: workspace,
                                message: 'Workspace updated successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'add_book_to_workspace',
                description: 'Add an existing book to a workspace',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        bookId: { type: 'string', description: 'ID of the book to add' },
                        userId: { type: 'string', description: 'ID of the user making the request' }
                    },
                    required: ['workspaceId', 'bookId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        bookId: z.string().min(1),
                        userId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'add_book_to_workspace',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ workspaceId, bookId, userId }) => {
                            const workspace = await this.workspaceService.addBookToWorkspace(workspaceId, bookId, userId);
                            return {
                                success: true,
                                workspace: workspace,
                                message: 'Book added to workspace successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'set_active_book',
                description: 'Set the active book in a workspace',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        bookId: { type: 'string', description: 'ID of the book to set as active' },
                        userId: { type: 'string', description: 'ID of the user making the request' }
                    },
                    required: ['workspaceId', 'bookId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        bookId: z.string().min(1),
                        userId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'set_active_book',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ workspaceId, bookId, userId }) => {
                            const workspace = await this.workspaceService.setActiveBook(workspaceId, bookId, userId);
                            return {
                                success: true,
                                workspace: workspace,
                                message: 'Active book set successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'get_workspace_stats',
                description: 'Get detailed statistics for a workspace including writing progress and goal tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        userId: { type: 'string', description: 'ID of the user requesting stats' }
                    },
                    required: ['workspaceId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        userId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_workspace_stats',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ workspaceId, userId }) => {
                            const stats = await this.workspaceService.getWorkspaceStats(workspaceId, userId);
                            return {
                                success: true,
                                stats: stats
                            };
                        }
                    });
                }
            },
            {
                name: 'delete_workspace',
                description: 'Delete a workspace (only workspace owners can perform this action)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceId: { type: 'string', description: 'ID of the workspace to delete' },
                        userId: { type: 'string', description: 'ID of the user requesting deletion' },
                        confirmDelete: { type: 'boolean', description: 'Confirmation that user wants to delete', default: false }
                    },
                    required: ['workspaceId', 'userId', 'confirmDelete']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        workspaceId: z.string().min(1),
                        userId: z.string().min(1),
                        confirmDelete: z.boolean().refine(val => val === true, {
                            message: "Must confirm deletion by setting confirmDelete to true"
                        })
                    });

                    return ToolExecutor.run({
                        name: 'delete_workspace',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ workspaceId, userId }) => {
                            await this.workspaceService.deleteWorkspace(workspaceId, userId);
                            return {
                                success: true,
                                message: 'Workspace deleted successfully'
                            };
                        }
                    });
                }
            }
        ];
    }
}

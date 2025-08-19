/**
 * Conversation Tool Handlers - MCP tools for book conversation management
 */

import { z } from 'zod';
import { ILogger } from '../../interfaces/ILogger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { BookConversationService } from '../../services/BookConversationService.js';

export class ConversationToolHandlers {
    private logger: ILogger;
    private conversationService: BookConversationService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.conversationService = new BookConversationService(logger);
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_book_conversation',
                description: 'Create a new conversation linked to a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Unique conversation ID' },
                        bookId: { type: 'string', description: 'ID of the book this conversation is about' },
                        workspaceId: { type: 'string', description: 'ID of the workspace' },
                        userId: { type: 'string', description: 'ID of the user creating the conversation' },
                        title: { type: 'string', description: 'Title for the conversation' },
                        description: { type: 'string', description: 'Description of the conversation purpose' },
                        type: {
                            type: 'string',
                            enum: ['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration'],
                            default: 'writing_session',
                            description: 'Type of conversation'
                        },
                        goals: {
                            type: 'object',
                            properties: {
                                primary: { type: 'string', description: 'Primary goal for this conversation' },
                                secondary: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Secondary goals'
                                },
                                sessionGoal: { type: 'string', description: 'Goal for this specific session' }
                            },
                            description: 'Goals for this conversation'
                        },
                        context: {
                            type: 'object',
                            properties: {
                                activeChapterId: { type: 'string', description: 'Currently active chapter' },
                                activePageId: { type: 'string', description: 'Currently active page' },
                                focusArea: {
                                    type: 'string',
                                    enum: ['writing', 'planning', 'editing', 'research', 'character_development', 'world_building'],
                                    description: 'Area of focus'
                                },
                                workflowStage: {
                                    type: 'string',
                                    enum: ['brainstorming', 'outlining', 'first_draft', 'revision', 'editing', 'proofreading', 'publishing'],
                                    description: 'Current workflow stage'
                                }
                            },
                            description: 'Context information for the conversation'
                        }
                    },
                    required: ['conversationId', 'bookId', 'workspaceId', 'userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1),
                        bookId: z.string().min(1),
                        workspaceId: z.string().min(1),
                        userId: z.string().min(1),
                        title: z.string().optional(),
                        description: z.string().optional(),
                        type: z.enum(['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration']).default('writing_session'),
                        goals: z.object({
                            primary: z.string().optional(),
                            secondary: z.array(z.string()).optional(),
                            sessionGoal: z.string().optional()
                        }).optional(),
                        context: z.object({
                            activeChapterId: z.string().optional(),
                            activePageId: z.string().optional(),
                            focusArea: z.enum(['writing', 'planning', 'editing', 'research', 'character_development', 'world_building']).optional(),
                            workflowStage: z.enum(['brainstorming', 'outlining', 'first_draft', 'revision', 'editing', 'proofreading', 'publishing']).optional()
                        }).optional()
                    });

                    return ToolExecutor.run({
                        name: 'create_book_conversation',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            // Ensure required fields are present
                            const requestData = {
                                ...data,
                                conversationId: data.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                bookId: data.bookId || 'default_book',
                                workspaceId: data.workspaceId || 'default_workspace',
                                userId: data.userId || 'default_user'
                            };
                            const conversation = await this.conversationService.createBookConversation(requestData);
                            return {
                                success: true,
                                conversationLinkId: conversation._id,
                                conversation: conversation,
                                message: 'Book conversation created successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'get_book_conversation',
                description: 'Get details of a book conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Book conversation link ID' }
                    },
                    required: ['id']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        id: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_book_conversation',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ id }) => {
                            const conversation = await this.conversationService.getBookConversation(id);
                            return {
                                success: true,
                                conversation: conversation
                            };
                        }
                    });
                }
            },
            {
                name: 'get_conversation_by_id',
                description: 'Get book conversation by conversation ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' }
                    },
                    required: ['conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_conversation_by_id',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId }) => {
                            const conversation = await this.conversationService.getConversationByConversationId(conversationId);
                            return {
                                success: true,
                                conversation: conversation,
                                found: conversation !== null
                            };
                        }
                    });
                }
            },
            {
                name: 'get_book_conversations',
                description: 'Get conversations with filtering and pagination',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Filter by book ID' },
                        workspaceId: { type: 'string', description: 'Filter by workspace ID' },
                        userId: { type: 'string', description: 'Filter by user ID' },
                        status: {
                            type: 'string',
                            enum: ['active', 'paused', 'completed', 'archived'],
                            description: 'Filter by status'
                        },
                        type: {
                            type: 'string',
                            enum: ['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration'],
                            description: 'Filter by conversation type'
                        },
                        includeArchived: { type: 'boolean', default: false, description: 'Include archived conversations' },
                        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum number of results' },
                        offset: { type: 'number', minimum: 0, description: 'Number of results to skip' },
                        sortBy: {
                            type: 'string',
                            enum: ['updatedAt', 'createdAt', 'title', 'activity', 'messageCount'],
                            default: 'updatedAt',
                            description: 'Field to sort by'
                        },
                        sortOrder: {
                            type: 'string',
                            enum: ['asc', 'desc'],
                            default: 'desc',
                            description: 'Sort order'
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Filter by tags'
                        },
                        search: { type: 'string', description: 'Search in title and description' }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().optional(),
                        workspaceId: z.string().optional(),
                        userId: z.string().optional(),
                        status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
                        type: z.enum(['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration']).optional(),
                        includeArchived: z.boolean().default(false),
                        limit: z.number().min(1).max(100).optional(),
                        offset: z.number().min(0).optional(),
                        sortBy: z.enum(['updatedAt', 'createdAt', 'title', 'activity', 'messageCount']).default('updatedAt'),
                        sortOrder: z.enum(['asc', 'desc']).default('desc'),
                        tags: z.array(z.string()).optional(),
                        search: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'get_book_conversations',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (options) => {
                            const conversations = await this.conversationService.getConversations(options);
                            return {
                                success: true,
                                conversations: conversations,
                                count: conversations.length
                            };
                        }
                    });
                }
            },
            {
                name: 'get_conversation_summaries',
                description: 'Get conversation summaries for display in UI',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Filter by book ID' },
                        workspaceId: { type: 'string', description: 'Filter by workspace ID' },
                        userId: { type: 'string', description: 'Filter by user ID' },
                        status: {
                            type: 'string',
                            enum: ['active', 'paused', 'completed', 'archived'],
                            description: 'Filter by status'
                        },
                        type: {
                            type: 'string',
                            enum: ['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration'],
                            description: 'Filter by conversation type'
                        },
                        includeArchived: { type: 'boolean', default: false, description: 'Include archived conversations' },
                        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum number of results' },
                        sortBy: {
                            type: 'string',
                            enum: ['updatedAt', 'createdAt', 'title', 'activity', 'messageCount'],
                            default: 'updatedAt',
                            description: 'Field to sort by'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().optional(),
                        workspaceId: z.string().optional(),
                        userId: z.string().optional(),
                        status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
                        type: z.enum(['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration']).optional(),
                        includeArchived: z.boolean().default(false),
                        limit: z.number().min(1).max(100).optional(),
                        sortBy: z.enum(['updatedAt', 'createdAt', 'title', 'activity', 'messageCount']).default('updatedAt')
                    });

                    return ToolExecutor.run({
                        name: 'get_conversation_summaries',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (options) => {
                            const summaries = await this.conversationService.getConversationSummaries(options);
                            return {
                                success: true,
                                summaries: summaries,
                                count: summaries.length
                            };
                        }
                    });
                }
            },
            {
                name: 'update_book_conversation',
                description: 'Update book conversation details',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Book conversation link ID' },
                        title: { type: 'string', description: 'New title' },
                        description: { type: 'string', description: 'New description' },
                        status: {
                            type: 'string',
                            enum: ['active', 'paused', 'completed', 'archived'],
                            description: 'New status'
                        },
                        goals: {
                            type: 'object',
                            description: 'Updated goals'
                        },
                        context: {
                            type: 'object',
                            description: 'Updated context'
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Updated tags'
                        },
                        category: {
                            type: 'string',
                            enum: ['draft', 'revision', 'planning', 'research', 'brainstorm', 'review'],
                            description: 'Updated category'
                        },
                        settings: {
                            type: 'object',
                            description: 'Updated settings'
                        }
                    },
                    required: ['id']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        id: z.string().min(1),
                        title: z.string().optional(),
                        description: z.string().optional(),
                        status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
                        goals: z.record(z.any()).optional(),
                        context: z.record(z.any()).optional(),
                        tags: z.array(z.string()).optional(),
                        category: z.enum(['draft', 'revision', 'planning', 'research', 'brainstorm', 'review']).optional(),
                        settings: z.record(z.any()).optional()
                    });

                    return ToolExecutor.run({
                        name: 'update_book_conversation',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { id, ...updates } = data;
                            const conversation = await this.conversationService.updateBookConversation(id, updates);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Conversation updated successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'start_writing_session',
                description: 'Start a new writing session for a conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' },
                        goals: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Goals for this session'
                        }
                    },
                    required: ['conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1),
                        goals: z.array(z.string()).optional()
                    });

                    return ToolExecutor.run({
                        name: 'start_writing_session',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId, goals }) => {
                            const conversation = await this.conversationService.startWritingSession(conversationId, goals);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Writing session started'
                            };
                        }
                    });
                }
            },
            {
                name: 'end_writing_session',
                description: 'End the current writing session for a conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' },
                        accomplished: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'What was accomplished in this session'
                        },
                        notes: { type: 'string', description: 'Session notes' }
                    },
                    required: ['conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1),
                        accomplished: z.array(z.string()).optional(),
                        notes: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'end_writing_session',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId, accomplished, notes }) => {
                            const conversation = await this.conversationService.endWritingSession(conversationId, accomplished, notes);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Writing session ended'
                            };
                        }
                    });
                }
            },
            {
                name: 'update_conversation_stats',
                description: 'Update conversation statistics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' },
                        stats: {
                            type: 'object',
                            properties: {
                                messageCount: { type: 'number', description: 'Number of messages' },
                                wordsGenerated: { type: 'number', description: 'Words generated' },
                                revisionsRequested: { type: 'number', description: 'Revisions requested' },
                                revisionsApplied: { type: 'number', description: 'Revisions applied' },
                                pagesCreated: { type: 'number', description: 'Pages created' },
                                charactersCreated: { type: 'number', description: 'Characters created' },
                                locationsCreated: { type: 'number', description: 'Locations created' }
                            },
                            description: 'Statistics to update'
                        }
                    },
                    required: ['conversationId', 'stats']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1),
                        stats: z.object({
                            messageCount: z.number().optional(),
                            wordsGenerated: z.number().optional(),
                            revisionsRequested: z.number().optional(),
                            revisionsApplied: z.number().optional(),
                            pagesCreated: z.number().optional(),
                            charactersCreated: z.number().optional(),
                            locationsCreated: z.number().optional()
                        })
                    });

                    return ToolExecutor.run({
                        name: 'update_conversation_stats',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId, stats }) => {
                            const conversation = await this.conversationService.updateConversationStats(conversationId, stats);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Statistics updated successfully'
                            };
                        }
                    });
                }
            },
            {
                name: 'update_last_message',
                description: 'Update the last message information for a conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' },
                        messageId: { type: 'string', description: 'Message ID' },
                        content: { type: 'string', description: 'Message content (preview)' },
                        sender: {
                            type: 'string',
                            enum: ['user', 'assistant'],
                            description: 'Who sent the message'
                        }
                    },
                    required: ['conversationId', 'messageId', 'content', 'sender']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1),
                        messageId: z.string().min(1),
                        content: z.string().min(1),
                        sender: z.enum(['user', 'assistant'])
                    });

                    return ToolExecutor.run({
                        name: 'update_last_message',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId, messageId, content, sender }) => {
                            const conversation = await this.conversationService.updateLastMessage(conversationId, messageId, content, sender);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Last message updated'
                            };
                        }
                    });
                }
            },
            {
                name: 'pin_conversation',
                description: 'Pin or unpin a conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Book conversation link ID' },
                        pinned: { type: 'boolean', description: 'Whether to pin the conversation' }
                    },
                    required: ['id', 'pinned']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        id: z.string().min(1),
                        pinned: z.boolean()
                    });

                    return ToolExecutor.run({
                        name: 'pin_conversation',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ id, pinned }) => {
                            const conversation = await this.conversationService.pinConversation(id, pinned);
                            return {
                                success: true,
                                conversation: conversation,
                                message: pinned ? 'Conversation pinned' : 'Conversation unpinned'
                            };
                        }
                    });
                }
            },
            {
                name: 'archive_conversation',
                description: 'Archive a conversation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Book conversation link ID' },
                        reason: { type: 'string', description: 'Reason for archiving' },
                        userId: { type: 'string', description: 'User who is archiving' }
                    },
                    required: ['id']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        id: z.string().min(1),
                        reason: z.string().optional(),
                        userId: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'archive_conversation',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ id, reason, userId }) => {
                            const conversation = await this.conversationService.archiveConversation(id, reason, userId);
                            return {
                                success: true,
                                conversation: conversation,
                                message: 'Conversation archived'
                            };
                        }
                    });
                }
            },
            {
                name: 'get_active_conversations',
                description: 'Get all active conversations for a user',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string', description: 'User ID' }
                    },
                    required: ['userId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        userId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_active_conversations',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ userId }) => {
                            const conversations = await this.conversationService.getActiveConversations(userId);
                            return {
                                success: true,
                                conversations: conversations,
                                count: conversations.length
                            };
                        }
                    });
                }
            },
            {
                name: 'get_book_conversation_stats',
                description: 'Get conversation statistics for a specific book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book ID' }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_book_conversation_stats',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ bookId }) => {
                            const stats = await this.conversationService.getBookConversationStats(bookId);
                            return {
                                success: true,
                                stats: stats
                            };
                        }
                    });
                }
            },
            {
                name: 'get_conversation_context',
                description: 'Get conversation context for AI generation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        conversationId: { type: 'string', description: 'Conversation ID' }
                    },
                    required: ['conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        conversationId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_conversation_context',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ conversationId }) => {
                            const context = await this.conversationService.getConversationContext(conversationId);
                            return {
                                success: true,
                                context: context,
                                hasContext: context !== null
                            };
                        }
                    });
                }
            }
        ];
    }
}

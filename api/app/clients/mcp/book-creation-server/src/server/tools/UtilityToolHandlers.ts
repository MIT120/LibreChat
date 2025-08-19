/**
 * Utility Tool Handlers - MCP tools for user information, book listing, and conversation management
 * These tools help users find IDs and manage their books and conversations
 */

import { z } from 'zod';
import { ILogger } from '../../interfaces/ILogger.js';
import { IToolHandler, IDatabaseService, DatabaseConfig } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { BookConversationService } from '../../services/BookConversationService.js';
import { BookService } from '../../services/BookService.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { BookStatus } from '../../../types/book.js';

export class UtilityToolHandlers {
    private logger: ILogger;
    private conversationService: BookConversationService;
    private bookService: BookService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.conversationService = new BookConversationService(logger);
        // Create a basic database service instance for BookService
        const databaseConfig: DatabaseConfig = {
            uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/book-creation',
            options: {
                bufferCommands: true,
                maxPoolSize: 10,
                minPoolSize: 0,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                maxIdleTimeMS: 30000,
                waitQueueTimeoutMS: 10000,
            }
        };
        const databaseService = new DatabaseService(logger, databaseConfig);
        this.bookService = new BookService(logger, databaseService);
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'list_user_books',
                description: 'List all books for a user to find Book IDs. If no authorId provided, will list recent books.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: {
                            type: 'string',
                            description: 'User/Author ID (optional - if not provided, lists recent books)'
                        },
                        limit: {
                            type: 'number',
                            default: 20,
                            description: 'Maximum number of books to return'
                        },
                        status: {
                            type: 'string',
                            enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
                            description: 'Filter by book status (optional)'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        authorId: z.string().optional(),
                        limit: z.number().min(1).max(100).default(20),
                        status: z.enum(['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published']).optional()
                    });

                    return ToolExecutor.run({
                        name: 'list_user_books',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const listParams = {
                                authorId: data.authorId || 'recent_user', // Default if not provided
                                conversationId: 'utility_request', // Required by schema but not used for listing
                                limit: data.limit,
                                offset: 0,
                                ...(data.status && { status: data.status as BookStatus })
                            };

                            const result = await this.bookService.listBooks(listParams);

                            const bookList = result.data.map(book => ({
                                id: book._id,
                                title: book.title,
                                subtitle: book.subtitle,
                                status: book.status,
                                authorId: book.authorId,
                                conversationId: book.conversationId,
                                currentWordCount: book.currentWordCount,
                                targetWordCount: book.targetWordCount,
                                createdAt: book.createdAt,
                                updatedAt: book.updatedAt
                            }));

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Found ${bookList.length} book(s)`,
                                        books: bookList,
                                        pagination: result.pagination
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'get_user_info',
                description: 'Get user/author information including their default authorId',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'User ID (optional - if not provided, returns system defaults)'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        userId: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'get_user_info',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            // For now, we'll generate/return sensible defaults
                            // In a real implementation, this would query a user database
                            const defaultAuthorId = data.userId || `author_${Date.now()}`;
                            const defaultWorkspaceId = `workspace_${Date.now()}`;

                            const userInfo = {
                                userId: data.userId || `user_${Date.now()}`,
                                defaultAuthorId: defaultAuthorId,
                                defaultWorkspaceId: defaultWorkspaceId,
                                suggestedConversationId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                preferences: {
                                    autoGenerateIds: true,
                                    defaultWritingStyle: {
                                        tone: 'conversational',
                                        voice: 'third_person',
                                        vocabulary: 'intermediate',
                                        sentenceStructure: 'varied'
                                    }
                                }
                            };

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: 'User information retrieved',
                                        userInfo: userInfo,
                                        instructions: {
                                            authorId: 'Use defaultAuthorId for new books, or provide custom value',
                                            conversationId: 'Use suggestedConversationId for new conversations, or provide custom value',
                                            workspace: 'Use defaultWorkspaceId for new projects'
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'list_conversations',
                description: 'List conversations to find conversation IDs for linking to books',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Filter conversations by book ID (optional)'
                        },
                        userId: {
                            type: 'string',
                            description: 'Filter conversations by user ID (optional)'
                        },
                        workspaceId: {
                            type: 'string',
                            description: 'Filter conversations by workspace ID (optional)'
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'paused', 'completed', 'archived'],
                            description: 'Filter by conversation status (optional)'
                        },
                        limit: {
                            type: 'number',
                            default: 20,
                            description: 'Maximum number of conversations to return'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().optional(),
                        userId: z.string().optional(),
                        workspaceId: z.string().optional(),
                        status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
                        limit: z.number().min(1).max(100).default(20)
                    });

                    return ToolExecutor.run({
                        name: 'list_conversations',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const conversations = await this.conversationService.getConversations({
                                bookId: data.bookId,
                                userId: data.userId,
                                workspaceId: data.workspaceId,
                                status: data.status,
                                limit: data.limit,
                                offset: 0,
                                sortBy: 'updatedAt',
                                sortOrder: 'desc'
                            });

                            const conversationList = conversations.map(conv => ({
                                id: conv._id,
                                conversationId: conv.conversationId,
                                bookId: conv.bookId,
                                workspaceId: conv.workspaceId,
                                userId: conv.userId,
                                title: conv.title,
                                description: conv.description,
                                type: conv.type,
                                status: conv.status,
                                createdAt: conv.createdAt,
                                updatedAt: conv.updatedAt,
                                stats: conv.stats
                            }));

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Found ${conversationList.length} conversation(s)`,
                                        conversations: conversationList,
                                        instructions: {
                                            usage: 'Use the conversationId field when creating or linking books',
                                            createNew: 'Use create_book_conversation tool to create new conversations'
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'generate_defaults',
                description: 'Generate default IDs for book creation (authorId, conversationId, workspaceId)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prefix: {
                            type: 'string',
                            description: 'Optional prefix for generated IDs (e.g., username)'
                        },
                        includeTimestamp: {
                            type: 'boolean',
                            default: true,
                            description: 'Include timestamp in generated IDs'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        prefix: z.string().optional(),
                        includeTimestamp: z.boolean().default(true)
                    });

                    return ToolExecutor.run({
                        name: 'generate_defaults',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const timestamp = data.includeTimestamp ? Date.now() : '';
                            const prefix = data.prefix || 'user';
                            const randomSuffix = Math.random().toString(36).substr(2, 9);

                            const defaults = {
                                authorId: `${prefix}_author${timestamp ? '_' + timestamp : ''}`,
                                conversationId: `conv_${timestamp}_${randomSuffix}`,
                                workspaceId: `workspace_${prefix}${timestamp ? '_' + timestamp : ''}`,
                                generated: {
                                    timestamp: new Date().toISOString(),
                                    prefix: prefix,
                                    includeTimestamp: data.includeTimestamp
                                }
                            };

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: 'Default IDs generated successfully',
                                        defaults: defaults,
                                        instructions: {
                                            usage: 'Use these IDs when creating books or conversations',
                                            customization: 'You can modify any of these IDs before using them',
                                            recommendation: 'Save the authorId for consistent book ownership'
                                        }
                                    }, null, 2)
                                }]
                            };
                        }
                    });
                }
            },

            {
                name: 'update_book_ids',
                description: 'Update authorId or conversationId for an existing book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'ID of the book to update'
                        },
                        newAuthorId: {
                            type: 'string',
                            description: 'New author ID (optional)'
                        },
                        newConversationId: {
                            type: 'string',
                            description: 'New conversation ID (optional)'
                        }
                    },
                    required: ['bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        newAuthorId: z.string().optional(),
                        newConversationId: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'update_book_ids',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const updates: any = {};
                            if (data.newAuthorId) updates.authorId = data.newAuthorId;
                            if (data.newConversationId) updates.conversationId = data.newConversationId;

                            if (Object.keys(updates).length === 0) {
                                return {
                                    content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: 'No updates provided. Please provide newAuthorId or newConversationId.'
                                        }, null, 2)
                                    }]
                                };
                            }

                            const updatedBook = await this.bookService.updateBook(data.bookId, updates);

                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: 'Book IDs updated successfully',
                                        book: {
                                            id: updatedBook._id,
                                            title: updatedBook.title,
                                            authorId: updatedBook.authorId,
                                            conversationId: updatedBook.conversationId,
                                            updatedAt: updatedBook.updatedAt
                                        },
                                        changes: updates
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

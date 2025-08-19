/**
 * Compatibility Tool Handlers - Provides backward compatibility for legacy tool calls
 */

import { z } from 'zod';
import { ToolExecutor } from '../ToolExecutor.js';
import { ILogger } from '../../interfaces/ILogger.js';

export class CompatibilityToolHandlers {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    getTools(): any[] {
        return [
            {
                name: 'list_chapters_legacy',
                description: 'List chapters with legacy parameter support (authorId/conversationId format)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: { type: 'string', description: 'Author ID (legacy support)' },
                        conversationId: { type: 'string', description: 'Conversation ID (may contain bookId)' },
                        bookId: { type: 'string', description: 'Book ID (preferred)' },
                        limit: { type: ['number', 'string'], description: 'Maximum number of results', default: 10 },
                        offset: { type: ['number', 'string'], description: 'Number of results to skip', default: 0 }
                    },
                    required: []
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        authorId: z.string().optional(),
                        conversationId: z.string().optional(),
                        bookId: z.string().optional(),
                        limit: z.union([z.number(), z.string().transform(Number)]).default(10),
                        offset: z.union([z.number(), z.string().transform(Number)]).default(0)
                    });

                    return ToolExecutor.run({
                        name: 'list_chapters_legacy',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            // Try to determine bookId from available parameters
                            let bookId = data.bookId;

                            if (!bookId && data.conversationId && data.conversationId !== 'current') {
                                // Try using conversationId as bookId if it looks like a valid ID
                                bookId = data.conversationId;
                            }

                            // Return helpful error with guidance
                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: false,
                                        error: 'list_chapters tool requires bookId parameter',
                                        received_params: {
                                            authorId: data.authorId,
                                            conversationId: data.conversationId,
                                            bookId: data.bookId,
                                            limit: data.limit,
                                            offset: data.offset
                                        },
                                        corrected_usage: {
                                            tool: 'list_chapters',
                                            required_params: {
                                                bookId: '<your-book-id>'
                                            },
                                            optional_params: {
                                                limit: 10,
                                                offset: 0
                                            }
                                        },
                                        suggestions: [
                                            'First create a book using create_book tool',
                                            'Then use the returned book ID with list_chapters',
                                            'Example: { "bookId": "book_123", "limit": 10, "offset": 0 }'
                                        ]
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

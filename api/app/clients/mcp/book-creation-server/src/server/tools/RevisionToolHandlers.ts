/**
 * Revision Tool Handlers - MCP tools for inline revision requests
 */

import { z } from 'zod';
import { ILogger } from '../../interfaces/ILogger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { RevisionService } from '../../services/RevisionService.js';

export class RevisionToolHandlers {
    private logger: ILogger;
    private revisionService: RevisionService;

    constructor(logger: ILogger) {
        this.logger = logger;
        this.revisionService = new RevisionService(logger);
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_revision_request',
                description: 'Create an inline revision request for selected text in a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book' },
                        chapterId: { type: 'string', description: 'ID of the chapter (optional)' },
                        pageId: { type: 'string', description: 'ID of the page (optional)' },
                        conversationId: { type: 'string', description: 'ID of the conversation' },
                        messageId: { type: 'string', description: 'ID of the message (optional)' },
                        userId: { type: 'string', description: 'ID of the user making the request' },
                        selection: {
                            type: 'object',
                            properties: {
                                startOffset: { type: 'number', description: 'Start position of selected text' },
                                endOffset: { type: 'number', description: 'End position of selected text' },
                                selectedText: { type: 'string', description: 'The selected text to revise' },
                                contextBefore: { type: 'string', description: 'Text before selection for context' },
                                contextAfter: { type: 'string', description: 'Text after selection for context' }
                            },
                            required: ['startOffset', 'endOffset', 'selectedText']
                        },
                        instruction: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['rewrite', 'expand', 'condense', 'improve_tone', 'fix_grammar', 'change_style', 'add_detail', 'custom'],
                                    description: 'Type of revision requested'
                                },
                                description: { type: 'string', description: 'Detailed description of what to change' },
                                specificInstructions: { type: 'string', description: 'Additional specific instructions' },
                                targetTone: {
                                    type: 'string',
                                    enum: ['formal', 'casual', 'dramatic', 'humorous', 'serious', 'poetic', 'conversational'],
                                    description: 'Target tone for the revision'
                                },
                                targetLength: {
                                    type: 'string',
                                    enum: ['much_shorter', 'shorter', 'same', 'longer', 'much_longer'],
                                    description: 'Target length for the revision'
                                },
                                preserveElements: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Elements to preserve in the revision'
                                },
                                avoidElements: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Elements to avoid in the revision'
                                }
                            },
                            required: ['type', 'description']
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'normal', 'high', 'urgent'],
                            default: 'normal',
                            description: 'Priority level of the revision'
                        },
                        notes: { type: 'string', description: 'Additional notes for the revision' }
                    },
                    required: ['bookId', 'conversationId', 'userId', 'selection', 'instruction']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        chapterId: z.string().optional(),
                        pageId: z.string().optional(),
                        conversationId: z.string().min(1),
                        messageId: z.string().optional(),
                        userId: z.string().min(1),
                        selection: z.object({
                            startOffset: z.number().min(0),
                            endOffset: z.number().min(0),
                            selectedText: z.string().min(1),
                            contextBefore: z.string().optional(),
                            contextAfter: z.string().optional()
                        }),
                        instruction: z.object({
                            type: z.enum(['rewrite', 'expand', 'condense', 'improve_tone', 'fix_grammar', 'change_style', 'add_detail', 'custom']),
                            description: z.string().min(1),
                            specificInstructions: z.string().optional(),
                            targetTone: z.enum(['formal', 'casual', 'dramatic', 'humorous', 'serious', 'poetic', 'conversational']).optional(),
                            targetLength: z.enum(['much_shorter', 'shorter', 'same', 'longer', 'much_longer']).optional(),
                            preserveElements: z.array(z.string()).optional(),
                            avoidElements: z.array(z.string()).optional()
                        }),
                        priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
                        notes: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'create_revision_request',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            // Ensure required fields are present
                            const requestData = {
                                ...data,
                                bookId: data.bookId || 'default_book',
                                conversationId: data.conversationId || `conv_${Date.now()}`,
                                userId: data.userId || 'default_user',
                                instruction: data.instruction ? {
                                    type: (data.instruction.type as any) || 'improve_tone',
                                    description: data.instruction.description || 'General improvement',
                                    specificInstructions: data.instruction.specificInstructions,
                                    targetTone: data.instruction.targetTone,
                                    targetLength: data.instruction.targetLength,
                                    preserveElements: data.instruction.preserveElements,
                                    avoidElements: data.instruction.avoidElements
                                } : { type: 'improve_tone' as any, description: 'General improvement' },
                                selection: data.selection ? {
                                    startOffset: data.selection.startOffset || 0,
                                    endOffset: data.selection.endOffset || 0,
                                    selectedText: data.selection.selectedText || '',
                                    contextBefore: data.selection.contextBefore,
                                    contextAfter: data.selection.contextAfter
                                } : undefined
                            };
                            const revision = await this.revisionService.createRevisionRequest(requestData);
                            return {
                                success: true,
                                revisionId: revision._id,
                                revision: revision,
                                message: 'Revision request created successfully'
                            };
                        },
                        format: function (result: unknown, validated: { bookId?: string; conversationId?: string; userId?: string; selection?: { startOffset?: number; endOffset?: number; selectedText?: string; contextBefore?: string; contextAfter?: string; }; instruction?: { type?: 'rewrite' | 'expand' | 'condense' | 'improve_tone' | 'fix_grammar' | 'change_style' | 'add_detail' | 'custom'; description?: string; specificInstructions?: string; targetTone?: 'formal' | 'casual' | 'dramatic' | 'humorous' | 'serious' | 'poetic' | 'conversational'; targetLength?: 'much_shorter' | 'shorter' | 'same' | 'longer' | 'much_longer'; preserveElements?: string[]; avoidElements?: string[]; }; chapterId?: string; pageId?: string; messageId?: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; notes?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'get_revision_request',
                description: 'Get details of a specific revision request',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' }
                    },
                    required: ['revisionId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_revision_request',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId }) => {
                            const revision = await this.revisionService.getRevisionRequest(revisionId);
                            return {
                                success: true,
                                revision: revision
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'get_revisions',
                description: 'Get revision requests with filtering and pagination',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Filter by book ID' },
                        chapterId: { type: 'string', description: 'Filter by chapter ID' },
                        pageId: { type: 'string', description: 'Filter by page ID' },
                        conversationId: { type: 'string', description: 'Filter by conversation ID' },
                        userId: { type: 'string', description: 'Filter by user ID' },
                        status: {
                            type: 'string',
                            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'applied'],
                            description: 'Filter by status'
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'normal', 'high', 'urgent'],
                            description: 'Filter by priority'
                        },
                        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum number of results' },
                        offset: { type: 'number', minimum: 0, description: 'Number of results to skip' },
                        sortBy: {
                            type: 'string',
                            enum: ['createdAt', 'updatedAt', 'priority', 'status'],
                            default: 'createdAt',
                            description: 'Field to sort by'
                        },
                        sortOrder: {
                            type: 'string',
                            enum: ['asc', 'desc'],
                            default: 'desc',
                            description: 'Sort order'
                        }
                    }
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().optional(),
                        chapterId: z.string().optional(),
                        pageId: z.string().optional(),
                        conversationId: z.string().optional(),
                        userId: z.string().optional(),
                        status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'applied']).optional(),
                        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
                        limit: z.number().min(1).max(100).optional(),
                        offset: z.number().min(0).optional(),
                        sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
                        sortOrder: z.enum(['asc', 'desc']).default('desc')
                    });

                    return ToolExecutor.run({
                        name: 'get_revisions',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (options) => {
                            const revisions = await this.revisionService.getRevisions(options);
                            return {
                                success: true,
                                revisions: revisions,
                                count: revisions.length
                            };
                        },
                        format: function (result: unknown, validated: { bookId?: string; conversationId?: string; userId?: string; chapterId?: string; pageId?: string; status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'applied'; priority?: 'low' | 'normal' | 'high' | 'urgent'; limit?: number; offset?: number; sortBy?: 'status' | 'priority' | 'createdAt' | 'updatedAt'; sortOrder?: 'asc' | 'desc'; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'process_revision_request',
                description: 'Process a revision request and generate the revised text',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request to process' }
                    },
                    required: ['revisionId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'process_revision_request',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId }) => {
                            const revision = await this.revisionService.processRevisionRequest(revisionId);
                            return {
                                success: true,
                                revision: revision,
                                message: 'Revision processed successfully'
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'submit_revision_feedback',
                description: 'Submit feedback for a completed revision request',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' },
                        rating: { type: 'number', minimum: 1, maximum: 5, description: 'Rating from 1-5' },
                        feedback: { type: 'string', description: 'Written feedback' },
                        acceptedVersion: {
                            type: 'string',
                            description: 'Version that was accepted (original, generated, or alternative variant)'
                        },
                        customEdits: { type: 'string', description: 'Any custom edits made to the generated text' }
                    },
                    required: ['revisionId', 'rating', 'acceptedVersion']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1),
                        rating: z.number().min(1).max(5),
                        feedback: z.string().optional(),
                        acceptedVersion: z.string().min(1),
                        customEdits: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'submit_revision_feedback',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async (data) => {
                            const { revisionId, ...feedbackData } = data;
                            // Ensure required fields are present
                            const completeFeedback = {
                                ...feedbackData,
                                rating: feedbackData.rating || 3,
                                acceptedVersion: feedbackData.acceptedVersion || 'original',
                                timestamp: new Date()
                            };
                            const revision = await this.revisionService.submitFeedback(revisionId, completeFeedback);
                            return {
                                success: true,
                                revision: revision,
                                message: 'Feedback submitted successfully'
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; rating?: number; acceptedVersion?: string; feedback?: string; customEdits?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'apply_revision',
                description: 'Apply a revision to the original content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' },
                        versionToApply: {
                            type: 'string',
                            default: 'generated',
                            description: 'Which version to apply (generated, or specific alternative variant)'
                        }
                    },
                    required: ['revisionId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1),
                        versionToApply: z.string().default('generated')
                    });

                    return ToolExecutor.run({
                        name: 'apply_revision',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId, versionToApply }) => {
                            const revision = await this.revisionService.applyRevision(revisionId, versionToApply);
                            return {
                                success: true,
                                revision: revision,
                                message: 'Revision applied successfully'
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; versionToApply?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'cancel_revision',
                description: 'Cancel a revision request',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' },
                        reason: { type: 'string', description: 'Reason for cancellation' }
                    },
                    required: ['revisionId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1),
                        reason: z.string().optional()
                    });

                    return ToolExecutor.run({
                        name: 'cancel_revision',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId, reason }) => {
                            const revision = await this.revisionService.cancelRevision(revisionId, reason);
                            return {
                                success: true,
                                revision: revision,
                                message: 'Revision cancelled successfully'
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; reason?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'get_revision_history',
                description: 'Get revision history for a specific page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'ID of the page' }
                    },
                    required: ['pageId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        pageId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_revision_history',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ pageId }) => {
                            const revisions = await this.revisionService.getRevisionHistory(pageId);
                            return {
                                success: true,
                                revisions: revisions,
                                count: revisions.length
                            };
                        },
                        format: function (result: unknown, validated: { pageId?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'get_conflicting_revisions',
                description: 'Get revisions that conflict with a specific revision',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' }
                    },
                    required: ['revisionId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1)
                    });

                    return ToolExecutor.run({
                        name: 'get_conflicting_revisions',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId }) => {
                            const conflicts = await this.revisionService.getConflictingRevisions(revisionId);
                            return {
                                success: true,
                                conflicts: conflicts,
                                count: conflicts.length
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'resolve_revision_conflicts',
                description: 'Resolve conflicts between overlapping revisions',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionId: { type: 'string', description: 'ID of the revision request' },
                        resolution: {
                            type: 'string',
                            enum: ['merge', 'replace', 'skip'],
                            description: 'How to resolve the conflicts'
                        }
                    },
                    required: ['revisionId', 'resolution']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionId: z.string().min(1),
                        resolution: z.enum(['merge', 'replace', 'skip'])
                    });

                    return ToolExecutor.run({
                        name: 'resolve_revision_conflicts',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionId, resolution }) => {
                            const revision = await this.revisionService.resolveConflicts(revisionId, resolution);
                            return {
                                success: true,
                                revision: revision,
                                message: 'Conflicts resolved successfully'
                            };
                        },
                        format: function (result: unknown, validated: { revisionId?: string; resolution?: 'merge' | 'replace' | 'skip'; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            },
            {
                name: 'bulk_update_revisions',
                description: 'Update multiple revision requests at once',
                inputSchema: {
                    type: 'object',
                    properties: {
                        revisionIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of revision IDs to update'
                        },
                        updates: {
                            type: 'object',
                            properties: {
                                status: {
                                    type: 'string',
                                    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'applied']
                                },
                                priority: {
                                    type: 'string',
                                    enum: ['low', 'normal', 'high', 'urgent']
                                },
                                tags: {
                                    type: 'array',
                                    items: { type: 'string' }
                                }
                            },
                            description: 'Updates to apply to all revisions'
                        }
                    },
                    required: ['revisionIds', 'updates']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        revisionIds: z.array(z.string().min(1)).min(1),
                        updates: z.object({
                            status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'applied']).optional(),
                            priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
                            tags: z.array(z.string()).optional()
                        })
                    });

                    return ToolExecutor.run({
                        name: 'bulk_update_revisions',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ revisionIds, updates }) => {
                            const modifiedCount = await this.revisionService.bulkUpdateRevisions(revisionIds, updates);
                            return {
                                success: true,
                                modifiedCount: modifiedCount,
                                message: `${modifiedCount} revisions updated successfully`
                            };
                        },
                        format: function (result: unknown, validated: { revisionIds?: string[]; updates?: { status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'applied'; priority?: 'low' | 'normal' | 'high' | 'urgent'; tags?: string[]; }; }) {
                            throw new Error('Function not implemented.');
                        }
                    });
                }
            }
        ];
    }
}

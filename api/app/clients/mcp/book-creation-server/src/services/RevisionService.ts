/**
 * Revision Service - Handles inline revision requests and management
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { RevisionRequest } from '../../models/RevisionRequest.js';
import { BookConversation } from '../../models/BookConversation.js';
import { Page } from '../../models/Page.js';
import { Chapter } from '../../models/Chapter.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';
import { Document } from 'mongoose';

// Type definitions for Mongoose documents
type RevisionRequestDocument = any;

// Service interfaces
export interface CreateRevisionRequest {
    bookId: string;
    chapterId?: string;
    pageId?: string;
    conversationId: string;
    messageId?: string;
    userId: string;
    selection: {
        startOffset: number;
        endOffset: number;
        selectedText: string;
        contextBefore?: string;
        contextAfter?: string;
    };
    instruction: {
        type: 'rewrite' | 'expand' | 'condense' | 'improve_tone' | 'fix_grammar' | 'change_style' | 'add_detail' | 'custom';
        description: string;
        specificInstructions?: string;
        targetTone?: string;
        targetLength?: string;
        preserveElements?: string[];
        avoidElements?: string[];
    };
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notes?: string;
}

export interface RevisionResult {
    generatedText: string;
    confidence: number;
    alternativeVersions?: Array<{
        text: string;
        variant: string;
        confidence: number;
    }>;
    changes: Array<{
        type: 'addition' | 'deletion' | 'modification' | 'restructure';
        description: string;
        impact: 'minor' | 'moderate' | 'significant';
    }>;
}

export interface RevisionFeedback {
    rating: number;
    feedback?: string;
    acceptedVersion: string;
    customEdits?: string;
}

export interface GetRevisionsOptions {
    bookId?: string;
    chapterId?: string;
    pageId?: string;
    conversationId?: string;
    userId?: string;
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
    sortOrder?: 'asc' | 'desc';
}

export interface IRevisionService {
    createRevisionRequest(request: CreateRevisionRequest): Promise<RevisionRequestDocument>;
    getRevisionRequest(revisionId: string): Promise<RevisionRequestDocument>;
    getRevisions(options: GetRevisionsOptions): Promise<RevisionRequestDocument[]>;
    processRevisionRequest(revisionId: string): Promise<RevisionRequestDocument>;
    updateRevisionResult(revisionId: string, result: RevisionResult): Promise<RevisionRequestDocument>;
    submitFeedback(revisionId: string, feedback: RevisionFeedback): Promise<RevisionRequestDocument>;
    applyRevision(revisionId: string, versionToApply?: string): Promise<RevisionRequestDocument>;
    cancelRevision(revisionId: string, reason?: string): Promise<RevisionRequestDocument>;
    getRevisionHistory(pageId: string): Promise<RevisionRequestDocument[]>;
    getConflictingRevisions(revisionId: string): Promise<RevisionRequestDocument[]>;
    resolveConflicts(revisionId: string, resolution: 'merge' | 'replace' | 'skip'): Promise<RevisionRequestDocument>;
    deleteRevision(revisionId: string): Promise<void>;
    bulkUpdateRevisions(revisionIds: string[], updates: any): Promise<number>;
}

export class RevisionService extends BaseService implements IRevisionService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('RevisionService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('RevisionService disposed');
    }

    async createRevisionRequest(request: CreateRevisionRequest): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('createRevisionRequest', async () => {
            this.validateCreateRevisionRequest(request);

            // Get context information
            const context = await this.buildRevisionContext(request);

            const revisionId = uuidv4();
            const revision = new RevisionRequest({
                _id: revisionId,
                bookId: request.bookId,
                chapterId: request.chapterId,
                pageId: request.pageId,
                conversationId: request.conversationId,
                messageId: request.messageId,
                userId: request.userId,
                selection: request.selection,
                instruction: request.instruction,
                priority: request.priority || 'normal',
                notes: request.notes,
                context,
                version: {
                    originalVersion: 1, // Would get actual version from page/content
                    conflictsWithRevisions: []
                },
                flags: {
                    isAutomated: false,
                    requiresReview: request.instruction.type === 'custom' || request.priority === 'urgent',
                    affectsMultiplePages: false,
                    hasConflicts: false,
                    isUrgent: request.priority === 'urgent'
                }
            });

            try {
                const savedRevision = await revision.save();

                // Check for conflicts with existing revisions
                // Check for conflicts (placeholder implementation)
                // TODO: Implement conflict detection logic

                // Update the conversation with this revision request
                await this.updateConversationWithRevision(request.conversationId, revisionId);

                // Auto-process if not requiring review
                if (!savedRevision.flags.requiresReview) {
                    // Queue for processing (would typically use a job queue)
                    setImmediate(() => this.processRevisionRequest(revisionId));
                }

                return savedRevision;
            } catch (error) {
                throw new DatabaseError(`Failed to create revision request: ${(error as Error).message}`);
            }
        }, { bookId: request.bookId, type: request.instruction.type });
    }

    async getRevisionRequest(revisionId: string): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('getRevisionRequest', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }
            return revision;
        }, { revisionId });
    }

    async getRevisions(options: GetRevisionsOptions = {}): Promise<RevisionRequestDocument[]> {
        return this.executeWithLogging('getRevisions', async () => {
            const query: any = {};

            if (options.bookId) query.bookId = options.bookId;
            if (options.chapterId) query.chapterId = options.chapterId;
            if (options.pageId) query.pageId = options.pageId;
            if (options.conversationId) query.conversationId = options.conversationId;
            if (options.userId) query.userId = options.userId;
            if (options.status) query.status = options.status;
            if (options.priority) query.priority = options.priority;

            let dbQuery = RevisionRequest.find(query);

            // Sorting
            if (options.sortBy) {
                const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
                dbQuery = dbQuery.sort({ [options.sortBy]: sortOrder });
            } else {
                dbQuery = dbQuery.sort({ createdAt: -1 });
            }

            // Pagination
            if (options.offset) {
                dbQuery = dbQuery.skip(options.offset);
            }
            if (options.limit) {
                dbQuery = dbQuery.limit(options.limit);
            }

            return dbQuery.exec();
        }, options);
    }

    async processRevisionRequest(revisionId: string): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('processRevisionRequest', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            if (revision.status !== 'pending') {
                throw new ValidationError('Revision request is not in pending status', []);
            }

            try {
                // Update status to processing
                // Update status to processing
                revision.status = 'processing';
                await revision.save();

                // Generate revision based on instruction
                const result = await this.generateRevision(revision);

                // Update with result
                // Add revision result to the result field (cast to any to handle type mismatch)
                revision.result = result as any;
                revision.status = 'completed';
                await revision.save();

                return revision;
            } catch (error) {
                // Update status to failed
                revision.status = 'failed';
                // Store error in notes field instead
                revision.notes = `Error: ${(error as any)?.message || 'Unknown error'}`;
                await revision.save();
                throw error;
            }
        }, { revisionId });
    }

    async updateRevisionResult(revisionId: string, result: RevisionResult): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('updateRevisionResult', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            // Add revision result (cast to any to handle type mismatch)
            revision.result = {
                ...result,
                metadata: {
                    model: 'custom',
                    timestamp: new Date(),
                    processingTime: 0
                }
            } as any;
            await revision.save();

            return revision;
        }, { revisionId });
    }

    async submitFeedback(revisionId: string, feedback: RevisionFeedback): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('submitFeedback', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            // Add feedback with required timestamp
            revision.feedback = {
                ...feedback,
                timestamp: new Date()
            };
            await revision.save();

            // Update conversation stats if revision was applied
            if (feedback.acceptedVersion !== 'original') {
                await this.updateConversationStats(revision.conversationId, {
                    revisionsApplied: 1
                });
            }

            return revision;
        }, { revisionId, rating: feedback.rating });
    }

    async applyRevision(revisionId: string, versionToApply = 'generated'): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('applyRevision', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            if (!revision.result || !revision.result.generatedText) {
                throw new ValidationError('No revision result available to apply', []);
            }

            // Here you would actually update the page content
            // This is a simplified version - real implementation would handle text replacement
            if (revision.pageId) {
                const page = await Page.findOne({ pageId: revision.pageId });
                if (page) {
                    const textToApply = versionToApply === 'generated'
                        ? revision.result.generatedText
                        : revision.result.alternativeVersions?.find(v => v.variant === versionToApply)?.text;

                    if (textToApply) {
                        // Replace the selected text with the revised text
                        const originalContent = page.content || '';
                        const newContent =
                            originalContent.substring(0, revision.selection.startOffset) +
                            textToApply +
                            originalContent.substring(revision.selection.endOffset);

                        page.content = newContent;
                        page.wordCount = newContent.split(/\s+/).filter(word => word.length > 0).length;
                        await page.save();
                    }
                }
            }

            // Update revision status
            revision.status = 'applied';
            revision.version.appliedVersion = revision.version.originalVersion + 1;

            // Add feedback automatically
            // Add application feedback
            revision.feedback = {
                rating: 5,
                feedback: 'Applied automatically',
                acceptedVersion: versionToApply,
                timestamp: new Date()
            };
            await revision.save();

            return revision;
        }, { revisionId, versionToApply });
    }

    async cancelRevision(revisionId: string, reason?: string): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('cancelRevision', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            revision.status = 'cancelled';
            if (reason) {
                revision.notes = (revision.notes || '') + `\nCancelled: ${reason}`;
            }

            return revision.save();
        }, { revisionId });
    }

    async getRevisionHistory(pageId: string): Promise<RevisionRequestDocument[]> {
        return this.executeWithLogging('getRevisionHistory', async () => {
            return RevisionRequest.find({ pageId })
                .sort({ createdAt: -1 })
                .exec();
        }, { pageId });
    }

    async getConflictingRevisions(revisionId: string): Promise<RevisionRequestDocument[]> {
        return this.executeWithLogging('getConflictingRevisions', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            // Get conflicting revisions (placeholder)
            return await RevisionRequest.find({
                pageId: revision.pageId,
                status: { $in: ['pending', 'processing'] },
                _id: { $ne: revision._id }
            });
        }, { revisionId });
    }

    async resolveConflicts(revisionId: string, resolution: 'merge' | 'replace' | 'skip'): Promise<RevisionRequestDocument> {
        return this.executeWithLogging('resolveConflicts', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            // Implementation would depend on the resolution strategy
            // This is a simplified version
            switch (resolution) {
                case 'merge':
                    // Try to merge conflicting changes
                    break;
                case 'replace':
                    // Replace conflicting revisions with this one
                    break;
                case 'skip':
                    // Skip this revision
                    revision.status = 'cancelled';
                    revision.notes = (revision.notes || '') + '\nSkipped due to conflicts';
                    break;
            }

            revision.flags.hasConflicts = false;
            return revision.save();
        }, { revisionId, resolution });
    }

    async deleteRevision(revisionId: string): Promise<void> {
        return this.executeWithLogging('deleteRevision', async () => {
            const revision = await RevisionRequest.findById(revisionId);
            if (!revision) {
                throw new NotFoundError('Revision Request', revisionId);
            }

            // Only allow deletion of pending or failed revisions
            if (!['pending', 'failed', 'cancelled'].includes(revision.status)) {
                throw new ValidationError('Cannot delete revision request in current status', []);
            }

            await RevisionRequest.findByIdAndDelete(revisionId);
        }, { revisionId });
    }

    async bulkUpdateRevisions(revisionIds: string[], updates: any): Promise<number> {
        return this.executeWithLogging('bulkUpdateRevisions', async () => {
            const result = await RevisionRequest.updateMany(
                { _id: { $in: revisionIds } },
                { $set: updates }
            );

            return result.modifiedCount;
        }, { count: revisionIds.length });
    }

    // Helper methods
    private validateCreateRevisionRequest(request: CreateRevisionRequest): void {
        if (!request.bookId) {
            throw new ValidationError('Book ID is required', []);
        }
        if (!request.conversationId) {
            throw new ValidationError('Conversation ID is required', []);
        }
        if (!request.userId) {
            throw new ValidationError('User ID is required', []);
        }
        if (!request.selection || !request.selection.selectedText) {
            throw new ValidationError('Text selection is required', []);
        }
        if (!request.instruction || !request.instruction.type || !request.instruction.description) {
            throw new ValidationError('Revision instruction is required', []);
        }
        if (request.selection.startOffset >= request.selection.endOffset) {
            throw new ValidationError('Invalid selection range', []);
        }
    }

    private async buildRevisionContext(request: CreateRevisionRequest): Promise<any> {
        const context: any = {
            surroundingText: '',
            chapterTitle: '',
            chapterSummary: '',
            characterContext: [],
            plotContext: '',
            previousRevisions: []
        };

        try {
            // Get chapter information
            if (request.chapterId) {
                const chapter = await Chapter.findById(request.chapterId);
                if (chapter) {
                    context.chapterTitle = chapter.title;
                    context.chapterSummary = chapter.description || '';
                }
            }

            // Get page content for surrounding text
            if (request.pageId) {
                const page = await Page.findOne({ pageId: request.pageId });
                if (page && page.content) {
                    const startContext = Math.max(0, request.selection.startOffset - 500);
                    const endContext = Math.min(page.content.length, request.selection.endOffset + 500);
                    context.surroundingText = page.content.substring(startContext, endContext);
                }
            }

            // Get previous revisions for this page
            if (request.pageId) {
                const previousRevisions = await RevisionRequest.find({
                    pageId: request.pageId,
                    status: { $in: ['completed', 'applied'] }
                }).limit(5).sort({ createdAt: -1 });

                context.previousRevisions = previousRevisions.map(r => r._id);
            }

        } catch (error) {
            this.logger.warn('Failed to build complete revision context', { error });
        }

        return context;
    }

    private async generateRevision(revision: RevisionRequestDocument): Promise<RevisionResult> {
        // This is where you'd integrate with your AI models
        // For now, returning a mock result

        const mockResult: RevisionResult = {
            generatedText: revision.selection.selectedText + ' [REVISED]',
            confidence: 85,
            alternativeVersions: [
                {
                    text: revision.selection.selectedText + ' [ALTERNATIVE 1]',
                    variant: 'formal',
                    confidence: 80
                },
                {
                    text: revision.selection.selectedText + ' [ALTERNATIVE 2]',
                    variant: 'casual',
                    confidence: 75
                }
            ],
            changes: [
                {
                    type: 'modification',
                    description: 'Improved clarity and flow',
                    impact: 'moderate'
                }
            ]
        };

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));

        return mockResult;
    }

    private async updateConversationWithRevision(conversationId: string, revisionId: string): Promise<void> {
        try {
            const conversation = await BookConversation.findOne({ conversationId });
            if (conversation) {
                // Add revision request to conversation
                if (!conversation.relatedContent.revisionRequests.includes(revisionId)) {
                    conversation.relatedContent.revisionRequests.push(revisionId);
                    conversation.stats.revisionsRequested = (conversation.stats.revisionsRequested || 0) + 1;
                    await conversation.save();
                }
            }
        } catch (error) {
            this.logger.warn('Failed to update conversation with revision', { conversationId, revisionId, error });
        }
    }

    private async updateConversationStats(conversationId: string, updates: any): Promise<void> {
        try {
            const conversation = await BookConversation.findOne({ conversationId });
            if (conversation) {
                const currentStats = conversation.stats;
                Object.keys(updates).forEach(key => {
                    currentStats[key] = (currentStats[key] || 0) + updates[key];
                });
                // Update conversation stats
                Object.assign(conversation.stats, currentStats);
                conversation.stats.lastActivity = new Date();
                await conversation.save();
            }
        } catch (error) {
            this.logger.warn('Failed to update conversation stats', { conversationId, error });
        }
    }
}

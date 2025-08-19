/**
 * Book Conversation Service - Manages conversations linked to books
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { BookConversation } from '../../models/BookConversation.js';
import { Book } from '../../models/Book.js';
import { ProjectWorkspace } from '../../models/ProjectWorkspace.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';
import { Document } from 'mongoose';

// Type definitions for Mongoose documents
type BookConversationDocument = any;

// Service interfaces
export interface CreateBookConversationRequest {
    conversationId: string;
    bookId: string;
    workspaceId: string;
    userId: string;
    title?: string;
    description?: string;
    type?: 'writing_session' | 'planning' | 'editing' | 'research' | 'brainstorming' | 'review' | 'collaboration';
    goals?: {
        primary?: string;
        secondary?: string[];
        sessionGoal?: string;
    };
    context?: {
        activeChapterId?: string;
        activePageId?: string;
        focusArea?: string;
        workflowStage?: string;
    };
}

export interface UpdateBookConversationRequest {
    title?: string;
    description?: string;
    status?: 'active' | 'paused' | 'completed' | 'archived';
    goals?: any;
    context?: any;
    tags?: string[];
    category?: string;
    settings?: any;
}

export interface ConversationSummary {
    id: string;
    conversationId: string;
    title: string;
    bookTitle: string;
    bookId: string;
    type: string;
    status: string;
    messageCount: number;
    wordsGenerated: number;
    lastActivity: Date;
    duration: number;
    productivity: number;
    tags: string[];
    isActive: boolean;
    isPinned: boolean;
}

export interface GetConversationsOptions {
    bookId?: string;
    workspaceId?: string;
    userId?: string;
    status?: string;
    type?: string;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'updatedAt' | 'createdAt' | 'title' | 'activity' | 'messageCount';
    sortOrder?: 'asc' | 'desc';
    tags?: string[];
    search?: string;
}

export interface IBookConversationService {
    createBookConversation(request: CreateBookConversationRequest): Promise<BookConversationDocument>;
    getBookConversation(id: string): Promise<BookConversationDocument>;
    getConversationByConversationId(conversationId: string): Promise<BookConversationDocument | null>;
    getConversations(options: GetConversationsOptions): Promise<BookConversationDocument[]>;
    getConversationSummaries(options: GetConversationsOptions): Promise<ConversationSummary[]>;
    updateBookConversation(id: string, updates: UpdateBookConversationRequest): Promise<BookConversationDocument>;
    deleteBookConversation(id: string): Promise<void>;
    startWritingSession(conversationId: string, goals?: string[]): Promise<BookConversationDocument>;
    endWritingSession(conversationId: string, accomplished?: string[], notes?: string): Promise<BookConversationDocument>;
    updateConversationStats(conversationId: string, stats: any): Promise<BookConversationDocument>;
    updateLastMessage(conversationId: string, messageId: string, content: string, sender: 'user' | 'assistant'): Promise<BookConversationDocument>;
    archiveConversation(id: string, reason?: string, userId?: string): Promise<BookConversationDocument>;
    pinConversation(id: string, pinned: boolean): Promise<BookConversationDocument>;
    getActiveConversations(userId: string): Promise<BookConversationDocument[]>;
    getBookConversationStats(bookId: string): Promise<any>;
    bulkUpdateConversations(ids: string[], updates: any): Promise<number>;
}

export class BookConversationService extends BaseService implements IBookConversationService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('BookConversationService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('BookConversationService disposed');
    }

    async createBookConversation(request: CreateBookConversationRequest): Promise<BookConversationDocument> {
        return this.executeWithLogging('createBookConversation', async () => {
            this.validateCreateRequest(request);

            // Verify book and workspace exist
            const book = await Book.findById(request.bookId);
            if (!book) {
                throw new NotFoundError('Book', request.bookId);
            }

            const workspace = await ProjectWorkspace.findById(request.workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', request.workspaceId);
            }

            const conversationLinkId = uuidv4();
            const bookConversation = new BookConversation({
                _id: conversationLinkId,
                conversationId: request.conversationId,
                bookId: request.bookId,
                workspaceId: request.workspaceId,
                userId: request.userId,
                title: request.title || `${book.title} - Writing Session`,
                description: request.description,
                type: request.type || 'writing_session',
                context: {
                    activeChapterId: request.context?.activeChapterId,
                    activePageId: request.context?.activePageId,
                    focusArea: request.context?.focusArea || 'writing',
                    workflowStage: request.context?.workflowStage || 'first_draft',
                    lastContext: {
                        characters: [],
                        locations: [],
                        plotlines: []
                    }
                },
                goals: {
                    primary: request.goals?.primary || 'general_writing',
                    secondary: request.goals?.secondary || [],
                    sessionGoal: request.goals?.sessionGoal,
                    specificTargets: []
                },
                stats: {
                    messageCount: 0,
                    wordsGenerated: 0,
                    revisionsRequested: 0,
                    revisionsApplied: 0,
                    chaptersWorkedOn: 0,
                    pagesCreated: 0,
                    charactersCreated: 0,
                    locationsCreated: 0,
                    lastActivity: new Date(),
                    totalSessionTime: 0,
                    averageResponseTime: 0
                },
                status: 'active',
                category: 'draft',
                settings: {
                    autoSave: true,
                    enableRevisionTracking: true,
                    enableContextAwareness: true,
                    enableSuggestions: true,
                    reminderInterval: 30
                },
                sessions: [],
                relatedContent: {
                    revisionRequests: [],
                    generatedPages: [],
                    modifiedChapters: [],
                    createdCharacters: [],
                    createdLocations: [],
                    researchItems: []
                },
                flags: {
                    isPinned: false,
                    isTemplate: false,
                    requiresReview: false,
                    hasUnresolvedIssues: false,
                    isHighPriority: false
                }
            });

            try {
                const savedConversation = await bookConversation.save();
                return savedConversation;
            } catch (error) {
                throw new DatabaseError(`Failed to create book conversation: ${(error as Error).message}`);
            }
        }, { bookId: request.bookId, conversationId: request.conversationId });
    }

    async getBookConversation(id: string): Promise<BookConversationDocument> {
        return this.executeWithLogging('getBookConversation', async () => {
            const conversation = await BookConversation.findById(id).populate('bookId', 'title genre');
            if (!conversation) {
                throw new NotFoundError('Book Conversation', id);
            }
            return conversation;
        }, { id });
    }

    async getConversationByConversationId(conversationId: string): Promise<BookConversationDocument | null> {
        return this.executeWithLogging('getConversationByConversationId', async () => {
            const conversation = await BookConversation.findOne({ conversationId }).populate('bookId', 'title genre');
            return conversation;
        }, { conversationId });
    }

    async getConversations(options: GetConversationsOptions = {}): Promise<BookConversationDocument[]> {
        return this.executeWithLogging('getConversations', async () => {
            const query: any = {};

            if (options.bookId) query.bookId = options.bookId;
            if (options.workspaceId) query.workspaceId = options.workspaceId;
            if (options.userId) query.userId = options.userId;
            if (options.status) query.status = options.status;
            if (options.type) query.type = options.type;
            if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };

            if (!options.includeArchived) {
                query.status = { $ne: 'archived' };
            }

            if (options.search) {
                query.$or = [
                    { title: { $regex: options.search, $options: 'i' } },
                    { description: { $regex: options.search, $options: 'i' } }
                ];
            }

            let dbQuery = BookConversation.find(query).populate('bookId', 'title genre');

            // Sorting
            if (options.sortBy) {
                const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
                dbQuery = dbQuery.sort({ [options.sortBy]: sortOrder });
            } else {
                dbQuery = dbQuery.sort({ updatedAt: -1 });
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

    async getConversationSummaries(options: GetConversationsOptions = {}): Promise<ConversationSummary[]> {
        return this.executeWithLogging('getConversationSummaries', async () => {
            const conversations = await this.getConversations(options);

            return Promise.all(conversations.map(async (conversation) => {
                // Populate book title if not already populated
                let bookTitle = 'Unknown Book';
                if (conversation.bookId) {
                    if (typeof conversation.bookId === 'string') {
                        const book = await Book.findById(conversation.bookId);
                        bookTitle = book?.title || 'Unknown Book';
                    } else {
                        bookTitle = (conversation.bookId as any).title;
                    }
                }

                return {
                    id: conversation._id,
                    conversationId: conversation.conversationId,
                    title: conversation.title,
                    bookTitle: bookTitle,
                    bookId: typeof conversation.bookId === 'string' ? conversation.bookId : (conversation.bookId as any)._id,
                    type: conversation.type,
                    status: conversation.status,
                    messageCount: conversation.stats.messageCount,
                    wordsGenerated: conversation.stats.wordsGenerated,
                    lastActivity: conversation.stats.lastActivity,
                    duration: conversation.totalDuration,
                    productivity: conversation.productivity,
                    tags: conversation.tags,
                    isActive: conversation.isActive,
                    isPinned: conversation.flags.isPinned
                };
            }));
        }, options);
    }

    async updateBookConversation(id: string, updates: UpdateBookConversationRequest): Promise<BookConversationDocument> {
        return this.executeWithLogging('updateBookConversation', async () => {
            const conversation = await BookConversation.findById(id);
            if (!conversation) {
                throw new NotFoundError('Book Conversation', id);
            }

            // Apply updates
            if (updates.title !== undefined) conversation.title = updates.title;
            if (updates.description !== undefined) conversation.description = updates.description;
            if (updates.status !== undefined) conversation.status = updates.status;
            if (updates.tags !== undefined) conversation.tags = updates.tags;
            if (updates.category !== undefined) {
                const validCategories = ['draft', 'revision', 'planning', 'research', 'brainstorm', 'review'];
                if (validCategories.includes(updates.category)) {
                    conversation.category = updates.category as any;
                }
            }

            if (updates.goals) {
                Object.assign(conversation.goals, updates.goals);
            }

            if (updates.context) {
                Object.assign(conversation.context, updates.context);
            }

            if (updates.settings) {
                Object.assign(conversation.settings, updates.settings);
            }

            try {
                const updatedConversation = await conversation.save();
                return updatedConversation;
            } catch (error) {
                throw new DatabaseError(`Failed to update book conversation: ${(error as Error).message}`);
            }
        }, { id });
    }

    async deleteBookConversation(id: string): Promise<void> {
        return this.executeWithLogging('deleteBookConversation', async () => {
            const conversation = await BookConversation.findById(id);
            if (!conversation) {
                throw new NotFoundError('Book Conversation', id);
            }

            try {
                await BookConversation.findByIdAndDelete(id);
            } catch (error) {
                throw new DatabaseError(`Failed to delete book conversation: ${(error as Error).message}`);
            }
        }, { id });
    }

    async startWritingSession(conversationId: string, goals?: string[]): Promise<BookConversationDocument> {
        return this.executeWithLogging('startWritingSession', async () => {
            const conversation = await BookConversation.findOne({ conversationId });
            if (!conversation) {
                throw new NotFoundError('Book Conversation', conversationId);
            }

            // Start a new session
            const session = {
                startTime: new Date(),
                messageCount: 0,
                wordsGenerated: 0,
                goals: goals || [],
                accomplished: [],
                notes: ''
            };
            conversation.sessions.push(session);
            conversation.status = 'active';
            await conversation.save();
            return conversation;
        }, { conversationId });
    }

    async endWritingSession(conversationId: string, accomplished?: string[], notes?: string): Promise<BookConversationDocument> {
        return this.executeWithLogging('endWritingSession', async () => {
            const conversation = await BookConversation.findOne({ conversationId });
            if (!conversation) {
                throw new NotFoundError('Book Conversation', conversationId);
            }

            // End the current session
            const currentSession = conversation.sessions[conversation.sessions.length - 1];
            if (currentSession && !currentSession.endTime) {
                currentSession.endTime = new Date();
                currentSession.duration = Math.round((currentSession.endTime.getTime() - currentSession.startTime.getTime()) / (1000 * 60));
                currentSession.accomplished = accomplished || [];
                currentSession.notes = notes || '';
            }
            await conversation.save();
            return conversation;
        }, { conversationId });
    }

    async updateConversationStats(conversationId: string, stats: any): Promise<BookConversationDocument> {
        return this.executeWithLogging('updateConversationStats', async () => {
            const conversation = await BookConversation.findOne({ conversationId });
            if (!conversation) {
                throw new NotFoundError('Book Conversation', conversationId);
            }

            // Update conversation stats
            Object.assign(conversation.stats, stats);
            conversation.stats.lastActivity = new Date();
            await conversation.save();
            return conversation;
        }, { conversationId });
    }

    async updateLastMessage(conversationId: string, messageId: string, content: string, sender: 'user' | 'assistant'): Promise<BookConversationDocument> {
        return this.executeWithLogging('updateLastMessage', async () => {
            const conversation = await BookConversation.findOne({ conversationId });
            if (!conversation) {
                throw new NotFoundError('Book Conversation', conversationId);
            }

            // Update last message
            conversation.lastMessage = {
                messageId,
                content: content.substring(0, 200),
                timestamp: new Date(),
                sender
            };
            conversation.stats.messageCount = (conversation.stats.messageCount || 0) + 1;
            conversation.stats.lastActivity = new Date();
            await conversation.save();
            return conversation;
        }, { conversationId, sender });
    }

    async archiveConversation(id: string, reason?: string, userId?: string): Promise<BookConversationDocument> {
        return this.executeWithLogging('archiveConversation', async () => {
            const conversation = await BookConversation.findById(id);
            if (!conversation) {
                throw new NotFoundError('Book Conversation', id);
            }

            // Archive the conversation
            conversation.status = 'archived';
            conversation.archivedAt = new Date();
            conversation.archivedBy = userId;
            conversation.archiveReason = reason;
            await conversation.save();
            return conversation;
        }, { id });
    }

    async pinConversation(id: string, pinned: boolean): Promise<BookConversationDocument> {
        return this.executeWithLogging('pinConversation', async () => {
            const conversation = await BookConversation.findById(id);
            if (!conversation) {
                throw new NotFoundError('Book Conversation', id);
            }

            conversation.flags.isPinned = pinned;
            return conversation.save();
        }, { id, pinned });
    }

    async getActiveConversations(userId: string): Promise<BookConversationDocument[]> {
        return this.executeWithLogging('getActiveConversations', async () => {
            return BookConversation.find({
                userId,
                status: 'active'
            }).sort({ updatedAt: -1 }).populate('bookId', 'title genre').exec();
        }, { userId });
    }

    async getBookConversationStats(bookId: string): Promise<any> {
        return this.executeWithLogging('getBookConversationStats', async () => {
            const stats = await BookConversation.aggregate([
                { $match: { bookId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalMessages: { $sum: '$stats.messageCount' },
                        totalWords: { $sum: '$stats.wordsGenerated' },
                        totalTime: { $sum: '$stats.totalSessionTime' }
                    }
                }
            ]);

            // Calculate totals
            const totals = stats.reduce((acc, stat) => {
                acc.totalConversations += stat.count;
                acc.totalMessages += stat.totalMessages;
                acc.totalWords += stat.totalWords;
                acc.totalTime += stat.totalTime;
                return acc;
            }, {
                totalConversations: 0,
                totalMessages: 0,
                totalWords: 0,
                totalTime: 0
            });

            return {
                byStatus: stats,
                totals,
                averageProductivity: totals.totalTime > 0 ? Math.round(totals.totalWords / totals.totalTime) : 0
            };
        }, { bookId });
    }

    async bulkUpdateConversations(ids: string[], updates: any): Promise<number> {
        return this.executeWithLogging('bulkUpdateConversations', async () => {
            const result = await BookConversation.updateMany(
                { _id: { $in: ids } },
                { $set: updates }
            );

            return result.modifiedCount;
        }, { count: ids.length });
    }

    // Helper methods
    private validateCreateRequest(request: CreateBookConversationRequest): void {
        if (!request.conversationId) {
            throw new ValidationError('Conversation ID is required', []);
        }
        if (!request.bookId) {
            throw new ValidationError('Book ID is required', []);
        }
        if (!request.workspaceId) {
            throw new ValidationError('Workspace ID is required', []);
        }
        if (!request.userId) {
            throw new ValidationError('User ID is required', []);
        }
    }

    // Get conversation context for AI generation
    async getConversationContext(conversationId: string): Promise<any> {
        return this.executeWithLogging('getConversationContext', async () => {
            const conversation = await BookConversation.findOne({ conversationId })
                .populate('bookId')
                .populate('relatedContent.generatedPages')
                .populate('relatedContent.modifiedChapters');

            if (!conversation) {
                return null;
            }

            return {
                book: conversation.bookId,
                activeChapter: conversation.context.activeChapterId,
                activePage: conversation.context.activePageId,
                focusArea: conversation.context.focusArea,
                workflowStage: conversation.context.workflowStage,
                recentContent: conversation.relatedContent,
                goals: conversation.goals,
                lastContext: conversation.context.lastContext
            };
        }, { conversationId });
    }
}

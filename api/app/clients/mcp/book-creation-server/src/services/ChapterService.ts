/**
 * Chapter Service - Dedicated service for chapter management
 */

import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import {
    AuthorizationError, ChapterResponse,
    ChapterStatus, CreateChapterRequest, IChapterService, IDatabaseService, NotFoundError, UpdateChapterRequest, ValidationError
} from '../interfaces/index.js';

export class ChapterService extends BaseService implements IChapterService {
    private databaseService: IDatabaseService;

    constructor(logger: ILogger, databaseService: IDatabaseService) {
        super(logger);
        this.databaseService = databaseService;
    }

    protected async onInitialize(): Promise<void> {
        await this.ensureConnection();
        this.logger.info('ChapterService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('ChapterService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            await this.ensureConnection();

            // Test database connectivity
            const testQuery = await Chapter.countDocuments({}).limit(1);

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Chapter service operational',
                details: {
                    databaseConnected: this.databaseService.isConnected(),
                    testQueryResult: testQuery >= 0,
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Chapter service health check failed: ${(error as Error).message}`,
                details: {
                    databaseConnected: this.databaseService.isConnected(),
                    error: (error as Error).message,
                },
                lastCheck: new Date(),
            };
        }
    }

    private async ensureConnection(): Promise<void> {
        if (!this.databaseService.isConnected()) {
            await this.databaseService.connect();
        }
    }

    async createChapter(chapterData: CreateChapterRequest): Promise<ChapterResponse> {
        return this.executeWithLogging('createChapter', async () => {
            await this.ensureConnection();

            // Validate input
            this.validateCreateChapterRequest(chapterData);

            // Verify book exists and get author permissions
            const book = await Book.findById(chapterData.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapterData.bookId);
            }

            // Auto-generate chapter number if not provided
            let chapterNumber = chapterData.chapterNumber;
            if (!chapterNumber) {
                const lastChapter = await Chapter.findOne({ bookId: chapterData.bookId })
                    .sort({ chapterNumber: -1 })
                    .select('chapterNumber');
                chapterNumber = (lastChapter?.chapterNumber || 0) + 1;
            }

            // Check for duplicate chapter numbers
            const existingChapter = await Chapter.findOne({
                bookId: chapterData.bookId,
                chapterNumber,
            });
            if (existingChapter) {
                throw new ValidationError('Chapter number already exists for this book', [
                    { field: 'chapterNumber', message: `Chapter ${chapterNumber} already exists`, code: 'DUPLICATE' }
                ]);
            }

            // Create chapter
            const chapter = new Chapter({
                ...chapterData,
                chapterNumber,
                wordCount: 0,
                status: ChapterStatus.PLANNED,
            });

            const savedChapter = await chapter.save();

            this.logger.info('Chapter created successfully', {
                chapterId: savedChapter._id,
                bookId: chapterData.bookId,
                chapterNumber,
            });

            return savedChapter.toObject() as ChapterResponse;
        }, { bookId: chapterData.bookId, title: chapterData.title });
    }

    async getChapter(chapterId: string, includePages = false): Promise<ChapterResponse> {
        return this.executeWithLogging('getChapter', async () => {
            await this.ensureConnection();

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const chapterResponse = chapter.toObject() as ChapterResponse;

            if (includePages) {
                const pages = await Page.find({ chapterId })
                    .sort({ pageNumber: 1 });
                chapterResponse.pages = pages.map(page => page.toObject());
            }

            return chapterResponse;
        }, { chapterId, includePages });
    }

    async listChapters(bookId: string): Promise<ChapterResponse[]> {
        return this.executeWithLogging('listChapters', async () => {
            await this.ensureConnection();

            // Verify book exists
            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            const chapters = await Chapter.find({ bookId })
                .sort({ chapterNumber: 1 });

            return chapters.map(chapter => chapter.toObject() as ChapterResponse);
        }, { bookId });
    }

    async updateChapter(chapterId: string, updates: UpdateChapterRequest): Promise<ChapterResponse> {
        return this.executeWithLogging('updateChapter', async () => {
            await this.ensureConnection();

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            // Validate chapter number conflicts if updating chapter number
            if ('chapterNumber' in updates && updates.chapterNumber && updates.chapterNumber !== chapter.chapterNumber) {
                const existingChapter = await Chapter.findOne({
                    bookId: chapter.bookId,
                    chapterNumber: updates.chapterNumber,
                    _id: { $ne: chapterId },
                });
                if (existingChapter) {
                    throw new ValidationError('Chapter number already exists for this book', [
                        { field: 'chapterNumber', message: `Chapter ${updates.chapterNumber} already exists`, code: 'DUPLICATE' }
                    ]);
                }
            }

            // Apply updates
            Object.assign(chapter, updates);
            const updatedChapter = await chapter.save();

            this.logger.info('Chapter updated successfully', {
                chapterId,
                updatedFields: Object.keys(updates),
            });

            return updatedChapter.toObject() as ChapterResponse;
        }, { chapterId, updates: Object.keys(updates) });
    }

    async deleteChapter(chapterId: string, authorId: string): Promise<void> {
        return this.executeWithLogging('deleteChapter', async () => {
            await this.ensureConnection();

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            // Verify author permissions
            const book = await Book.findById(chapter.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapter.bookId);
            }

            if (book.authorId !== authorId) {
                throw new AuthorizationError('You can only delete chapters from your own books');
            }

            // Delete all pages in this chapter
            const deleteResult = await Page.deleteMany({ chapterId });
            this.logger.info('Deleted pages from chapter', {
                chapterId,
                deletedPagesCount: deleteResult.deletedCount,
            });

            // Delete the chapter
            await Chapter.findByIdAndDelete(chapterId);

            // Update book word count
            await this.updateBookWordCount(chapter.bookId);

            this.logger.info('Chapter deleted successfully', {
                chapterId,
                bookId: chapter.bookId,
            });
        }, { chapterId, authorId });
    }

    async getChapterStatistics(chapterId: string): Promise<any> {
        return this.executeWithLogging('getChapterStatistics', async () => {
            await this.ensureConnection();

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const pages = await Page.find({ chapterId });
            const pageStatusBreakdown = pages.reduce((acc: any, page) => {
                acc[page.status] = (acc[page.status] || 0) + 1;
                return acc;
            }, {});

            const avgWordsPerPage = pages.length > 0
                ? Math.round(pages.reduce((sum, page) => sum + page.wordCount, 0) / pages.length)
                : 0;

            return {
                chapterInfo: {
                    id: chapter._id,
                    title: chapter.title,
                    status: chapter.status,
                    chapterNumber: chapter.chapterNumber,
                },
                progress: {
                    completionPercentage: chapter.targetWordCount
                        ? Math.min(100, Math.round((chapter.wordCount / chapter.targetWordCount) * 100))
                        : 0,
                    currentWordCount: chapter.wordCount,
                    targetWordCount: chapter.targetWordCount || 0,
                    wordsRemaining: Math.max(0, (chapter.targetWordCount || 0) - chapter.wordCount),
                },
                pages: {
                    total: pages.length,
                    statusBreakdown: pageStatusBreakdown,
                    averageWordsPerPage: avgWordsPerPage,
                },
                lastUpdated: chapter.updatedAt,
            };
        }, { chapterId });
    }

    private validateCreateChapterRequest(chapterData: CreateChapterRequest): void {
        const errors: any[] = [];

        if (!chapterData.bookId) {
            errors.push({ field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' });
        }

        if (!chapterData.title || chapterData.title.trim().length === 0) {
            errors.push({ field: 'title', message: 'Chapter title is required', code: 'REQUIRED' });
        }

        if (chapterData.title && chapterData.title.length > 200) {
            errors.push({ field: 'title', message: 'Chapter title must be 200 characters or less', code: 'MAX_LENGTH' });
        }

        if (chapterData.description && chapterData.description.length > 1000) {
            errors.push({ field: 'description', message: 'Chapter description must be 1000 characters or less', code: 'MAX_LENGTH' });
        }

        if (chapterData.targetWordCount && chapterData.targetWordCount < 0) {
            errors.push({ field: 'targetWordCount', message: 'Target word count must be non-negative', code: 'MIN_VALUE' });
        }

        if (chapterData.chapterNumber && chapterData.chapterNumber < 1) {
            errors.push({ field: 'chapterNumber', message: 'Chapter number must be positive', code: 'MIN_VALUE' });
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid chapter data', errors);
        }
    }

    private async updateBookWordCount(bookId: string): Promise<void> {
        try {
            const chapters = await Chapter.find({ bookId });
            const totalWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
            await Book.findByIdAndUpdate(bookId, { currentWordCount: totalWordCount });

            this.logger.debug('Updated book word count', { bookId, totalWordCount });
        } catch (error) {
            this.logger.warn('Failed to update book word count', error as Error);
        }
    }
}

export default ChapterService;

/**
 * Page Service - Dedicated service for page management
 */

import { v4 as uuidv4 } from 'uuid';
import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import {
    AuthorizationError, CreatePageRequest, IDatabaseService, IPageService, NotFoundError, PageResponse,
    PageStatus, UpdatePageRequest, ValidationError
} from '../interfaces/index.js';

export class PageService extends BaseService implements IPageService {
    private databaseService: IDatabaseService;

    constructor(logger: ILogger, databaseService: IDatabaseService) {
        super(logger);
        this.databaseService = databaseService;
    }

    protected async onInitialize(): Promise<void> {
        await this.ensureConnection();
        this.logger.info('PageService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('PageService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            await this.ensureConnection();

            // Test database connectivity
            const testQuery = await Page.countDocuments({}).limit(1);

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Page service operational',
                details: {
                    databaseConnected: this.databaseService.isConnected(),
                    testQueryResult: testQuery >= 0,
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Page service health check failed: ${(error as Error).message}`,
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

    async createPage(pageData: CreatePageRequest): Promise<PageResponse> {
        return this.executeWithLogging('createPage', async () => {
            await this.ensureConnection();

            // Validate input
            this.validateCreatePageRequest(pageData);

            // Verify chapter exists
            const chapter = await Chapter.findById(pageData.chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', pageData.chapterId);
            }

            // Auto-generate page number if not provided
            let pageNumber = pageData.pageNumber;
            if (!pageNumber) {
                const lastPage = await Page.findOne({ chapterId: pageData.chapterId })
                    .sort({ pageNumber: -1 })
                    .select('pageNumber');
                pageNumber = (lastPage?.pageNumber || 0) + 1;
            }

            // Check for duplicate page numbers
            const existingPage = await Page.findOne({
                chapterId: pageData.chapterId,
                pageNumber,
            });
            if (existingPage) {
                throw new ValidationError('Page number already exists for this chapter', [
                    { field: 'pageNumber', message: `Page ${pageNumber} already exists`, code: 'DUPLICATE' }
                ]);
            }

            // Calculate word count
            const wordCount = this.countWords(pageData.content);

            // Create page
            const page = new Page({
                ...pageData,
                pageId: uuidv4(),
                pageNumber,
                wordCount,
                status: PageStatus.DRAFT,
            });

            const savedPage = await page.save();

            // Update chapter word count
            await this.updateChapterWordCount(pageData.chapterId);

            this.logger.info('Page created successfully', {
                pageId: savedPage.pageId,
                chapterId: pageData.chapterId,
                pageNumber,
                wordCount,
            });

            return savedPage.toObject() as PageResponse;
        }, { chapterId: pageData.chapterId, title: pageData.title });
    }

    async getPage(pageId: string): Promise<PageResponse> {
        return this.executeWithLogging('getPage', async () => {
            await this.ensureConnection();

            const page = await Page.findOne({ pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            return page.toObject() as PageResponse;
        }, { pageId });
    }

    async listPages(chapterId: string): Promise<PageResponse[]> {
        return this.executeWithLogging('listPages', async () => {
            await this.ensureConnection();

            // Verify chapter exists
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const pages = await Page.find({ chapterId })
                .sort({ pageNumber: 1 });

            return pages.map(page => page.toObject() as PageResponse);
        }, { chapterId });
    }

    async updatePage(pageId: string, updates: UpdatePageRequest): Promise<PageResponse> {
        return this.executeWithLogging('updatePage', async () => {
            await this.ensureConnection();

            const page = await Page.findOne({ pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            // Recalculate word count if content is updated
            if (updates.content !== undefined) {
                const wordCount = this.countWords(updates.content);
                Object.assign(updates, { wordCount });
            }

            // Apply updates
            Object.assign(page, updates);
            const updatedPage = await page.save();

            // Update chapter word count if content changed
            if (updates.content !== undefined) {
                await this.updateChapterWordCount(page.chapterId);
            }

            this.logger.info('Page updated successfully', {
                pageId,
                updatedFields: Object.keys(updates),
                newWordCount: updatedPage.wordCount,
            });

            return updatedPage.toObject() as PageResponse;
        }, { pageId, updates: Object.keys(updates) });
    }

    async deletePage(pageId: string, authorId: string): Promise<void> {
        return this.executeWithLogging('deletePage', async () => {
            await this.ensureConnection();

            const page = await Page.findOne({ pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            // Verify author permissions
            const chapter = await Chapter.findById(page.chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', page.chapterId);
            }

            const book = await Book.findById(chapter.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapter.bookId);
            }

            if (book.authorId !== authorId) {
                throw new AuthorizationError('You can only delete pages from your own books');
            }

            const chapterId = page.chapterId;

            // Delete the page
            await Page.deleteOne({ pageId });

            // Update chapter word count
            await this.updateChapterWordCount(chapterId);

            this.logger.info('Page deleted successfully', {
                pageId,
                chapterId,
            });
        }, { pageId, authorId });
    }

    async getPageStatistics(pageId: string): Promise<any> {
        return this.executeWithLogging('getPageStatistics', async () => {
            await this.ensureConnection();

            const page = await Page.findOne({ pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            // Get chapter and book info for context
            const chapter = await Chapter.findById(page.chapterId);
            const book = chapter ? await Book.findById(chapter.bookId) : null;

            const content = page.content;
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

            return {
                pageInfo: {
                    id: page.pageId,
                    title: page.title,
                    status: page.status,
                    pageNumber: page.pageNumber,
                },
                content: {
                    wordCount: page.wordCount,
                    characterCount: content.length,
                    characterCountNoSpaces: content.replace(/\s/g, '').length,
                    sentenceCount: sentences.length,
                    paragraphCount: paragraphs.length,
                    averageWordsPerSentence: sentences.length > 0 ? Math.round(page.wordCount / sentences.length) : 0,
                    averageWordsPerParagraph: paragraphs.length > 0 ? Math.round(page.wordCount / paragraphs.length) : 0,
                },
                context: {
                    chapterTitle: chapter?.title,
                    chapterNumber: chapter?.chapterNumber,
                    bookTitle: book?.title,
                },
                readingTime: {
                    minutes: Math.ceil(page.wordCount / 200), // Assuming 200 words per minute
                    seconds: Math.ceil((page.wordCount / 200) * 60),
                },
                lastUpdated: page.updatedAt,
            };
        }, { pageId });
    }

    async reorderPages(chapterId: string, pageOrders: Array<{ pageId: string; pageNumber: number }>): Promise<void> {
        return this.executeWithLogging('reorderPages', async () => {
            await this.ensureConnection();

            // Verify chapter exists
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            // Validate that all page IDs belong to the chapter
            const pageIds = pageOrders.map(po => po.pageId);
            const existingPages = await Page.find({
                chapterId,
                pageId: { $in: pageIds }
            });

            if (existingPages.length !== pageIds.length) {
                throw new ValidationError('Some pages do not belong to this chapter', []);
            }

            // Update page numbers
            for (const { pageId, pageNumber } of pageOrders) {
                await Page.updateOne(
                    { pageId },
                    { pageNumber }
                );
            }

            this.logger.info('Pages reordered successfully', {
                chapterId,
                pageCount: pageOrders.length,
            });
        }, { chapterId, pageCount: pageOrders.length });
    }

    async duplicatePage(pageId: string): Promise<PageResponse> {
        return this.executeWithLogging('duplicatePage', async () => {
            await this.ensureConnection();

            const originalPage = await Page.findOne({ pageId });
            if (!originalPage) {
                throw new NotFoundError('Page', pageId);
            }

            // Get next page number
            const lastPage = await Page.findOne({ chapterId: originalPage.chapterId })
                .sort({ pageNumber: -1 })
                .select('pageNumber');
            const nextPageNumber = (lastPage?.pageNumber || 0) + 1;

            // Create duplicate
            const duplicatedPage = new Page({
                ...originalPage.toObject(),
                _id: undefined,
                pageId: uuidv4(),
                pageNumber: nextPageNumber,
                title: `${originalPage.title} (Copy)`,
                status: PageStatus.DRAFT,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const savedPage = await duplicatedPage.save();

            // Update chapter word count
            await this.updateChapterWordCount(originalPage.chapterId);

            this.logger.info('Page duplicated successfully', {
                originalPageId: pageId,
                newPageId: savedPage.pageId,
                chapterId: originalPage.chapterId,
            });

            return savedPage.toObject() as PageResponse;
        }, { pageId });
    }

    private validateCreatePageRequest(pageData: CreatePageRequest): void {
        const errors: any[] = [];

        if (!pageData.chapterId) {
            errors.push({ field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' });
        }

        if (!pageData.title || pageData.title.trim().length === 0) {
            errors.push({ field: 'title', message: 'Page title is required', code: 'REQUIRED' });
        }

        if (pageData.title && pageData.title.length > 200) {
            errors.push({ field: 'title', message: 'Page title must be 200 characters or less', code: 'MAX_LENGTH' });
        }

        if (!pageData.content || pageData.content.trim().length === 0) {
            errors.push({ field: 'content', message: 'Page content is required', code: 'REQUIRED' });
        }

        if (pageData.pageNumber && pageData.pageNumber < 1) {
            errors.push({ field: 'pageNumber', message: 'Page number must be positive', code: 'MIN_VALUE' });
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid page data', errors);
        }
    }

    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    private async updateChapterWordCount(chapterId: string): Promise<void> {
        try {
            const pages = await Page.find({ chapterId });
            const totalWordCount = pages.reduce((sum, page) => sum + page.wordCount, 0);
            await Chapter.findByIdAndUpdate(chapterId, { wordCount: totalWordCount });

            this.logger.debug('Updated chapter word count', { chapterId, totalWordCount });

            // Also update book word count
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                await this.updateBookWordCount(chapter.bookId);
            }
        } catch (error) {
            this.logger.warn('Failed to update chapter word count', error as Error);
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

export default PageService;

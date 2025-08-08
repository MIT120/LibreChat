/**
 * Book Service - Core business logic for book management
 */

import { v4 as uuidv4 } from 'uuid';
import {
    BookResponse,
    BookStatistics,
    BookStatus,
    ChapterResponse,
    ChapterStatus,
    ContentGenerationOptions,
    ContentImprovementOptions,
    ContentSuggestion,
    CreateBookRequest,
    CreateChapterRequest,
    CreatePageRequest,
    GetBookOptions,
    ListBooksOptions,
    PageGenerationOptions,
    PageResponse,
    PageStatus,

    UpdateBookRequest,
    UpdateChapterRequest,
    UpdatePageRequest,
} from '../../types/book.js';
import {
    AuthorizationError,
    DatabaseError,
    NotFoundError,
    ValidationError,
} from '../../types/errors.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import {
    IBookService,
    IChapterService,
    IContentService,
    IDatabaseService,
    IPageService,
    PaginatedResponse
} from '../interfaces/index.js';

// Import models
import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';

export class BookService extends BaseService implements IBookService, IChapterService, IPageService, IContentService {
    private databaseService: IDatabaseService;

    constructor(logger: ILogger, databaseService: IDatabaseService) {
        super(logger);
        this.databaseService = databaseService;
    }

    protected async onInitialize(): Promise<void> {
        await this.ensureConnection();
    }

    protected async onDispose(): Promise<void> {
        // No specific cleanup needed
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            if (!this.databaseService.isConnected()) {
                return {
                    status: ServiceHealthStatus.UNHEALTHY,
                    message: 'Database connection not available',
                    lastCheck: new Date(),
                };
            }

            // Test database operations
            const testQuery = Book.countDocuments({});
            await testQuery.exec();

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Book service is operational',
                details: {
                    databaseConnected: this.databaseService.isConnected(),
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Service health check failed: ${(error as Error).message}`,
                details: { error: (error as Error).stack },
                lastCheck: new Date(),
            };
        }
    }

    private async ensureConnection(): Promise<void> {
        if (!this.databaseService.isConnected()) {
            throw new DatabaseError('Database connection not ready');
        }
    }

    // Book Service Methods
    async createBook(bookData: CreateBookRequest): Promise<BookResponse> {
        return this.executeWithLogging('createBook', async () => {
            await this.ensureConnection();

            // Validate required fields
            this.validateCreateBookRequest(bookData);

            // Create the book document
            const book = new Book({
                _id: uuidv4(),
                title: bookData.title,
                subtitle: bookData.subtitle,
                theme: bookData.theme,
                genre: bookData.genre,
                targetAudience: bookData.targetAudience,
                writingStyle: bookData.writingStyle,
                description: bookData.description,
                targetWordCount: bookData.targetWordCount,
                estimatedPages: bookData.estimatedPages,
                authorId: bookData.authorId,
                status: BookStatus.PLANNING,
                currentWordCount: 0,
                metadata: {
                    language: 'en',
                    keywords: [],
                    tags: [],
                },
                settings: {
                    autoSave: true,
                    backupFrequency: 'daily' as any,
                    collaborationEnabled: false,
                    exportFormats: ['pdf' as any],
                },
            });

            try {
                const savedBook = await book.save();
                return savedBook.toObject() as BookResponse;
            } catch (error) {
                throw new DatabaseError(`Failed to create book: ${(error as Error).message}`);
            }
        }, { title: bookData.title, authorId: bookData.authorId });
    }

    async getBook(bookId: string, options: GetBookOptions = {}): Promise<BookResponse> {
        return this.executeWithLogging('getBook', async () => {
            await this.ensureConnection();

            if (!bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const book = await Book.findById(bookId);
                if (!book) {
                    throw new NotFoundError('Book', bookId);
                }

                const bookResponse: BookResponse = book.toObject();

                // Include chapters if requested
                if (options.includeChapters) {
                    const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
                    bookResponse.chapters = chapters.map(chapter => {
                        const chapterObj = chapter.toObject() as ChapterResponse;
                        if (options.includePages) {
                            // Pages will be populated separately for performance
                            chapterObj.pages = [];
                        }
                        return chapterObj;
                    });

                    // Include pages if requested
                    if (options.includePages && bookResponse.chapters) {
                        for (const chapter of bookResponse.chapters) {
                            const pages = await Page.find({ chapterId: chapter._id }).sort({ pageNumber: 1 });
                            chapter.pages = pages.map(page => page.toObject() as PageResponse);
                        }
                    }
                }

                return bookResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to get book: ${(error as Error).message}`);
            }
        }, { bookId, options });
    }

    async listBooks(options: ListBooksOptions): Promise<PaginatedResponse<BookResponse>> {
        return this.executeWithLogging('listBooks', async () => {
            await this.ensureConnection();

            if (!options.authorId) {
                throw new ValidationError('Author ID is required', [
                    { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' }
                ]);
            }

            const { authorId, status, genre, limit = 20, offset = 0 } = options;

            try {
                // Build query
                const query: any = { authorId };
                if (status) query.status = status;
                if (genre) query.genre = genre;

                // Get total count
                const total = await Book.countDocuments(query);

                // Get books with pagination
                const books = await Book.find(query)
                    .sort({ createdAt: -1 })
                    .skip(offset)
                    .limit(limit);

                const data = books.map(book => book.toObject() as BookResponse);

                return {
                    data,
                    pagination: {
                        total,
                        limit,
                        offset,
                        hasMore: offset + limit < total,
                    },
                };
            } catch (error) {
                throw new DatabaseError(`Failed to list books: ${(error as Error).message}`);
            }
        }, { authorId: options.authorId, limit: options.limit, offset: options.offset });
    }

    async updateBook(bookId: string, updates: UpdateBookRequest): Promise<BookResponse> {
        return this.executeWithLogging('updateBook', async () => {
            await this.ensureConnection();

            if (!bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const book = await Book.findById(bookId);
                if (!book) {
                    throw new NotFoundError('Book', bookId);
                }

                // Apply updates
                Object.assign(book, updates);
                book.updatedAt = new Date();

                const updatedBook = await book.save();
                return updatedBook.toObject() as BookResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to update book: ${(error as Error).message}`);
            }
        }, { bookId, updates });
    }

    async deleteBook(bookId: string, authorId: string): Promise<void> {
        return this.executeWithLogging('deleteBook', async () => {
            await this.ensureConnection();

            if (!bookId || !authorId) {
                throw new ValidationError('Book ID and author ID are required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const book = await Book.findById(bookId);
                if (!book) {
                    throw new NotFoundError('Book', bookId);
                }

                if (book.authorId !== authorId) {
                    throw new AuthorizationError('You can only delete your own books');
                }

                // Delete all related data
                await Page.deleteMany({ chapterId: { $in: await Chapter.find({ bookId }).distinct('_id') } });
                await Chapter.deleteMany({ bookId });
                await Book.findByIdAndDelete(bookId);

                this.logger.info('Book and related data deleted successfully', { bookId });
            } catch (error) {
                if (error instanceof NotFoundError || error instanceof AuthorizationError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to delete book: ${(error as Error).message}`);
            }
        }, { bookId, authorId });
    }

    async getBookStatistics(bookId: string): Promise<BookStatistics> {
        return this.executeWithLogging('getBookStatistics', async () => {
            await this.ensureConnection();

            if (!bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const book = await Book.findById(bookId);
                if (!book) {
                    throw new NotFoundError('Book', bookId);
                }

                // Get chapter statistics
                const chapters = await Chapter.find({ bookId });
                const chapterStatusBreakdown = chapters.reduce((acc, chapter) => {
                    acc[chapter.status] = (acc[chapter.status] || 0) + 1;
                    return acc;
                }, {} as Record<ChapterStatus, number>);

                // Get page statistics
                const chapterIds = chapters.map(c => c._id);
                const pages = await Page.find({ chapterId: { $in: chapterIds } });
                const pageStatusBreakdown = pages.reduce((acc, page) => {
                    acc[page.status] = (acc[page.status] || 0) + 1;
                    return acc;
                }, {} as Record<PageStatus, number>);

                // Calculate progress
                const completionPercentage = book.targetWordCount && book.targetWordCount > 0
                    ? Math.round((book.currentWordCount / book.targetWordCount) * 100)
                    : 0;

                return {
                    bookInfo: {
                        id: book._id,
                        title: book.title,
                        status: book.status,
                        theme: book.theme,
                        genre: book.genre,
                    },
                    progress: {
                        completionPercentage,
                        currentWordCount: book.currentWordCount,
                        targetWordCount: book.targetWordCount || 0,
                        wordsRemaining: Math.max(0, (book.targetWordCount || 0) - book.currentWordCount),
                    },
                    chapters: {
                        total: chapters.length,
                        completed: chapters.filter(c => c.status === ChapterStatus.APPROVED).length,
                        statusBreakdown: chapterStatusBreakdown,
                    },
                    pages: {
                        total: pages.length,
                        completed: pages.filter(p => p.status === PageStatus.APPROVED).length,
                        statusBreakdown: pageStatusBreakdown,
                    },
                    lastUpdated: book.updatedAt,
                };
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to get book statistics: ${(error as Error).message}`);
            }
        }, { bookId });
    }

    // Chapter Service Methods
    async createChapter(chapterData: CreateChapterRequest): Promise<ChapterResponse> {
        return this.executeWithLogging('createChapter', async () => {
            await this.ensureConnection();

            this.validateCreateChapterRequest(chapterData);

            try {
                // Verify book exists
                const book = await Book.findById(chapterData.bookId);
                if (!book) {
                    throw new NotFoundError('Book', chapterData.bookId);
                }

                // Determine chapter number if not provided
                let chapterNumber = chapterData.chapterNumber;
                if (!chapterNumber) {
                    const lastChapter = await Chapter.findOne({ bookId: chapterData.bookId })
                        .sort({ chapterNumber: -1 });
                    chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
                }

                const chapter = new Chapter({
                    _id: uuidv4(),
                    bookId: chapterData.bookId,
                    chapterNumber,
                    title: chapterData.title,
                    description: chapterData.description,
                    outline: chapterData.outline,
                    targetWordCount: chapterData.targetWordCount,
                    wordCount: 0,
                    status: ChapterStatus.PLANNED,
                });

                const savedChapter = await chapter.save();
                return savedChapter.toObject() as ChapterResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to create chapter: ${(error as Error).message}`);
            }
        }, { bookId: chapterData.bookId, title: chapterData.title });
    }

    async getChapter(chapterId: string, includePages = false): Promise<ChapterResponse> {
        return this.executeWithLogging('getChapter', async () => {
            await this.ensureConnection();

            if (!chapterId) {
                throw new ValidationError('Chapter ID is required', [
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const chapter = await Chapter.findById(chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', chapterId);
                }

                const chapterResponse: ChapterResponse = chapter.toObject();

                if (includePages) {
                    const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
                    chapterResponse.pages = pages.map(page => page.toObject() as PageResponse);
                }

                return chapterResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to get chapter: ${(error as Error).message}`);
            }
        }, { chapterId, includePages });
    }

    async listChapters(bookId: string): Promise<ChapterResponse[]> {
        return this.executeWithLogging('listChapters', async () => {
            await this.ensureConnection();

            if (!bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
                return chapters.map(chapter => chapter.toObject() as ChapterResponse);
            } catch (error) {
                throw new DatabaseError(`Failed to list chapters: ${(error as Error).message}`);
            }
        }, { bookId });
    }

    async updateChapter(chapterId: string, updates: UpdateChapterRequest): Promise<ChapterResponse> {
        return this.executeWithLogging('updateChapter', async () => {
            await this.ensureConnection();

            if (!chapterId) {
                throw new ValidationError('Chapter ID is required', [
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const chapter = await Chapter.findById(chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', chapterId);
                }

                Object.assign(chapter, updates);
                chapter.updatedAt = new Date();

                const updatedChapter = await chapter.save();

                // Update book word count if chapter word count changed
                if ('wordCount' in updates) {
                    await this.updateBookWordCount(chapter.bookId);
                }

                return updatedChapter.toObject() as ChapterResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to update chapter: ${(error as Error).message}`);
            }
        }, { chapterId, updates });
    }

    async deleteChapter(chapterId: string, authorId: string): Promise<void> {
        return this.executeWithLogging('deleteChapter', async () => {
            await this.ensureConnection();

            if (!chapterId || !authorId) {
                throw new ValidationError('Chapter ID and author ID are required', [
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' },
                    { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const chapter = await Chapter.findById(chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', chapterId);
                }

                // Verify author owns the book
                const book = await Book.findById(chapter.bookId);
                if (!book || book.authorId !== authorId) {
                    throw new AuthorizationError('You can only delete chapters from your own books');
                }

                // Delete all pages in the chapter
                await Page.deleteMany({ chapterId });
                await Chapter.findByIdAndDelete(chapterId);

                // Update book word count
                await this.updateBookWordCount(chapter.bookId);

                this.logger.info('Chapter and related pages deleted successfully', { chapterId });
            } catch (error) {
                if (error instanceof NotFoundError || error instanceof AuthorizationError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to delete chapter: ${(error as Error).message}`);
            }
        }, { chapterId, authorId });
    }

    // Page Service Methods
    async createPage(pageData: CreatePageRequest): Promise<PageResponse> {
        return this.executeWithLogging('createPage', async () => {
            await this.ensureConnection();

            this.validateCreatePageRequest(pageData);

            try {
                // Verify chapter exists
                const chapter = await Chapter.findById(pageData.chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', pageData.chapterId);
                }

                // Determine page number if not provided
                let pageNumber = pageData.pageNumber;
                if (!pageNumber) {
                    const lastPage = await Page.findOne({ chapterId: pageData.chapterId })
                        .sort({ pageNumber: -1 });
                    pageNumber = lastPage ? lastPage.pageNumber + 1 : 1;
                }

                // Calculate word count
                const wordCount = this.countWords(pageData.content);

                const page = new Page({
                    pageId: uuidv4(),
                    chapterId: pageData.chapterId,
                    pageNumber,
                    title: pageData.title,
                    content: pageData.content,
                    wordCount,
                    notes: pageData.notes,
                    status: PageStatus.DRAFT,
                });

                const savedPage = await page.save();

                // Update chapter and book word counts
                await this.updateChapterWordCount(pageData.chapterId);

                return savedPage.toObject() as PageResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to create page: ${(error as Error).message}`);
            }
        }, { chapterId: pageData.chapterId, title: pageData.title });
    }

    async getPage(pageId: string): Promise<PageResponse> {
        return this.executeWithLogging('getPage', async () => {
            await this.ensureConnection();

            if (!pageId) {
                throw new ValidationError('Page ID is required', [
                    { field: 'pageId', message: 'Page ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const page = await Page.findOne({ pageId });
                if (!page) {
                    throw new NotFoundError('Page', pageId);
                }

                return page.toObject() as PageResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to get page: ${(error as Error).message}`);
            }
        }, { pageId });
    }

    async listPages(chapterId: string): Promise<PageResponse[]> {
        return this.executeWithLogging('listPages', async () => {
            await this.ensureConnection();

            if (!chapterId) {
                throw new ValidationError('Chapter ID is required', [
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
                return pages.map(page => page.toObject() as PageResponse);
            } catch (error) {
                throw new DatabaseError(`Failed to list pages: ${(error as Error).message}`);
            }
        }, { chapterId });
    }

    async updatePage(pageId: string, updates: UpdatePageRequest): Promise<PageResponse> {
        return this.executeWithLogging('updatePage', async () => {
            await this.ensureConnection();

            if (!pageId) {
                throw new ValidationError('Page ID is required', [
                    { field: 'pageId', message: 'Page ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const page = await Page.findOne({ pageId });
                if (!page) {
                    throw new NotFoundError('Page', pageId);
                }

                // Recalculate word count if content changed
                if (updates.content) {
                    const wordCount = this.countWords(updates.content);
                    Object.assign(updates, { wordCount });
                }

                Object.assign(page, updates);
                page.updatedAt = new Date();

                const updatedPage = await page.save();

                // Update chapter and book word counts if content changed
                if (updates.content) {
                    await this.updateChapterWordCount(page.chapterId);
                }

                return updatedPage.toObject() as PageResponse;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to update page: ${(error as Error).message}`);
            }
        }, { pageId, updates });
    }

    async deletePage(pageId: string, authorId: string): Promise<void> {
        return this.executeWithLogging('deletePage', async () => {
            await this.ensureConnection();

            if (!pageId || !authorId) {
                throw new ValidationError('Page ID and author ID are required', [
                    { field: 'pageId', message: 'Page ID is required', code: 'REQUIRED' },
                    { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                const page = await Page.findOne({ pageId });
                if (!page) {
                    throw new NotFoundError('Page', pageId);
                }

                // Verify author owns the book
                const chapter = await Chapter.findById(page.chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', page.chapterId);
                }

                const book = await Book.findById(chapter.bookId);
                if (!book || book.authorId !== authorId) {
                    throw new AuthorizationError('You can only delete pages from your own books');
                }

                await Page.findOneAndDelete({ pageId });

                // Update chapter and book word counts
                await this.updateChapterWordCount(page.chapterId);

                this.logger.info('Page deleted successfully', { pageId });
            } catch (error) {
                if (error instanceof NotFoundError || error instanceof AuthorizationError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to delete page: ${(error as Error).message}`);
            }
        }, { pageId, authorId });
    }

    // Content Service Methods
    async generateContentSuggestion(chapterId: string, context: Record<string, any> = {}): Promise<ContentSuggestion> {
        return this.executeWithLogging('generateContentSuggestion', async () => {
            await this.ensureConnection();

            if (!chapterId) {
                throw new ValidationError('Chapter ID is required', [
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' }
                ]);
            }

            try {
                // Get chapter and book information
                const chapter = await Chapter.findById(chapterId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', chapterId);
                }

                const book = await Book.findById(chapter.bookId);
                if (!book) {
                    throw new NotFoundError('Book', chapter.bookId);
                }

                // Get existing pages
                const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });

                // Calculate suggested word count for next page
                const averagePageWordCount = pages.length > 0
                    ? Math.round(pages.reduce((sum, page) => sum + page.wordCount, 0) / pages.length)
                    : 500;

                const recommendedWordCount = Math.max(averagePageWordCount, 300);

                // Generate suggestion
                const nextPageNumber = pages.length + 1;
                const suggestion: ContentSuggestion = {
                    bookContext: {
                        title: book.title,
                        theme: book.theme,
                        genre: book.genre,
                        writingStyle: book.writingStyle,
                        targetAudience: book.targetAudience,
                    },
                    chapterContext: {
                        title: chapter.title,
                        description: chapter.description,
                        outline: chapter.outline,
                        chapterNumber: chapter.chapterNumber,
                    },
                    existingContent: pages.map(page => ({
                        pageNumber: page.pageNumber,
                        title: page.title,
                        wordCount: page.wordCount,
                    })),
                    suggestions: {
                        nextPageTitle: `Page ${nextPageNumber}`,
                        recommendedWordCount,
                        writingPrompt: this.generateWritingPrompt(book, chapter, pages, context),
                    },
                };

                return suggestion;
            } catch (error) {
                if (error instanceof NotFoundError) {
                    throw error;
                }
                throw new DatabaseError(`Failed to generate content suggestion: ${(error as Error).message}`);
            }
        }, { chapterId, context });
    }

    // Placeholder implementations for content generation
    async generateChapterContent(chapterId: string, options: ContentGenerationOptions): Promise<string> {
        // This would integrate with AI content service
        throw new Error('Content generation not implemented yet');
    }

    async generatePageContent(chapterId: string, options: PageGenerationOptions): Promise<PageResponse> {
        // This would integrate with AI content service
        throw new Error('Page generation not implemented yet');
    }

    async improveContent(contentId: string, options: ContentImprovementOptions): Promise<string> {
        // This would integrate with AI content service
        throw new Error('Content improvement not implemented yet');
    }

    // Private helper methods
    private validateCreateBookRequest(bookData: CreateBookRequest): void {
        const errors: Array<{ field: string; message: string; code: string }> = [];

        if (!bookData.title?.trim()) {
            errors.push({ field: 'title', message: 'Title is required', code: 'REQUIRED' });
        }
        if (!bookData.theme?.trim()) {
            errors.push({ field: 'theme', message: 'Theme is required', code: 'REQUIRED' });
        }
        if (!bookData.genre?.trim()) {
            errors.push({ field: 'genre', message: 'Genre is required', code: 'REQUIRED' });
        }
        if (!bookData.writingStyle) {
            errors.push({ field: 'writingStyle', message: 'Writing style is required', code: 'REQUIRED' });
        }
        if (!bookData.authorId?.trim()) {
            errors.push({ field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' });
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid book data', errors);
        }
    }

    private validateCreateChapterRequest(chapterData: CreateChapterRequest): void {
        const errors: Array<{ field: string; message: string; code: string }> = [];

        if (!chapterData.bookId?.trim()) {
            errors.push({ field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' });
        }
        if (!chapterData.title?.trim()) {
            errors.push({ field: 'title', message: 'Title is required', code: 'REQUIRED' });
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid chapter data', errors);
        }
    }

    private validateCreatePageRequest(pageData: CreatePageRequest): void {
        const errors: Array<{ field: string; message: string; code: string }> = [];

        if (!pageData.chapterId?.trim()) {
            errors.push({ field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' });
        }
        if (!pageData.title?.trim()) {
            errors.push({ field: 'title', message: 'Title is required', code: 'REQUIRED' });
        }
        if (!pageData.content?.trim()) {
            errors.push({ field: 'content', message: 'Content is required', code: 'REQUIRED' });
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid page data', errors);
        }
    }

    private countWords(text: string): number {
        if (!text?.trim()) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    private async updateChapterWordCount(chapterId: string): Promise<void> {
        try {
            const pages = await Page.find({ chapterId });
            const totalWordCount = pages.reduce((sum, page) => sum + page.wordCount, 0);

            await Chapter.findByIdAndUpdate(chapterId, {
                wordCount: totalWordCount,
                updatedAt: new Date(),
            });

            // Update book word count
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                await this.updateBookWordCount(chapter.bookId);
            }
        } catch (error) {
            this.logger.error('Failed to update chapter word count', error as Error, { chapterId });
        }
    }

    private async updateBookWordCount(bookId: string): Promise<void> {
        try {
            const chapters = await Chapter.find({ bookId });
            const totalWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

            await Book.findByIdAndUpdate(bookId, {
                currentWordCount: totalWordCount,
                updatedAt: new Date(),
            });
        } catch (error) {
            this.logger.error('Failed to update book word count', error as Error, { bookId });
        }
    }

    private generateWritingPrompt(book: any, chapter: any, existingPages: any[], context: Record<string, any>): string {
        const prompts = [
            `Continue the story in "${chapter.title}" maintaining the ${book.writingStyle.tone} tone and ${book.writingStyle.voice} perspective.`,
            `Develop the theme of "${book.theme}" further in this chapter, focusing on character development.`,
            `Advance the plot while staying true to the ${book.genre} genre conventions.`,
            `Build tension and engage the ${book.targetAudience || 'reader'} with compelling narrative.`,
        ];

        if (existingPages.length === 0) {
            return `Begin "${chapter.title}" with an engaging opening that sets the tone for this chapter. ${prompts[0]}`;
        } else {
            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
            return randomPrompt ?? prompts[0] ?? 'Continue the story.';
        }
    }
}

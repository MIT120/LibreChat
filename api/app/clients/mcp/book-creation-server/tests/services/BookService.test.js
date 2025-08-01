const BookService = require('../../services/BookService');
const BookModel = require('../../models/Book');
const { AIClient } = require('../../utils/aiClient');
const ConfigService = require('../../services/ConfigService');

// Mock dependencies
jest.mock('../../models/Book');
jest.mock('../../utils/aiClient');
jest.mock('../../services/ConfigService');

describe('BookService', () => {
  let bookService;
  let mockAIClient;
  let mockConfigService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAIClient = {
      generateBookOutline: jest.fn(),
    };

    mockConfigService = {
      prepareConfiguration: jest.fn(),
    };

    // Mock constructors
    AIClient.mockImplementation(() => mockAIClient);
    ConfigService.mockImplementation(() => mockConfigService);

    bookService = new BookService();
  });

  describe('createBookProject', () => {
    const userId = 'user123';
    const bookData = {
      title: 'Test Book',
      theme: 'AI and Technology',
      genre: 'technical',
      config: {
        content: { chapterCount: 8 },
        style: { writingStyle: 'academic', targetAudience: 'developers' },
      },
    };

    it('should create a book project successfully', async () => {
      // Mock configuration service
      mockConfigService.prepareConfiguration.mockReturnValue({
        isValid: true,
        config: {
          content: { chapterCount: 8 },
          style: { writingStyle: 'academic', targetAudience: 'developers' },
        },
        errors: [],
      });

      // Mock AI client
      const mockOutline = {
        title: 'AI and Technology Guide',
        description: 'A comprehensive guide to AI and technology',
        chapters: [
          { title: 'Introduction to AI', description: 'Basic concepts of AI' },
          { title: 'Machine Learning', description: 'ML fundamentals' },
        ],
      };
      mockAIClient.generateBookOutline.mockResolvedValue(mockOutline);

      // Mock BookModel
      const mockBook = {
        bookId: 'book123',
        title: 'AI and Technology Guide',
        theme: 'AI and Technology',
        genre: 'technical',
        status: 'outline_pending',
        outline: {
          chapters: mockOutline.chapters,
        },
        config: bookData.config,
        progress: { currentChapter: 0, completedChapters: 0, totalChapters: 8 },
        metadata: { wordCount: 0, estimatedReadingTime: 0 },
        createdAt: new Date(),
      };
      BookModel.create.mockResolvedValue(mockBook);

      const result = await bookService.createBookProject(userId, bookData);

      expect(mockConfigService.prepareConfiguration).toHaveBeenCalledWith(bookData.config);
      expect(mockAIClient.generateBookOutline).toHaveBeenCalledWith(bookData.theme, {
        genre: bookData.genre,
        chapterCount: 8,
        targetAudience: 'developers',
        writingStyle: 'academic',
      });
      expect(BookModel.create).toHaveBeenCalledWith({
        user: userId,
        title: bookData.title,
        theme: bookData.theme,
        genre: bookData.genre,
        config: bookData.config,
        outline: mockOutline.chapters,
      });

      expect(result).toEqual({
        bookId: 'book123',
        title: 'AI and Technology Guide',
        theme: 'AI and Technology',
        genre: 'technical',
        status: 'outline_pending',
        outline: {
          chapters: mockOutline.chapters,
          description: mockOutline.description,
        },
        config: bookData.config,
        progress: mockBook.progress,
        metadata: mockBook.metadata,
        createdAt: mockBook.createdAt,
      });
    });

    it('should throw error for invalid configuration', async () => {
      mockConfigService.prepareConfiguration.mockReturnValue({
        isValid: false,
        errors: ['chapterCount must be between 3 and 50'],
      });

      await expect(bookService.createBookProject(userId, bookData)).rejects.toThrow(
        'Invalid configuration provided',
      );

      expect(mockAIClient.generateBookOutline).not.toHaveBeenCalled();
      expect(BookModel.create).not.toHaveBeenCalled();
    });

    it('should handle AI generation failure', async () => {
      mockConfigService.prepareConfiguration.mockReturnValue({
        isValid: true,
        config: bookData.config,
        errors: [],
      });

      mockAIClient.generateBookOutline.mockRejectedValue(new Error('AI service unavailable'));

      await expect(bookService.createBookProject(userId, bookData)).rejects.toThrow(
        'Failed to create book project: AI service unavailable',
      );
    });

    it('should handle database creation failure', async () => {
      mockConfigService.prepareConfiguration.mockReturnValue({
        isValid: true,
        config: bookData.config,
        errors: [],
      });

      mockAIClient.generateBookOutline.mockResolvedValue({
        title: 'Test Book',
        description: 'Test description',
        chapters: [],
      });

      BookModel.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(bookService.createBookProject(userId, bookData)).rejects.toThrow(
        'Failed to create book project: Database connection failed',
      );
    });
  });

  describe('approveOutline', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should approve outline successfully', async () => {
      const mockBook = {
        bookId: 'book123',
        status: 'in_progress',
        outline: { approvedAt: new Date() },
        progress: { currentChapter: 0, completedChapters: 0, totalChapters: 10 },
        updatedAt: new Date(),
      };

      BookModel.approveOutline.mockResolvedValue(mockBook);

      const result = await bookService.approveOutline(userId, bookId);

      expect(BookModel.approveOutline).toHaveBeenCalledWith(bookId, userId);
      expect(result).toEqual({
        bookId: mockBook.bookId,
        status: mockBook.status,
        outline: mockBook.outline,
        progress: mockBook.progress,
        updatedAt: mockBook.updatedAt,
      });
    });

    it('should throw error when book not found', async () => {
      BookModel.approveOutline.mockResolvedValue(null);

      await expect(bookService.approveOutline(userId, bookId)).rejects.toThrow(
        'Book not found or outline already approved',
      );
    });
  });

  describe('getBookProgress', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should return book progress with calculated metrics', async () => {
      const mockBook = {
        bookId: 'book123',
        title: 'Test Book',
        status: 'in_progress',
        progress: { currentChapter: 3, completedChapters: 2, totalChapters: 10 },
        metadata: { wordCount: 4000, estimatedReadingTime: 20 },
        updatedAt: new Date(),
      };

      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await bookService.getBookProgress(userId, bookId);

      expect(BookModel.findByIdAndUser).toHaveBeenCalledWith(bookId, userId);
      expect(result.progress.completionPercentage).toBe(20); // 2/10 * 100
      expect(result.progress.currentPhase).toBe('generation');
      expect(result.metadata.chaptersRemaining).toBe(8);
      expect(result.metadata.averageWordsPerChapter).toBe(2000); // 4000/2
    });

    it('should throw error when book not found', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(null);

      await expect(bookService.getBookProgress(userId, bookId)).rejects.toThrow('Book not found');
    });
  });

  describe('updateProgress', () => {
    const userId = 'user123';
    const bookId = 'book123';
    const progressData = { completedChapters: 3, wordCount: 6000 };

    it('should update progress successfully', async () => {
      const mockBook = {
        bookId: 'book123',
        progress: { currentChapter: 3, completedChapters: 3, totalChapters: 10 },
        metadata: { wordCount: 6000, estimatedReadingTime: 30 },
        updatedAt: new Date(),
      };

      BookModel.updateProgress.mockResolvedValue(mockBook);

      const result = await bookService.updateProgress(userId, bookId, progressData);

      expect(BookModel.updateProgress).toHaveBeenCalledWith(bookId, userId, progressData);
      expect(result.progress.completionPercentage).toBe(30); // 3/10 * 100
    });

    it('should throw error when book not found', async () => {
      BookModel.updateProgress.mockResolvedValue(null);

      await expect(bookService.updateProgress(userId, bookId, progressData)).rejects.toThrow(
        'Book not found',
      );
    });
  });

  describe('listBooks', () => {
    const userId = 'user123';

    it('should list books with progress metrics', async () => {
      const mockBooks = [
        {
          bookId: 'book1',
          title: 'Book 1',
          theme: 'Theme 1',
          genre: 'fiction',
          status: 'in_progress',
          progress: { currentChapter: 2, completedChapters: 1, totalChapters: 5 },
          metadata: { wordCount: 2000, estimatedReadingTime: 10 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bookId: 'book2',
          title: 'Book 2',
          theme: 'Theme 2',
          genre: 'non-fiction',
          status: 'completed',
          progress: { currentChapter: 8, completedChapters: 8, totalChapters: 8 },
          metadata: { wordCount: 16000, estimatedReadingTime: 80 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockStatistics = {
        total: 2,
        in_progress: 1,
        completed: 1,
        totalWords: 18000,
      };

      BookModel.findByUser.mockResolvedValue(mockBooks);
      BookModel.getStatistics.mockResolvedValue(mockStatistics);

      const result = await bookService.listBooks(userId);

      expect(BookModel.findByUser).toHaveBeenCalledWith(userId, {});
      expect(BookModel.getStatistics).toHaveBeenCalledWith(userId);
      expect(result.books).toHaveLength(2);
      expect(result.books[0].progress.completionPercentage).toBe(20); // 1/5 * 100
      expect(result.books[1].progress.completionPercentage).toBe(100); // 8/8 * 100
      expect(result.statistics).toEqual(mockStatistics);
      expect(result.total).toBe(2);
    });
  });

  describe('exportBook', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should export book in markdown format', async () => {
      const mockBook = {
        bookId: 'book123',
        title: 'Test Book',
        theme: 'Test Theme',
        genre: 'fiction',
        status: 'completed',
        outline: {
          chapters: [
            { title: 'Chapter 1', description: 'First chapter' },
            { title: 'Chapter 2', description: 'Second chapter' },
          ],
        },
        metadata: { wordCount: 5000, estimatedReadingTime: 25 },
        createdAt: new Date(),
      };

      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await bookService.exportBook(userId, bookId, 'markdown');

      expect(BookModel.findByIdAndUser).toHaveBeenCalledWith(bookId, userId);
      expect(result.format).toBe('markdown');
      expect(result.content).toContain('# Test Book');
      expect(result.content).toContain('## Chapter 1: Chapter 1');
      expect(result.downloadInfo.filename).toBe('Test_Book.md');
      expect(result.downloadInfo.mimeType).toBe('text/markdown');
    });

    it('should throw error for unsupported format', async () => {
      const mockBook = { status: 'completed' };
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      await expect(bookService.exportBook(userId, bookId, 'pdf')).rejects.toThrow(
        'Unsupported export format: pdf',
      );
    });

    it('should throw error for incomplete book', async () => {
      const mockBook = { status: 'in_progress' };
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      await expect(bookService.exportBook(userId, bookId, 'markdown')).rejects.toThrow(
        'Book must be completed before export',
      );
    });

    it('should throw error when book not found', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(null);

      await expect(bookService.exportBook(userId, bookId, 'markdown')).rejects.toThrow(
        'Book not found',
      );
    });
  });

  describe('deleteBook', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should delete book successfully', async () => {
      BookModel.deleteByIdAndUser.mockResolvedValue(true);

      const result = await bookService.deleteBook(userId, bookId);

      expect(BookModel.deleteByIdAndUser).toHaveBeenCalledWith(bookId, userId);
      expect(result).toBe(true);
    });

    it('should throw error when book not found', async () => {
      BookModel.deleteByIdAndUser.mockResolvedValue(false);

      await expect(bookService.deleteBook(userId, bookId)).rejects.toThrow('Book not found');
    });
  });

  describe('calculateProgressMetrics', () => {
    it('should calculate progress metrics correctly', () => {
      const book = {
        status: 'in_progress',
        progress: { currentChapter: 3, completedChapters: 2, totalChapters: 10 },
        metadata: { wordCount: 4000 },
      };

      const metrics = bookService.calculateProgressMetrics(book);

      expect(metrics.completionPercentage).toBe(20); // 2/10 * 100
      expect(metrics.chaptersRemaining).toBe(8); // 10 - 2
      expect(metrics.averageWordsPerChapter).toBe(2000); // 4000 / 2
      expect(metrics.estimatedTimeRemaining).toBe(8 * 24 * 60); // 8 chapters * 24 hours * 60 minutes
      expect(metrics.currentPhase).toBe('generation');
      expect(metrics.nextAction).toBe('Generate chapter 4');
    });

    it('should handle completed book status', () => {
      const book = {
        status: 'completed',
        progress: { currentChapter: 5, completedChapters: 5, totalChapters: 5 },
        metadata: { wordCount: 10000 },
      };

      const metrics = bookService.calculateProgressMetrics(book);

      expect(metrics.completionPercentage).toBe(100);
      expect(metrics.currentPhase).toBe('completed');
      expect(metrics.nextAction).toBe('Book is complete - ready for export');
    });

    it('should handle outline pending status', () => {
      const book = {
        status: 'outline_pending',
        progress: { currentChapter: 0, completedChapters: 0, totalChapters: 10 },
        metadata: { wordCount: 0 },
      };

      const metrics = bookService.calculateProgressMetrics(book);

      expect(metrics.completionPercentage).toBe(0);
      expect(metrics.currentPhase).toBe('outline');
      expect(metrics.nextAction).toBe('Approve outline to begin chapter generation');
    });
  });

  describe('export format generation', () => {
    const mockBook = {
      bookId: 'book123',
      title: 'Test Book',
      theme: 'Test Theme',
      genre: 'fiction',
      status: 'completed',
      outline: {
        chapters: [
          { title: 'Chapter 1', description: 'First chapter' },
          { title: 'Chapter 2', description: 'Second chapter' },
        ],
      },
      metadata: { wordCount: 5000 },
      createdAt: new Date('2024-01-01'),
    };

    it('should generate HTML export correctly', () => {
      const content = bookService.generateHtmlExport(mockBook, {
        includeMetadata: true,
        includeTableOfContents: true,
      });

      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<title>Test Book</title>');
      expect(content).toContain('<h1>Test Book</h1>');
      expect(content).toContain('Table of Contents');
      expect(content).toContain('Chapter 1: Chapter 1');
    });

    it('should generate text export correctly', () => {
      const content = bookService.generateTextExport(mockBook, { includeMetadata: true });

      expect(content).toContain('Test Book');
      expect(content).toContain('Theme: Test Theme');
      expect(content).toContain('Chapter 1: Chapter 1');
      expect(content).toContain('First chapter');
    });

    it('should generate JSON export correctly', () => {
      const exportData = bookService.generateJsonExport(mockBook);

      expect(exportData.bookId).toBe('book123');
      expect(exportData.title).toBe('Test Book');
      expect(exportData.chapters).toHaveLength(2);
      expect(exportData.chapters[0].title).toBe('Chapter 1');
      expect(exportData.metadata.exportedAt).toBeDefined();
    });
  });
});

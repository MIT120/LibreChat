const ChapterService = require('../../services/ChapterService');
const ChapterModel = require('../../models/Chapter');
const BookModel = require('../../models/Book');
const { AIClient } = require('../../utils/aiClient');
const ConfigService = require('../../services/ConfigService');

// Mock dependencies
jest.mock('../../models/Chapter');
jest.mock('../../models/Book');
jest.mock('../../utils/aiClient');
jest.mock('../../services/ConfigService');

describe('ChapterService', () => {
  let chapterService;
  let mockAIClient;
  let mockConfigService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAIClient = {
      generateChapter: jest.fn(),
      generateChapterSummary: jest.fn(),
    };

    mockConfigService = {};

    // Mock constructors
    AIClient.mockImplementation(() => mockAIClient);
    ConfigService.mockImplementation(() => mockConfigService);

    chapterService = new ChapterService();
  });

  describe('generateChapter', () => {
    const userId = 'user123';
    const bookId = 'book123';
    const chapterNumber = 1;

    const mockBook = {
      bookId: 'book123',
      theme: 'AI Technology',
      genre: 'technical',
      status: 'in_progress',
      outline: {
        chapters: [
          { title: 'Introduction to AI', description: 'Basic concepts of AI' },
          { title: 'Machine Learning', description: 'ML fundamentals' },
        ],
      },
      config: {
        style: {
          writingStyle: 'academic',
          targetAudience: 'developers',
        },
        content: {
          averageChapterLength: 2000,
        },
      },
      progress: {
        totalChapters: 2,
      },
    };

    it('should generate a chapter successfully', async () => {
      // Mock book retrieval
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      // Mock existing chapters check
      ChapterModel.findByBook.mockResolvedValue([]);

      // Mock context building
      ChapterModel.getApprovedSummaries.mockResolvedValue([]);

      // Mock AI generation
      const mockChapterData = {
        title: 'Introduction to AI',
        content: 'This chapter covers the basic concepts of artificial intelligence...',
        wordCount: 1500,
      };
      mockAIClient.generateChapter.mockResolvedValue(mockChapterData);

      // Mock chapter creation
      const mockCreatedChapter = {
        chapterId: 'chapter123',
        chapterNumber: 1,
        title: 'Introduction to AI',
        content: mockChapterData.content,
        wordCount: 1500,
        status: 'pending',
        estimatedReadingTime: 8,
        createdAt: new Date(),
      };
      ChapterModel.create.mockResolvedValue(mockCreatedChapter);

      const result = await chapterService.generateChapter(userId, bookId, chapterNumber);

      expect(BookModel.findByIdAndUser).toHaveBeenCalledWith(bookId, userId);
      expect(ChapterModel.findByBook).toHaveBeenCalledWith(bookId, userId, { status: null });
      expect(mockAIClient.generateChapter).toHaveBeenCalledWith(
        {
          title: 'Introduction to AI',
          description: 'Basic concepts of AI',
          chapterNumber: 1,
          totalChapters: 2,
        },
        expect.objectContaining({
          bookTheme: 'AI Technology',
          genre: 'technical',
          writingStyle: 'academic',
          targetAudience: 'developers',
          targetWordCount: 2000,
        }),
      );
      expect(ChapterModel.create).toHaveBeenCalledWith({
        bookId,
        user: userId,
        chapterNumber: 1,
        title: 'Introduction to AI',
        content: mockChapterData.content,
        generationContext: expect.objectContaining({
          previousSummaries: [],
        }),
      });

      expect(result).toEqual({
        chapterId: 'chapter123',
        chapterNumber: 1,
        title: 'Introduction to AI',
        content: mockChapterData.content,
        wordCount: 1500,
        status: 'pending',
        estimatedReadingTime: 8,
        createdAt: mockCreatedChapter.createdAt,
      });
    });

    it('should throw error when book not found', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(null);

      await expect(chapterService.generateChapter(userId, bookId, chapterNumber)).rejects.toThrow(
        'Book not found',
      );
    });

    it('should throw error when book is not in progress', async () => {
      const inactiveBook = { ...mockBook, status: 'outline_pending' };
      BookModel.findByIdAndUser.mockResolvedValue(inactiveBook);

      await expect(chapterService.generateChapter(userId, bookId, chapterNumber)).rejects.toThrow(
        'Book must be in progress to generate chapters',
      );
    });

    it('should throw error for invalid chapter number', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      await expect(chapterService.generateChapter(userId, bookId, 5)).rejects.toThrow(
        'Invalid chapter number',
      );
    });

    it('should throw error when chapter already exists', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ChapterModel.findByBook.mockResolvedValue([{ chapterNumber: 1, status: 'pending' }]);

      await expect(chapterService.generateChapter(userId, bookId, chapterNumber)).rejects.toThrow(
        'Chapter already exists',
      );
    });

    it('should use previous chapter summaries for context', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ChapterModel.findByBook.mockResolvedValue([]);

      const mockSummaries = [{ chapterNumber: 1, title: 'Intro', summary: 'Introduction summary' }];
      ChapterModel.getApprovedSummaries.mockResolvedValue(mockSummaries);

      mockAIClient.generateChapter.mockResolvedValue({
        title: 'Chapter 2',
        content: 'Chapter content...',
      });

      ChapterModel.create.mockResolvedValue({
        chapterId: 'chapter123',
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'Chapter content...',
        wordCount: 1000,
        status: 'pending',
        estimatedReadingTime: 5,
        createdAt: new Date(),
      });

      await chapterService.generateChapter(userId, bookId, 2);

      expect(ChapterModel.getApprovedSummaries).toHaveBeenCalledWith(bookId, userId, 2);
      expect(mockAIClient.generateChapter).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          previousSummaries: ['Chapter 1 (Intro): Introduction summary'],
        }),
      );
    });
  });

  describe('approveChapter', () => {
    const userId = 'user123';
    const bookId = 'book123';
    const chapterId = 'chapter123';

    const mockChapter = {
      chapterId: 'chapter123',
      bookId: 'book123',
      chapterNumber: 1,
      title: 'Chapter 1',
      content: 'Chapter content...',
      status: 'pending',
      wordCount: 1500,
    };

    const mockBook = {
      bookId: 'book123',
      progress: {
        completedChapters: 0,
        currentChapter: 0,
        totalChapters: 3,
      },
      metadata: {
        wordCount: 0,
      },
    };

    it('should approve chapter successfully', async () => {
      ChapterModel.findByIdAndUser.mockResolvedValue(mockChapter);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const mockSummary = { summary: 'Chapter summary' };
      mockAIClient.generateChapterSummary.mockResolvedValue(mockSummary);

      const mockApprovedChapter = {
        ...mockChapter,
        status: 'approved',
        summary: 'Chapter summary',
        approvedAt: new Date(),
      };
      ChapterModel.approve.mockResolvedValue(mockApprovedChapter);

      BookModel.updateProgress.mockResolvedValue(true);

      const result = await chapterService.approveChapter(userId, bookId, chapterId);

      expect(ChapterModel.findByIdAndUser).toHaveBeenCalledWith(chapterId, userId);
      expect(mockAIClient.generateChapterSummary).toHaveBeenCalledWith(mockChapter.content, {
        summaryLength: 'brief',
      });
      expect(ChapterModel.approve).toHaveBeenCalledWith(chapterId, userId, 'Chapter summary');
      expect(BookModel.updateProgress).toHaveBeenCalledWith(bookId, userId, {
        completedChapters: 1,
        currentChapter: 1,
        wordCount: 1500,
      });

      expect(result.status).toBe('approved');
      expect(result.nextChapter.nextChapterNumber).toBe(2);
      expect(result.nextChapter.canGenerateNext).toBe(true);
      expect(result.bookProgress.completionPercentage).toBe(33); // 1/3 * 100
    });

    it('should mark book as completed when last chapter is approved', async () => {
      const lastChapter = { ...mockChapter, chapterNumber: 3 };
      ChapterModel.findByIdAndUser.mockResolvedValue(lastChapter);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      mockAIClient.generateChapterSummary.mockResolvedValue({ summary: 'Summary' });
      ChapterModel.approve.mockResolvedValue({ ...lastChapter, status: 'approved' });
      BookModel.updateProgress.mockResolvedValue(true);
      BookModel.updateByIdAndUser.mockResolvedValue(true);

      const result = await chapterService.approveChapter(userId, bookId, chapterId);

      expect(BookModel.updateByIdAndUser).toHaveBeenCalledWith(bookId, userId, {
        status: 'completed',
      });
      expect(result.nextChapter.bookCompleted).toBe(true);
      expect(result.nextChapter.canGenerateNext).toBe(false);
    });

    it('should throw error when chapter not found', async () => {
      ChapterModel.findByIdAndUser.mockResolvedValue(null);

      await expect(chapterService.approveChapter(userId, bookId, chapterId)).rejects.toThrow(
        'Chapter not found',
      );
    });

    it('should throw error when chapter belongs to different book', async () => {
      const wrongBookChapter = { ...mockChapter, bookId: 'different-book' };
      ChapterModel.findByIdAndUser.mockResolvedValue(wrongBookChapter);

      await expect(chapterService.approveChapter(userId, bookId, chapterId)).rejects.toThrow(
        'Chapter does not belong to this book',
      );
    });

    it('should throw error when chapter is not pending', async () => {
      const approvedChapter = { ...mockChapter, status: 'approved' };
      ChapterModel.findByIdAndUser.mockResolvedValue(approvedChapter);

      await expect(chapterService.approveChapter(userId, bookId, chapterId)).rejects.toThrow(
        'Chapter is not pending approval',
      );
    });
  });

  describe('rejectChapter', () => {
    const userId = 'user123';
    const chapterId = 'chapter123';
    const feedback = 'Please add more examples';

    it('should reject chapter successfully', async () => {
      const mockRejectedChapter = {
        chapterId: 'chapter123',
        chapterNumber: 1,
        title: 'Chapter 1',
        status: 'rejected',
        feedback: 'Please add more examples',
        rejectedAt: new Date(),
      };

      ChapterModel.reject.mockResolvedValue(mockRejectedChapter);

      const result = await chapterService.rejectChapter(userId, chapterId, feedback);

      expect(ChapterModel.reject).toHaveBeenCalledWith(chapterId, userId, feedback);
      expect(result.status).toBe('rejected');
      expect(result.feedback).toBe(feedback);
      expect(result.canRegenerate).toBe(true);
    });

    it('should throw error when chapter not found', async () => {
      ChapterModel.reject.mockResolvedValue(null);

      await expect(chapterService.rejectChapter(userId, chapterId, feedback)).rejects.toThrow(
        'Chapter not found or not pending',
      );
    });
  });

  describe('regenerateChapter', () => {
    const userId = 'user123';
    const bookId = 'book123';
    const chapterId = 'chapter123';

    const mockRejectedChapter = {
      chapterId: 'chapter123',
      bookId: 'book123',
      chapterNumber: 1,
      title: 'Chapter 1',
      content: 'Old content...',
      status: 'rejected',
      feedback: 'Add more examples',
      generationContext: {
        previousSummaries: [],
        styleInstructions: 'Academic style',
      },
    };

    const mockBook = {
      bookId: 'book123',
      theme: 'AI Technology',
      genre: 'technical',
      outline: {
        chapters: [{ title: 'Introduction to AI', description: 'Basic concepts' }],
      },
      config: {
        style: {
          writingStyle: 'academic',
          targetAudience: 'developers',
        },
        content: {
          averageChapterLength: 2000,
        },
      },
      progress: {
        totalChapters: 3,
      },
    };

    it('should regenerate chapter successfully', async () => {
      ChapterModel.findByIdAndUser.mockResolvedValue(mockRejectedChapter);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ChapterModel.getApprovedSummaries.mockResolvedValue([]);

      const mockNewChapterData = {
        title: 'Introduction to AI',
        content: 'New improved content with examples...',
      };
      mockAIClient.generateChapter.mockResolvedValue(mockNewChapterData);

      const mockUpdatedChapter = {
        ...mockRejectedChapter,
        content: mockNewChapterData.content,
        status: 'pending',
        wordCount: 2000,
        estimatedReadingTime: 10,
        updatedAt: new Date(),
      };
      ChapterModel.updateByIdAndUser.mockResolvedValue(mockUpdatedChapter);

      const result = await chapterService.regenerateChapter(userId, bookId, chapterId, {
        feedback: 'Include practical examples',
      });

      expect(ChapterModel.findByIdAndUser).toHaveBeenCalledWith(chapterId, userId);
      expect(BookModel.findByIdAndUser).toHaveBeenCalledWith(bookId, userId);
      expect(mockAIClient.generateChapter).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          specificRequirements: expect.stringContaining('Add more examples'),
        }),
      );
      expect(ChapterModel.updateByIdAndUser).toHaveBeenCalledWith(chapterId, userId, {
        content: mockNewChapterData.content,
        status: 'pending',
        feedback: '',
        rejectedAt: undefined,
        approvedAt: undefined,
        generationContext: expect.objectContaining({
          specificRequirements: expect.stringContaining('Add more examples'),
        }),
      });

      expect(result.status).toBe('pending');
      expect(result.content).toBe(mockNewChapterData.content);
      expect(result.feedbackIncorporated).toContain('Add more examples');
    });

    it('should throw error when chapter not found', async () => {
      ChapterModel.findByIdAndUser.mockResolvedValue(null);

      await expect(chapterService.regenerateChapter(userId, bookId, chapterId)).rejects.toThrow(
        'Chapter not found',
      );
    });

    it('should throw error when chapter is not rejected', async () => {
      const pendingChapter = { ...mockRejectedChapter, status: 'pending' };
      ChapterModel.findByIdAndUser.mockResolvedValue(pendingChapter);

      await expect(chapterService.regenerateChapter(userId, bookId, chapterId)).rejects.toThrow(
        'Only rejected chapters can be regenerated',
      );
    });
  });

  describe('getChapter', () => {
    const userId = 'user123';
    const chapterId = 'chapter123';

    it('should get chapter details successfully', async () => {
      const mockChapter = {
        chapterId: 'chapter123',
        bookId: 'book123',
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Chapter content...',
        summary: 'Chapter summary',
        status: 'approved',
        wordCount: 1500,
        estimatedReadingTime: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ChapterModel.findByIdAndUser.mockResolvedValue(mockChapter);

      const result = await chapterService.getChapter(userId, chapterId);

      expect(ChapterModel.findByIdAndUser).toHaveBeenCalledWith(chapterId, userId);
      expect(result).toEqual(mockChapter);
    });

    it('should throw error when chapter not found', async () => {
      ChapterModel.findByIdAndUser.mockResolvedValue(null);

      await expect(chapterService.getChapter(userId, chapterId)).rejects.toThrow(
        'Chapter not found',
      );
    });
  });

  describe('listChapters', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should list chapters with statistics', async () => {
      const mockChapters = [
        {
          chapterId: 'chapter1',
          chapterNumber: 1,
          title: 'Chapter 1',
          status: 'approved',
          wordCount: 1500,
          estimatedReadingTime: 8,
          content: 'Content...',
          summary: 'Summary...',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          chapterId: 'chapter2',
          chapterNumber: 2,
          title: 'Chapter 2',
          status: 'pending',
          wordCount: 1200,
          estimatedReadingTime: 6,
          content: 'Content...',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockStatistics = {
        total: 2,
        pending: 1,
        approved: 1,
        rejected: 0,
        totalWords: 2700,
      };

      ChapterModel.findByBook.mockResolvedValue(mockChapters);
      ChapterModel.getBookStatistics.mockResolvedValue(mockStatistics);

      const result = await chapterService.listChapters(userId, bookId);

      expect(ChapterModel.findByBook).toHaveBeenCalledWith(bookId, userId, {
        status: undefined,
        sortByNumber: true,
      });
      expect(ChapterModel.getBookStatistics).toHaveBeenCalledWith(bookId, userId);

      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].hasContent).toBe(true);
      expect(result.chapters[0].hasSummary).toBe(true);
      expect(result.chapters[1].hasSummary).toBe(false);
      expect(result.statistics).toEqual(mockStatistics);
      expect(result.total).toBe(2);
    });
  });

  describe('buildChapterContext', () => {
    const userId = 'user123';
    const bookId = 'book123';
    const chapterNumber = 3;

    const mockBook = {
      theme: 'AI Technology',
      genre: 'technical',
      config: {
        style: {
          writingStyle: 'academic',
          targetAudience: 'developers',
          tone: 'professional',
          perspective: 'third-person',
        },
        content: {
          averageChapterLength: 2000,
        },
      },
      progress: {
        totalChapters: 5,
      },
    };

    it('should build chapter context with previous summaries', async () => {
      const mockSummaries = [
        { chapterNumber: 1, title: 'Intro', summary: 'Introduction to AI' },
        { chapterNumber: 2, title: 'Basics', summary: 'Basic concepts' },
      ];

      ChapterModel.getApprovedSummaries.mockResolvedValue(mockSummaries);

      const result = await chapterService.buildChapterContext(
        userId,
        bookId,
        chapterNumber,
        mockBook,
      );

      expect(ChapterModel.getApprovedSummaries).toHaveBeenCalledWith(bookId, userId, 3);
      expect(result.previousSummaries).toEqual([
        'Chapter 1 (Intro): Introduction to AI',
        'Chapter 2 (Basics): Basic concepts',
      ]);
      expect(result.styleInstructions).toContain('Writing style: academic');
      expect(result.styleInstructions).toContain('Tone: professional');
      expect(result.styleInstructions).toContain('Target audience: developers');
      expect(result.bookTheme).toBe('AI Technology');
      expect(result.genre).toBe('technical');
    });

    it('should handle empty previous summaries', async () => {
      ChapterModel.getApprovedSummaries.mockResolvedValue([]);

      const result = await chapterService.buildChapterContext(userId, bookId, 1, mockBook);

      expect(result.previousSummaries).toEqual([]);
      expect(result.styleInstructions).toBeDefined();
    });
  });

  describe('getNextChapterToGenerate', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should return next chapter info when available', async () => {
      const mockBook = {
        status: 'in_progress',
        outline: {
          chapters: [
            { title: 'Chapter 1', description: 'First chapter' },
            { title: 'Chapter 2', description: 'Second chapter' },
          ],
        },
        progress: {
          totalChapters: 2,
        },
      };

      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ChapterModel.getNextChapterNumber.mockResolvedValue(2);

      const result = await chapterService.getNextChapterToGenerate(userId, bookId);

      expect(result).toEqual({
        chapterNumber: 2,
        title: 'Chapter 2',
        description: 'Second chapter',
        canGenerate: true,
      });
    });

    it('should return null when all chapters are generated', async () => {
      const mockBook = {
        status: 'in_progress',
        progress: { totalChapters: 2 },
      };

      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ChapterModel.getNextChapterNumber.mockResolvedValue(3); // Exceeds total

      const result = await chapterService.getNextChapterToGenerate(userId, bookId);

      expect(result).toBeNull();
    });

    it('should return null when book is not in progress', async () => {
      const mockBook = { status: 'completed' };
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await chapterService.getNextChapterToGenerate(userId, bookId);

      expect(result).toBeNull();
    });
  });

  describe('getChapterProgress', () => {
    const userId = 'user123';
    const bookId = 'book123';

    it('should return chapter progress with statistics', async () => {
      const mockStatistics = {
        total: 3,
        pending: 1,
        approved: 2,
        rejected: 0,
        totalWords: 4500,
      };

      const mockNextChapter = {
        chapterNumber: 4,
        title: 'Chapter 4',
        canGenerate: true,
      };

      ChapterModel.getBookStatistics.mockResolvedValue(mockStatistics);
      chapterService.getNextChapterToGenerate = jest.fn().mockResolvedValue(mockNextChapter);

      const result = await chapterService.getChapterProgress(userId, bookId);

      expect(result.statistics).toEqual(mockStatistics);
      expect(result.nextChapter).toEqual(mockNextChapter);
      expect(result.generationComplete).toBe(false);
      expect(result.pendingApproval).toBe(true);
      expect(result.needsRegeneration).toBe(false);
    });

    it('should indicate generation complete when no next chapter', async () => {
      ChapterModel.getBookStatistics.mockResolvedValue({
        total: 2,
        pending: 0,
        approved: 2,
        rejected: 0,
      });
      chapterService.getNextChapterToGenerate = jest.fn().mockResolvedValue(null);

      const result = await chapterService.getChapterProgress(userId, bookId);

      expect(result.generationComplete).toBe(true);
      expect(result.pendingApproval).toBe(false);
    });
  });
});

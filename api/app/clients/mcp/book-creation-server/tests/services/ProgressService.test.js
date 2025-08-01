const ProgressService = require('../../services/ProgressService');
const ProgressModel = require('../../models/Progress');
const BookModel = require('../../models/Book');
const ChapterModel = require('../../models/Chapter');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

// Mock the models
jest.mock('../../models/Progress');
jest.mock('../../models/Book');
jest.mock('../../models/Chapter');

describe('ProgressService', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeProgress', () => {
    it('should initialize progress tracking for a new book', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
        currentPhase: 'outline',
      };

      ProgressModel.create.mockResolvedValue(mockProgress);

      const result = await ProgressService.initializeProgress('test-book-id', 'test-user-id', 10);

      expect(ProgressModel.create).toHaveBeenCalledWith({
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      });
      expect(result).toEqual(mockProgress);
    });

    it('should handle errors during initialization', async () => {
      ProgressModel.create.mockRejectedValue(new Error('Database error'));

      await expect(
        ProgressService.initializeProgress('test-book-id', 'test-user-id', 10),
      ).rejects.toThrow('Database error');
    });
  });

  describe('recordOutlineGenerated', () => {
    it('should record outline generation milestone', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        milestones: [
          { phase: 'project_created' },
          { phase: 'outline_generated' },
        ],
      };

      ProgressModel.addMilestone.mockResolvedValue(mockProgress);

      const result = await ProgressService.recordOutlineGenerated('test-book-id', 'test-user-id', {
        chapterCount: 10,
      });

      expect(ProgressModel.addMilestone).toHaveBeenCalledWith('test-book-id', 'test-user-id', {
        phase: 'outline_generated',
        metadata: {
          chapterCount: 10,
          timestamp: expect.any(String),
        },
      });
      expect(result).toEqual(mockProgress);
    });
  });

  describe('recordChapterGenerated', () => {
    it('should record chapter generation milestone and update statistics', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        milestones: [{ phase: 'chapter_generated' }],
      };

      ProgressModel.addMilestone.mockResolvedValue(mockProgress);
      ChapterModel.getBookStatistics.mockResolvedValue({
        totalWords: 5000,
        approved: 2,
      });
      ProgressModel.findByBookAndUser.mockResolvedValue({
        progressId: 'test-progress-id',
      });
      ProgressModel.updateStatistics.mockResolvedValue(mockProgress);
      BookModel.updateProgress.mockResolvedValue({});

      const result = await ProgressService.recordChapterGenerated(
        'test-book-id',
        'test-user-id',
        3,
        { wordCount: 2000 },
      );

      expect(ProgressModel.addMilestone).toHaveBeenCalledWith('test-book-id', 'test-user-id', {
        phase: 'chapter_generated',
        chapterNumber: 3,
        metadata: {
          wordCount: 2000,
          timestamp: expect.any(String),
        },
      });
      expect(result).toEqual(mockProgress);
    });
  });

  describe('recordChapterApproved', () => {
    it('should record chapter approval and check book completion', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        completedChapters: 3,
        totalChapters: 10,
      };

      ProgressModel.addMilestone.mockResolvedValue(mockProgress);
      ChapterModel.getBookStatistics.mockResolvedValue({
        totalWords: 6000,
        approved: 3,
      });
      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      ProgressModel.updateStatistics.mockResolvedValue(mockProgress);
      BookModel.updateProgress.mockResolvedValue({});

      const result = await ProgressService.recordChapterApproved(
        'test-book-id',
        'test-user-id',
        3,
        { summaryGenerated: true },
      );

      expect(ProgressModel.addMilestone).toHaveBeenCalledWith('test-book-id', 'test-user-id', {
        phase: 'chapter_approved',
        chapterNumber: 3,
        metadata: {
          summaryGenerated: true,
          timestamp: expect.any(String),
        },
      });
      expect(result).toEqual(mockProgress);
    });

    it('should record book completion when all chapters are approved', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        completedChapters: 10,
        totalChapters: 10,
        milestones: [],
      };

      ProgressModel.addMilestone.mockResolvedValue(mockProgress);
      ChapterModel.getBookStatistics.mockResolvedValue({
        totalWords: 20000,
        approved: 10,
      });
      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      ProgressModel.updateStatistics.mockResolvedValue(mockProgress);
      BookModel.updateProgress.mockResolvedValue({});
      BookModel.updateByIdAndUser.mockResolvedValue({});

      // Mock the checkBookCompletion method to simulate completion
      jest.spyOn(ProgressService, 'recordBookCompleted').mockResolvedValue(mockProgress);

      await ProgressService.recordChapterApproved('test-book-id', 'test-user-id', 10);

      // The updateWordCountStatistics method should be called
      expect(ChapterModel.getBookStatistics).toHaveBeenCalledWith('test-book-id', 'test-user-id');
    });
  });

  describe('getCurrentProgress', () => {
    it('should return current progress for a book', async () => {
      const mockProgress = {
        progressId: 'test-progress-id',
        bookId: 'test-book-id',
        currentPhase: 'generation',
        percentComplete: 30,
      };

      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);

      const result = await ProgressService.getCurrentProgress('test-book-id', 'test-user-id');

      expect(ProgressModel.findByBookAndUser).toHaveBeenCalledWith('test-book-id', 'test-user-id');
      expect(result).toEqual(mockProgress);
    });

    it('should return null if progress not found', async () => {
      ProgressModel.findByBookAndUser.mockResolvedValue(null);

      const result = await ProgressService.getCurrentProgress('test-book-id', 'test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('generateStatusMessage', () => {
    it('should generate status message for outline phase', async () => {
      const mockProgress = {
        currentPhase: 'outline',
        percentComplete: 0,
        completedChapters: 0,
        totalChapters: 10,
        estimatedTimeRemaining: 300,
      };

      const mockBook = {
        title: 'Test Book',
        bookId: 'test-book-id',
      };

      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await ProgressService.generateStatusMessage('test-book-id', 'test-user-id');

      expect(result.type).toBe('info');
      expect(result.message).toContain('Outline phase');
      expect(result.bookTitle).toBe('Test Book');
      expect(result.phase).toBe('outline');
    });

    it('should generate status message for generation phase', async () => {
      const mockProgress = {
        currentPhase: 'generation',
        percentComplete: 30,
        completedChapters: 3,
        totalChapters: 10,
        estimatedTimeRemaining: 210,
      };

      const mockBook = {
        title: 'Test Book',
        bookId: 'test-book-id',
      };

      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await ProgressService.generateStatusMessage('test-book-id', 'test-user-id');

      expect(result.type).toBe('progress');
      expect(result.message).toContain('Generating chapters');
      expect(result.message).toContain('(3/10)');
      expect(result.percentComplete).toBe(30);
    });

    it('should generate status message for completed phase', async () => {
      const mockProgress = {
        currentPhase: 'completed',
        percentComplete: 100,
        completedChapters: 10,
        totalChapters: 10,
        statistics: {
          totalWordCount: 20000,
        },
      };

      const mockBook = {
        title: 'Test Book',
        bookId: 'test-book-id',
      };

      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);

      const result = await ProgressService.generateStatusMessage('test-book-id', 'test-user-id');

      expect(result.type).toBe('success');
      expect(result.message).toContain('Book completed!');
      expect(result.details).toContain('20,000 words');
    });

    it('should handle error when progress not found', async () => {
      ProgressModel.findByBookAndUser.mockResolvedValue(null);

      const result = await ProgressService.generateStatusMessage('test-book-id', 'test-user-id');

      expect(result.type).toBe('error');
      expect(result.message).toContain('Progress tracking not found');
    });
  });

  describe('getDetailedAnalytics', () => {
    it('should return detailed analytics for a book', async () => {
      const mockAnalytics = {
        progressId: 'test-progress-id',
        phaseBreakdown: { outline: 1000, generation: 5000 },
        timelineAnalysis: { totalTime: 6000 },
        productivityMetrics: { chaptersPerDay: 1.5 },
      };

      ProgressModel.getDetailedAnalytics.mockResolvedValue(mockAnalytics);

      const result = await ProgressService.getDetailedAnalytics('test-book-id', 'test-user-id');

      expect(ProgressModel.getDetailedAnalytics).toHaveBeenCalledWith('test-book-id', 'test-user-id');
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('deleteProgress', () => {
    it('should delete progress tracking for a book', async () => {
      ProgressModel.deleteByBookAndUser.mockResolvedValue(true);

      const result = await ProgressService.deleteProgress('test-book-id', 'test-user-id');

      expect(ProgressModel.deleteByBookAndUser).toHaveBeenCalledWith('test-book-id', 'test-user-id');
      expect(result).toBe(true);
    });

    it('should return false if progress not found', async () => {
      ProgressModel.deleteByBookAndUser.mockResolvedValue(false);

      const result = await ProgressService.deleteProgress('test-book-id', 'test-user-id');

      expect(result).toBe(false);
    });
  });

  describe('updateWordCountStatistics', () => {
    it('should update word count statistics from chapter data', async () => {
      const mockChapterStats = {
        totalWords: 8000,
        approved: 4,
      };

      const mockProgress = {
        progressId: 'test-progress-id',
      };

      ChapterModel.getBookStatistics.mockResolvedValue(mockChapterStats);
      ProgressModel.findByBookAndUser.mockResolvedValue(mockProgress);
      ProgressModel.updateStatistics.mockResolvedValue(mockProgress);
      BookModel.updateProgress.mockResolvedValue({});

      await ProgressService.updateWordCountStatistics('test-book-id', 'test-user-id');

      expect(ChapterModel.getBookStatistics).toHaveBeenCalledWith('test-book-id', 'test-user-id');
      expect(ProgressModel.updateStatistics).toHaveBeenCalledWith('test-book-id', 'test-user-id', {
        totalWordCount: 8000,
        completedChapters: 4,
      });
      expect(BookModel.updateProgress).toHaveBeenCalledWith('test-book-id', 'test-user-id', {
        wordCount: 8000,
        completedChapters: 4,
      });
    });

    it('should handle case when progress not found', async () => {
      ChapterModel.getBookStatistics.mockResolvedValue({ totalWords: 0, approved: 0 });
      ProgressModel.findByBookAndUser.mockResolvedValue(null);

      // Should not throw error
      await expect(
        ProgressService.updateWordCountStatistics('test-book-id', 'test-user-id'),
      ).resolves.not.toThrow();

      expect(ProgressModel.updateStatistics).not.toHaveBeenCalled();
    });
  });

  describe('getActiveProgressUpdates', () => {
    it('should return active progress updates for user', async () => {
      const mockProgressList = [
        {
          bookId: 'book-1',
          currentPhase: 'generation',
          percentComplete: 30,
          completedChapters: 3,
          totalChapters: 10,
        },
        {
          bookId: 'book-2',
          currentPhase: 'review',
          percentComplete: 50,
          completedChapters: 5,
          totalChapters: 10,
        },
      ];

      const mockBooks = [
        { bookId: 'book-1', title: 'Book 1' },
        { bookId: 'book-2', title: 'Book 2' },
      ];

      ProgressModel.getUserProgressSummary.mockResolvedValue(mockProgressList);
      BookModel.findByIdAndUser
        .mockResolvedValueOnce(mockBooks[0])
        .mockResolvedValueOnce(mockBooks[1]);

      const result = await ProgressService.getActiveProgressUpdates('test-user-id');

      expect(result).toHaveLength(2);
      expect(result[0].bookTitle).toBe('Book 1');
      expect(result[1].bookTitle).toBe('Book 2');
      expect(ProgressModel.getUserProgressSummary).toHaveBeenCalledWith('test-user-id', {
        phase: ['generation', 'review'],
        limit: 10,
      });
    });

    it('should handle empty progress list', async () => {
      ProgressModel.getUserProgressSummary.mockResolvedValue([]);

      const result = await ProgressService.getActiveProgressUpdates('test-user-id');

      expect(result).toEqual([]);
    });
  });

  describe('formatStatusMessage', () => {
    it('should format status message correctly for different phases', () => {
      const mockProgress = {
        currentPhase: 'generation',
        percentComplete: 40,
        completedChapters: 4,
        totalChapters: 10,
        estimatedTimeRemaining: 180,
        currentChapter: 5,
      };

      const mockBook = {
        title: 'Test Book',
        bookId: 'test-book-id',
      };

      const result = ProgressService.formatStatusMessage(mockProgress, mockBook);

      expect(result.type).toBe('progress');
      expect(result.bookTitle).toBe('Test Book');
      expect(result.phase).toBe('generation');
      expect(result.percentComplete).toBe(40);
      expect(result.completedChapters).toBe(4);
      expect(result.totalChapters).toBe(10);
      expect(result.message).toContain('Generating chapters (4/10)');
    });
  });
});
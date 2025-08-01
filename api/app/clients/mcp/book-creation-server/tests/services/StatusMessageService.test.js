const StatusMessageService = require('../../services/StatusMessageService');
const ProgressService = require('../../services/ProgressService');
const BookModel = require('../../models/Book');
const ChapterModel = require('../../models/Chapter');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

// Mock the dependencies
jest.mock('../../services/ProgressService');
jest.mock('../../models/Book');
jest.mock('../../models/Chapter');

describe('StatusMessageService', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBookStatusUpdate', () => {
    it('should generate status update for a book', async () => {
      const mockProgress = {
        currentPhase: 'generation',
        percentComplete: 30,
        completedChapters: 3,
        totalChapters: 10,
        estimatedTimeRemaining: 210,
      };

      const mockBook = {
        bookId: 'test-book-id',
        title: 'Test Book',
        status: 'in_progress',
      };

      const mockStatusMessage = {
        type: 'progress',
        message: 'Generating chapters (3/10)',
        bookTitle: 'Test Book',
        phase: 'generation',
      };

      ProgressService.getCurrentProgress.mockResolvedValue(mockProgress);
      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ProgressService.generateStatusMessage.mockResolvedValue(mockStatusMessage);

      const result = await StatusMessageService.generateBookStatusUpdate('test-book-id', 'test-user-id');

      expect(result.type).toBe('progress');
      expect(result.bookTitle).toBe('Test Book');
      expect(result.progressIndicator).toBeDefined();
      expect(result.actionButtons).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return error message when book not found', async () => {
      ProgressService.getCurrentProgress.mockResolvedValue(null);
      BookModel.findByIdAndUser.mockResolvedValue(null);

      const result = await StatusMessageService.generateBookStatusUpdate('nonexistent-book', 'test-user-id');

      expect(result.type).toBe('error');
      expect(result.message).toContain('Book or progress tracking not found');
    });
  });

  describe('generateWorkflowStageMessage', () => {
    it('should generate book creation started message', () => {
      const data = {
        title: 'Test Book',
        theme: 'Science Fiction',
        genre: 'fiction',
        chapterCount: 10,
      };

      const result = StatusMessageService.generateWorkflowStageMessage('book_creation_started', data);

      expect(result.type).toBe('info');
      expect(result.icon).toBe('📚');
      expect(result.title).toBe('Book Creation Started');
      expect(result.message).toContain('Test Book');
      expect(result.message).toContain('10 chapters');
      expect(result.details).toContain('Science Fiction');
      expect(result.showProgress).toBe(false);
    });

    it('should generate outline generating message', () => {
      const data = { title: 'Test Book' };

      const result = StatusMessageService.generateWorkflowStageMessage('outline_generating', data);

      expect(result.type).toBe('progress');
      expect(result.icon).toBe('⚡');
      expect(result.title).toBe('Generating Outline');
      expect(result.showProgress).toBe(true);
      expect(result.indeterminate).toBe(true);
    });

    it('should generate chapter ready message', () => {
      const data = {
        chapterNumber: 3,
        chapterTitle: 'Chapter 3 Title',
        wordCount: 2500,
        estimatedReadingTime: 12,
      };

      const result = StatusMessageService.generateWorkflowStageMessage('chapter_ready', data);

      expect(result.type).toBe('waiting');
      expect(result.icon).toBe('👀');
      expect(result.title).toBe('Chapter Ready for Review');
      expect(result.message).toContain('Chapter 3');
      expect(result.message).toContain('Chapter 3 Title');
      expect(result.details).toContain('2500 words');
      expect(result.details).toContain('12 min');
      expect(result.requiresAction).toBe(true);
    });

    it('should generate book completed message', () => {
      const data = {
        title: 'Test Book',
        totalChapters: 10,
        totalWords: 25000,
      };

      const result = StatusMessageService.generateWorkflowStageMessage('book_completed', data);

      expect(result.type).toBe('success');
      expect(result.icon).toBe('🎉');
      expect(result.title).toBe('Book Completed!');
      expect(result.message).toContain('Test Book');
      expect(result.details).toContain('10 chapters');
      expect(result.details).toContain('25,000 words');
      expect(result.celebratory).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('should handle unknown stage', () => {
      const result = StatusMessageService.generateWorkflowStageMessage('unknown_stage', {});

      expect(result.type).toBe('error');
      expect(result.icon).toBe('⚠️');
      expect(result.title).toBe('Error Occurred');
    });
  });

  describe('createProgressIndicator', () => {
    it('should create progress indicator with visual bar', () => {
      const progress = {
        percentComplete: 30,
        completedChapters: 3,
        totalChapters: 10,
        currentPhase: 'generation',
        estimatedTimeRemaining: 180,
      };

      const result = StatusMessageService.createProgressIndicator(progress);

      expect(result.percentage).toBe(30);
      expect(result.fraction).toBe('3/10');
      expect(result.phase).toBe('✍️ Writing');
      expect(result.bar).toContain('█');
      expect(result.bar).toContain('░');
      expect(result.text).toContain('30%');
      expect(result.estimatedTimeRemaining).toBe('3h');
    });

    it('should handle zero progress', () => {
      const progress = {
        percentComplete: 0,
        completedChapters: 0,
        totalChapters: 10,
        currentPhase: 'outline',
        estimatedTimeRemaining: 300,
      };

      const result = StatusMessageService.createProgressIndicator(progress);

      expect(result.percentage).toBe(0);
      expect(result.fraction).toBe('0/10');
      expect(result.phase).toBe('📝 Outline');
      expect(result.bar).toMatch(/^░+$/); // All empty bars
    });

    it('should handle completed progress', () => {
      const progress = {
        percentComplete: 100,
        completedChapters: 10,
        totalChapters: 10,
        currentPhase: 'completed',
        estimatedTimeRemaining: 0,
      };

      const result = StatusMessageService.createProgressIndicator(progress);

      expect(result.percentage).toBe(100);
      expect(result.fraction).toBe('10/10');
      expect(result.phase).toBe('✅ Complete');
      expect(result.bar).toMatch(/^█+$/); // All filled bars
      expect(result.estimatedTimeRemaining).toBe('Unknown');
    });
  });

  describe('createActionButtons', () => {
    it('should create outline approval buttons', () => {
      const progress = {
        currentPhase: 'outline',
        currentChapter: 0,
        totalChapters: 10,
      };

      const book = {
        bookId: 'test-book-id',
        status: 'outline_pending',
      };

      const result = StatusMessageService.createActionButtons(progress, book);

      expect(result).toHaveLength(3); // approve, regenerate, view progress
      expect(result[0].id).toBe('approve_outline');
      expect(result[0].text).toBe('Approve Outline');
      expect(result[0].type).toBe('primary');
      expect(result[1].id).toBe('regenerate_outline');
      expect(result[2].id).toBe('view_progress');
    });

    it('should create generation buttons', () => {
      const progress = {
        currentPhase: 'generation',
        currentChapter: 2,
        totalChapters: 10,
      };

      const book = {
        bookId: 'test-book-id',
        status: 'in_progress',
      };

      const result = StatusMessageService.createActionButtons(progress, book);

      expect(result).toHaveLength(2); // generate next, view progress
      expect(result[0].id).toBe('generate_next_chapter');
      expect(result[0].text).toBe('Generate Chapter 3');
      expect(result[0].params.chapterNumber).toBe(3);
    });

    it('should create completion buttons', () => {
      const progress = {
        currentPhase: 'completed',
        currentChapter: 10,
        totalChapters: 10,
      };

      const book = {
        bookId: 'test-book-id',
        status: 'completed',
      };

      const result = StatusMessageService.createActionButtons(progress, book);

      expect(result).toHaveLength(3); // export, view details, view progress
      expect(result[0].id).toBe('export_book');
      expect(result[0].text).toBe('Export Book');
      expect(result[1].id).toBe('view_book_details');
    });
  });

  describe('generateCompletionNotification', () => {
    it('should generate completion notification with statistics', async () => {
      const mockBook = {
        bookId: 'test-book-id',
        title: 'Test Book',
        theme: 'Science Fiction',
        genre: 'fiction',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
      };

      const mockProgress = {
        totalChapters: 10,
      };

      const mockChapterStats = {
        totalWords: 25000,
      };

      const mockAnalytics = {
        statistics: {
          approvalRate: 90,
          regenerationCount: 2,
        },
      };

      BookModel.findByIdAndUser.mockResolvedValue(mockBook);
      ProgressService.getCurrentProgress.mockResolvedValue(mockProgress);
      ChapterModel.getBookStatistics.mockResolvedValue(mockChapterStats);
      ProgressService.getDetailedAnalytics.mockResolvedValue(mockAnalytics);

      const result = await StatusMessageService.generateCompletionNotification('test-book-id', 'test-user-id');

      expect(result.type).toBe('celebration');
      expect(result.icon).toBe('🎉');
      expect(result.title).toContain('Congratulations');
      expect(result.summary.title).toBe('Test Book');
      expect(result.summary.totalWords).toBe(25000);
      expect(result.summary.estimatedReadingTime).toBe(125); // 25000 / 200
      expect(result.statistics.approvalRate).toBe(90);
      expect(result.exportOptions).toHaveLength(4);
      expect(result.actionButtons).toHaveLength(2);
    });

    it('should handle error when book not found', async () => {
      BookModel.findByIdAndUser.mockResolvedValue(null);
      ProgressService.getCurrentProgress.mockResolvedValue(null);

      const result = await StatusMessageService.generateCompletionNotification('nonexistent-book', 'test-user-id');

      expect(result.type).toBe('error');
      expect(result.message).toContain('Book not found');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format minutes correctly', () => {
      expect(StatusMessageService.formatTimeRemaining(30)).toBe('30 min');
      expect(StatusMessageService.formatTimeRemaining(45)).toBe('45 min');
    });

    it('should format hours correctly', () => {
      expect(StatusMessageService.formatTimeRemaining(60)).toBe('1h');
      expect(StatusMessageService.formatTimeRemaining(90)).toBe('1h 30m');
      expect(StatusMessageService.formatTimeRemaining(120)).toBe('2h');
    });

    it('should format days correctly', () => {
      expect(StatusMessageService.formatTimeRemaining(1440)).toBe('1d'); // 24 hours
      expect(StatusMessageService.formatTimeRemaining(1500)).toBe('1d 1h'); // 25 hours
      expect(StatusMessageService.formatTimeRemaining(2880)).toBe('2d'); // 48 hours
    });

    it('should handle edge cases', () => {
      expect(StatusMessageService.formatTimeRemaining(0)).toBe('Unknown');
      expect(StatusMessageService.formatTimeRemaining(-10)).toBe('Unknown');
      expect(StatusMessageService.formatTimeRemaining(null)).toBe('Unknown');
      expect(StatusMessageService.formatTimeRemaining(undefined)).toBe('Unknown');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(StatusMessageService.formatDuration(5000)).toBe('5 seconds');
      expect(StatusMessageService.formatDuration(1000)).toBe('1 second');
    });

    it('should format minutes correctly', () => {
      expect(StatusMessageService.formatDuration(60000)).toBe('1 minute');
      expect(StatusMessageService.formatDuration(120000)).toBe('2 minutes');
    });

    it('should format hours correctly', () => {
      expect(StatusMessageService.formatDuration(3600000)).toBe('1 hour');
      expect(StatusMessageService.formatDuration(7200000)).toBe('2 hours');
    });

    it('should format days correctly', () => {
      expect(StatusMessageService.formatDuration(86400000)).toBe('1 day');
      expect(StatusMessageService.formatDuration(172800000)).toBe('2 days');
    });
  });

  describe('generateActiveStatusUpdates', () => {
    it('should generate active status updates for user', async () => {
      const mockActiveUpdates = [
        {
          bookId: 'book-1',
          bookTitle: 'Book 1',
          type: 'progress',
          phase: 'generation',
          percentComplete: 30,
          completedChapters: 3,
          totalChapters: 10,
          lastActivity: new Date(),
        },
        {
          bookId: 'book-2',
          bookTitle: 'Book 2',
          type: 'waiting',
          phase: 'review',
          percentComplete: 50,
          completedChapters: 5,
          totalChapters: 10,
          lastActivity: new Date(),
        },
      ];

      ProgressService.getActiveProgressUpdates.mockResolvedValue(mockActiveUpdates);

      const result = await StatusMessageService.generateActiveStatusUpdates('test-user-id');

      expect(result).toHaveLength(2);
      expect(result[0].bookTitle).toBe('Book 1');
      expect(result[0].progressIndicator).toBeDefined();
      expect(result[0].lastUpdated).toBeDefined();
      expect(result[1].bookTitle).toBe('Book 2');
    });

    it('should handle empty active updates', async () => {
      ProgressService.getActiveProgressUpdates.mockResolvedValue([]);

      const result = await StatusMessageService.generateActiveStatusUpdates('test-user-id');

      expect(result).toEqual([]);
    });
  });

  describe('generateProgressSummary', () => {
    it('should generate progress summary for user', async () => {
      const mockProgressList = [
        {
          bookId: 'book-1',
          currentPhase: 'generation',
          percentComplete: 30,
          lastActivity: new Date(),
        },
        {
          bookId: 'book-2',
          currentPhase: 'completed',
          percentComplete: 100,
          lastActivity: new Date(),
        },
      ];

      const mockBookStats = {
        total: 5,
        in_progress: 2,
        completed: 3,
        totalWords: 50000,
      };

      ProgressService.getUserProgressSummary.mockResolvedValue(mockProgressList);
      BookModel.getStatistics.mockResolvedValue(mockBookStats);

      const result = await StatusMessageService.generateProgressSummary('test-user-id');

      expect(result.type).toBe('summary');
      expect(result.icon).toBe('📊');
      expect(result.title).toBe('Your Book Creation Progress');
      expect(result.message).toContain('2 active book');
      expect(result.summary.totalBooks).toBe(5);
      expect(result.summary.activeBooks).toBe(2);
      expect(result.summary.completedBooks).toBe(3);
      expect(result.summary.totalWords).toBe(50000);
      expect(result.summary.recentActivity).toHaveLength(2);
    });
  });

  describe('generateHelpMessage', () => {
    it('should generate outline approval help', () => {
      const result = StatusMessageService.generateHelpMessage('outline_approval');

      expect(result.type).toBe('help');
      expect(result.icon).toBe('💡');
      expect(result.title).toBe('Reviewing Your Book Outline');
      expect(result.tips).toHaveLength(4);
      expect(result.tips[0]).toContain('chapter titles');
      expect(result.context).toBe('outline_approval');
    });

    it('should generate chapter review help', () => {
      const result = StatusMessageService.generateHelpMessage('chapter_review');

      expect(result.title).toBe('Reviewing Generated Chapters');
      expect(result.tips).toHaveLength(4);
      expect(result.tips[0]).toContain('consistency');
    });

    it('should generate default help for unknown context', () => {
      const result = StatusMessageService.generateHelpMessage('unknown_context');

      expect(result.title).toBe('Book Creation Help');
      expect(result.tips).toHaveLength(4);
      expect(result.context).toBe('unknown_context');
    });
  });

  describe('createErrorMessage', () => {
    it('should create error message with solution', () => {
      const result = StatusMessageService.createErrorMessage('Book not found');

      expect(result.type).toBe('error');
      expect(result.icon).toBe('⚠️');
      expect(result.title).toBe('Error');
      expect(result.message).toBe('Book not found');
      expect(result.details).toContain('deleted or you may not have access');
      expect(result.actionButtons).toHaveLength(2);
      expect(result.actionButtons[0].id).toBe('retry');
      expect(result.actionButtons[1].id).toBe('get_help');
    });

    it('should create error message with custom details', () => {
      const result = StatusMessageService.createErrorMessage('Custom error', {
        originalError: 'Detailed error information',
      });

      expect(result.message).toBe('Custom error');
      expect(result.details).toBe('Detailed error information');
    });
  });
});
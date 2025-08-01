const mongoose = require('mongoose');
const ProgressModel = require('../../models/Progress');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

describe('ProgressModel', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up any existing progress records
    await mongoose.connection.db.collection('progresses').deleteMany({});
  });

  describe('create', () => {
    it('should create a new progress tracker', async () => {
      const progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };

      const progress = await ProgressModel.create(progressData);

      expect(progress).toBeDefined();
      expect(progress.progressId).toBeDefined();
      expect(progress.bookId).toBe(progressData.bookId);
      expect(progress.user).toBe(progressData.user);
      expect(progress.totalChapters).toBe(progressData.totalChapters);
      expect(progress.currentPhase).toBe('outline');
      expect(progress.percentComplete).toBe(0);
      expect(progress.milestones).toHaveLength(1);
      expect(progress.milestones[0].phase).toBe('project_created');
    });

    it('should initialize with default values', async () => {
      const progressData = {
        bookId: 'test-book-id-2',
        user: 'test-user-id-2',
        totalChapters: 5,
      };

      const progress = await ProgressModel.create(progressData);

      expect(progress.currentChapter).toBe(0);
      expect(progress.completedChapters).toBe(0);
      expect(progress.estimatedTimeRemaining).toBe(0);
      expect(progress.statistics.totalGenerationTime).toBe(0);
      expect(progress.statistics.approvalRate).toBe(100);
      expect(progress.timeEstimates.estimatedTimePerChapter).toBe(30);
    });
  });

  describe('findByBookAndUser', () => {
    it('should find progress by book and user', async () => {
      const progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };

      const createdProgress = await ProgressModel.create(progressData);
      const foundProgress = await ProgressModel.findByBookAndUser(
        progressData.bookId,
        progressData.user,
      );

      expect(foundProgress).toBeDefined();
      expect(foundProgress.progressId).toBe(createdProgress.progressId);
      expect(foundProgress.bookId).toBe(progressData.bookId);
      expect(foundProgress.user).toBe(progressData.user);
    });

    it('should return null if progress not found', async () => {
      const progress = await ProgressModel.findByBookAndUser('nonexistent-book', 'nonexistent-user');
      expect(progress).toBeNull();
    });
  });

  describe('addMilestone', () => {
    let progressData;

    beforeEach(async () => {
      progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };
      await ProgressModel.create(progressData);
    });

    it('should add a milestone to existing progress', async () => {
      const milestoneData = {
        phase: 'outline_generated',
        metadata: { chapterCount: 10 },
      };

      const updatedProgress = await ProgressModel.addMilestone(
        progressData.bookId,
        progressData.user,
        milestoneData,
      );

      expect(updatedProgress).toBeDefined();
      expect(updatedProgress.milestones).toHaveLength(2);
      expect(updatedProgress.milestones[1].phase).toBe('outline_generated');
      expect(updatedProgress.milestones[1].metadata.chapterCount).toBe(10);
      expect(updatedProgress.milestones[1].duration).toBeGreaterThanOrEqual(0);
    });

    it('should update current phase based on milestone', async () => {
      const milestoneData = {
        phase: 'outline_approved',
      };

      const updatedProgress = await ProgressModel.addMilestone(
        progressData.bookId,
        progressData.user,
        milestoneData,
      );

      expect(updatedProgress.currentPhase).toBe('generation');
    });

    it('should update chapter progress for chapter milestones', async () => {
      const milestoneData = {
        phase: 'chapter_approved',
        chapterNumber: 3,
      };

      const updatedProgress = await ProgressModel.addMilestone(
        progressData.bookId,
        progressData.user,
        milestoneData,
      );

      expect(updatedProgress.completedChapters).toBe(3);
    });

    it('should return null if progress not found', async () => {
      const milestoneData = {
        phase: 'outline_generated',
      };

      const result = await ProgressModel.addMilestone(
        'nonexistent-book',
        'nonexistent-user',
        milestoneData,
      );

      expect(result).toBeNull();
    });
  });

  describe('updateStatistics', () => {
    let progressData;

    beforeEach(async () => {
      progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };
      await ProgressModel.create(progressData);
    });

    it('should update word count statistics', async () => {
      const statsData = {
        totalWordCount: 5000,
        completedChapters: 2,
      };

      const updatedProgress = await ProgressModel.updateStatistics(
        progressData.bookId,
        progressData.user,
        statsData,
      );

      expect(updatedProgress).toBeDefined();
      expect(updatedProgress.statistics.totalWordCount).toBe(5000);
      expect(updatedProgress.statistics.averageWordsPerChapter).toBe(2500);
    });

    it('should return null if progress not found', async () => {
      const statsData = {
        totalWordCount: 5000,
        completedChapters: 2,
      };

      const result = await ProgressModel.updateStatistics(
        'nonexistent-book',
        'nonexistent-user',
        statsData,
      );

      expect(result).toBeNull();
    });
  });

  describe('getUserProgressSummary', () => {
    beforeEach(async () => {
      // Create multiple progress records
      await ProgressModel.create({
        bookId: 'book-1',
        user: 'test-user',
        totalChapters: 10,
      });

      await ProgressModel.create({
        bookId: 'book-2',
        user: 'test-user',
        totalChapters: 5,
      });

      await ProgressModel.create({
        bookId: 'book-3',
        user: 'other-user',
        totalChapters: 8,
      });
    });

    it('should return progress summary for user', async () => {
      const summary = await ProgressModel.getUserProgressSummary('test-user');

      expect(summary).toHaveLength(2);
      expect(summary.every((p) => p.user === 'test-user')).toBe(true);
    });

    it('should filter by phase', async () => {
      const summary = await ProgressModel.getUserProgressSummary('test-user', {
        phase: 'outline',
      });

      expect(summary).toHaveLength(2);
      expect(summary.every((p) => p.currentPhase === 'outline')).toBe(true);
    });

    it('should limit results', async () => {
      const summary = await ProgressModel.getUserProgressSummary('test-user', {
        limit: 1,
      });

      expect(summary).toHaveLength(1);
    });
  });

  describe('deleteByBookAndUser', () => {
    it('should delete progress tracker', async () => {
      const progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };

      await ProgressModel.create(progressData);

      const deleted = await ProgressModel.deleteByBookAndUser(
        progressData.bookId,
        progressData.user,
      );

      expect(deleted).toBe(true);

      const found = await ProgressModel.findByBookAndUser(progressData.bookId, progressData.user);
      expect(found).toBeNull();
    });

    it('should return false if progress not found', async () => {
      const deleted = await ProgressModel.deleteByBookAndUser('nonexistent-book', 'nonexistent-user');
      expect(deleted).toBe(false);
    });
  });

  describe('getDetailedAnalytics', () => {
    let progressData;

    beforeEach(async () => {
      progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };
      await ProgressModel.create(progressData);

      // Add some milestones
      await ProgressModel.addMilestone(progressData.bookId, progressData.user, {
        phase: 'outline_generated',
      });
      await ProgressModel.addMilestone(progressData.bookId, progressData.user, {
        phase: 'outline_approved',
      });
      await ProgressModel.addMilestone(progressData.bookId, progressData.user, {
        phase: 'chapter_generated',
        chapterNumber: 1,
      });
    });

    it('should return detailed analytics', async () => {
      const analytics = await ProgressModel.getDetailedAnalytics(
        progressData.bookId,
        progressData.user,
      );

      expect(analytics).toBeDefined();
      expect(analytics.progressId).toBeDefined();
      expect(analytics.phaseBreakdown).toBeDefined();
      expect(analytics.timelineAnalysis).toBeDefined();
      expect(analytics.productivityMetrics).toBeDefined();
      expect(analytics.milestones).toHaveLength(4); // Including initial project_created
    });

    it('should return null if progress not found', async () => {
      const analytics = await ProgressModel.getDetailedAnalytics('nonexistent-book', 'nonexistent-user');
      expect(analytics).toBeNull();
    });
  });

  describe('helper methods', () => {
    describe('getPhaseFromMilestone', () => {
      it('should map milestone phases to current phases correctly', () => {
        expect(ProgressModel.getPhaseFromMilestone('project_created')).toBe('outline');
        expect(ProgressModel.getPhaseFromMilestone('outline_generated')).toBe('outline');
        expect(ProgressModel.getPhaseFromMilestone('outline_approved')).toBe('generation');
        expect(ProgressModel.getPhaseFromMilestone('chapter_generated')).toBe('review');
        expect(ProgressModel.getPhaseFromMilestone('chapter_approved')).toBe('generation');
        expect(ProgressModel.getPhaseFromMilestone('book_completed')).toBe('completed');
        expect(ProgressModel.getPhaseFromMilestone('unknown_phase')).toBe('generation');
      });
    });

    describe('calculatePhaseBreakdown', () => {
      it('should calculate phase breakdown from milestones', () => {
        const milestones = [
          { phase: 'project_created', duration: 0 },
          { phase: 'outline_generated', duration: 1000 },
          { phase: 'outline_approved', duration: 500 },
          { phase: 'chapter_generated', duration: 2000 },
          { phase: 'chapter_approved', duration: 300 },
        ];

        const breakdown = ProgressModel.calculatePhaseBreakdown(milestones);

        expect(breakdown.outline).toBe(1500); // outline_generated + outline_approved
        expect(breakdown.generation).toBe(300); // chapter_approved
        expect(breakdown.review).toBe(2000); // chapter_generated
        expect(breakdown.completed).toBe(0);
      });
    });

    describe('calculateTimelineAnalysis', () => {
      it('should calculate timeline analysis from milestones', () => {
        const milestones = [
          { phase: 'project_created', duration: 0 },
          { phase: 'outline_generated', duration: 1000 },
          { phase: 'chapter_generated', duration: 2000 },
        ];

        const analysis = ProgressModel.calculateTimelineAnalysis(milestones);

        expect(analysis.totalTime).toBe(3000);
        expect(analysis.averageMilestoneTime).toBe(1000);
        expect(analysis.longestPhase.phase).toBe('chapter_generated');
        expect(analysis.longestPhase.time).toBe(2000);
        expect(analysis.shortestPhase.phase).toBe('project_created');
        expect(analysis.shortestPhase.time).toBe(0);
      });

      it('should handle empty milestones array', () => {
        const analysis = ProgressModel.calculateTimelineAnalysis([]);

        expect(analysis.totalTime).toBe(0);
        expect(analysis.averageMilestoneTime).toBe(0);
        expect(analysis.longestPhase).toBeNull();
        expect(analysis.shortestPhase).toBeNull();
      });
    });
  });

  describe('schema validation and middleware', () => {
    it('should calculate percentage complete on save', async () => {
      const progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };

      const progress = await ProgressModel.create(progressData);

      // Add milestone to trigger completion calculation
      const updatedProgress = await ProgressModel.addMilestone(
        progressData.bookId,
        progressData.user,
        {
          phase: 'chapter_approved',
          chapterNumber: 3,
        },
      );

      expect(updatedProgress.percentComplete).toBe(30); // 3/10 * 100
    });

    it('should update last activity on save', async () => {
      const progressData = {
        bookId: 'test-book-id',
        user: 'test-user-id',
        totalChapters: 10,
      };

      const progress = await ProgressModel.create(progressData);
      const originalLastActivity = progress.lastActivity;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedProgress = await ProgressModel.addMilestone(
        progressData.bookId,
        progressData.user,
        {
          phase: 'outline_generated',
        },
      );

      expect(updatedProgress.lastActivity.getTime()).toBeGreaterThan(
        originalLastActivity.getTime(),
      );
    });
  });
});
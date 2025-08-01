const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { v4: uuidv4 } = require('uuid');

// Define the progress schema for detailed tracking
const progressSchema = new mongoose.Schema(
  {
    progressId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    bookId: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    currentPhase: {
      type: String,
      enum: ['outline', 'generation', 'review', 'completed', 'cancelled'],
      default: 'outline',
      index: true,
    },
    currentChapter: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedChapters: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalChapters: {
      type: Number,
      required: true,
      min: 1,
    },
    percentComplete: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    estimatedTimeRemaining: {
      type: Number, // in minutes
      default: 0,
      min: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
    milestones: [
      {
        phase: {
          type: String,
          enum: [
            'project_created',
            'outline_generated',
            'outline_approved',
            'chapter_generation_started',
            'chapter_generated',
            'chapter_approved',
            'chapter_rejected',
            'chapter_regenerated',
            'book_completed',
            'book_exported',
            'book_cancelled',
          ],
          required: true,
        },
        chapterNumber: {
          type: Number,
          min: 0,
        },
        completedAt: {
          type: Date,
          default: Date.now,
        },
        duration: {
          type: Number, // milliseconds from previous milestone
          min: 0,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    statistics: {
      totalGenerationTime: {
        type: Number, // milliseconds
        default: 0,
      },
      averageChapterTime: {
        type: Number, // milliseconds
        default: 0,
      },
      totalWordCount: {
        type: Number,
        default: 0,
      },
      averageWordsPerChapter: {
        type: Number,
        default: 0,
      },
      approvalRate: {
        type: Number, // percentage
        default: 100,
        min: 0,
        max: 100,
      },
      regenerationCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    timeEstimates: {
      estimatedTotalTime: {
        type: Number, // minutes
        default: 0,
      },
      estimatedTimePerChapter: {
        type: Number, // minutes
        default: 30, // default estimate
      },
      actualTimePerChapter: {
        type: Number, // minutes (calculated from milestones)
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for efficient queries
progressSchema.index({ bookId: 1, user: 1 }, { unique: true });
progressSchema.index({ user: 1, currentPhase: 1 });
progressSchema.index({ user: 1, lastActivity: -1 });
progressSchema.index({ currentPhase: 1, lastActivity: -1 });

// Virtual for completion status
progressSchema.virtual('isCompleted').get(function () {
  return this.currentPhase === 'completed';
});

// Virtual for time since last activity
progressSchema.virtual('timeSinceLastActivity').get(function () {
  return Date.now() - this.lastActivity.getTime();
});

// Pre-save middleware to calculate progress metrics
progressSchema.pre('save', function (next) {
  // Calculate percentage complete
  if (this.totalChapters > 0) {
    this.percentComplete = Math.round((this.completedChapters / this.totalChapters) * 100);
  }

  // Update last activity
  this.lastActivity = new Date();

  // Calculate statistics if we have milestones
  if (this.milestones && this.milestones.length > 0) {
    this.calculateStatistics();
  }

  // Estimate remaining time
  this.calculateTimeEstimates();

  next();
});

// Method to calculate statistics from milestones
progressSchema.methods.calculateStatistics = function () {
  const chapterMilestones = this.milestones.filter(
    (m) => m.phase === 'chapter_generated' || m.phase === 'chapter_approved',
  );

  if (chapterMilestones.length > 0) {
    // Calculate total generation time
    this.statistics.totalGenerationTime = chapterMilestones.reduce(
      (total, milestone) => total + (milestone.duration || 0),
      0,
    );

    // Calculate average chapter time
    this.statistics.averageChapterTime =
      this.statistics.totalGenerationTime / chapterMilestones.length;

    // Calculate actual time per chapter in minutes
    this.timeEstimates.actualTimePerChapter = Math.round(
      this.statistics.averageChapterTime / (1000 * 60),
    );
  }

  // Calculate regeneration count
  this.statistics.regenerationCount = this.milestones.filter(
    (m) => m.phase === 'chapter_regenerated',
  ).length;

  // Calculate approval rate
  const approvedChapters = this.milestones.filter((m) => m.phase === 'chapter_approved').length;
  const rejectedChapters = this.milestones.filter((m) => m.phase === 'chapter_rejected').length;
  const totalChapterDecisions = approvedChapters + rejectedChapters;

  if (totalChapterDecisions > 0) {
    this.statistics.approvalRate = Math.round((approvedChapters / totalChapterDecisions) * 100);
  }
};

// Method to calculate time estimates
progressSchema.methods.calculateTimeEstimates = function () {
  const remainingChapters = this.totalChapters - this.completedChapters;

  // Use actual time per chapter if available, otherwise use estimate
  const timePerChapter =
    this.timeEstimates.actualTimePerChapter > 0
      ? this.timeEstimates.actualTimePerChapter
      : this.timeEstimates.estimatedTimePerChapter;

  this.estimatedTimeRemaining = remainingChapters * timePerChapter;
  this.timeEstimates.estimatedTotalTime = this.totalChapters * timePerChapter;
};

// Create the Progress model
const Progress = mongoose.models.Progress || mongoose.model('Progress', progressSchema);

/**
 * Progress model operations for the MCP server
 */
class ProgressModel {
  /**
   * Create a new progress tracker
   * @param {Object} progressData - Progress creation data
   * @param {string} progressData.bookId - Book ID
   * @param {string} progressData.user - User ID
   * @param {number} progressData.totalChapters - Total number of chapters
   * @returns {Promise<Object>} Created progress document
   */
  static async create(progressData) {
    try {
      const progressId = uuidv4();

      const progress = new Progress({
        progressId,
        bookId: progressData.bookId,
        user: progressData.user,
        currentPhase: 'outline',
        totalChapters: progressData.totalChapters,
        milestones: [
          {
            phase: 'project_created',
            completedAt: new Date(),
            duration: 0,
            metadata: {
              totalChapters: progressData.totalChapters,
            },
          },
        ],
      });

      const savedProgress = await progress.save();
      logger.info(
        `[ProgressModel] Created progress tracker: ${progressId} for book: ${progressData.bookId}`,
      );

      return savedProgress.toObject();
    } catch (error) {
      logger.error('[ProgressModel] Error creating progress tracker:', error);
      throw error;
    }
  }

  /**
   * Find progress by book ID and user
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Progress document or null
   */
  static async findByBookAndUser(bookId, userId) {
    try {
      const progress = await Progress.findOne({ bookId, user: userId }).lean();
      return progress;
    } catch (error) {
      logger.error('[ProgressModel] Error finding progress:', error);
      throw error;
    }
  }

  /**
   * Add a milestone to progress tracking
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} milestoneData - Milestone data
   * @param {string} milestoneData.phase - Milestone phase
   * @param {number} milestoneData.chapterNumber - Chapter number (optional)
   * @param {Object} milestoneData.metadata - Additional metadata (optional)
   * @returns {Promise<Object|null>} Updated progress document or null
   */
  static async addMilestone(bookId, userId, milestoneData) {
    try {
      const progress = await Progress.findOne({ bookId, user: userId });
      if (!progress) {
        logger.warn(`[ProgressModel] Progress not found for book: ${bookId}, user: ${userId}`);
        return null;
      }

      // Calculate duration from last milestone
      const lastMilestone = progress.milestones[progress.milestones.length - 1];
      const duration = lastMilestone ? Date.now() - lastMilestone.completedAt.getTime() : 0;

      // Add new milestone
      const newMilestone = {
        phase: milestoneData.phase,
        chapterNumber: milestoneData.chapterNumber,
        completedAt: new Date(),
        duration,
        metadata: milestoneData.metadata || {},
      };

      progress.milestones.push(newMilestone);

      // Update current phase based on milestone
      progress.currentPhase = this.getPhaseFromMilestone(milestoneData.phase);

      // Update chapter progress if applicable
      if (milestoneData.phase === 'chapter_approved') {
        progress.completedChapters = Math.max(
          progress.completedChapters,
          milestoneData.chapterNumber || 0,
        );
      }

      if (milestoneData.phase === 'chapter_generated') {
        progress.currentChapter = milestoneData.chapterNumber || progress.currentChapter;
      }

      const savedProgress = await progress.save();
      logger.info(`[ProgressModel] Added milestone: ${milestoneData.phase} for book: ${bookId}`);

      return savedProgress.toObject();
    } catch (error) {
      logger.error('[ProgressModel] Error adding milestone:', error);
      throw error;
    }
  }

  /**
   * Update progress statistics
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} statsData - Statistics update data
   * @returns {Promise<Object|null>} Updated progress document or null
   */
  static async updateStatistics(bookId, userId, statsData) {
    try {
      const updateFields = {};

      if (statsData.totalWordCount !== undefined) {
        updateFields['statistics.totalWordCount'] = statsData.totalWordCount;
        updateFields['statistics.averageWordsPerChapter'] = Math.round(
          statsData.totalWordCount / Math.max(statsData.completedChapters || 1, 1),
        );
      }

      const progress = await Progress.findOneAndUpdate({ bookId, user: userId }, updateFields, {
        new: true,
        runValidators: true,
      });

      return progress ? progress.toObject() : null;
    } catch (error) {
      logger.error('[ProgressModel] Error updating statistics:', error);
      throw error;
    }
  }

  /**
   * Get progress summary for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} options.phase - Filter by phase
   * @param {number} options.limit - Limit results
   * @returns {Promise<Array>} Array of progress summaries
   */
  static async getUserProgressSummary(userId, options = {}) {
    try {
      const query = { user: userId };

      if (options.phase) {
        query.currentPhase = options.phase;
      }

      let dbQuery = Progress.find(query)
        .select(
          'bookId currentPhase percentComplete estimatedTimeRemaining lastActivity statistics',
        )
        .sort({ lastActivity: -1 });

      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const progressList = await dbQuery.lean();
      return progressList;
    } catch (error) {
      logger.error('[ProgressModel] Error getting user progress summary:', error);
      throw error;
    }
  }

  /**
   * Delete progress tracker
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async deleteByBookAndUser(bookId, userId) {
    try {
      const result = await Progress.deleteOne({ bookId, user: userId });

      if (result.deletedCount > 0) {
        logger.info(`[ProgressModel] Deleted progress tracker for book: ${bookId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[ProgressModel] Error deleting progress tracker:', error);
      throw error;
    }
  }

  /**
   * Get detailed progress analytics
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Detailed progress analytics
   */
  static async getDetailedAnalytics(bookId, userId) {
    try {
      const progress = await Progress.findOne({ bookId, user: userId }).lean();
      if (!progress) {
        return null;
      }

      // Calculate additional analytics
      const analytics = {
        ...progress,
        phaseBreakdown: this.calculatePhaseBreakdown(progress.milestones),
        timelineAnalysis: this.calculateTimelineAnalysis(progress.milestones),
        productivityMetrics: this.calculateProductivityMetrics(progress),
      };

      return analytics;
    } catch (error) {
      logger.error('[ProgressModel] Error getting detailed analytics:', error);
      throw error;
    }
  }

  /**
   * Helper method to determine phase from milestone
   * @param {string} milestonePhase - Milestone phase
   * @returns {string} Current phase
   */
  static getPhaseFromMilestone(milestonePhase) {
    const phaseMap = {
      project_created: 'outline',
      outline_generated: 'outline',
      outline_approved: 'generation',
      chapter_generation_started: 'generation',
      chapter_generated: 'review',
      chapter_approved: 'generation',
      chapter_rejected: 'review',
      chapter_regenerated: 'review',
      book_completed: 'completed',
      book_exported: 'completed',
      book_cancelled: 'cancelled',
    };

    return phaseMap[milestonePhase] || 'generation';
  }

  /**
   * Calculate phase breakdown from milestones
   * @param {Array} milestones - Array of milestones
   * @returns {Object} Phase breakdown statistics
   */
  static calculatePhaseBreakdown(milestones) {
    const breakdown = {
      outline: 0,
      generation: 0,
      review: 0,
      completed: 0,
    };

    milestones.forEach((milestone) => {
      const phase = this.getPhaseFromMilestone(milestone.phase);
      breakdown[phase] += milestone.duration || 0;
    });

    return breakdown;
  }

  /**
   * Calculate timeline analysis from milestones
   * @param {Array} milestones - Array of milestones
   * @returns {Object} Timeline analysis
   */
  static calculateTimelineAnalysis(milestones) {
    if (milestones.length === 0) {
      return { totalTime: 0, averageMilestoneTime: 0, longestPhase: null, shortestPhase: null };
    }

    const totalTime = milestones.reduce((sum, milestone) => sum + (milestone.duration || 0), 0);
    const averageMilestoneTime = totalTime / milestones.length;

    // Find longest and shortest phases
    const phaseTimes = {};
    milestones.forEach((milestone) => {
      if (!phaseTimes[milestone.phase]) {
        phaseTimes[milestone.phase] = 0;
      }
      phaseTimes[milestone.phase] += milestone.duration || 0;
    });

    const phases = Object.entries(phaseTimes);
    const longestPhase = phases.reduce(
      (max, [phase, time]) => (time > max.time ? { phase, time } : max),
      { phase: null, time: 0 },
    );
    const shortestPhase = phases.reduce(
      (min, [phase, time]) => (time < min.time ? { phase, time } : min),
      { phase: null, time: Infinity },
    );

    return {
      totalTime,
      averageMilestoneTime,
      longestPhase: longestPhase.phase ? longestPhase : null,
      shortestPhase: shortestPhase.phase && shortestPhase.time !== Infinity ? shortestPhase : null,
    };
  }

  /**
   * Calculate productivity metrics with memory optimization
   * @param {Object} progress - Progress document
   * @returns {Object} Productivity metrics
   */
  static calculateProductivityMetrics(progress) {
    const metrics = {
      chaptersPerDay: 0,
      wordsPerDay: 0,
      efficiency: 0, // percentage based on estimated vs actual time
    };

    const milestoneCount = progress.milestones?.length || 0;
    if (milestoneCount > 1) {
      const firstMilestone = progress.milestones[0];
      const lastMilestone = progress.milestones[milestoneCount - 1];

      // Use more efficient time calculation
      const timeDiff = lastMilestone.completedAt.getTime() - firstMilestone.completedAt.getTime();
      const totalDays = Math.max(1, timeDiff / (1000 * 60 * 60 * 24));

      metrics.chaptersPerDay = (progress.completedChapters || 0) / totalDays;
      metrics.wordsPerDay = (progress.statistics?.totalWordCount || 0) / totalDays;

      // Calculate efficiency with null checks
      const actualTime = progress.timeEstimates?.actualTimePerChapter;
      const estimatedTime = progress.timeEstimates?.estimatedTimePerChapter;

      if (actualTime > 0 && estimatedTime > 0) {
        metrics.efficiency = Math.round((estimatedTime / actualTime) * 100);
      }
    }

    return metrics;
  }
}

module.exports = ProgressModel;

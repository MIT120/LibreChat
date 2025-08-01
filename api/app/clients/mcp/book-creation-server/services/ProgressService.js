const ProgressModel = require('../models/Progress');
const BookModel = require('../models/Book');
const ChapterModel = require('../models/Chapter');
const { logger } = require('@librechat/data-schemas');

/**
 * Service for managing book creation progress tracking
 *
 * This service handles all progress-related operations including:
 * - Milestone tracking (outline generation, chapter completion, etc.)
 * - Progress analytics and statistics
 * - Status message generation for UI feedback
 * - Time estimation and completion prediction
 *
 * @class ProgressService
 * @since 1.0.0
 */
class ProgressService {
  /**
   * Initialize progress tracking for a new book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} totalChapters - Total number of chapters
   * @returns {Promise<Object>} Created progress tracker
   */
  static async initializeProgress(bookId, userId, totalChapters) {
    try {
      logger.info(`[ProgressService] Initializing progress for book: ${bookId}`);

      const progress = await ProgressModel.create({
        bookId,
        user: userId,
        totalChapters,
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error initializing progress:', error);
      throw error;
    }
  }

  /**
   * Record outline generation milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordOutlineGenerated(bookId, userId, metadata = {}) {
    try {
      logger.info(`[ProgressService] Recording outline generated for book: ${bookId}`);

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'outline_generated',
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording outline generated:', error);
      throw error;
    }
  }

  /**
   * Record outline approval milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordOutlineApproved(bookId, userId, metadata = {}) {
    try {
      logger.info(`[ProgressService] Recording outline approved for book: ${bookId}`);

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'outline_approved',
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording outline approved:', error);
      throw error;
    }
  }

  /**
   * Record chapter generation start milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} chapterNumber - Chapter number
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordChapterGenerationStarted(bookId, userId, chapterNumber, metadata = {}) {
    try {
      logger.info(
        `[ProgressService] Recording chapter generation started for book: ${bookId}, chapter: ${chapterNumber}`,
      );

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'chapter_generation_started',
        chapterNumber,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording chapter generation started:', error);
      throw error;
    }
  }

  /**
   * Record chapter generation completion milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} chapterNumber - Chapter number
   * @param {Object} metadata - Additional metadata (wordCount, etc.)
   * @returns {Promise<Object>} Updated progress
   */
  static async recordChapterGenerated(bookId, userId, chapterNumber, metadata = {}) {
    try {
      logger.info(
        `[ProgressService] Recording chapter generated for book: ${bookId}, chapter: ${chapterNumber}`,
      );

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'chapter_generated',
        chapterNumber,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      // Update statistics with word count if provided
      if (metadata.wordCount) {
        await this.updateWordCountStatistics(bookId, userId);
      }

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording chapter generated:', error);
      throw error;
    }
  }

  /**
   * Record chapter approval milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} chapterNumber - Chapter number
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordChapterApproved(bookId, userId, chapterNumber, metadata = {}) {
    try {
      logger.info(
        `[ProgressService] Recording chapter approved for book: ${bookId}, chapter: ${chapterNumber}`,
      );

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'chapter_approved',
        chapterNumber,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      // Update word count statistics
      await this.updateWordCountStatistics(bookId, userId);

      // Check if book is completed
      await this.checkBookCompletion(bookId, userId);

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording chapter approved:', error);
      throw error;
    }
  }

  /**
   * Record chapter rejection milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} chapterNumber - Chapter number
   * @param {Object} metadata - Additional metadata (feedback, etc.)
   * @returns {Promise<Object>} Updated progress
   */
  static async recordChapterRejected(bookId, userId, chapterNumber, metadata = {}) {
    try {
      logger.info(
        `[ProgressService] Recording chapter rejected for book: ${bookId}, chapter: ${chapterNumber}`,
      );

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'chapter_rejected',
        chapterNumber,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording chapter rejected:', error);
      throw error;
    }
  }

  /**
   * Record chapter regeneration milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} chapterNumber - Chapter number
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordChapterRegenerated(bookId, userId, chapterNumber, metadata = {}) {
    try {
      logger.info(
        `[ProgressService] Recording chapter regenerated for book: ${bookId}, chapter: ${chapterNumber}`,
      );

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'chapter_regenerated',
        chapterNumber,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording chapter regenerated:', error);
      throw error;
    }
  }

  /**
   * Record book completion milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated progress
   */
  static async recordBookCompleted(bookId, userId, metadata = {}) {
    try {
      logger.info(`[ProgressService] Recording book completed for book: ${bookId}`);

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'book_completed',
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording book completed:', error);
      throw error;
    }
  }

  /**
   * Record book export milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} metadata - Additional metadata (format, etc.)
   * @returns {Promise<Object>} Updated progress
   */
  static async recordBookExported(bookId, userId, metadata = {}) {
    try {
      logger.info(`[ProgressService] Recording book exported for book: ${bookId}`);

      const progress = await ProgressModel.addMilestone(bookId, userId, {
        phase: 'book_exported',
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error recording book exported:', error);
      throw error;
    }
  }

  /**
   * Get current progress for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Current progress or null
   */
  static async getCurrentProgress(bookId, userId) {
    try {
      const progress = await ProgressModel.findByBookAndUser(bookId, userId);
      return progress;
    } catch (error) {
      logger.error('[ProgressService] Error getting current progress:', error);
      throw error;
    }
  }

  /**
   * Get detailed progress analytics
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Detailed analytics or null
   */
  static async getDetailedAnalytics(bookId, userId) {
    try {
      const analytics = await ProgressModel.getDetailedAnalytics(bookId, userId);
      return analytics;
    } catch (error) {
      logger.error('[ProgressService] Error getting detailed analytics:', error);
      throw error;
    }
  }

  /**
   * Get progress summary for all user's books
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of progress summaries
   */
  static async getUserProgressSummary(userId, options = {}) {
    try {
      const progressList = await ProgressModel.getUserProgressSummary(userId, options);
      return progressList;
    } catch (error) {
      logger.error('[ProgressService] Error getting user progress summary:', error);
      throw error;
    }
  }

  /**
   * Update word count statistics
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async updateWordCountStatistics(bookId, userId) {
    try {
      // Get chapter statistics from ChapterModel
      const chapterStats = await ChapterModel.getBookStatistics(bookId, userId);

      // Get current progress
      const progress = await ProgressModel.findByBookAndUser(bookId, userId);
      if (!progress) {
        return;
      }

      // Update progress statistics
      await ProgressModel.updateStatistics(bookId, userId, {
        totalWordCount: chapterStats.totalWords,
        completedChapters: chapterStats.approved,
      });

      // Also update the book model's metadata
      await BookModel.updateProgress(bookId, userId, {
        wordCount: chapterStats.totalWords,
        completedChapters: chapterStats.approved,
      });

      logger.info(`[ProgressService] Updated word count statistics for book: ${bookId}`);
    } catch (error) {
      logger.error('[ProgressService] Error updating word count statistics:', error);
      throw error;
    }
  }

  /**
   * Check if book is completed and record milestone
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if book was completed
   */
  static async checkBookCompletion(bookId, userId) {
    try {
      const progress = await ProgressModel.findByBookAndUser(bookId, userId);
      if (!progress) {
        return false;
      }

      // Check if all chapters are completed
      if (progress.completedChapters >= progress.totalChapters) {
        // Record completion milestone if not already recorded
        const hasCompletionMilestone = progress.milestones.some(
          (m) => m.phase === 'book_completed',
        );

        if (!hasCompletionMilestone) {
          await this.recordBookCompleted(bookId, userId, {
            totalChapters: progress.totalChapters,
            totalWordCount: progress.statistics.totalWordCount,
          });

          // Update book status
          await BookModel.updateByIdAndUser(bookId, userId, { status: 'completed' });

          logger.info(`[ProgressService] Book completed: ${bookId}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[ProgressService] Error checking book completion:', error);
      throw error;
    }
  }

  /**
   * Generate progress status message for chat interface
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Status message object
   */
  static async generateStatusMessage(bookId, userId) {
    try {
      const progress = await ProgressModel.findByBookAndUser(bookId, userId);
      if (!progress) {
        return {
          type: 'error',
          message: 'Progress tracking not found for this book.',
        };
      }

      const book = await BookModel.findByIdAndUser(bookId, userId);
      if (!book) {
        return {
          type: 'error',
          message: 'Book not found.',
        };
      }

      // Generate status message based on current phase
      const statusMessage = this.formatStatusMessage(progress, book);

      return statusMessage;
    } catch (error) {
      logger.error('[ProgressService] Error generating status message:', error);
      return {
        type: 'error',
        message: 'Error retrieving progress status.',
      };
    }
  }

  /**
   * Format status message for different phases
   * @param {Object} progress - Progress document
   * @param {Object} book - Book document
   * @returns {Object} Formatted status message
   */
  static formatStatusMessage(progress, book) {
    const {
      currentPhase,
      percentComplete,
      completedChapters,
      totalChapters,
      estimatedTimeRemaining,
    } = progress;

    const baseMessage = {
      bookTitle: book.title,
      bookId: book.bookId,
      phase: currentPhase,
      percentComplete,
      completedChapters,
      totalChapters,
      estimatedTimeRemaining,
    };

    switch (currentPhase) {
      case 'outline':
        return {
          ...baseMessage,
          type: 'info',
          message: `📝 **${book.title}** - Outline phase`,
          details: 'Waiting for outline approval to begin chapter generation.',
          action: 'Review and approve the book outline to continue.',
        };

      case 'generation':
        return {
          ...baseMessage,
          type: 'progress',
          message: `✍️ **${book.title}** - Generating chapters (${completedChapters}/${totalChapters})`,
          details: `${percentComplete}% complete. Estimated time remaining: ${Math.round(estimatedTimeRemaining)} minutes.`,
          action:
            completedChapters < totalChapters
              ? 'Chapter generation in progress...'
              : 'Ready for next chapter approval.',
        };

      case 'review':
        return {
          ...baseMessage,
          type: 'waiting',
          message: `👀 **${book.title}** - Waiting for chapter approval`,
          details: `Chapter ${progress.currentChapter} is ready for review.`,
          action: 'Please review and approve or reject the current chapter.',
        };

      case 'completed':
        return {
          ...baseMessage,
          type: 'success',
          message: `🎉 **${book.title}** - Book completed!`,
          details: `All ${totalChapters} chapters completed. Total word count: ${progress.statistics.totalWordCount.toLocaleString()} words.`,
          action: 'Your book is ready for export in various formats.',
        };

      case 'cancelled':
        return {
          ...baseMessage,
          type: 'warning',
          message: `❌ **${book.title}** - Book cancelled`,
          details: 'Book creation was cancelled.',
          action: 'You can restart this book or create a new one.',
        };

      default:
        return {
          ...baseMessage,
          type: 'info',
          message: `📚 **${book.title}** - In progress`,
          details: `${percentComplete}% complete (${completedChapters}/${totalChapters} chapters).`,
          action: 'Book creation is in progress.',
        };
    }
  }

  /**
   * Delete progress tracking for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async deleteProgress(bookId, userId) {
    try {
      const deleted = await ProgressModel.deleteByBookAndUser(bookId, userId);

      if (deleted) {
        logger.info(`[ProgressService] Deleted progress tracking for book: ${bookId}`);
      }

      return deleted;
    } catch (error) {
      logger.error('[ProgressService] Error deleting progress:', error);
      throw error;
    }
  }

  /**
   * Get real-time progress updates for active books
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of active progress updates
   */
  static async getActiveProgressUpdates(userId) {
    try {
      const activeProgress = await ProgressModel.getUserProgressSummary(userId, {
        phase: ['generation', 'review'],
        limit: 10,
      });

      const updates = [];
      for (const progress of activeProgress) {
        const book = await BookModel.findByIdAndUser(progress.bookId, userId);
        if (book) {
          const statusMessage = this.formatStatusMessage(progress, book);
          updates.push(statusMessage);
        }
      }

      return updates;
    } catch (error) {
      logger.error('[ProgressService] Error getting active progress updates:', error);
      throw error;
    }
  }
}

module.exports = ProgressService;

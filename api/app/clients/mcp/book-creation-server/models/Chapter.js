const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { v4: uuidv4 } = require('uuid');

// Define the chapter schema directly for now
const chapterSchema = new mongoose.Schema(
  {
    chapterId: {
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
    chapterNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 50000, // ~25,000 words max
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    generationContext: {
      previousSummaries: [
        {
          type: String,
          maxlength: 2000,
        },
      ],
      styleInstructions: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      specificRequirements: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for efficient queries
chapterSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ user: 1, status: 1 });
chapterSchema.index({ bookId: 1, status: 1 });
chapterSchema.index({ chapterId: 1, user: 1 }, { unique: true });

// Virtual for estimated reading time (assuming 200 words per minute)
chapterSchema.virtual('estimatedReadingTime').get(function () {
  return Math.ceil(this.wordCount / 200);
});

// Pre-save middleware to calculate word count
chapterSchema.pre('save', function (next) {
  // Always recalculate word count when content exists
  if (this.content) {
    this.wordCount = this.content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  // Set approval/rejection timestamps
  if (this.isModified('status')) {
    if (this.status === 'approved' && !this.approvedAt) {
      this.approvedAt = new Date();
      this.rejectedAt = undefined;
    } else if (this.status === 'rejected' && !this.rejectedAt) {
      this.rejectedAt = new Date();
      this.approvedAt = undefined;
    } else if (this.status === 'pending') {
      this.approvedAt = undefined;
      this.rejectedAt = undefined;
    }
  }

  next();
});

// Also add pre-findOneAndUpdate middleware to handle updates
chapterSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update && update.content) {
    update.wordCount = update.content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
  next();
});

// Create the Chapter model
const Chapter = mongoose.models.Chapter || mongoose.model('Chapter', chapterSchema);

/**
 * Chapter model operations for the MCP server
 */
class ChapterModel {
  /**
   * Create a new chapter
   * @param {Object} chapterData - Chapter creation data
   * @param {string} chapterData.bookId - Book ID
   * @param {string} chapterData.user - User ID
   * @param {number} chapterData.chapterNumber - Chapter number
   * @param {string} chapterData.title - Chapter title
   * @param {string} chapterData.content - Chapter content
   * @param {Object} chapterData.generationContext - Generation context
   * @returns {Promise<Object>} Created chapter document
   */
  static async create(chapterData) {
    try {
      const chapterId = uuidv4();

      const chapter = new Chapter({
        chapterId,
        bookId: chapterData.bookId,
        user: chapterData.user,
        chapterNumber: chapterData.chapterNumber,
        title: chapterData.title,
        content: chapterData.content,
        status: 'pending',
        generationContext: {
          previousSummaries: chapterData.generationContext?.previousSummaries || [],
          styleInstructions: chapterData.generationContext?.styleInstructions || '',
          specificRequirements: chapterData.generationContext?.specificRequirements || '',
        },
      });

      const savedChapter = await chapter.save();
      logger.info(`[ChapterModel] Created chapter: ${chapterId} for book: ${chapterData.bookId}`);

      return savedChapter.toObject();
    } catch (error) {
      logger.error('[ChapterModel] Error creating chapter:', error);
      throw error;
    }
  }

  /**
   * Find a chapter by ID and user
   * @param {string} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Chapter document or null
   */
  static async findByIdAndUser(chapterId, userId) {
    try {
      const chapter = await Chapter.findOne({ chapterId, user: userId }).lean();
      return chapter;
    } catch (error) {
      logger.error('[ChapterModel] Error finding chapter:', error);
      throw error;
    }
  }

  /**
   * Find chapters by book ID
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {boolean} options.sortByNumber - Sort by chapter number
   * @returns {Promise<Array>} Array of chapter documents
   */
  static async findByBook(bookId, userId, options = {}) {
    try {
      const query = { bookId, user: userId };

      if (options.status) {
        query.status = options.status;
      }

      let dbQuery = Chapter.find(query);

      if (options.sortByNumber) {
        dbQuery = dbQuery.sort({ chapterNumber: 1 });
      } else {
        dbQuery = dbQuery.sort({ createdAt: 1 });
      }

      const chapters = await dbQuery.lean();
      return chapters;
    } catch (error) {
      logger.error('[ChapterModel] Error finding chapters by book:', error);
      throw error;
    }
  }

  /**
   * Update a chapter
   * @param {string} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object|null>} Updated chapter document or null
   */
  static async updateByIdAndUser(chapterId, userId, updateData) {
    try {
      const chapter = await Chapter.findOneAndUpdate({ chapterId, user: userId }, updateData, {
        new: true,
        runValidators: true,
      });

      if (chapter) {
        logger.info(`[ChapterModel] Updated chapter: ${chapterId} for user: ${userId}`);
      }

      return chapter ? chapter.toObject() : null;
    } catch (error) {
      logger.error('[ChapterModel] Error updating chapter:', error);
      throw error;
    }
  }

  /**
   * Delete a chapter
   * @param {string} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async deleteByIdAndUser(chapterId, userId) {
    try {
      const result = await Chapter.deleteOne({ chapterId, user: userId });

      if (result.deletedCount > 0) {
        logger.info(`[ChapterModel] Deleted chapter: ${chapterId} for user: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[ChapterModel] Error deleting chapter:', error);
      throw error;
    }
  }

  /**
   * Delete all chapters for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of deleted chapters
   */
  static async deleteByBook(bookId, userId) {
    try {
      const result = await Chapter.deleteMany({ bookId, user: userId });

      if (result.deletedCount > 0) {
        logger.info(`[ChapterModel] Deleted ${result.deletedCount} chapters for book: ${bookId}`);
      }

      return result.deletedCount;
    } catch (error) {
      logger.error('[ChapterModel] Error deleting chapters by book:', error);
      throw error;
    }
  }

  /**
   * Approve a chapter
   * @param {string} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @param {string} summary - Chapter summary
   * @returns {Promise<Object|null>} Updated chapter document or null
   */
  static async approve(chapterId, userId, summary = '') {
    try {
      const chapter = await Chapter.findOneAndUpdate(
        { chapterId, user: userId, status: 'pending' },
        {
          status: 'approved',
          summary: summary,
          approvedAt: new Date(),
          rejectedAt: undefined,
        },
        { new: true, runValidators: true },
      );

      if (chapter) {
        logger.info(`[ChapterModel] Approved chapter: ${chapterId}`);
      }

      return chapter ? chapter.toObject() : null;
    } catch (error) {
      logger.error('[ChapterModel] Error approving chapter:', error);
      throw error;
    }
  }

  /**
   * Reject a chapter
   * @param {string} chapterId - Chapter ID
   * @param {string} userId - User ID
   * @param {string} feedback - Rejection feedback
   * @returns {Promise<Object|null>} Updated chapter document or null
   */
  static async reject(chapterId, userId, feedback = '') {
    try {
      const chapter = await Chapter.findOneAndUpdate(
        { chapterId, user: userId, status: 'pending' },
        {
          status: 'rejected',
          feedback: feedback,
          rejectedAt: new Date(),
          approvedAt: undefined,
        },
        { new: true, runValidators: true },
      );

      if (chapter) {
        logger.info(`[ChapterModel] Rejected chapter: ${chapterId}`);
      }

      return chapter ? chapter.toObject() : null;
    } catch (error) {
      logger.error('[ChapterModel] Error rejecting chapter:', error);
      throw error;
    }
  }

  /**
   * Get approved chapter summaries for context
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {number} beforeChapter - Get summaries before this chapter number
   * @returns {Promise<Array>} Array of chapter summaries
   */
  static async getApprovedSummaries(bookId, userId, beforeChapter) {
    try {
      const chapters = await Chapter.find({
        bookId,
        user: userId,
        status: 'approved',
        chapterNumber: { $lt: beforeChapter },
        summary: { $exists: true, $ne: '' },
      })
        .select('chapterNumber title summary')
        .sort({ chapterNumber: 1 })
        .lean();

      return chapters.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        summary: chapter.summary,
      }));
    } catch (error) {
      logger.error('[ChapterModel] Error getting approved summaries:', error);
      throw error;
    }
  }

  /**
   * Get chapter statistics for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Chapter statistics
   */
  static async getBookStatistics(bookId, userId) {
    try {
      const stats = await Chapter.aggregate([
        { $match: { bookId, user: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalWords: { $sum: '$wordCount' },
          },
        },
      ]);

      const result = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalWords: 0,
      };

      stats.forEach((stat) => {
        result[stat._id] = stat.count;
        result.total += stat.count;
        result.totalWords += stat.totalWords;
      });

      return result;
    } catch (error) {
      logger.error('[ChapterModel] Error getting book statistics:', error);
      throw error;
    }
  }

  /**
   * Find the next chapter number for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Next chapter number
   */
  static async getNextChapterNumber(bookId, userId) {
    try {
      const lastChapter = await Chapter.findOne({ bookId, user: userId })
        .sort({ chapterNumber: -1 })
        .select('chapterNumber')
        .lean();

      return lastChapter ? lastChapter.chapterNumber + 1 : 1;
    } catch (error) {
      logger.error('[ChapterModel] Error getting next chapter number:', error);
      throw error;
    }
  }
}

module.exports = ChapterModel;

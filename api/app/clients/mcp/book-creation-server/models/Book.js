const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { v4: uuidv4 } = require('uuid');

// Define the book schema directly for now
const bookSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    theme: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    genre: {
      type: String,
      required: true,
      enum: ['fiction', 'non-fiction', 'technical', 'educational'],
    },
    status: {
      type: String,
      enum: ['outline_pending', 'in_progress', 'completed', 'cancelled'],
      default: 'outline_pending',
      index: true,
    },
    outline: {
      chapters: [
        {
          title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
          },
          description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
          },
        },
      ],
      approvedAt: {
        type: Date,
      },
    },
    config: {
      chapterCount: {
        type: Number,
        default: 10,
        min: 3,
        max: 50,
      },
      writingStyle: {
        type: String,
        enum: ['formal', 'casual', 'academic', 'creative'],
        default: 'casual',
      },
      targetAudience: {
        type: String,
        trim: true,
        maxlength: 200,
      },
      formatting: {
        font: {
          type: String,
          default: 'Arial',
          trim: true,
        },
        fontSize: {
          type: Number,
          default: 12,
          min: 8,
          max: 24,
        },
        lineSpacing: {
          type: Number,
          default: 1.5,
          enum: [1, 1.15, 1.5, 2],
        },
      },
    },
    progress: {
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
        min: 3,
        max: 50,
      },
    },
    metadata: {
      wordCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      estimatedReadingTime: {
        type: Number,
        default: 0,
        min: 0,
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
bookSchema.index({ user: 1, status: 1 });
bookSchema.index({ user: 1, createdAt: -1 });
bookSchema.index({ bookId: 1, user: 1 }, { unique: true });

// Virtual for completion percentage
bookSchema.virtual('completionPercentage').get(function () {
  if (this.progress.totalChapters === 0) return 0;
  return Math.round((this.progress.completedChapters / this.progress.totalChapters) * 100);
});

// Pre-save middleware to validate progress consistency
bookSchema.pre('save', function (next) {
  // Ensure currentChapter doesn't exceed totalChapters
  if (this.progress.currentChapter > this.progress.totalChapters) {
    this.progress.currentChapter = this.progress.totalChapters;
  }

  // Ensure completedChapters doesn't exceed totalChapters
  if (this.progress.completedChapters > this.progress.totalChapters) {
    this.progress.completedChapters = this.progress.totalChapters;
  }

  // Update status based on progress
  if (
    this.progress.completedChapters === this.progress.totalChapters &&
    this.status === 'in_progress'
  ) {
    this.status = 'completed';
  }

  next();
});

// Create the Book model
const Book = mongoose.models.Book || mongoose.model('Book', bookSchema);

/**
 * Book model operations for the MCP server
 */
class BookModel {
  /**
   * Create a new book project
   * @param {Object} bookData - Book creation data
   * @param {string} bookData.user - User ID
   * @param {string} bookData.title - Book title
   * @param {string} bookData.theme - Book theme
   * @param {string} bookData.genre - Book genre
   * @param {Object} bookData.config - Book configuration
   * @param {Array} bookData.outline - Book outline chapters
   * @returns {Promise<Object>} Created book document
   */
  static async create(bookData) {
    try {
      const bookId = uuidv4();

      const book = new Book({
        bookId,
        user: bookData.user,
        title: bookData.title,
        theme: bookData.theme,
        genre: bookData.genre,
        status: 'outline_pending',
        outline: {
          chapters: bookData.outline || [],
        },
        config: {
          chapterCount:
            bookData.config?.content?.chapterCount || bookData.config?.chapterCount || 10,
          writingStyle:
            bookData.config?.style?.writingStyle || bookData.config?.writingStyle || 'casual',
          targetAudience:
            bookData.config?.style?.targetAudience || bookData.config?.targetAudience || '',
          formatting: {
            font: bookData.config?.formatting?.font || 'Arial',
            fontSize: bookData.config?.formatting?.fontSize || 12,
            lineSpacing: bookData.config?.formatting?.lineSpacing || 1.5,
          },
        },
        progress: {
          currentChapter: 0,
          completedChapters: 0,
          totalChapters:
            bookData.config?.content?.chapterCount || bookData.config?.chapterCount || 10,
        },
        metadata: {
          wordCount: 0,
          estimatedReadingTime: 0,
        },
      });

      const savedBook = await book.save();
      logger.info(`[BookModel] Created book: ${bookId} for user: ${bookData.user}`);

      return savedBook.toObject();
    } catch (error) {
      logger.error('[BookModel] Error creating book:', error);
      throw error;
    }
  }

  /**
   * Find a book by ID and user
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Book document or null
   */
  static async findByIdAndUser(bookId, userId) {
    try {
      const book = await Book.findOne({ bookId, user: userId }).lean();
      return book;
    } catch (error) {
      logger.error('[BookModel] Error finding book:', error);
      throw error;
    }
  }

  /**
   * Find all books for a user with optimized queries
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Limit results
   * @param {number} options.skip - Skip results
   * @param {Array} options.select - Fields to select
   * @returns {Promise<Array>} Array of book documents
   */
  static async findByUser(userId, options = {}) {
    try {
      const query = { user: userId };

      if (options.status) {
        query.status = options.status;
      }

      let dbQuery = Book.find(query).sort({ updatedAt: -1 });

      // Select only needed fields for better performance
      if (options.select) {
        dbQuery = dbQuery.select(options.select.join(' '));
      } else {
        // Default selection excludes large fields when not needed
        dbQuery = dbQuery.select('-outline.chapters -config.formatting');
      }

      if (options.limit) {
        dbQuery = dbQuery.limit(Math.min(options.limit, 100)); // Cap at 100
      }

      if (options.skip) {
        dbQuery = dbQuery.skip(options.skip);
      }

      const books = await dbQuery.lean();
      return books;
    } catch (error) {
      logger.error('[BookModel] Error finding books by user:', error);
      throw error;
    }
  }

  /**
   * Update a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object|null>} Updated book document or null
   */
  static async updateByIdAndUser(bookId, userId, updateData) {
    try {
      const book = await Book.findOneAndUpdate({ bookId, user: userId }, updateData, {
        new: true,
        runValidators: true,
      });

      if (book) {
        logger.info(`[BookModel] Updated book: ${bookId} for user: ${userId}`);
      }

      return book ? book.toObject() : null;
    } catch (error) {
      logger.error('[BookModel] Error updating book:', error);
      throw error;
    }
  }

  /**
   * Delete a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async deleteByIdAndUser(bookId, userId) {
    try {
      const result = await Book.deleteOne({ bookId, user: userId });

      if (result.deletedCount > 0) {
        logger.info(`[BookModel] Deleted book: ${bookId} for user: ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[BookModel] Error deleting book:', error);
      throw error;
    }
  }

  /**
   * Approve book outline
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Updated book document or null
   */
  static async approveOutline(bookId, userId) {
    try {
      console.log(
        `[BookModel] DEBUG - Attempting to approve outline for bookId: ${bookId}, userId: ${userId}`,
      );

      // First, let's check if the book exists and what its current status is
      const existingBook = await Book.findOne({ bookId, user: userId });
      console.log(
        `[BookModel] DEBUG - Found book:`,
        existingBook
          ? {
            bookId: existingBook.bookId,
            status: existingBook.status,
            user: existingBook.user,
          }
          : 'NOT FOUND',
      );

      const book = await Book.findOneAndUpdate(
        { bookId, user: userId, status: 'outline_pending' },
        {
          status: 'in_progress',
          'outline.approvedAt': new Date(),
        },
        { new: true, runValidators: true },
      );

      console.log(
        `[BookModel] DEBUG - Update result:`,
        book
          ? {
            bookId: book.bookId,
            status: book.status,
            approvedAt: book.outline?.approvedAt,
          }
          : 'UPDATE FAILED - NO BOOK FOUND',
      );

      if (book) {
        logger.info(`[BookModel] Approved outline for book: ${bookId}`);
      } else {
        logger.warn(
          `[BookModel] Failed to approve outline - book not found or not in outline_pending status`,
        );
      }

      return book ? book.toObject() : null;
    } catch (error) {
      logger.error('[BookModel] Error approving outline:', error);
      throw error;
    }
  }

  /**
   * Update book progress
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} progressData - Progress update data
   * @returns {Promise<Object|null>} Updated book document or null
   */
  static async updateProgress(bookId, userId, progressData) {
    try {
      const updateFields = {};

      if (progressData.currentChapter !== undefined) {
        updateFields['progress.currentChapter'] = progressData.currentChapter;
      }

      if (progressData.completedChapters !== undefined) {
        updateFields['progress.completedChapters'] = progressData.completedChapters;
      }

      if (progressData.wordCount !== undefined) {
        updateFields['metadata.wordCount'] = progressData.wordCount;
        updateFields['metadata.estimatedReadingTime'] = Math.ceil(progressData.wordCount / 200);
      }

      const book = await Book.findOneAndUpdate({ bookId, user: userId }, updateFields, {
        new: true,
        runValidators: true,
      });

      return book ? book.toObject() : null;
    } catch (error) {
      logger.error('[BookModel] Error updating progress:', error);
      throw error;
    }
  }

  /**
   * Get book statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Book statistics
   */
  static async getStatistics(userId) {
    try {
      const stats = await Book.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalWords: { $sum: '$metadata.wordCount' },
          },
        },
      ]);

      const result = {
        total: 0,
        outline_pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        totalWords: 0,
      };

      stats.forEach((stat) => {
        result[stat._id] = stat.count;
        result.total += stat.count;
        result.totalWords += stat.totalWords;
      });

      return result;
    } catch (error) {
      logger.error('[BookModel] Error getting statistics:', error);
      throw error;
    }
  }
}

module.exports = BookModel;

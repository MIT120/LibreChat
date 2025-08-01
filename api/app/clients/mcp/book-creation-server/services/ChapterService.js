const ChapterModel = require('../models/Chapter');
const BookModel = require('../models/Book');
const { AIClient } = require('../utils/aiClient');
const ConfigService = require('./ConfigService');
const ProgressService = require('./ProgressService');

// Use console for logging in MCP server context
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};

/**
 * Custom error class for ChapterService operations
 */
class ChapterServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ChapterServiceError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ChapterService class for managing chapter workflow
 * Handles chapter generation, approval workflow, regeneration, and context building
 */
class ChapterService {
  constructor(options = {}) {
    this.aiClient = options.aiClient || new AIClient();
    this.configService = options.configService || new ConfigService();
    this.maxRegenerationAttempts = options.maxRegenerationAttempts || 3;
  }

  /**
   * Generate a new chapter with context from previous chapters
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {number} chapterNumber - Chapter number to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated chapter data
   */
  async generateChapter(userId, bookId, chapterNumber, options = {}) {
    try {
      logger.info(`[ChapterService] Generating chapter ${chapterNumber} for book: ${bookId}`);

      // Get book information
      const book = await BookModel.findByIdAndUser(bookId, userId);
      if (!book) {
        throw new ChapterServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      if (book.status !== 'in_progress') {
        throw new ChapterServiceError(
          'Book must be in progress to generate chapters',
          'INVALID_BOOK_STATUS',
          { currentStatus: book.status },
        );
      }

      // Validate chapter number
      if (chapterNumber < 1 || chapterNumber > book.progress.totalChapters) {
        throw new ChapterServiceError('Invalid chapter number', 'INVALID_CHAPTER_NUMBER', {
          chapterNumber,
          totalChapters: book.progress.totalChapters,
        });
      }

      // Check if chapter already exists
      const existingChapter = await ChapterModel.findByBook(bookId, userId, {
        status: null, // Find any status
      });
      const chapterExists = existingChapter.some((ch) => ch.chapterNumber === chapterNumber);

      if (chapterExists) {
        throw new ChapterServiceError('Chapter already exists', 'CHAPTER_EXISTS', {
          chapterNumber,
        });
      }

      // Get chapter outline information
      const chapterOutline = book.outline.chapters[chapterNumber - 1];
      if (!chapterOutline) {
        throw new ChapterServiceError('Chapter outline not found', 'OUTLINE_NOT_FOUND', {
          chapterNumber,
        });
      }

      // Record chapter generation start milestone
      await ProgressService.recordChapterGenerationStarted(bookId, userId, chapterNumber, {
        chapterTitle: chapterOutline.title,
        chapterDescription: chapterOutline.description,
      });

      // Build generation context
      const context = await this.buildChapterContext(userId, bookId, chapterNumber, book);

      // Generate chapter content using AI
      const chapterData = await this.aiClient.generateChapter(
        {
          title: chapterOutline.title,
          description: chapterOutline.description,
          chapterNumber,
          totalChapters: book.progress.totalChapters,
        },
        {
          bookTheme: book.theme,
          genre: book.genre,
          writingStyle: book.config.style.writingStyle,
          targetAudience: book.config.style.targetAudience,
          previousSummaries: context.previousSummaries,
          targetWordCount: book.config.content.averageChapterLength || 2000,
          ...options,
        },
      );

      // Create chapter in database
      const chapter = await ChapterModel.create({
        bookId,
        user: userId,
        chapterNumber,
        title: chapterData.title,
        content: chapterData.content,
        generationContext: {
          previousSummaries: context.previousSummaries,
          styleInstructions: context.styleInstructions,
          specificRequirements: options.specificRequirements || '',
        },
      });

      // Record chapter generation completion milestone
      await ProgressService.recordChapterGenerated(bookId, userId, chapterNumber, {
        chapterTitle: chapter.title,
        wordCount: chapter.wordCount,
        estimatedReadingTime: chapter.estimatedReadingTime,
      });

      logger.info(`[ChapterService] Generated chapter ${chapterNumber} for book: ${bookId}`);

      return {
        chapterId: chapter.chapterId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount,
        status: chapter.status,
        estimatedReadingTime: chapter.estimatedReadingTime,
        createdAt: chapter.createdAt,
      };
    } catch (error) {
      logger.error('[ChapterService] Error generating chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(
        `Failed to generate chapter: ${error.message}`,
        'GENERATION_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Approve a chapter and update book progress
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {string} chapterId - Chapter ID
   * @param {Object} options - Approval options
   * @returns {Promise<Object>} Approval result with updated progress
   */
  async approveChapter(userId, bookId, chapterId, options = {}) {
    try {
      logger.info(`[ChapterService] Approving chapter: ${chapterId}`);

      // Get chapter
      const chapter = await ChapterModel.findByIdAndUser(chapterId, userId);
      if (!chapter) {
        throw new ChapterServiceError('Chapter not found', 'CHAPTER_NOT_FOUND');
      }

      if (chapter.bookId !== bookId) {
        throw new ChapterServiceError('Chapter does not belong to this book', 'INVALID_BOOK');
      }

      if (chapter.status !== 'pending') {
        throw new ChapterServiceError('Chapter is not pending approval', 'INVALID_STATUS', {
          currentStatus: chapter.status,
        });
      }

      // Generate chapter summary for future context
      const summaryData = await this.aiClient.generateChapterSummary(chapter.content, {
        summaryLength: options.summaryLength || 'brief',
      });

      // Approve chapter with summary
      const approvedChapter = await ChapterModel.approve(chapterId, userId, summaryData.summary);
      if (!approvedChapter) {
        throw new ChapterServiceError('Failed to approve chapter', 'APPROVAL_FAILED');
      }

      // Record chapter approval milestone
      await ProgressService.recordChapterApproved(bookId, userId, chapter.chapterNumber, {
        chapterTitle: approvedChapter.title,
        wordCount: approvedChapter.wordCount,
        summaryGenerated: !!approvedChapter.summary,
      });

      // Update book progress
      const book = await BookModel.findByIdAndUser(bookId, userId);
      let newCompletedChapters = 0;
      if (book) {
        newCompletedChapters = book.progress.completedChapters + 1;
        const newWordCount = book.metadata.wordCount + approvedChapter.wordCount;

        await BookModel.updateProgress(bookId, userId, {
          completedChapters: newCompletedChapters,
          currentChapter: Math.max(book.progress.currentChapter, chapter.chapterNumber),
          wordCount: newWordCount,
        });

        logger.info(
          `[ChapterService] Updated book progress: ${newCompletedChapters}/${book.progress.totalChapters} chapters`,
        );
      }

      // Check if this was the last chapter and trigger next chapter generation
      let nextChapterInfo = null;
      if (book && chapter.chapterNumber < book.progress.totalChapters) {
        nextChapterInfo = {
          nextChapterNumber: chapter.chapterNumber + 1,
          canGenerateNext: true,
        };
      } else if (book && chapter.chapterNumber === book.progress.totalChapters) {
        // Mark book as completed
        await BookModel.updateByIdAndUser(bookId, userId, { status: 'completed' });
        nextChapterInfo = {
          bookCompleted: true,
          canGenerateNext: false,
        };
      }

      logger.info(`[ChapterService] Chapter approved: ${chapterId}`);

      return {
        chapterId: approvedChapter.chapterId,
        chapterNumber: approvedChapter.chapterNumber,
        title: approvedChapter.title,
        status: approvedChapter.status,
        summary: approvedChapter.summary,
        wordCount: approvedChapter.wordCount,
        approvedAt: approvedChapter.approvedAt,
        nextChapter: nextChapterInfo,
        bookProgress: {
          completedChapters: newCompletedChapters,
          totalChapters: book ? book.progress.totalChapters : 0,
          completionPercentage: book
            ? Math.round((newCompletedChapters / book.progress.totalChapters) * 100)
            : 0,
        },
      };
    } catch (error) {
      logger.error('[ChapterService] Error approving chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(
        `Failed to approve chapter: ${error.message}`,
        'APPROVAL_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Reject a chapter with feedback
   * @param {string} userId - User ID
   * @param {string} chapterId - Chapter ID
   * @param {string} feedback - Rejection feedback
   * @returns {Promise<Object>} Rejection result
   */
  async rejectChapter(userId, chapterId, feedback = '') {
    try {
      logger.info(`[ChapterService] Rejecting chapter: ${chapterId}`);

      const rejectedChapter = await ChapterModel.reject(chapterId, userId, feedback);
      if (!rejectedChapter) {
        throw new ChapterServiceError('Chapter not found or not pending', 'CHAPTER_NOT_FOUND');
      }

      // Record chapter rejection milestone
      await ProgressService.recordChapterRejected(rejectedChapter.bookId, userId, rejectedChapter.chapterNumber, {
        chapterTitle: rejectedChapter.title,
        feedback: feedback,
        rejectedAt: rejectedChapter.rejectedAt,
      });

      logger.info(`[ChapterService] Chapter rejected: ${chapterId}`);

      return {
        chapterId: rejectedChapter.chapterId,
        chapterNumber: rejectedChapter.chapterNumber,
        title: rejectedChapter.title,
        status: rejectedChapter.status,
        feedback: rejectedChapter.feedback,
        rejectedAt: rejectedChapter.rejectedAt,
        canRegenerate: true,
      };
    } catch (error) {
      logger.error('[ChapterService] Error rejecting chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(
        `Failed to reject chapter: ${error.message}`,
        'REJECTION_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Regenerate a chapter with user feedback incorporation
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {string} chapterId - Chapter ID
   * @param {Object} options - Regeneration options
   * @returns {Promise<Object>} Regenerated chapter data
   */
  async regenerateChapter(userId, bookId, chapterId, options = {}) {
    try {
      logger.info(`[ChapterService] Regenerating chapter: ${chapterId}`);

      // Get existing chapter
      const existingChapter = await ChapterModel.findByIdAndUser(chapterId, userId);
      if (!existingChapter) {
        throw new ChapterServiceError('Chapter not found', 'CHAPTER_NOT_FOUND');
      }

      if (existingChapter.status !== 'rejected') {
        throw new ChapterServiceError(
          'Only rejected chapters can be regenerated',
          'INVALID_STATUS',
          { currentStatus: existingChapter.status },
        );
      }

      // Get book information
      const book = await BookModel.findByIdAndUser(bookId, userId);
      if (!book) {
        throw new ChapterServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      // Build regeneration context with feedback
      const context = await this.buildChapterContext(
        userId,
        bookId,
        existingChapter.chapterNumber,
        book,
      );

      // Get chapter outline
      const chapterOutline = book.outline.chapters[existingChapter.chapterNumber - 1];

      // Incorporate user feedback into generation prompt
      const feedbackInstructions = existingChapter.feedback
        ? `Previous feedback to address: ${existingChapter.feedback}`
        : '';

      const additionalRequirements = options.feedback
        ? `Additional requirements: ${options.feedback}`
        : '';

      const combinedRequirements = [feedbackInstructions, additionalRequirements]
        .filter((req) => req.length > 0)
        .join('\n');

      // Generate new chapter content
      const chapterData = await this.aiClient.generateChapter(
        {
          title: chapterOutline.title,
          description: chapterOutline.description,
          chapterNumber: existingChapter.chapterNumber,
          totalChapters: book.progress.totalChapters,
        },
        {
          bookTheme: book.theme,
          genre: book.genre,
          writingStyle: book.config.style.writingStyle,
          targetAudience: book.config.style.targetAudience,
          previousSummaries: context.previousSummaries,
          targetWordCount: book.config.content.averageChapterLength || 2000,
          specificRequirements: combinedRequirements,
          ...options,
        },
      );

      // Update chapter with new content and reset status to pending
      const updatedChapter = await ChapterModel.updateByIdAndUser(chapterId, userId, {
        content: chapterData.content,
        status: 'pending',
        feedback: '', // Clear previous feedback
        rejectedAt: undefined,
        approvedAt: undefined,
        generationContext: {
          ...existingChapter.generationContext,
          specificRequirements: combinedRequirements,
        },
      });

      if (!updatedChapter) {
        throw new ChapterServiceError('Failed to update chapter', 'UPDATE_FAILED');
      }

      // Record chapter regeneration milestone
      await ProgressService.recordChapterRegenerated(bookId, userId, existingChapter.chapterNumber, {
        chapterTitle: updatedChapter.title,
        wordCount: updatedChapter.wordCount,
        feedbackIncorporated: combinedRequirements,
        regeneratedAt: updatedChapter.updatedAt,
      });

      logger.info(`[ChapterService] Chapter regenerated: ${chapterId}`);

      return {
        chapterId: updatedChapter.chapterId,
        chapterNumber: updatedChapter.chapterNumber,
        title: updatedChapter.title,
        content: updatedChapter.content,
        wordCount: updatedChapter.wordCount,
        status: updatedChapter.status,
        estimatedReadingTime: updatedChapter.estimatedReadingTime,
        regeneratedAt: updatedChapter.updatedAt,
        feedbackIncorporated: combinedRequirements,
      };
    } catch (error) {
      logger.error('[ChapterService] Error regenerating chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(
        `Failed to regenerate chapter: ${error.message}`,
        'REGENERATION_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Get chapter details with context
   * @param {string} userId - User ID
   * @param {string} chapterId - Chapter ID
   * @returns {Promise<Object>} Chapter details
   */
  async getChapter(userId, chapterId) {
    try {
      const chapter = await ChapterModel.findByIdAndUser(chapterId, userId);
      if (!chapter) {
        throw new ChapterServiceError('Chapter not found', 'CHAPTER_NOT_FOUND');
      }

      return {
        chapterId: chapter.chapterId,
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
        status: chapter.status,
        feedback: chapter.feedback,
        wordCount: chapter.wordCount,
        estimatedReadingTime: chapter.estimatedReadingTime,
        generationContext: chapter.generationContext,
        approvedAt: chapter.approvedAt,
        rejectedAt: chapter.rejectedAt,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    } catch (error) {
      logger.error('[ChapterService] Error getting chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(`Failed to get chapter: ${error.message}`, 'FETCH_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * List chapters for a book
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} List of chapters with metadata
   */
  async listChapters(userId, bookId, options = {}) {
    try {
      const chapters = await ChapterModel.findByBook(bookId, userId, {
        status: options.status,
        sortByNumber: true,
      });

      const statistics = await ChapterModel.getBookStatistics(bookId, userId);

      const chaptersWithDetails = chapters.map((chapter) => ({
        chapterId: chapter.chapterId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        status: chapter.status,
        wordCount: chapter.wordCount,
        estimatedReadingTime: chapter.estimatedReadingTime,
        hasContent: !!chapter.content,
        hasSummary: !!chapter.summary,
        hasFeedback: !!chapter.feedback,
        approvedAt: chapter.approvedAt,
        rejectedAt: chapter.rejectedAt,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      }));

      return {
        chapters: chaptersWithDetails,
        statistics,
        total: chapters.length,
      };
    } catch (error) {
      logger.error('[ChapterService] Error listing chapters:', error);
      throw new ChapterServiceError(`Failed to list chapters: ${error.message}`, 'LIST_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Delete a chapter
   * @param {string} userId - User ID
   * @param {string} chapterId - Chapter ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteChapter(userId, chapterId) {
    try {
      logger.info(`[ChapterService] Deleting chapter: ${chapterId}`);

      const deleted = await ChapterModel.deleteByIdAndUser(chapterId, userId);
      if (!deleted) {
        throw new ChapterServiceError('Chapter not found', 'CHAPTER_NOT_FOUND');
      }

      logger.info(`[ChapterService] Chapter deleted: ${chapterId}`);
      return true;
    } catch (error) {
      logger.error('[ChapterService] Error deleting chapter:', error);

      if (error instanceof ChapterServiceError) {
        throw error;
      }

      throw new ChapterServiceError(`Failed to delete chapter: ${error.message}`, 'DELETE_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Delete all chapters for a book
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<number>} Number of deleted chapters
   */
  async deleteAllChapters(userId, bookId) {
    try {
      logger.info(`[ChapterService] Deleting all chapters for book: ${bookId}`);

      const deletedCount = await ChapterModel.deleteByBook(bookId, userId);

      logger.info(`[ChapterService] Deleted ${deletedCount} chapters for book: ${bookId}`);
      return deletedCount;
    } catch (error) {
      logger.error('[ChapterService] Error deleting all chapters:', error);
      throw new ChapterServiceError(
        `Failed to delete all chapters: ${error.message}`,
        'DELETE_ALL_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Build chapter context for AI generation
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {number} chapterNumber - Chapter number being generated
   * @param {Object} book - Book document
   * @returns {Promise<Object>} Chapter generation context
   */
  async buildChapterContext(userId, bookId, chapterNumber, book) {
    try {
      // Get summaries of all previous approved chapters
      const previousSummaries = await ChapterModel.getApprovedSummaries(
        bookId,
        userId,
        chapterNumber,
      );

      // Build style instructions from book configuration
      const styleInstructions = this.buildStyleInstructions(book.config);

      return {
        previousSummaries: previousSummaries.map(
          (summary) => `Chapter ${summary.chapterNumber} (${summary.title}): ${summary.summary}`,
        ),
        styleInstructions,
        bookTheme: book.theme,
        genre: book.genre,
        targetAudience: book.config.style.targetAudience,
        writingStyle: book.config.style.writingStyle,
        chapterCount: book.progress.totalChapters,
      };
    } catch (error) {
      logger.error('[ChapterService] Error building chapter context:', error);
      throw new ChapterServiceError(
        `Failed to build chapter context: ${error.message}`,
        'CONTEXT_BUILD_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Build style instructions from book configuration
   * @param {Object} config - Book configuration
   * @returns {string} Style instructions for AI generation
   */
  buildStyleInstructions(config) {
    const instructions = [];

    if (config.style.writingStyle) {
      instructions.push(`Writing style: ${config.style.writingStyle}`);
    }

    if (config.style.tone) {
      instructions.push(`Tone: ${config.style.tone}`);
    }

    if (config.style.perspective) {
      instructions.push(`Perspective: ${config.style.perspective}`);
    }

    if (config.style.targetAudience) {
      instructions.push(`Target audience: ${config.style.targetAudience}`);
    }

    if (config.content.averageChapterLength) {
      instructions.push(
        `Target length: approximately ${config.content.averageChapterLength} words`,
      );
    }

    return instructions.join('. ');
  }

  /**
   * Get next chapter to generate for a book
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<Object|null>} Next chapter info or null if none
   */
  async getNextChapterToGenerate(userId, bookId) {
    try {
      const book = await BookModel.findByIdAndUser(bookId, userId);
      if (!book || book.status !== 'in_progress') {
        return null;
      }

      const nextChapterNumber = await ChapterModel.getNextChapterNumber(bookId, userId);

      if (nextChapterNumber > book.progress.totalChapters) {
        return null; // All chapters generated
      }

      const chapterOutline = book.outline.chapters[nextChapterNumber - 1];

      return {
        chapterNumber: nextChapterNumber,
        title: chapterOutline?.title || `Chapter ${nextChapterNumber}`,
        description: chapterOutline?.description || '',
        canGenerate: true,
      };
    } catch (error) {
      logger.error('[ChapterService] Error getting next chapter:', error);
      return null;
    }
  }

  /**
   * Get chapter generation progress for a book
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} Chapter generation progress
   */
  async getChapterProgress(userId, bookId) {
    try {
      const statistics = await ChapterModel.getBookStatistics(bookId, userId);
      const nextChapter = await this.getNextChapterToGenerate(userId, bookId);

      return {
        statistics,
        nextChapter,
        generationComplete: !nextChapter,
        pendingApproval: statistics.pending > 0,
        needsRegeneration: statistics.rejected > 0,
      };
    } catch (error) {
      logger.error('[ChapterService] Error getting chapter progress:', error);
      throw new ChapterServiceError(
        `Failed to get chapter progress: ${error.message}`,
        'PROGRESS_FETCH_FAILED',
        { originalError: error.message },
      );
    }
  }
}

module.exports = ChapterService;

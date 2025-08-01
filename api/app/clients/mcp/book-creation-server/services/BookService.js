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
 * Custom error class for BookService operations
 */
class BookServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BookServiceError';
    this.code = code;
    this.details = details;
  }
}

/**
 * BookService class for managing book project lifecycle
 * Handles book creation, status management, progress tracking, and export functionality
 */
class BookService {
  constructor(options = {}) {
    this.aiClient = options.aiClient || new AIClient();
    this.configService = options.configService || new ConfigService();
    this.exportFormats = ['markdown', 'html', 'txt', 'json'];

    // Database models - will be injected by the MCP server
    this.models = options.models;
    if (!this.models) {
      throw new Error('BookService requires database models to be provided');
    }
  }

  /**
   * Create a new book project with theme-based outline generation
   * @param {string} userId - User ID
   * @param {Object} bookData - Book creation data
   * @param {string} bookData.title - Book title
   * @param {string} bookData.theme - Book theme
   * @param {string} bookData.genre - Book genre
   * @param {Object} bookData.config - Book configuration
   * @returns {Promise<Object>} Created book project with outline
   */
  async createBookProject(userId, bookData) {
    try {
      logger.info(`[BookService] Creating book project for user: ${userId}`);

      // Validate and prepare configuration
      const configResult = this.configService.prepareConfiguration(bookData.config);
      if (!configResult.isValid) {
        throw new BookServiceError('Invalid configuration provided', 'INVALID_CONFIG', {
          errors: configResult.errors,
        });
      }

      // Generate book outline using AI
      logger.info(`[BookService] Generating outline for theme: ${bookData.theme}`);
      const outlineData = await this.aiClient.generateBookOutline(bookData.theme, {
        genre: bookData.genre,
        chapterCount: configResult.config.content.chapterCount,
        targetAudience: configResult.config.style.targetAudience,
        writingStyle: configResult.config.style.writingStyle,
      });

      // Create book project in database
      const bookProject = await this.models.Book.create({
        user: userId,
        title: bookData.title || outlineData.title,
        theme: bookData.theme,
        genre: bookData.genre,
        config: configResult.config,
        outline: outlineData.chapters.map((chapter) => ({
          title: chapter.title,
          description: chapter.description,
        })),
      });

      // Initialize progress tracking
      await ProgressService.initializeProgress(
        bookProject.bookId,
        userId,
        configResult.config.content.chapterCount,
      );

      // Record outline generation milestone
      await ProgressService.recordOutlineGenerated(bookProject.bookId, userId, {
        chapterCount: configResult.config.content.chapterCount,
        genre: bookData.genre,
        theme: bookData.theme,
      });

      logger.info(`[BookService] Created book project: ${bookProject.bookId}`);

      return {
        bookId: bookProject.bookId,
        title: bookProject.title,
        theme: bookProject.theme,
        genre: bookProject.genre,
        status: bookProject.status,
        outline: {
          chapters: bookProject.outline.chapters,
          description: outlineData.description,
        },
        config: bookProject.config,
        progress: bookProject.progress,
        metadata: bookProject.metadata,
        createdAt: bookProject.createdAt,
      };
    } catch (error) {
      logger.error('[BookService] Error creating book project:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(
        `Failed to create book project: ${error.message}`,
        'CREATION_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Approve book outline and transition to in_progress status
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} Updated book project
   */
  async approveOutline(userId, bookId) {
    try {
      logger.info(`[BookService] Approving outline for book: ${bookId}`);

      const book = await this.models.Book.findOne({ bookId, user: userId });
      if (!book) {
        throw new BookServiceError('Book not found or outline already approved', 'BOOK_NOT_FOUND');
      }

      // Record outline approval milestone
      await ProgressService.recordOutlineApproved(bookId, userId, {
        totalChapters: book.progress.totalChapters,
        approvedAt: book.outline.approvedAt,
      });

      logger.info(`[BookService] Outline approved for book: ${bookId}`);

      return {
        bookId: book.bookId,
        status: book.status,
        outline: book.outline,
        progress: book.progress,
        updatedAt: book.updatedAt,
      };
    } catch (error) {
      logger.error('[BookService] Error approving outline:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(`Failed to approve outline: ${error.message}`, 'APPROVAL_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Get book progress with completion percentage calculations
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} Book progress information
   */
  async getBookProgress(userId, bookId) {
    try {
      const book = await this.models.Book.findOne({ bookId, user: userId });
      if (!book) {
        throw new BookServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      // Get detailed progress from ProgressService
      const detailedProgress = await ProgressService.getCurrentProgress(bookId, userId);
      const statusMessage = await ProgressService.generateStatusMessage(bookId, userId);

      // Calculate basic progress metrics for backward compatibility
      const basicProgress = this.calculateProgressMetrics(book);

      return {
        bookId: book.bookId,
        title: book.title,
        status: book.status,
        progress: {
          ...book.progress,
          completionPercentage:
            detailedProgress?.percentComplete || basicProgress.completionPercentage,
          estimatedTimeRemaining:
            detailedProgress?.estimatedTimeRemaining || basicProgress.estimatedTimeRemaining,
          currentPhase: detailedProgress?.currentPhase || basicProgress.currentPhase,
          nextAction: statusMessage?.action || basicProgress.nextAction,
        },
        detailedProgress,
        statusMessage,
        metadata: {
          ...book.metadata,
          chaptersRemaining: basicProgress.chaptersRemaining,
          averageWordsPerChapter: basicProgress.averageWordsPerChapter,
        },
        lastUpdated: book.updatedAt,
      };
    } catch (error) {
      logger.error('[BookService] Error getting book progress:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(
        `Failed to get book progress: ${error.message}`,
        'PROGRESS_FETCH_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * Update book progress
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {Object} progressData - Progress update data
   * @returns {Promise<Object>} Updated book progress
   */
  async updateProgress(userId, bookId, progressData) {
    try {
      logger.info(`[BookService] Updating progress for book: ${bookId}`);

      const updatedBook = await this.models.Book.findOneAndUpdate(
        { bookId, user: userId },
        { progress: progressData },
        { new: true },
      );
      if (!updatedBook) {
        throw new BookServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      const progress = this.calculateProgressMetrics(updatedBook);

      logger.info(
        `[BookService] Progress updated for book: ${bookId} - ${progress.completionPercentage}% complete`,
      );

      return {
        bookId: updatedBook.bookId,
        progress: {
          ...updatedBook.progress,
          completionPercentage: progress.completionPercentage,
          currentPhase: progress.currentPhase,
        },
        metadata: updatedBook.metadata,
        updatedAt: updatedBook.updatedAt,
      };
    } catch (error) {
      logger.error('[BookService] Error updating progress:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(
        `Failed to update progress: ${error.message}`,
        'PROGRESS_UPDATE_FAILED',
        { originalError: error.message },
      );
    }
  }

  /**
   * List all books for a user with filtering options
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Limit results
   * @param {number} options.skip - Skip results
   * @returns {Promise<Object>} List of books with metadata
   */
  async listBooks(userId, _options = {}) {
    try {
      logger.info(`[BookService] Listing books for user: ${userId}`);

      const books = await this.models.Book.find({ user: userId }).sort({ createdAt: -1 });
      const totalBooks = await this.models.Book.countDocuments({ user: userId });
      const completedBooks = await this.models.Book.countDocuments({
        user: userId,
        status: 'completed',
      });
      const statistics = { totalBooks, completedBooks };

      const booksWithProgress = books.map((book) => {
        const progress = this.calculateProgressMetrics(book);
        return {
          bookId: book.bookId,
          title: book.title,
          theme: book.theme,
          genre: book.genre,
          status: book.status,
          progress: {
            ...book.progress,
            completionPercentage: progress.completionPercentage,
            currentPhase: progress.currentPhase,
          },
          metadata: book.metadata,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        };
      });

      return {
        books: booksWithProgress,
        statistics,
        total: books.length,
      };
    } catch (error) {
      logger.error('[BookService] Error listing books:', error);
      throw new BookServiceError(`Failed to list books: ${error.message}`, 'LIST_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Export book in multiple formats
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {string} format - Export format (markdown, html, txt, json)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported book content
   */
  async exportBook(userId, bookId, format = 'markdown', options = {}) {
    try {
      logger.info(`[BookService] Exporting book: ${bookId} in format: ${format}`);

      if (!this.exportFormats.includes(format)) {
        throw new BookServiceError(`Unsupported export format: ${format}`, 'INVALID_FORMAT', {
          supportedFormats: this.exportFormats,
        });
      }

      const book = await this.models.Book.findOne({ bookId, user: userId });
      if (!book) {
        throw new BookServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      if (book.status !== 'completed') {
        throw new BookServiceError('Book must be completed before export', 'BOOK_NOT_COMPLETED', {
          currentStatus: book.status,
        });
      }

      // Get all chapters for the book (this would require ChapterService integration)
      // For now, we'll create a placeholder structure
      const exportData = await this.generateExportContent(book, format, options);

      // Record export milestone
      await ProgressService.recordBookExported(bookId, userId, {
        format,
        fileSize: exportData.content.length,
        exportedAt: new Date().toISOString(),
      });

      logger.info(`[BookService] Book exported successfully: ${bookId}`);

      return {
        bookId: book.bookId,
        title: book.title,
        format,
        content: exportData.content,
        metadata: {
          ...book.metadata,
          exportedAt: new Date(),
          format,
          fileSize: exportData.content.length,
        },
        downloadInfo: exportData.downloadInfo,
      };
    } catch (error) {
      logger.error('[BookService] Error exporting book:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(`Failed to export book: ${error.message}`, 'EXPORT_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Delete a book project and all associated data
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteBook(userId, bookId) {
    try {
      logger.info(`[BookService] Deleting book: ${bookId}`);

      const deleted = await this.models.Book.findOneAndDelete({ bookId, user: userId });
      if (!deleted) {
        throw new BookServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      // Delete progress tracking
      await ProgressService.deleteProgress(bookId, userId);

      // TODO: Also delete associated chapters when ChapterService is implemented
      // await this.chapterService.deleteAllChapters(bookId, userId);

      logger.info(`[BookService] Book deleted successfully: ${bookId}`);
      return true;
    } catch (error) {
      logger.error('[BookService] Error deleting book:', error);

      if (error instanceof BookServiceError) {
        throw error;
      }

      throw new BookServiceError(`Failed to delete book: ${error.message}`, 'DELETE_FAILED', {
        originalError: error.message,
      });
    }
  }

  /**
   * Calculate detailed progress metrics for a book
   * @param {Object} book - Book document
   * @returns {Object} Progress metrics
   */
  calculateProgressMetrics(book) {
    const completionPercentage =
      book.progress.totalChapters === 0
        ? 0
        : Math.round((book.progress.completedChapters / book.progress.totalChapters) * 100);

    const chaptersRemaining = book.progress.totalChapters - book.progress.completedChapters;

    const averageWordsPerChapter =
      book.progress.completedChapters > 0
        ? Math.round(book.metadata.wordCount / book.progress.completedChapters)
        : 0;

    // Estimate time remaining (assuming 1 chapter per day for generation and approval)
    const estimatedTimeRemaining = chaptersRemaining * 24 * 60; // minutes

    // Determine current phase
    let currentPhase = 'outline';
    let nextAction = 'Approve outline to begin chapter generation';

    if (book.status === 'in_progress') {
      currentPhase = 'generation';
      if (book.progress.currentChapter < book.progress.totalChapters) {
        nextAction = `Generate chapter ${book.progress.currentChapter + 1}`;
      } else {
        nextAction = 'Review and approve final chapter';
      }
    } else if (book.status === 'completed') {
      currentPhase = 'completed';
      nextAction = 'Book is complete - ready for export';
    } else if (book.status === 'cancelled') {
      currentPhase = 'cancelled';
      nextAction = 'Book creation was cancelled';
    }

    return {
      completionPercentage,
      chaptersRemaining,
      averageWordsPerChapter,
      estimatedTimeRemaining,
      currentPhase,
      nextAction,
    };
  }

  /**
   * Generate export content in the specified format
   * @param {Object} book - Book document
   * @param {string} format - Export format
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export content and metadata
   */
  async generateExportContent(book, format, options = {}) {
    const {
      includeMetadata = true,
      includeTableOfContents = true,
      includePageNumbers = false,
    } = options;

    let content = '';
    let downloadInfo = {};

    switch (format) {
      case 'markdown':
        content = this.generateMarkdownExport(book, {
          includeMetadata,
          includeTableOfContents,
        });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
          mimeType: 'text/markdown',
        };
        break;

      case 'html':
        content = this.generateHtmlExport(book, {
          includeMetadata,
          includeTableOfContents,
          includePageNumbers,
        });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`,
          mimeType: 'text/html',
        };
        break;

      case 'txt':
        content = this.generateTextExport(book, { includeMetadata });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
          mimeType: 'text/plain',
        };
        break;

      case 'json':
        content = JSON.stringify(this.generateJsonExport(book), null, 2);
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
          mimeType: 'application/json',
        };
        break;

      default:
        throw new BookServiceError(`Unsupported export format: ${format}`, 'INVALID_FORMAT');
    }

    return { content, downloadInfo };
  }

  /**
   * Generate Markdown export format
   */
  generateMarkdownExport(book, options) {
    let content = `# ${book.title}\n\n`;

    if (options.includeMetadata) {
      content += `**Theme:** ${book.theme}\n`;
      content += `**Genre:** ${book.genre}\n`;
      content += `**Status:** ${book.status}\n`;
      content += `**Word Count:** ${book.metadata.wordCount}\n`;
      content += `**Created:** ${new Date(book.createdAt).toLocaleDateString()}\n\n`;
    }

    if (options.includeTableOfContents) {
      content += `## Table of Contents\n\n`;
      book.outline.chapters.forEach((chapter, index) => {
        content += `${index + 1}. [${chapter.title}](#chapter-${index + 1})\n`;
      });
      content += '\n';
    }

    // Add chapters (placeholder - would be populated with actual chapter content)
    book.outline.chapters.forEach((chapter, index) => {
      content += `## Chapter ${index + 1}: ${chapter.title}\n\n`;
      content += `${chapter.description}\n\n`;
      content += `*[Chapter content would be inserted here]*\n\n`;
    });

    return content;
  }

  /**
   * Generate HTML export format
   */
  generateHtmlExport(book, options) {
    let content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${book.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #333; }
        h2 { color: #666; margin-top: 30px; }
        .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .toc { background: #f9f9f9; padding: 15px; border-radius: 5px; }
        .toc ul { list-style-type: none; padding-left: 0; }
        .toc li { margin: 5px 0; }
        .chapter { margin-top: 40px; page-break-before: always; }
    </style>
</head>
<body>
    <h1>${book.title}</h1>`;

    if (options.includeMetadata) {
      content += `
    <div class="metadata">
        <strong>Theme:</strong> ${book.theme}<br>
        <strong>Genre:</strong> ${book.genre}<br>
        <strong>Status:</strong> ${book.status}<br>
        <strong>Word Count:</strong> ${book.metadata.wordCount}<br>
        <strong>Created:</strong> ${new Date(book.createdAt).toLocaleDateString()}
    </div>`;
    }

    if (options.includeTableOfContents) {
      content += `
    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>`;
      book.outline.chapters.forEach((chapter, index) => {
        content += `<li><a href="#chapter-${index + 1}">${index + 1}. ${chapter.title}</a></li>`;
      });
      content += `
        </ul>
    </div>`;
    }

    // Add chapters
    book.outline.chapters.forEach((chapter, index) => {
      content += `
    <div class="chapter" id="chapter-${index + 1}">
        <h2>Chapter ${index + 1}: ${chapter.title}</h2>
        <p>${chapter.description}</p>
        <p><em>[Chapter content would be inserted here]</em></p>
    </div>`;
    });

    content += `
</body>
</html>`;

    return content;
  }

  /**
   * Generate plain text export format
   */
  generateTextExport(book, options) {
    let content = `${book.title}\n${'='.repeat(book.title.length)}\n\n`;

    if (options.includeMetadata) {
      content += `Theme: ${book.theme}\n`;
      content += `Genre: ${book.genre}\n`;
      content += `Status: ${book.status}\n`;
      content += `Word Count: ${book.metadata.wordCount}\n`;
      content += `Created: ${new Date(book.createdAt).toLocaleDateString()}\n\n`;
    }

    // Add chapters
    book.outline.chapters.forEach((chapter, index) => {
      content += `Chapter ${index + 1}: ${chapter.title}\n`;
      content += `${'-'.repeat(chapter.title.length + 12)}\n\n`;
      content += `${chapter.description}\n\n`;
      content += `[Chapter content would be inserted here]\n\n`;
    });

    return content;
  }

  /**
   * Generate JSON export format
   */
  generateJsonExport(book) {
    return {
      bookId: book.bookId,
      title: book.title,
      theme: book.theme,
      genre: book.genre,
      status: book.status,
      outline: book.outline,
      config: book.config,
      progress: book.progress,
      metadata: {
        ...book.metadata,
        exportedAt: new Date().toISOString(),
      },
      chapters: book.outline.chapters.map((chapter, index) => ({
        number: index + 1,
        title: chapter.title,
        description: chapter.description,
        content: '[Chapter content would be inserted here]',
      })),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  }
}

module.exports = BookService;

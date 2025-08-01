const { AIClient } = require('../utils/aiClient');
const ConfigService = require('./ConfigService');
const ProgressService = require('./ProgressService');
const PageModel = require('../models/Page');
const BookModel = require('../models/Book');

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
    this.exportFormats = ['markdown', 'html', 'txt', 'json', 'pdf'];

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
        targetAudience:
          configResult.config.style?.targetAudience || configResult.config.targetAudience,
        writingStyle: configResult.config.style?.writingStyle || configResult.config.writingStyle,
      });

      // Create book project in database
      const bookProject = await BookModel.create({
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

      // Use the Book model's approveOutline method to properly update status
      const updatedBook = await BookModel.approveOutline(bookId, userId);
      if (!updatedBook) {
        throw new BookServiceError('Book not found or outline already approved', 'BOOK_NOT_FOUND');
      }

      // Record outline approval milestone
      await ProgressService.recordOutlineApproved(bookId, userId, {
        totalChapters: updatedBook.progress.totalChapters,
        approvedAt: updatedBook.outline.approvedAt,
      });

      logger.info(`[BookService] Outline approved for book: ${bookId}`);

      return {
        bookId: updatedBook.bookId,
        status: updatedBook.status,
        outline: updatedBook.outline,
        progress: updatedBook.progress,
        updatedAt: updatedBook.updatedAt,
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
      const book = await BookModel.findByIdAndUser(bookId, userId);
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

      const updatedBook = await BookModel.updateProgress(bookId, userId, progressData);
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

      const books = await BookModel.findByUser(userId);
      const statistics = await BookModel.getStatistics(userId);

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

      const book = await BookModel.findByIdAndUser(bookId, userId);
      if (!book) {
        throw new BookServiceError('Book not found', 'BOOK_NOT_FOUND');
      }

      // Allow export at any time - no completion requirement needed

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

      const deleted = await BookModel.deleteByIdAndUser(bookId, userId);
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
   * Fetch all pages for a book organized by chapters
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Pages organized by chapter number
   */
  async fetchBookPages(bookId, userId) {
    try {
      const pages = await PageModel.find({
        bookId: bookId,
        user: userId,
        status: { $in: ['approved', 'pending'] }, // Include approved and pending pages
      }).sort({ chapterNumber: 1, pageNumber: 1 });

      // Organize pages by chapter
      const chapterPages = {};
      pages.forEach((page) => {
        if (!chapterPages[page.chapterNumber]) {
          chapterPages[page.chapterNumber] = [];
        }
        chapterPages[page.chapterNumber].push(page);
      });

      return chapterPages;
    } catch (error) {
      logger.error('[BookService] Error fetching book pages:', error);
      return {};
    }
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

    // Fetch actual page content for the book
    const chapterPages = await this.fetchBookPages(book.bookId, book.user);

    let content = '';
    let downloadInfo = {};

    switch (format) {
      case 'markdown':
        content = await this.generateMarkdownExport(book, chapterPages, {
          includeMetadata,
          includeTableOfContents,
        });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
          mimeType: 'text/markdown',
        };
        break;

      case 'html':
        content = await this.generateHtmlExport(book, chapterPages, {
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
        content = await this.generateTextExport(book, chapterPages, { includeMetadata });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
          mimeType: 'text/plain',
        };
        break;

      case 'json':
        content = JSON.stringify(await this.generateJsonExport(book, chapterPages), null, 2);
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
          mimeType: 'application/json',
        };
        break;

      case 'pdf':
        content = await this.generatePdfExport(book, {
          includeMetadata,
          includeTableOfContents,
          includePageNumbers: true, // Always include page numbers for PDF
        });
        downloadInfo = {
          filename: `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          mimeType: 'application/pdf',
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
  async generateMarkdownExport(book, chapterPages, options) {
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

    // Add chapters with actual page content
    book.outline.chapters.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      content += `## Chapter ${chapterNumber}: ${chapter.title}\n\n`;
      content += `${chapter.description}\n\n`;

      // Add actual page content if available
      const pages = chapterPages[chapterNumber] || [];
      if (pages.length > 0) {
        pages.forEach((page) => {
          content += `${page.content}\n\n`;
        });
      } else {
        content += `*[Chapter content not yet generated]*\n\n`;
      }
    });

    return content;
  }

  /**
   * Generate HTML export format
   */
  async generateHtmlExport(book, chapterPages, options) {
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

    // Add chapters with actual page content
    book.outline.chapters.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      content += `
    <div class="chapter" id="chapter-${chapterNumber}">
        <h2>Chapter ${chapterNumber}: ${chapter.title}</h2>
        <p>${chapter.description}</p>`;

      // Add actual page content if available
      const pages = chapterPages[chapterNumber] || [];
      if (pages.length > 0) {
        pages.forEach((page) => {
          // Convert line breaks to HTML paragraphs
          const pageHtml = page.content
            .split('\n\n')
            .map((paragraph) =>
              paragraph.trim() ? `<p>${paragraph.replace(/\n/g, '<br>')}</p>` : '',
            )
            .filter((p) => p)
            .join('\n        ');
          content += `\n        ${pageHtml}`;
        });
      } else {
        content += `\n        <p><em>[Chapter content not yet generated]</em></p>`;
      }

      content += `
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
  async generateTextExport(book, chapterPages, options) {
    let content = `${book.title}\n${'='.repeat(book.title.length)}\n\n`;

    if (options.includeMetadata) {
      content += `Theme: ${book.theme}\n`;
      content += `Genre: ${book.genre}\n`;
      content += `Status: ${book.status}\n`;
      content += `Word Count: ${book.metadata.wordCount}\n`;
      content += `Created: ${new Date(book.createdAt).toLocaleDateString()}\n\n`;
    }

    // Add chapters with actual page content
    book.outline.chapters.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      content += `Chapter ${chapterNumber}: ${chapter.title}\n`;
      content += `${'-'.repeat(chapter.title.length + 12)}\n\n`;
      content += `${chapter.description}\n\n`;

      // Add actual page content if available
      const pages = chapterPages[chapterNumber] || [];
      if (pages.length > 0) {
        pages.forEach((page) => {
          content += `${page.content}\n\n`;
        });
      } else {
        content += `[Chapter content not yet generated]\n\n`;
      }
    });

    return content;
  }

  /**
   * Generate JSON export format
   */
  async generateJsonExport(book, chapterPages) {
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
      chapters: book.outline.chapters.map((chapter, index) => {
        const chapterNumber = index + 1;
        const pages = chapterPages[chapterNumber] || [];
        const chapterContent =
          pages.length > 0
            ? pages.map((page) => page.content).join('\n\n')
            : '[Chapter content not yet generated]';

        return {
          number: chapterNumber,
          title: chapter.title,
          description: chapter.description,
          content: chapterContent,
          pages: pages.map((page) => ({
            pageNumber: page.pageNumber,
            content: page.content,
            status: page.status,
            wordCount: page.content.split(/\s+/).filter((word) => word.length > 0).length,
          })),
        };
      }),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  }

  /**
   * Generate PDF export format
   */
  async generatePdfExport(book, chapterPages, options) {
    try {
      // First generate HTML content
      const htmlContent = await this.generateHtmlExport(book, chapterPages, {
        ...options,
        includePageNumbers: true,
      });

      // Enhanced CSS for better PDF formatting
      const enhancedHtml = htmlContent.replace(
        /<style>[\s\S]*?<\/style>/,
        `<style>
        @page {
          margin: 1in;
          @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10pt;
            font-family: Arial, sans-serif;
          }
        }
        body {
          font-family: "Times New Roman", serif;
          font-size: 12pt;
          line-height: 1.6;
          max-width: none;
          margin: 0;
          padding: 0;
          color: #000;
        }
        h1 {
          color: #000;
          border-bottom: 2px solid #000;
          page-break-before: always;
          margin-top: 0;
          font-size: 24pt;
          text-align: center;
        }
        h2 {
          color: #333;
          margin-top: 30px;
          page-break-before: always;
          font-size: 18pt;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }
        .metadata {
          background: #f8f8f8;
          padding: 15px;
          border: 1px solid #ddd;
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .toc {
          background: #f9f9f9;
          padding: 15px;
          border: 1px solid #ddd;
          page-break-after: always;
          page-break-inside: avoid;
        }
        .toc h2 {
          page-break-before: avoid;
          margin-top: 0;
        }
        .toc ul {
          list-style-type: none;
          padding-left: 0;
        }
        .toc li {
          margin: 5px 0;
          padding: 3px 0;
          border-bottom: 1px dotted #ccc;
        }
        .chapter {
          margin-top: 40px;
          page-break-before: always;
          page-break-inside: avoid;
        }
        .chapter:first-of-type {
          page-break-before: avoid;
        }
        p {
          text-align: justify;
          margin-bottom: 12pt;
          orphans: 2;
          widows: 2;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
        </style>`,
      );

      // Use puppeteer to generate PDF (when available)
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        await page.setContent(enhancedHtml, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '1in',
            right: '1in',
            bottom: '1in',
            left: '1in',
          },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: `
            <div style="font-size: 10px; text-align: center; width: 100%; margin: 0 auto;">
              <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
          `,
        });

        await browser.close();

        // Convert buffer to base64 for transport
        return pdfBuffer.toString('base64');
      } catch (puppeteerError) {
        logger.warn(
          '[BookService] Puppeteer not available, returning HTML content:',
          puppeteerError.message,
        );
        // Fallback to HTML if puppeteer is not available
        return enhancedHtml;
      }
    } catch (error) {
      logger.error('[BookService] Error generating PDF export:', error);
      throw new BookServiceError(
        `Failed to generate PDF export: ${error.message}`,
        'PDF_GENERATION_FAILED',
        {
          originalError: error.message,
        },
      );
    }
  }
}

module.exports = BookService;

/**
 * List Books MCP Tool
 *
 * Implements the list_books MCP tool for displaying user's book projects.
 * Provides filtering, sorting, and pagination options for book management.
 */

const BookService = require('../services/BookService');
const {
  validateListBooksParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for list_books
 */
const listBooksTool = {
  name: 'list_books',
  description:
    'List all book projects for the current user with filtering and sorting options. Displays project status, progress, and metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['outline_pending', 'in_progress', 'completed', 'cancelled'],
        description: 'Filter books by status',
      },
      genre: {
        type: 'string',
        enum: ['fiction', 'non-fiction', 'technical', 'educational'],
        description: 'Filter books by genre',
      },
      sortBy: {
        type: 'string',
        enum: ['created', 'updated', 'title', 'progress', 'status'],
        default: 'updated',
        description: 'Sort books by specified field',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort order (ascending or descending)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Maximum number of books to return',
      },
      offset: {
        type: 'number',
        minimum: 0,
        default: 0,
        description: 'Number of books to skip (for pagination)',
      },
      includeDetails: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information about each book (outline, configuration, etc.)',
      },
    },
  },

  /**
   * Execute the list_books tool
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context with user information
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params, context) {
    try {
      // Extract user ID from context
      const userId = context?.user?.id || context?.userId;
      if (!userId) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required to list books',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateListBooksParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'List books parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      // Prepare query options
      const queryOptions = {
        status: sanitizedParams.status,
        genre: sanitizedParams.genre,
        sortBy: sanitizedParams.sortBy || 'updated',
        sortOrder: sanitizedParams.sortOrder || 'desc',
        limit: sanitizedParams.limit || 20,
        skip: sanitizedParams.offset || 0,
      };

      // Create book service instance
      const bookService = new BookService({
        models: context.serverModels || context.models,
      });

      // Get books list with statistics
      const booksResult = await bookService.listBooks(userId, queryOptions);

      // Format books data based on detail level
      const formattedBooks = booksResult.books.map((book) => {
        const baseBookData = {
          bookId: book.bookId,
          title: book.title,
          theme: book.theme,
          genre: book.genre,
          status: book.status,
          progress: {
            completionPercentage: book.progress.completionPercentage,
            currentChapter: book.progress.currentChapter,
            completedChapters: book.progress.completedChapters,
            totalChapters: book.progress.totalChapters,
            currentPhase: book.progress.currentPhase,
          },
          metadata: {
            wordCount: book.metadata.wordCount,
            estimatedReadingTime: book.metadata.estimatedReadingTime,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt,
          },
        };

        // Add detailed information if requested
        if (sanitizedParams.includeDetails) {
          baseBookData.details = {
            outline: book.outline
              ? {
                chapters: book.outline.chapters,
                approvedAt: book.outline.approvedAt,
              }
              : null,
            configuration: {
              chapterCount: book.config?.content?.chapterCount,
              writingStyle: book.config?.style?.writingStyle,
              tone: book.config?.style?.tone,
              targetAudience: book.config?.style?.targetAudience,
              averageChapterLength: book.config?.content?.averageChapterLength,
            },
            nextAction: this.getNextAction(book),
          };
        }

        return baseBookData;
      });

      // Prepare summary statistics
      const summary = {
        totalBooks: booksResult.total,
        filteredCount: formattedBooks.length,
        statusBreakdown: booksResult.statistics.statusBreakdown || {},
        genreBreakdown: booksResult.statistics.genreBreakdown || {},
        averageProgress: booksResult.statistics.averageProgress || 0,
        totalWordCount: booksResult.statistics.totalWordCount || 0,
      };

      // Prepare pagination info
      const pagination = {
        limit: queryOptions.limit,
        offset: queryOptions.skip,
        hasMore: queryOptions.skip + formattedBooks.length < booksResult.total,
        nextOffset: queryOptions.skip + queryOptions.limit,
        totalPages: Math.ceil(booksResult.total / queryOptions.limit),
        currentPage: Math.floor(queryOptions.skip / queryOptions.limit) + 1,
      };

      // Prepare filter info
      const appliedFilters = {
        status: sanitizedParams.status || 'all',
        genre: sanitizedParams.genre || 'all',
        sortBy: queryOptions.sortBy,
        sortOrder: queryOptions.sortOrder,
      };

      return {
        success: true,
        data: {
          books: formattedBooks,
          summary: summary,
          pagination: pagination,
          filters: appliedFilters,
          recommendations: this.generateRecommendations(formattedBooks, summary),
        },
        message: `Found ${formattedBooks.length} book${formattedBooks.length !== 1 ? 's' : ''} ${sanitizedParams.status ? `with status "${sanitizedParams.status}"` : ''
          }${sanitizedParams.genre ? ` in genre "${sanitizedParams.genre}"` : ''}.`,
      };
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'BookServiceError') {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      // Handle unexpected errors
      console.error('[ListBooksTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing books',
          details: {
            error: error.message,
          },
        },
      };
    }
  },

  /**
   * Determine the next action for a book based on its current state
   * @param {Object} book - Book object
   * @returns {Object} Next action information
   */
  getNextAction(book) {
    switch (book.status) {
      case 'outline_pending':
        return {
          action: 'approve_outline',
          description: 'Review and approve the book outline to begin chapter generation',
          priority: 'high',
        };
      case 'in_progress':
        if (book.progress.currentChapter <= book.progress.totalChapters) {
          return {
            action: 'approve_chapter',
            description: `Review and approve chapter ${book.progress.currentChapter}`,
            priority: 'high',
            chapterNumber: book.progress.currentChapter,
          };
        } else {
          return {
            action: 'complete_book',
            description: 'All chapters completed, ready to mark book as finished',
            priority: 'medium',
          };
        }
      case 'completed':
        return {
          action: 'export_book',
          description: 'Export the completed book in your preferred format',
          priority: 'low',
        };
      case 'cancelled':
        return {
          action: 'resume_or_delete',
          description: 'Resume work on this book or delete it permanently',
          priority: 'low',
        };
      default:
        return {
          action: 'review',
          description: 'Review book status and take appropriate action',
          priority: 'medium',
        };
    }
  },

  /**
   * Generate recommendations based on user's book collection
   * @param {Array} books - User's books
   * @param {Object} summary - Summary statistics
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(books, summary) {
    const recommendations = [];

    // Check for books needing attention
    const pendingOutlines = books.filter((book) => book.status === 'outline_pending');
    if (pendingOutlines.length > 0) {
      recommendations.push({
        type: 'action_needed',
        priority: 'high',
        message: `You have ${pendingOutlines.length} book${pendingOutlines.length !== 1 ? 's' : ''} waiting for outline approval`,
        action: 'approve_outline',
        bookIds: pendingOutlines.map((book) => book.bookId),
      });
    }

    // Check for stalled progress
    const inProgressBooks = books.filter((book) => book.status === 'in_progress');
    const stalledBooks = inProgressBooks.filter((book) => {
      const daysSinceUpdate =
        (Date.now() - new Date(book.metadata.updatedAt)) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 7; // More than a week since last update
    });

    if (stalledBooks.length > 0) {
      recommendations.push({
        type: 'productivity',
        priority: 'medium',
        message: `${stalledBooks.length} book${stalledBooks.length !== 1 ? 's' : ''} haven't been updated in over a week`,
        action: 'resume_progress',
        bookIds: stalledBooks.map((book) => book.bookId),
      });
    }

    // Check for completed books not exported
    const completedBooks = books.filter((book) => book.status === 'completed');
    if (completedBooks.length > 0) {
      recommendations.push({
        type: 'completion',
        priority: 'low',
        message: `You have ${completedBooks.length} completed book${completedBooks.length !== 1 ? 's' : ''} ready for export`,
        action: 'export_book',
        bookIds: completedBooks.map((book) => book.bookId),
      });
    }

    // Productivity insights
    if (summary.averageProgress > 0 && summary.averageProgress < 50) {
      recommendations.push({
        type: 'insight',
        priority: 'low',
        message: `Your books are ${Math.round(summary.averageProgress)}% complete on average. Consider focusing on one book at a time for better progress.`,
        action: 'focus_strategy',
      });
    }

    return recommendations;
  },
};

module.exports = listBooksTool;

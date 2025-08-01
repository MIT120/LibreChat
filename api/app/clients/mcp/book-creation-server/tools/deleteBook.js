/**
 * Delete Book MCP Tool
 * 
 * Implements the delete_book MCP tool for removing book projects.
 * Provides safe deletion with confirmation and cleanup of associated data.
 */

const BookService = require('../services/BookService');
const { validateDeleteBookParams, sanitizeAndValidate, formatValidationErrors } = require('../utils/validators');

/**
 * MCP Tool Definition for delete_book
 */
const deleteBookTool = {
  name: 'delete_book',
  description: 'Delete a book project and all associated data. This action is irreversible and requires explicit confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project to delete'
      },
      confirm: {
        type: 'boolean',
        description: 'Explicit confirmation that you want to delete the book (must be true)'
      },
      reason: {
        type: 'string',
        description: 'Optional reason for deletion (for logging purposes)',
        enum: ['no_longer_needed', 'duplicate', 'test_project', 'starting_over', 'other']
      },
      backupFirst: {
        type: 'boolean',
        default: false,
        description: 'Whether to create a backup before deletion'
      }
    },
    required: ['bookId', 'confirm']
  },

  /**
   * Execute the delete_book tool
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
            message: 'User authentication required to delete books'
          }
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateDeleteBookParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Delete book parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params)
            }
          }
        };
      }

      const sanitizedParams = validationResult.params;

      // Additional safety check for confirmation
      if (sanitizedParams.confirm !== true) {
        return {
          success: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Explicit confirmation required to delete book. Set confirm parameter to true.',
            details: {
              warning: 'Book deletion is irreversible',
              requiredParameter: 'confirm: true'
            }
          }
        };
      }

      // Create book service instance
      const bookService = new BookService();

      // Get book information before deletion (for backup and confirmation)
      let bookInfo = null;
      let backupData = null;

      try {
        bookInfo = await bookService.getBookProgress(userId, sanitizedParams.bookId);
        
        // Create backup if requested
        if (sanitizedParams.backupFirst) {
          backupData = await this.createBookBackup(bookService, userId, sanitizedParams.bookId, bookInfo);
        }
      } catch (error) {
        // If book doesn't exist, return appropriate error
        if (error.code === 'BOOK_NOT_FOUND') {
          return {
            success: false,
            error: {
              code: 'BOOK_NOT_FOUND',
              message: 'The specified book project could not be found',
              details: {
                bookId: sanitizedParams.bookId,
                possibleReasons: [
                  'Book ID is incorrect',
                  'Book has already been deleted',
                  'You do not have access to this book'
                ]
              }
            }
          };
        }
        
        // For other errors, continue with deletion attempt
        console.warn('[DeleteBookTool] Could not retrieve book info before deletion:', error.message);
      }

      // Perform the deletion
      const deletionResult = await bookService.deleteBook(userId, sanitizedParams.bookId);

      if (!deletionResult) {
        return {
          success: false,
          error: {
            code: 'DELETION_FAILED',
            message: 'Failed to delete the book project',
            details: {
              bookId: sanitizedParams.bookId,
              possibleReasons: [
                'Book not found',
                'Insufficient permissions',
                'Database error'
              ]
            }
          }
        };
      }

      // Log deletion for audit purposes
      this.logDeletion(userId, sanitizedParams.bookId, bookInfo, sanitizedParams.reason);

      // Prepare success response
      const responseData = {
        deletedBook: {
          bookId: sanitizedParams.bookId,
          title: bookInfo?.title || 'Unknown',
          deletedAt: new Date().toISOString(),
          reason: sanitizedParams.reason || 'not_specified'
        },
        cleanup: {
          bookDataRemoved: true,
          chaptersRemoved: true,
          associatedDataRemoved: true
        }
      };

      // Include backup information if backup was created
      if (backupData) {
        responseData.backup = {
          created: true,
          format: backupData.format,
          size: backupData.size,
          content: backupData.content,
          createdAt: backupData.createdAt,
          instructions: 'Backup data is included in this response. Save it if you need to restore the book later.'
        };
      }

      // Add statistics about what was deleted
      if (bookInfo) {
        responseData.deletionSummary = {
          chaptersDeleted: bookInfo.progress?.totalChapters || 0,
          completedChapters: bookInfo.progress?.completedChapters || 0,
          totalWordCount: bookInfo.metadata?.wordCount || 0,
          bookAge: this.calculateBookAge(bookInfo.metadata?.createdAt),
          completionPercentage: bookInfo.progress?.completionPercentage || 0
        };
      }

      // Provide recommendations based on deletion
      responseData.recommendations = this.generatePostDeletionRecommendations(
        bookInfo,
        sanitizedParams.reason
      );

      return {
        success: true,
        data: responseData,
        message: `Book "${bookInfo?.title || sanitizedParams.bookId}" has been permanently deleted${
          backupData ? ' (backup created)' : ''
        }. All associated chapters and data have been removed.`,
        warnings: [
          'This action cannot be undone',
          'All chapter content has been permanently removed',
          backupData ? 'Backup data is included in this response - save it if needed' : 'No backup was created'
        ]
      };

    } catch (error) {
      // Handle different types of errors
      if (error.name === 'BookServiceError') {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
      }

      // Handle unexpected errors
      console.error('[DeleteBookTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the book',
          details: {
            error: error.message,
            bookId: params.bookId
          }
        }
      };
    }
  },

  /**
   * Create a backup of the book before deletion
   * @param {BookService} bookService - Book service instance
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {Object} bookInfo - Book information
   * @returns {Promise<Object>} Backup data
   */
  async createBookBackup(bookService, userId, bookId, bookInfo) {
    try {
      // Export book as JSON for complete backup
      const exportResult = await bookService.exportBook(userId, bookId, 'json', {
        includeMetadata: true,
        includeTableOfContents: true,
        includeChapterSummaries: true,
        includeGenerationInfo: true
      });

      return {
        format: 'json',
        content: exportResult.content,
        size: exportResult.content.length,
        createdAt: new Date().toISOString(),
        metadata: {
          originalTitle: bookInfo.title,
          originalBookId: bookId,
          backupReason: 'pre_deletion_backup',
          originalWordCount: bookInfo.metadata?.wordCount || 0,
          originalChapterCount: bookInfo.progress?.totalChapters || 0
        }
      };
    } catch (error) {
      console.warn('[DeleteBookTool] Failed to create backup:', error.message);
      // Return minimal backup with available information
      return {
        format: 'metadata_only',
        content: JSON.stringify({
          bookId: bookId,
          title: bookInfo.title,
          backupError: 'Could not create full backup',
          availableInfo: bookInfo
        }, null, 2),
        size: 0,
        createdAt: new Date().toISOString(),
        metadata: {
          backupType: 'partial',
          backupError: error.message
        }
      };
    }
  },

  /**
   * Log book deletion for audit purposes
   * @param {string} userId - User ID
   * @param {string} bookId - Book ID
   * @param {Object} bookInfo - Book information
   * @param {string} reason - Deletion reason
   */
  logDeletion(userId, bookId, bookInfo, reason) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'book_deleted',
      userId: userId,
      bookId: bookId,
      bookTitle: bookInfo?.title || 'Unknown',
      reason: reason || 'not_specified',
      bookStats: {
        totalChapters: bookInfo?.progress?.totalChapters || 0,
        completedChapters: bookInfo?.progress?.completedChapters || 0,
        wordCount: bookInfo?.metadata?.wordCount || 0,
        completionPercentage: bookInfo?.progress?.completionPercentage || 0
      }
    };

    // In a real implementation, this would write to an audit log
    console.log('[AUDIT] Book deletion:', JSON.stringify(logEntry));
  },

  /**
   * Calculate how long the book existed
   * @param {string} createdAt - Creation timestamp
   * @returns {Object} Age information
   */
  calculateBookAge(createdAt) {
    if (!createdAt) return { days: 0, description: 'Unknown' };

    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
      return {
        days: 0,
        hours: diffHours,
        description: diffHours === 0 ? 'Less than an hour' : `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
      };
    }

    return {
      days: diffDays,
      description: `${diffDays} day${diffDays !== 1 ? 's' : ''}`
    };
  },

  /**
   * Generate recommendations after book deletion
   * @param {Object} bookInfo - Book information
   * @param {string} reason - Deletion reason
   * @returns {Array} Array of recommendations
   */
  generatePostDeletionRecommendations(bookInfo, reason) {
    const recommendations = [];

    // Recommendations based on deletion reason
    switch (reason) {
      case 'starting_over':
        recommendations.push({
          type: 'action',
          message: 'Consider creating a new book project with the lessons learned from this one',
          action: 'create_book_project',
          priority: 'medium'
        });
        break;

      case 'duplicate':
        recommendations.push({
          type: 'organization',
          message: 'Review your existing books to avoid creating duplicates in the future',
          action: 'list_books',
          priority: 'low'
        });
        break;

      case 'no_longer_needed':
        recommendations.push({
          type: 'productivity',
          message: 'Focus on your remaining active book projects for better progress',
          priority: 'medium'
        });
        break;

      case 'test_project':
        recommendations.push({
          type: 'learning',
          message: 'Now that you\'re familiar with the system, consider starting your main book project',
          action: 'create_book_project',
          priority: 'high'
        });
        break;
    }

    // Recommendations based on book progress
    if (bookInfo?.progress?.completionPercentage > 50) {
      recommendations.push({
        type: 'warning',
        message: 'You deleted a book that was more than 50% complete. Consider if this was intentional.',
        priority: 'high'
      });
    }

    if (bookInfo?.progress?.completedChapters > 0) {
      recommendations.push({
        type: 'content',
        message: `You had ${bookInfo.progress.completedChapters} completed chapters. Consider if any content could be reused in future projects.`,
        priority: 'medium'
      });
    }

    // General recommendations
    recommendations.push({
      type: 'backup',
      message: 'Consider enabling automatic backups for future book projects to prevent data loss',
      priority: 'low'
    });

    return recommendations;
  }
};

module.exports = deleteBookTool;
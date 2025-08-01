/**
 * Get Status Updates MCP Tool
 *
 * Implements the get_status_updates MCP tool for retrieving real-time progress updates
 * and status messages for active book projects.
 */

const StatusMessageService = require('../services/StatusMessageService');
const ProgressService = require('../services/ProgressService');
const {
  validateGetStatusUpdatesParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for get_status_updates
 */
const getStatusUpdatesTool = {
  name: 'get_status_updates',
  description:
    'Get real-time status updates and progress information for book projects. Returns formatted status messages for chat interface display.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'Optional: Get status for a specific book. If omitted, returns all active books.',
      },
      includeCompleted: {
        type: 'boolean',
        default: false,
        description: 'Include completed books in the status updates',
      },
      includeProgressSummary: {
        type: 'boolean',
        default: true,
        description: 'Include overall progress summary for the user',
      },
      format: {
        type: 'string',
        enum: ['detailed', 'summary', 'minimal'],
        default: 'detailed',
        description: 'Level of detail in the status updates',
      },
    },
    required: [],
  },

  /**
   * Execute the get_status_updates tool
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
            message: 'User authentication required for status updates',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateGetStatusUpdatesParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Status update parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      let statusUpdates = [];
      let progressSummary = null;

      if (sanitizedParams.bookId) {
        // Get status for specific book
        const bookStatus = await StatusMessageService.generateBookStatusUpdate(
          sanitizedParams.bookId,
          userId,
        );

        if (bookStatus.type !== 'error') {
          statusUpdates.push(bookStatus);
        } else {
          return {
            success: false,
            error: {
              code: 'BOOK_NOT_FOUND',
              message: bookStatus.message,
              details: bookStatus.details,
            },
          };
        }
      } else {
        // Get status for all active books
        const activeUpdates = await StatusMessageService.generateActiveStatusUpdates(userId);
        statusUpdates = activeUpdates;

        // Include completed books if requested
        if (sanitizedParams.includeCompleted) {
          const completedProgress = await ProgressService.getUserProgressSummary(userId, {
            phase: 'completed',
            limit: 5,
          });

          for (const progress of completedProgress) {
            const completedStatus = await StatusMessageService.generateBookStatusUpdate(
              progress.bookId,
              userId,
            );
            if (completedStatus.type !== 'error') {
              statusUpdates.push(completedStatus);
            }
          }
        }
      }

      // Generate progress summary if requested
      if (sanitizedParams.includeProgressSummary && !sanitizedParams.bookId) {
        progressSummary = await StatusMessageService.generateProgressSummary(userId);
      }

      // Format response based on requested detail level
      const responseData = this.formatStatusResponse(
        statusUpdates,
        progressSummary,
        sanitizedParams.format,
      );

      // Generate appropriate message
      let message;
      if (sanitizedParams.bookId) {
        message = statusUpdates.length > 0 
          ? `Status update for book retrieved successfully.`
          : 'No status updates available for the specified book.';
      } else {
        message = statusUpdates.length > 0 
          ? `Retrieved ${statusUpdates.length} active book status update${statusUpdates.length !== 1 ? 's' : ''}.`
          : 'No active book projects found.';
      }

      return {
        success: true,
        data: responseData,
        message: message,
      };
    } catch (error) {
      // Handle unexpected errors
      console.error('[GetStatusUpdatesTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving status updates',
          details: {
            error: error.message,
          },
        },
      };
    }
  },

  /**
   * Format status response based on detail level
   * @param {Array} statusUpdates - Array of status updates
   * @param {Object} progressSummary - Progress summary object
   * @param {string} format - Detail level (detailed, summary, minimal)
   * @returns {Object} Formatted response data
   */
  formatStatusResponse(statusUpdates, progressSummary, format) {
    const baseResponse = {
      statusUpdates: statusUpdates,
      progressSummary: progressSummary,
      timestamp: new Date().toISOString(),
      totalUpdates: statusUpdates.length,
    };

    switch (format) {
      case 'minimal':
        return {
          statusUpdates: statusUpdates.map(update => ({
            bookId: update.bookId,
            bookTitle: update.bookTitle,
            phase: update.phase,
            percentComplete: update.percentComplete,
            type: update.type,
            message: update.message,
          })),
          totalUpdates: statusUpdates.length,
          timestamp: baseResponse.timestamp,
        };

      case 'summary':
        return {
          statusUpdates: statusUpdates.map(update => ({
            bookId: update.bookId,
            bookTitle: update.bookTitle,
            phase: update.phase,
            percentComplete: update.percentComplete,
            completedChapters: update.completedChapters,
            totalChapters: update.totalChapters,
            type: update.type,
            message: update.message,
            details: update.details,
            action: update.action,
            progressIndicator: update.progressIndicator,
          })),
          progressSummary: progressSummary ? {
            totalBooks: progressSummary.summary?.totalBooks,
            activeBooks: progressSummary.summary?.activeBooks,
            completedBooks: progressSummary.summary?.completedBooks,
            totalWords: progressSummary.summary?.totalWords,
          } : null,
          totalUpdates: statusUpdates.length,
          timestamp: baseResponse.timestamp,
        };

      case 'detailed':
      default:
        return baseResponse;
    }
  },
};

module.exports = getStatusUpdatesTool;
/**
 * Approve Chapter MCP Tool
 *
 * Implements the approve_chapter MCP tool for approving chapters and proceeding to the next chapter.
 * Handles chapter status updates, summary generation, and automatic next chapter generation.
 */

const BookService = require('../services/BookService');
const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
  validateApproveChapterParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for approve_chapter
 */
const approveChapterTool = {
  name: 'approve_chapter',
  description:
    'Approve a chapter and proceed to the next chapter generation. Updates chapter status, creates summary for context, and triggers next chapter generation.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project',
      },
      chapterId: {
        type: 'string',
        description: 'The unique identifier of the chapter to approve',
      },
      feedback: {
        type: 'string',
        description: 'Optional feedback about the chapter for future context',
      },
    },
    required: ['bookId', 'chapterId'],
  },

  /**
   * Execute the approve_chapter tool
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
            message: 'User authentication required for chapter approval',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateApproveChapterParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Chapter approval parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      // Create service instances
      const bookService = new BookService();
      const chapterService = new ChapterService();

      // Approve the chapter and generate summary
      const approvalResult = await chapterService.approveChapter(
        userId,
        sanitizedParams.bookId,
        sanitizedParams.chapterId,
        sanitizedParams.feedback,
      );

      // Generate chapter approval status message
      const approvalMessage = StatusMessageService.generateWorkflowStageMessage(
        'chapter_approved',
        {
          chapterNumber: approvalResult.chapterNumber,
          chapterTitle: approvalResult.title,
          completedChapters: approvalResult.bookProgress.completedChapters,
          totalChapters: approvalResult.bookProgress.totalChapters,
          percentComplete: approvalResult.bookProgress.completionPercentage,
        },
      );

      // Update book progress
      const progressUpdate = await bookService.updateProgress(userId, sanitizedParams.bookId, {
        completedChapters: approvalResult.completedChapters,
        currentChapter: approvalResult.nextChapterNumber,
      });

      // Check if book is complete
      const isBookComplete = approvalResult.nextChapterNumber > approvalResult.totalChapters;

      let nextChapterResult = null;
      let bookCompletionResult = null;

      let completionMessage = null;
      let nextChapterMessage = null;

      if (isBookComplete) {
        // Mark book as completed
        try {
          bookCompletionResult = await bookService.updateProgress(userId, sanitizedParams.bookId, {
            status: 'completed',
          });

          // Generate book completion message
          completionMessage = await StatusMessageService.generateCompletionNotification(
            sanitizedParams.bookId,
            userId,
          );
        } catch (completionError) {
          console.error('[ApproveChapterTool] Error marking book as complete:', completionError);
        }
      } else {
        // Generate next chapter
        try {
          nextChapterResult = await chapterService.generateChapter(
            sanitizedParams.bookId,
            approvalResult.nextChapterNumber,
            {
              userId,
              previousSummaries: approvalResult.allSummaries,
              feedback: sanitizedParams.feedback,
            },
          );

          // Generate next chapter ready message
          if (nextChapterResult) {
            nextChapterMessage = StatusMessageService.generateWorkflowStageMessage(
              'chapter_ready',
              {
                chapterNumber: nextChapterResult.chapterNumber,
                chapterTitle: nextChapterResult.title,
                wordCount: nextChapterResult.wordCount,
                estimatedReadingTime: nextChapterResult.estimatedReadingTime,
              },
            );
          }
        } catch (chapterError) {
          console.error('[ApproveChapterTool] Error generating next chapter:', chapterError);
          // Continue with approval even if next chapter generation fails
        }
      }

      // Prepare response data
      const responseData = {
        bookId: sanitizedParams.bookId,
        approvedChapter: {
          chapterId: approvalResult.chapterId,
          title: approvalResult.title,
          chapterNumber: approvalResult.chapterNumber,
          status: 'approved',
          approvedAt: approvalResult.approvedAt,
          summary: approvalResult.summary,
          wordCount: approvalResult.wordCount,
        },
        progress: {
          status: isBookComplete ? 'completed' : 'in_progress',
          currentChapter: progressUpdate.progress.currentChapter,
          completedChapters: progressUpdate.progress.completedChapters,
          totalChapters: approvalResult.totalChapters,
          completionPercentage: progressUpdate.progress.completionPercentage,
        },
      };

      if (isBookComplete) {
        // Book completion response
        responseData.completion = {
          isComplete: true,
          completedAt: bookCompletionResult?.updatedAt || new Date(),
          totalWordCount: progressUpdate.metadata.wordCount,
          estimatedReadingTime: Math.round(progressUpdate.metadata.wordCount / 200),
        };
        responseData.nextSteps = {
          action: 'export_book',
          description: 'Your book is complete! You can now export it in various formats.',
          message: `Congratulations! Your book "${approvalResult.bookTitle || 'Untitled'}" is now complete with ${approvalResult.totalChapters} chapters. You can export it using the export_book tool.`,
        };
      } else if (nextChapterResult) {
        // Next chapter generated successfully
        responseData.nextChapter = {
          chapterId: nextChapterResult.chapterId,
          title: nextChapterResult.title,
          chapterNumber: nextChapterResult.chapterNumber,
          status: nextChapterResult.status,
          wordCount: nextChapterResult.wordCount,
          preview: nextChapterResult.content.substring(0, 200) + '...',
        };
        responseData.nextSteps = {
          action: 'approve_chapter',
          description: `Review chapter ${nextChapterResult.chapterNumber} and approve it to continue`,
          chapterNumber: nextChapterResult.chapterNumber,
          message: `Chapter ${approvalResult.chapterNumber} approved! Chapter ${nextChapterResult.chapterNumber} "${nextChapterResult.title}" has been generated and is ready for review.`,
        };
      } else {
        // Next chapter generation failed or not attempted
        responseData.nextSteps = {
          action: 'generate_chapter',
          description: `Generate chapter ${approvalResult.nextChapterNumber} manually`,
          chapterNumber: approvalResult.nextChapterNumber,
          message: `Chapter ${approvalResult.chapterNumber} approved! Please generate chapter ${approvalResult.nextChapterNumber} manually.`,
        };
      }

      // Prepare success message
      let message;
      if (isBookComplete) {
        message = `Chapter ${approvalResult.chapterNumber} approved and book completed! Your book is now ready for export.`;
      } else if (nextChapterResult) {
        message = `Chapter ${approvalResult.chapterNumber} approved successfully! Chapter ${nextChapterResult.chapterNumber} "${nextChapterResult.title}" has been generated and is awaiting your review.`;
      } else {
        message = `Chapter ${approvalResult.chapterNumber} approved successfully! Ready to generate chapter ${approvalResult.nextChapterNumber}.`;
      }

      // Collect status messages
      const statusMessages = [approvalMessage];
      if (completionMessage) {
        statusMessages.push(completionMessage);
      }
      if (nextChapterMessage) {
        statusMessages.push(nextChapterMessage);
      }

      return {
        success: true,
        data: {
          ...responseData,
          statusMessages,
          currentStatus: completionMessage || nextChapterMessage || approvalMessage,
        },
        message: message,
      };
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'ChapterServiceError') {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

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
      console.error('[ApproveChapterTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while approving the chapter',
          details: {
            error: error.message,
          },
        },
      };
    }
  },
};

module.exports = approveChapterTool;

/**
 * Approve Outline MCP Tool
 *
 * Implements the approve_outline MCP tool for approving book outlines and starting chapter generation.
 * Transitions book status from outline_pending to in_progress and initiates the chapter workflow.
 */

const BookService = require('../services/BookService');
const ChapterService = require('../services/ChapterService');
const {
  validateApproveOutlineParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for approve_outline
 */
const approveOutlineTool = {
  name: 'approve_outline',
  description:
    'Approve a book outline and start the chapter generation workflow. Transitions the book from outline_pending to in_progress status.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project',
      },
      feedback: {
        type: 'string',
        description: 'Optional feedback or modifications for the outline before approval',
      },
    },
    required: ['bookId'],
  },

  /**
   * Execute the approve_outline tool
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
            message: 'User authentication required for outline approval',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateApproveOutlineParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Outline approval parameters'),
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

      // Approve the outline and transition book status
      const updatedBook = await bookService.approveOutline(userId, sanitizedParams.bookId);

      // Start generation of the first chapter
      let firstChapterResult = null;
      try {
        firstChapterResult = await chapterService.generateChapter(
          sanitizedParams.bookId,
          1, // First chapter
          {
            userId,
            feedback: sanitizedParams.feedback,
            isFirstChapter: true,
          },
        );
      } catch (chapterError) {
        console.error('[ApproveOutlineTool] Error generating first chapter:', chapterError);
        // Continue with outline approval even if chapter generation fails
        // The user can manually trigger chapter generation later
      }

      // Return structured response with updated status and next steps
      return {
        success: true,
        data: {
          bookId: updatedBook.bookId,
          status: updatedBook.status,
          outline: {
            approvedAt: updatedBook.outline.approvedAt,
            chapters: updatedBook.outline.chapters,
          },
          progress: {
            status: updatedBook.status,
            currentChapter: updatedBook.progress.currentChapter,
            completedChapters: updatedBook.progress.completedChapters,
            totalChapters: updatedBook.progress.totalChapters,
            completionPercentage: Math.round(
              (updatedBook.progress.completedChapters / updatedBook.progress.totalChapters) * 100,
            ),
          },
          firstChapter: firstChapterResult
            ? {
                chapterId: firstChapterResult.chapterId,
                title: firstChapterResult.title,
                status: firstChapterResult.status,
                wordCount: firstChapterResult.wordCount,
                preview: firstChapterResult.content.substring(0, 200) + '...',
              }
            : null,
          nextSteps: {
            action: firstChapterResult ? 'approve_chapter' : 'generate_chapter',
            description: firstChapterResult
              ? 'Review the first chapter and approve it to continue'
              : 'Generate the first chapter manually using the generate_chapter tool',
            chapterNumber: 1,
            message: firstChapterResult
              ? `Outline approved! The first chapter "${firstChapterResult.title}" has been generated and is ready for your review. Use the approve_chapter tool to proceed.`
              : 'Outline approved! You can now start generating chapters. The first chapter is ready to be generated.',
          },
        },
        message: `Outline approved successfully! Book status changed to "${updatedBook.status}". ${
          firstChapterResult
            ? `First chapter "${firstChapterResult.title}" has been generated and is awaiting your approval.`
            : 'You can now begin chapter generation.'
        }`,
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

      if (error.name === 'ChapterServiceError') {
        // If chapter generation fails but outline approval succeeded,
        // return partial success
        return {
          success: true,
          data: {
            bookId: params.bookId,
            status: 'in_progress',
            warning: 'Outline approved but first chapter generation failed',
            nextSteps: {
              action: 'generate_chapter',
              description: 'Manually generate the first chapter',
              chapterNumber: 1,
              message:
                'Outline approved successfully, but automatic chapter generation encountered an issue. Please try generating the first chapter manually.',
            },
          },
          message:
            'Outline approved with warnings. Chapter generation needs to be triggered manually.',
          warnings: [error.message],
        };
      }

      // Handle unexpected errors
      console.error('[ApproveOutlineTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while approving the outline',
          details: {
            error: error.message,
          },
        },
      };
    }
  },
};

module.exports = approveOutlineTool;

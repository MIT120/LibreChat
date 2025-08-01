/**
 * Regenerate Chapter MCP Tool
 *
 * Implements the regenerate_chapter MCP tool for regenerating chapters with user feedback.
 * Allows users to request chapter regeneration with specific feedback for improvements.
 */

const ChapterService = require('../services/ChapterService');
const {
  validateRegenerateChapterParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for regenerate_chapter
 */
const regenerateChapterTool = {
  name: 'regenerate_chapter',
  description:
    'Regenerate a chapter with user feedback for improvements. Creates a new version of the chapter incorporating the provided feedback.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project',
      },
      chapterId: {
        type: 'string',
        description: 'The unique identifier of the chapter to regenerate',
      },
      feedback: {
        type: 'string',
        description: 'Specific feedback for improving the chapter (required for regeneration)',
      },
      regenerationOptions: {
        type: 'object',
        description: 'Optional settings for chapter regeneration',
        properties: {
          focusAreas: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['content', 'style', 'structure', 'tone', 'length', 'clarity'],
            },
            description: 'Specific areas to focus on during regeneration',
          },
          preserveElements: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Specific elements or sections to preserve from the original chapter',
          },
          targetWordCount: {
            type: 'number',
            minimum: 500,
            maximum: 10000,
            description: 'Target word count for the regenerated chapter',
          },
          styleAdjustments: {
            type: 'object',
            properties: {
              tone: {
                type: 'string',
                enum: ['more_formal', 'more_casual', 'more_technical', 'more_accessible'],
              },
              complexity: {
                type: 'string',
                enum: ['simpler', 'more_detailed', 'more_examples', 'more_concise'],
              },
            },
          },
        },
      },
    },
    required: ['bookId', 'chapterId', 'feedback'],
  },

  /**
   * Execute the regenerate_chapter tool
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
            message: 'User authentication required for chapter regeneration',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateRegenerateChapterParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(
              validationResult.errors,
              'Chapter regeneration parameters',
            ),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      // Validate regeneration options if provided
      const regenerationOptions = sanitizedParams.regenerationOptions || {};

      // Validate focus areas
      if (regenerationOptions.focusAreas) {
        const validFocusAreas = ['content', 'style', 'structure', 'tone', 'length', 'clarity'];
        const invalidAreas = regenerationOptions.focusAreas.filter(
          (area) => !validFocusAreas.includes(area),
        );
        if (invalidAreas.length > 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid focus areas: ${invalidAreas.join(', ')}. Valid areas are: ${validFocusAreas.join(', ')}`,
              details: {
                invalidAreas,
                validAreas: validFocusAreas,
              },
            },
          };
        }
      }

      // Create chapter service instance
      const chapterService = new ChapterService();

      // Prepare regeneration context
      const regenerationContext = {
        userId,
        feedback: sanitizedParams.feedback,
        options: {
          focusAreas: regenerationOptions.focusAreas || ['content'],
          preserveElements: regenerationOptions.preserveElements || [],
          targetWordCount: regenerationOptions.targetWordCount,
          styleAdjustments: regenerationOptions.styleAdjustments || {},
        },
      };

      // Regenerate the chapter
      const regeneratedChapter = await chapterService.regenerateChapter(
        userId,
        sanitizedParams.bookId,
        sanitizedParams.chapterId,
        regenerationContext,
      );

      // Prepare comparison data between original and regenerated versions
      const comparisonData = {
        changes: {
          wordCountChange:
            regeneratedChapter.wordCount - (regeneratedChapter.originalWordCount || 0),
          structureChanges: regeneratedChapter.structureChanges || [],
          contentChanges: regeneratedChapter.contentChanges || [],
          styleChanges: regeneratedChapter.styleChanges || [],
        },
        improvements: regeneratedChapter.improvements || [],
        preservedElements: regeneratedChapter.preservedElements || [],
      };

      // Return structured response with regenerated chapter
      return {
        success: true,
        data: {
          bookId: sanitizedParams.bookId,
          regeneratedChapter: {
            chapterId: regeneratedChapter.chapterId,
            title: regeneratedChapter.title,
            chapterNumber: regeneratedChapter.chapterNumber,
            status: regeneratedChapter.status,
            content: regeneratedChapter.content,
            wordCount: regeneratedChapter.wordCount,
            regeneratedAt: regeneratedChapter.updatedAt,
            version: regeneratedChapter.version || 2,
            preview: regeneratedChapter.content.substring(0, 300) + '...',
          },
          regenerationDetails: {
            feedback: sanitizedParams.feedback,
            focusAreas: regenerationContext.options.focusAreas,
            preservedElements: regenerationContext.options.preserveElements,
            appliedChanges: comparisonData.changes,
            improvements: comparisonData.improvements,
          },
          comparison: {
            originalWordCount: regeneratedChapter.originalWordCount || 0,
            newWordCount: regeneratedChapter.wordCount,
            wordCountDifference: comparisonData.changes.wordCountChange,
            significantChanges:
              comparisonData.changes.contentChanges.length > 0 ||
              comparisonData.changes.structureChanges.length > 0,
          },
          nextSteps: {
            action: 'approve_chapter',
            description:
              'Review the regenerated chapter and approve it to continue, or regenerate again with different feedback',
            alternatives: [
              {
                action: 'approve_chapter',
                description: 'Approve the regenerated chapter if satisfied',
              },
              {
                action: 'regenerate_chapter',
                description: 'Regenerate again with additional feedback',
              },
            ],
            message: `Chapter ${regeneratedChapter.chapterNumber} has been regenerated based on your feedback. Please review the changes and approve if satisfied, or provide additional feedback for further regeneration.`,
          },
        },
        message: `Chapter ${regeneratedChapter.chapterNumber} "${regeneratedChapter.title}" has been successfully regenerated with ${Math.abs(comparisonData.changes.wordCountChange)} word ${comparisonData.changes.wordCountChange >= 0 ? 'increase' : 'decrease'}. The chapter is ready for your review.`,
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

      // Handle specific regeneration errors
      if (error.message.includes('regeneration limit')) {
        return {
          success: false,
          error: {
            code: 'REGENERATION_LIMIT_EXCEEDED',
            message: 'Maximum number of regeneration attempts reached for this chapter',
            details: {
              suggestion: 'Consider approving the current version or starting a new chapter',
            },
          },
        };
      }

      if (error.message.includes('chapter not found')) {
        return {
          success: false,
          error: {
            code: 'CHAPTER_NOT_FOUND',
            message: 'The specified chapter could not be found',
            details: {
              bookId: params.bookId,
              chapterId: params.chapterId,
            },
          },
        };
      }

      // Handle unexpected errors
      console.error('[RegenerateChapterTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while regenerating the chapter',
          details: {
            error: error.message,
          },
        },
      };
    }
  },
};

module.exports = regenerateChapterTool;

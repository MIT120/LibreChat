/**
 * Create Book Project MCP Tool
 *
 * Implements the create_book_project MCP tool for initiating new book creation projects.
 * Handles book project creation logic with AI outline generation and user approval workflow.
 */

const BookService = require('../services/BookService');
const StatusMessageService = require('../services/StatusMessageService');
const {
  validateCreateBookParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for create_book_project
 */
const createBookTool = {
  name: 'create_book_project',
  description:
    'Create a new book project with theme and configuration. Generates an AI-powered outline based on the provided theme and settings.',
  inputSchema: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description: 'The main theme/topic of the book',
      },
      title: {
        type: 'string',
        description: 'Proposed book title',
      },
      genre: {
        type: 'string',
        enum: ['fiction', 'non-fiction', 'technical', 'educational'],
        description: 'Book genre that determines writing style and structure',
      },
      chapterCount: {
        type: 'number',
        minimum: 3,
        maximum: 50,
        default: 10,
        description: 'Number of chapters in the book',
      },
      writingStyle: {
        type: 'string',
        enum: ['formal', 'casual', 'academic', 'creative'],
        default: 'casual',
        description: 'Writing style for the book content',
      },
      targetAudience: {
        type: 'string',
        description:
          'Target audience description (e.g., "general readers", "professionals", "students")',
      },
      config: {
        type: 'object',
        description: 'Optional advanced configuration for book generation',
        properties: {
          content: {
            type: 'object',
            properties: {
              averageChapterLength: {
                type: 'number',
                minimum: 500,
                maximum: 10000,
                default: 2000,
                description: 'Target word count per chapter',
              },
              includeIntroduction: {
                type: 'boolean',
                default: true,
                description: 'Include an introduction chapter',
              },
              includeConclusion: {
                type: 'boolean',
                default: true,
                description: 'Include a conclusion chapter',
              },
            },
          },
          style: {
            type: 'object',
            properties: {
              tone: {
                type: 'string',
                enum: ['professional', 'friendly', 'authoritative', 'conversational'],
                default: 'friendly',
                description: 'Tone of the writing',
              },
              perspective: {
                type: 'string',
                enum: ['first-person', 'second-person', 'third-person'],
                default: 'third-person',
                description: 'Narrative perspective',
              },
            },
          },
          generation: {
            type: 'object',
            properties: {
              temperature: {
                type: 'number',
                minimum: 0,
                maximum: 2,
                default: 0.7,
                description:
                  'AI generation creativity level (0 = deterministic, 2 = very creative)',
              },
              summaryLength: {
                type: 'string',
                enum: ['brief', 'detailed'],
                default: 'brief',
                description: 'Length of chapter summaries for context',
              },
            },
          },
        },
      },
    },
    required: ['theme', 'title', 'genre'],
  },

  /**
   * Execute the create_book_project tool
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
            message: 'User authentication required for book creation',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateCreateBookParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Book creation parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      // Prepare book data with configuration
      const bookData = {
        title: sanitizedParams.title,
        theme: sanitizedParams.theme,
        genre: sanitizedParams.genre,
        config: {
          content: {
            chapterCount: sanitizedParams.chapterCount || 10,
            averageChapterLength: sanitizedParams.config?.content?.averageChapterLength || 2000,
            includeIntroduction: sanitizedParams.config?.content?.includeIntroduction !== false,
            includeConclusion: sanitizedParams.config?.content?.includeConclusion !== false,
            includeBibliography: sanitizedParams.config?.content?.includeBibliography || false,
          },
          style: {
            writingStyle: sanitizedParams.writingStyle || 'casual',
            tone: sanitizedParams.config?.style?.tone || 'friendly',
            perspective: sanitizedParams.config?.style?.perspective || 'third-person',
            targetAudience: sanitizedParams.targetAudience || 'general readers',
          },
          generation: {
            temperature: sanitizedParams.config?.generation?.temperature || 0.7,
            summaryLength: sanitizedParams.config?.generation?.summaryLength || 'brief',
          },
        },
      };

      // Create book service instance
      const bookService = new BookService({
        models: context.serverModels || context.models,
      });

      // Generate status message for book creation start
      const startMessage = StatusMessageService.generateWorkflowStageMessage(
        'book_creation_started',
        {
          title: bookData.title,
          theme: bookData.theme,
          genre: bookData.genre,
          chapterCount: bookData.config.content.chapterCount,
        },
      );

      // Generate outline generation status
      const outlineGeneratingMessage = StatusMessageService.generateWorkflowStageMessage(
        'outline_generating',
        {
          title: bookData.title,
        },
      );

      // Create the book project with AI outline generation
      const bookProject = await bookService.createBookProject(userId, bookData);

      // Generate outline ready status
      const outlineReadyMessage = StatusMessageService.generateWorkflowStageMessage(
        'outline_ready',
        {
          title: bookProject.title,
          chapterCount: bookProject.outline.chapters.length,
        },
      );

      // Return structured response with project details and outline
      return {
        success: true,
        data: {
          bookId: bookProject.bookId,
          title: bookProject.title,
          theme: bookProject.theme,
          genre: bookProject.genre,
          status: bookProject.status,
          outline: {
            description: bookProject.outline.description,
            chapters: bookProject.outline.chapters.map((chapter, index) => ({
              number: index + 1,
              title: chapter.title,
              description: chapter.description,
            })),
          },
          configuration: {
            chapterCount: bookProject.config.chapterCount,
            writingStyle: bookProject.config.writingStyle,
            targetAudience: bookProject.config.targetAudience,
          },
          progress: {
            status: bookProject.status,
            currentChapter: bookProject.progress.currentChapter,
            totalChapters: bookProject.progress.totalChapters,
            completionPercentage: 0,
          },
          metadata: {
            createdAt: bookProject.createdAt,
            estimatedWordCount: bookProject.config.chapterCount * 2000, // Default 2000 words per chapter
            estimatedReadingTime: Math.round((bookProject.config.chapterCount * 2000) / 200), // 200 words per minute
          },
          nextSteps: {
            action: 'approve_outline',
            description: 'Review the generated outline and approve it to begin chapter generation',
            message: `Your book "${bookProject.title}" has been created with a ${bookProject.outline.chapters.length}-chapter outline. Please review the outline above and use the approve_outline tool to proceed with chapter generation.`,
          },
        },
        statusMessages: [startMessage, outlineGeneratingMessage, outlineReadyMessage],
        currentStatus: outlineReadyMessage,
        message: `Successfully created book project "${bookProject.title}" with ${bookProject.outline.chapters.length} chapters. The outline is ready for your review and approval.`,
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
      console.error('[CreateBookTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the book project',
          details: {
            error: error.message,
          },
        },
      };
    }
  },
};

module.exports = createBookTool;

/**
 * Start Chapter Pages MCP Tool
 *
 * Implements the start_chapter_pages MCP tool for initiating page-by-page generation
 * for a chapter instead of generating the entire chapter at once.
 */

const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
    validateStartChapterPagesParams,
    sanitizeAndValidate,
    formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for start_chapter_pages
 */
const startChapterPagesTool = {
    name: 'start_chapter_pages',
    description:
        'Start page-by-page generation for a chapter. Creates the chapter structure and generates the first page for review and approval.',
    inputSchema: {
        type: 'object',
        properties: {
            bookId: {
                type: 'string',
                description: 'The unique identifier of the book project',
            },
            chapterNumber: {
                type: 'number',
                description: 'The chapter number to start page-by-page generation for',
                minimum: 1,
            },
            estimatedPages: {
                type: 'number',
                default: 3,
                description: 'Estimated total number of pages for this chapter',
                minimum: 1,
                maximum: 10,
            },
            specificRequirements: {
                type: 'string',
                description: 'Any specific requirements or guidance for this chapter',
            },
        },
        required: ['bookId', 'chapterNumber'],
    },

    /**
     * Execute the start_chapter_pages tool
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
                        message: 'User authentication required to start chapter page generation',
                    },
                };
            }

            // Sanitize and validate input parameters
            const validationResult = sanitizeAndValidate(params, validateStartChapterPagesParams);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatValidationErrors(
                            validationResult.errors,
                            'Start chapter pages parameters',
                        ),
                        details: {
                            errors: validationResult.errors,
                            receivedParams: Object.keys(params),
                        },
                    },
                };
            }

            const sanitizedParams = validationResult.params;

            // Create service instances
            const chapterService = new ChapterService();

            // Start page-by-page generation
            const startResult = await chapterService.startPageByPageGeneration(
                userId,
                sanitizedParams.bookId,
                sanitizedParams.chapterNumber,
                {
                    estimatedPages: sanitizedParams.estimatedPages,
                    specificRequirements: sanitizedParams.specificRequirements,
                },
            );

            // Generate status message
            const statusMessage = StatusMessageService.generateWorkflowStageMessage(
                'page_generation_started',
                {
                    chapterNumber: startResult.chapterNumber,
                    chapterTitle: startResult.title,
                    totalEstimatedPages: startResult.totalEstimatedPages,
                    firstPageWordCount: startResult.firstPage.wordCount,
                },
            );

            return {
                success: true,
                data: {
                    chapter: {
                        chapterId: startResult.chapterId,
                        chapterNumber: startResult.chapterNumber,
                        title: startResult.title,
                        totalEstimatedPages: startResult.totalEstimatedPages,
                    },
                    firstPage: {
                        pageId: startResult.firstPage.pageId,
                        pageNumber: startResult.firstPage.pageNumber,
                        content: startResult.firstPage.content,
                        wordCount: startResult.firstPage.wordCount,
                        status: startResult.firstPage.status,
                    },
                    statusMessage,
                    workflow: {
                        currentStep: 'page_review',
                        description: 'Review the first page and approve/reject it to continue',
                        nextActions: [
                            {
                                action: 'approve_page',
                                description: 'Approve the page to automatically generate the next page',
                            },
                            {
                                action: 'reject_page',
                                description: 'Reject the page with feedback to regenerate it',
                            },
                        ],
                    },
                },
            };
        } catch (error) {
            console.error('[StartChapterPagesTool] Error:', error);

            // Handle specific error cases
            if (error.code === 'CHAPTER_EXISTS') {
                return {
                    success: false,
                    error: {
                        code: 'CHAPTER_EXISTS',
                        message: `Chapter ${params.chapterNumber} already has pages generated. Use the get_page_status tool to view existing pages.`,
                        details: {
                            chapterNumber: params.chapterNumber,
                            pageCount: error.details.pageCount,
                        },
                    },
                };
            }

            return {
                success: false,
                error: {
                    code: error.code || 'GENERATION_START_FAILED',
                    message: error.message || 'Failed to start page-by-page generation',
                    details: {
                        originalError: error.message,
                        ...(error.details || {}),
                    },
                },
            };
        }
    },
};

module.exports = startChapterPagesTool;

/**
 * Regenerate Page MCP Tool
 *
 * Implements the regenerate_page MCP tool for regenerating rejected pages with
 * incorporated feedback and improvements.
 */

const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
    validateRegeneratePageParams,
    sanitizeAndValidate,
    formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for regenerate_page
 */
const regeneratePageTool = {
    name: 'regenerate_page',
    description:
        'Regenerate a rejected page incorporating the previous feedback and any additional requirements. Creates an improved version of the page content.',
    inputSchema: {
        type: 'object',
        properties: {
            pageId: {
                type: 'string',
                description: 'The unique identifier of the page to regenerate',
            },
            feedback: {
                type: 'string',
                description: 'Additional feedback or requirements for the regeneration (optional)',
            },
            estimatedPages: {
                type: 'number',
                default: 3,
                description: 'Estimated total number of pages for the chapter',
            },
        },
        required: ['pageId'],
    },

    /**
     * Execute the regenerate_page tool
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
                        message: 'User authentication required for page regeneration',
                    },
                };
            }

            // Sanitize and validate input parameters
            const validationResult = sanitizeAndValidate(params, validateRegeneratePageParams);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatValidationErrors(
                            validationResult.errors,
                            'Page regeneration parameters',
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

            // Regenerate the page
            const regenerationResult = await chapterService.regeneratePage(
                userId,
                sanitizedParams.pageId,
                {
                    feedback: sanitizedParams.feedback,
                    estimatedPages: sanitizedParams.estimatedPages,
                },
            );

            // Generate status message
            const statusMessage = StatusMessageService.generateWorkflowStageMessage('page_regenerated', {
                pageNumber: regenerationResult.pageNumber,
                wordCount: regenerationResult.wordCount,
                regenerationCount: regenerationResult.regenerationCount,
                feedbackIncorporated: !!regenerationResult.feedbackIncorporated,
            });

            return {
                success: true,
                data: {
                    regeneratedPage: {
                        pageId: regenerationResult.pageId,
                        pageNumber: regenerationResult.pageNumber,
                        content: regenerationResult.content,
                        wordCount: regenerationResult.wordCount,
                        status: regenerationResult.status,
                        regenerationCount: regenerationResult.regenerationCount,
                    },
                    feedbackIncorporated: regenerationResult.feedbackIncorporated,
                    statusMessage,
                    nextAction: {
                        recommended: 'review_page',
                        description: 'Review the regenerated page content and approve or reject it',
                    },
                },
            };
        } catch (error) {
            console.error('[RegeneratePageTool] Error:', error);

            // Handle specific error cases
            if (error.code === 'MAX_REGENERATIONS_REACHED') {
                return {
                    success: false,
                    error: {
                        code: 'MAX_REGENERATIONS_REACHED',
                        message: `Maximum regeneration attempts reached (${error.details.attempts}/${error.details.maxAttempts}). Consider manual editing or starting a new page.`,
                        details: error.details,
                    },
                };
            }

            return {
                success: false,
                error: {
                    code: error.code || 'REGENERATION_FAILED',
                    message: error.message || 'Failed to regenerate page',
                    details: {
                        originalError: error.message,
                        ...(error.details || {}),
                    },
                },
            };
        }
    },
};

module.exports = regeneratePageTool;

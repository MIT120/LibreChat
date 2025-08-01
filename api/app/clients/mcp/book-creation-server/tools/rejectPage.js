/**
 * Reject Page MCP Tool
 *
 * Implements the reject_page MCP tool for rejecting individual pages with feedback
 * so they can be regenerated with improvements.
 */

const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
    validateRejectPageParams,
    sanitizeAndValidate,
    formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for reject_page
 */
const rejectPageTool = {
    name: 'reject_page',
    description:
        'Reject a page with feedback explaining what needs to be improved. The page can then be regenerated using the regenerate_page tool.',
    inputSchema: {
        type: 'object',
        properties: {
            pageId: {
                type: 'string',
                description: 'The unique identifier of the page to reject',
            },
            feedback: {
                type: 'string',
                description: 'Specific feedback explaining what needs to be improved in the page',
                minLength: 1,
            },
        },
        required: ['pageId', 'feedback'],
    },

    /**
     * Execute the reject_page tool
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
                        message: 'User authentication required for page rejection',
                    },
                };
            }

            // Sanitize and validate input parameters
            const validationResult = sanitizeAndValidate(params, validateRejectPageParams);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatValidationErrors(validationResult.errors, 'Page rejection parameters'),
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

            // Reject the page with feedback
            const rejectionResult = await chapterService.rejectPage(
                userId,
                sanitizedParams.pageId,
                sanitizedParams.feedback,
            );

            // Generate status message
            const statusMessage = StatusMessageService.generateWorkflowStageMessage('page_rejected', {
                pageNumber: rejectionResult.pageNumber,
                feedback: rejectionResult.feedback,
                canRegenerate: rejectionResult.canRegenerate,
            });

            return {
                success: true,
                data: {
                    rejectedPage: {
                        pageId: rejectionResult.pageId,
                        pageNumber: rejectionResult.pageNumber,
                        status: rejectionResult.status,
                        feedback: rejectionResult.feedback,
                        canRegenerate: rejectionResult.canRegenerate,
                    },
                    statusMessage,
                    nextAction: {
                        recommended: 'regenerate_page',
                        description:
                            'Use the regenerate_page tool to create an improved version based on the feedback',
                    },
                },
            };
        } catch (error) {
            console.error('[RejectPageTool] Error:', error);

            return {
                success: false,
                error: {
                    code: error.code || 'REJECTION_FAILED',
                    message: error.message || 'Failed to reject page',
                    details: {
                        originalError: error.message,
                        ...(error.details || {}),
                    },
                },
            };
        }
    },
};

module.exports = rejectPageTool;

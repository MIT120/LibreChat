/**
 * Approve Page MCP Tool
 *
 * Implements the approve_page MCP tool for approving individual pages and automatically
 * generating the next page or assembling the chapter when complete.
 */

const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
    validateApprovePageParams,
    sanitizeAndValidate,
    formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for approve_page
 */
const approvePageTool = {
    name: 'approve_page',
    description:
        'Approve a page and automatically generate the next page in the chapter. When all pages are approved, the chapter is assembled and marked as ready for chapter-level approval.',
    inputSchema: {
        type: 'object',
        properties: {
            pageId: {
                type: 'string',
                description: 'The unique identifier of the page to approve',
            },
            feedback: {
                type: 'string',
                description: 'Optional feedback about the page for future context',
            },
            generateNext: {
                type: 'boolean',
                default: true,
                description: 'Whether to automatically generate the next page after approval',
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
     * Execute the approve_page tool
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
                        message: 'User authentication required for page approval',
                    },
                };
            }

            // Sanitize and validate input parameters
            const validationResult = sanitizeAndValidate(params, validateApprovePageParams);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatValidationErrors(validationResult.errors, 'Page approval parameters'),
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

            // Approve the page
            const approvalResult = await chapterService.approvePage(userId, sanitizedParams.pageId, {
                feedback: sanitizedParams.feedback,
                generateNext: sanitizedParams.generateNext,
                estimatedPages: sanitizedParams.estimatedPages,
            });

            // Generate success status message
            const statusMessage = StatusMessageService.generateWorkflowStageMessage('page_approved', {
                pageNumber: approvalResult.pageNumber,
                totalPages: approvalResult.chapterStatus.totalPages,
                approvedPages: approvalResult.chapterStatus.approvedPages,
                pendingPages: approvalResult.chapterStatus.pendingPages,
                isChapterComplete: approvalResult.chapterComplete,
                hasNextPage: !!approvalResult.nextPage,
            });

            let result = {
                success: true,
                data: {
                    approvedPage: {
                        pageId: approvalResult.pageId,
                        pageNumber: approvalResult.pageNumber,
                        status: approvalResult.status,
                    },
                    chapterStatus: approvalResult.chapterStatus,
                    statusMessage,
                },
            };

            // Add chapter completion information if chapter is complete
            if (approvalResult.chapterComplete) {
                result.data.chapterComplete = true;
                result.data.assembledContent = approvalResult.assembledContent;
                result.data.statusMessage = StatusMessageService.generateWorkflowStageMessage(
                    'chapter_assembled',
                    {
                        wordCount: approvalResult.assembledContent.wordCount,
                        pageCount: approvalResult.assembledContent.pageCount,
                    },
                );
            }

            // Add next page information if generated
            if (approvalResult.nextPage) {
                result.data.nextPage = {
                    pageId: approvalResult.nextPage.pageId,
                    pageNumber: approvalResult.nextPage.pageNumber,
                    content: approvalResult.nextPage.content,
                    wordCount: approvalResult.nextPage.wordCount,
                    status: approvalResult.nextPage.status,
                };
                result.data.pageGenerated = true;
            }

            // Add next page generation error if occurred
            if (approvalResult.nextPageError) {
                result.data.nextPageError = approvalResult.nextPageError;
                result.data.manualGenerationRequired = true;
            }

            return result;
        } catch (error) {
            console.error('[ApprovePageTool] Error:', error);

            return {
                success: false,
                error: {
                    code: error.code || 'APPROVAL_FAILED',
                    message: error.message || 'Failed to approve page',
                    details: {
                        originalError: error.message,
                        ...(error.details || {}),
                    },
                },
            };
        }
    },
};

module.exports = approvePageTool;

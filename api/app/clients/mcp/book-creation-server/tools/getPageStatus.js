/**
 * Get Page Status MCP Tool
 *
 * Implements the get_page_status MCP tool for retrieving the status and progress
 * of pages within a chapter, including approval status and content details.
 */

const ChapterService = require('../services/ChapterService');
const StatusMessageService = require('../services/StatusMessageService');
const {
    validateGetPageStatusParams,
    sanitizeAndValidate,
    formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for get_page_status
 */
const getPageStatusTool = {
    name: 'get_page_status',
    description:
        'Get the status and progress of all pages within a chapter, including approval status, word counts, and any feedback.',
    inputSchema: {
        type: 'object',
        properties: {
            chapterId: {
                type: 'string',
                description: 'The unique identifier of the chapter to get page status for',
            },
            includeContent: {
                type: 'boolean',
                default: false,
                description: 'Whether to include the actual page content in the response',
            },
        },
        required: ['chapterId'],
    },

    /**
     * Execute the get_page_status tool
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
                        message: 'User authentication required to get page status',
                    },
                };
            }

            // Sanitize and validate input parameters
            const validationResult = sanitizeAndValidate(params, validateGetPageStatusParams);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatValidationErrors(validationResult.errors, 'Get page status parameters'),
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

            // Get chapter page status
            const statusResult = await chapterService.getChapterPageStatus(
                userId,
                sanitizedParams.chapterId,
            );

            // Generate status message
            const statusMessage = StatusMessageService.generateWorkflowStageMessage(
                'page_status_overview',
                {
                    chapterNumber: statusResult.chapterNumber,
                    chapterTitle: statusResult.title,
                    totalPages: statusResult.pageStatus.totalPages,
                    approvedPages: statusResult.pageStatus.approvedPages,
                    pendingPages: statusResult.pageStatus.pendingPages,
                    rejectedPages: statusResult.pageStatus.rejectedPages,
                    isComplete: statusResult.pageStatus.isComplete,
                },
            );

            // Prepare page details
            const pageDetails = statusResult.pages.map((page) => {
                const pageInfo = {
                    pageId: page.pageId,
                    pageNumber: page.pageNumber,
                    status: page.status,
                    wordCount: page.wordCount,
                    regenerationCount: page.regenerationCount,
                };

                // Add feedback if page is rejected
                if (page.status === 'rejected' && page.feedback) {
                    pageInfo.feedback = page.feedback;
                }

                // Add content if requested
                if (sanitizedParams.includeContent && statusResult.pageStatus.pages) {
                    const fullPage = statusResult.pageStatus.pages.find((p) => p.pageId === page.pageId);
                    if (fullPage && fullPage.content) {
                        pageInfo.content = fullPage.content;
                    }
                }

                return pageInfo;
            });

            // Calculate progress percentage
            const progressPercentage =
                statusResult.pageStatus.totalPages > 0
                    ? Math.round(
                        (statusResult.pageStatus.approvedPages / statusResult.pageStatus.totalPages) * 100,
                    )
                    : 0;

            // Determine next recommended actions
            const nextActions = [];

            if (statusResult.pageStatus.pendingPages > 0) {
                nextActions.push({
                    action: 'review_pages',
                    description: `Review ${statusResult.pageStatus.pendingPages} pending page(s) and approve or reject them`,
                });
            }

            if (statusResult.pageStatus.rejectedPages > 0) {
                nextActions.push({
                    action: 'regenerate_pages',
                    description: `Regenerate ${statusResult.pageStatus.rejectedPages} rejected page(s) with feedback`,
                });
            }

            if (statusResult.pageStatus.isComplete) {
                nextActions.push({
                    action: 'approve_chapter',
                    description: 'All pages are approved. The chapter is ready for final approval.',
                });
            } else if (
                statusResult.pageStatus.approvedPages > 0 &&
                statusResult.pageStatus.pendingPages === 0
            ) {
                nextActions.push({
                    action: 'generate_next_page',
                    description: 'Generate the next page in the chapter',
                });
            }

            return {
                success: true,
                data: {
                    chapter: {
                        chapterId: statusResult.chapterId,
                        chapterNumber: statusResult.chapterNumber,
                        title: statusResult.title,
                    },
                    pageStatus: {
                        totalPages: statusResult.pageStatus.totalPages,
                        approvedPages: statusResult.pageStatus.approvedPages,
                        pendingPages: statusResult.pageStatus.pendingPages,
                        rejectedPages: statusResult.pageStatus.rejectedPages,
                        isComplete: statusResult.pageStatus.isComplete,
                        progressPercentage,
                    },
                    pages: pageDetails,
                    statusMessage,
                    nextActions,
                },
            };
        } catch (error) {
            console.error('[GetPageStatusTool] Error:', error);

            return {
                success: false,
                error: {
                    code: error.code || 'STATUS_FETCH_FAILED',
                    message: error.message || 'Failed to get page status',
                    details: {
                        originalError: error.message,
                        ...(error.details || {}),
                    },
                },
            };
        }
    },
};

module.exports = getPageStatusTool;

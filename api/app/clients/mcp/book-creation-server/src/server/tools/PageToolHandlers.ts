/**
 * Page Tool Handlers - MCP tools for page management
 */

import { z } from 'zod';
import { CreatePageRequest, UpdatePageRequest } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IPageService, IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';

export class PageToolHandlers {
    private logger: ILogger;
    private pageService: IPageService;

    constructor(logger: ILogger, pageService: IPageService) {
        this.logger = logger.child('PageToolHandlers');
        this.pageService = pageService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_page',
                description: 'Create a new page in a chapter',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: { type: 'string', description: 'Chapter identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        title: { type: 'string', description: 'Page title' },
                        content: { type: 'string', description: 'Page content' },
                        notes: { type: 'string', description: 'Page notes (optional)' },
                        pageNumber: { type: 'number', description: 'Page number (optional - will auto-increment if not provided)' },
                    },
                    required: ['chapterId', 'conversationId', 'title', 'content'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        chapterId: z.string().min(1),
                        conversationId: z.string().min(1),
                        title: z.string().min(1),
                        content: z.string().min(1),
                        notes: z.string().optional(),
                        pageNumber: z.number().int().positive().optional(),
                    });

                    return ToolExecutor.run({
                        name: 'create_page',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.pageService.createPage(input as CreatePageRequest),
                        format: (page) => {
                            return `✅ Page created successfully!\n\n**Page Details:**\n- **Page ID:** ${page.pageId}\n- **Chapter ID:** ${page.chapterId}\n- **Page Number:** ${page.pageNumber}\n- **Title:** ${page.title}\n- **Word Count:** ${page.wordCount.toLocaleString()}\n- **Status:** ${page.status}\n- **Created:** ${new Date(page.createdAt).toLocaleDateString()}\n\n**Content Preview:**\n${page.content.length > 200 ? page.content.substring(0, 200) + '...' : page.content}\n\n${page.notes ? `**Notes:** ${page.notes}` : ''}`;
                        },
                    });
                },
            },
            {
                name: 'get_page',
                description: 'Retrieve a page by ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: {
                            type: 'string',
                            description: 'Page identifier',
                        },
                    },
                    required: ['pageId'],
                },
                handler: this.handleGetPage.bind(this),
            },
            {
                name: 'list_pages',
                description: 'List all pages in a chapter',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: {
                            type: 'string',
                            description: 'Chapter identifier',
                        },
                    },
                    required: ['chapterId'],
                },
                handler: this.handleListPages.bind(this),
            },
            {
                name: 'update_page',
                description: 'Update page content and information',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: {
                            type: 'string',
                            description: 'Page identifier',
                        },
                        updates: {
                            type: 'object',
                            description: 'Object containing fields to update',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'New title',
                                },
                                content: {
                                    type: 'string',
                                    description: 'New content',
                                },
                                notes: {
                                    type: 'string',
                                    description: 'New notes',
                                },
                                status: {
                                    type: 'string',
                                    enum: ['draft', 'review', 'approved', 'published'],
                                    description: 'New status',
                                },
                            },
                        },
                    },
                    required: ['pageId', 'updates'],
                },
                handler: this.handleUpdatePage.bind(this),
            },
            {
                name: 'delete_page',
                description: 'Delete a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: {
                            type: 'string',
                            description: 'Page identifier',
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author identifier for verification',
                        },
                    },
                    required: ['pageId', 'authorId'],
                },
                handler: this.handleDeletePage.bind(this),
            },
        ];
    }

    private async handleCreatePage(args: CreatePageRequest): Promise<string> {
        try {
            const page = await this.pageService.createPage(args);

            return `✅ Page created successfully!

**Page Details:**
- **Page ID:** ${page.pageId}
- **Chapter ID:** ${page.chapterId}
- **Page Number:** ${page.pageNumber}
- **Title:** ${page.title}
- **Word Count:** ${page.wordCount.toLocaleString()}
- **Status:** ${page.status}
- **Created:** ${new Date(page.createdAt).toLocaleDateString()}

**Content Preview:**
${page.content.length > 200 ? page.content.substring(0, 200) + '...' : page.content}

${page.notes ? `**Notes:** ${page.notes}` : ''}

The page has been added to the chapter and word counts have been updated!`;
        } catch (error) {
            this.logger.error('Failed to create page', error as Error, args);
            throw error;
        }
    }

    private async handleGetPage(args: { pageId: string }): Promise<string> {
        try {
            const page = await this.pageService.getPage(args.pageId);

            let result = `📄 **Page ${page.pageNumber}: ${page.title}**

**Page Information:**
- **Page ID:** ${page.pageId}
- **Chapter ID:** ${page.chapterId}
- **Status:** ${page.status}
- **Word Count:** ${page.wordCount.toLocaleString()}
- **Created:** ${new Date(page.createdAt).toLocaleDateString()}
- **Last Updated:** ${new Date(page.updatedAt).toLocaleDateString()}`;

            if (page.notes) {
                result += `\n\n**Notes:**\n${page.notes}`;
            }

            result += `\n\n**Content:**\n${page.content}`;

            return result;
        } catch (error) {
            this.logger.error('Failed to get page', error as Error, args);
            throw error;
        }
    }

    private async handleListPages(args: { chapterId: string }): Promise<string> {
        try {
            const pages = await this.pageService.listPages(args.chapterId);

            if (pages.length === 0) {
                return `📄 No pages found for chapter ${args.chapterId}. Create your first page to get started!`;
            }

            let response = `📄 **Pages for Chapter ${args.chapterId}**\n\n`;
            response += `Found ${pages.length} page(s)\n\n`;

            const totalWords = pages.reduce((sum, page) => sum + page.wordCount, 0);
            const completedPages = pages.filter(p => p.status === 'approved').length;

            response += `**Summary:**\n`;
            response += `- **Total Pages:** ${pages.length}\n`;
            response += `- **Completed:** ${completedPages}/${pages.length}\n`;
            response += `- **Total Words:** ${totalWords.toLocaleString()}\n\n`;

            pages.forEach((page) => {
                response += `**Page ${page.pageNumber}: ${page.title}**\n`;
                response += `- Page ID: ${page.pageId}\n`;
                response += `- Status: ${page.status}\n`;
                response += `- Words: ${page.wordCount.toLocaleString()}\n`;
                response += `- Last Updated: ${new Date(page.updatedAt).toLocaleDateString()}\n`;

                // Content preview
                const contentPreview = page.content.length > 100
                    ? page.content.substring(0, 100) + '...'
                    : page.content;
                response += `- Content: ${contentPreview}\n`;

                if (page.notes) {
                    response += `- Notes: ${page.notes}\n`;
                }
                response += `\n`;
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to list pages', error as Error, args);
            throw error;
        }
    }

    private async handleUpdatePage(args: { pageId: string; updates: UpdatePageRequest }): Promise<string> {
        try {
            const updatedPage = await this.pageService.updatePage(args.pageId, args.updates);

            const updatedFields = Object.keys(args.updates);

            let result = `✅ Page updated successfully!

**Updated Page: ${updatedPage.title}**
- **Page ID:** ${updatedPage.pageId}
- **Page Number:** ${updatedPage.pageNumber}
- **Updated Fields:** ${updatedFields.join(', ')}
- **Status:** ${updatedPage.status}
- **Word Count:** ${updatedPage.wordCount.toLocaleString()}
- **Last Updated:** ${new Date(updatedPage.updatedAt).toLocaleDateString()}`;

            // Show content preview if content was updated
            if (args.updates.content) {
                result += `\n\n**Updated Content Preview:**\n${args.updates.content.length > 200 ? args.updates.content.substring(0, 200) + '...' : args.updates.content}`;
            }

            result += `\n\nThe page information has been updated and word counts have been recalculated.`;

            return result;
        } catch (error) {
            this.logger.error('Failed to update page', error as Error, args);
            throw error;
        }
    }

    private async handleDeletePage(args: { pageId: string; authorId: string }): Promise<string> {
        try {
            await this.pageService.deletePage(args.pageId, args.authorId);

            return `✅ Page deleted successfully!

**Deleted Page ID:** ${args.pageId}

The page has been permanently removed from the system and word counts have been updated.`;
        } catch (error) {
            this.logger.error('Failed to delete page', error as Error, args);
            throw error;
        }
    }
}

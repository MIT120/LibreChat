/**
 * Chapter Tool Handlers - MCP tools for chapter management
 */

import { z } from 'zod';
import { CreateChapterRequest, UpdateChapterRequest } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IChapterService, IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';

export class ChapterToolHandlers {
    private logger: ILogger;
    private chapterService: IChapterService;

    constructor(logger: ILogger, chapterService: IChapterService) {
        this.logger = logger.child('ChapterToolHandlers');
        this.chapterService = chapterService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_chapter',
                description: 'Create a new chapter in a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        conversationId: { type: 'string', description: 'Conversation identifier' },
                        title: { type: 'string', description: 'Chapter title' },
                        description: { type: 'string', description: 'Chapter description (optional)' },
                        outline: { type: 'string', description: 'Chapter outline (optional)' },
                        targetWordCount: { type: 'number', description: 'Target word count for this chapter (optional)' },
                        chapterNumber: { type: 'number', description: 'Chapter number (optional - auto-increment if not provided)' },
                    },
                    required: ['bookId', 'conversationId', 'title'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        conversationId: z.string().min(1),
                        title: z.string().min(1),
                        description: z.string().optional(),
                        outline: z.string().optional(),
                        targetWordCount: z.number().int().positive().optional(),
                        chapterNumber: z.number().int().positive().optional(),
                    });
                    return ToolExecutor.run({
                        name: 'create_chapter',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.chapterService.createChapter(input as CreateChapterRequest),
                        format: (chapter) => {
                            return `✅ Chapter created successfully!\n\n**Chapter Details:**\n- **ID:** ${chapter._id}\n- **Book ID:** ${chapter.bookId}\n- **Chapter Number:** ${chapter.chapterNumber}\n- **Title:** ${chapter.title}\n- **Description:** ${chapter.description || 'Not provided'}\n- **Target Word Count:** ${chapter.targetWordCount?.toLocaleString() || 'Not set'}\n- **Status:** ${chapter.status}\n- **Created:** ${new Date(chapter.createdAt).toLocaleDateString()}`;
                        },
                    });
                },
            },
            {
                name: 'get_chapter',
                description: 'Retrieve a chapter by ID with optional page content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: {
                            type: 'string',
                            description: 'Chapter identifier',
                        },
                        includePages: {
                            type: 'boolean',
                            description: 'Include page content (optional)',
                            default: false,
                        },
                    },
                    required: ['chapterId'],
                },
                handler: this.handleGetChapter.bind(this),
            },
            {
                name: 'list_chapters',
                description: 'List all chapters in a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleListChapters.bind(this),
            },
            {
                name: 'update_chapter',
                description: 'Update chapter information',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: {
                            type: 'string',
                            description: 'Chapter identifier',
                        },
                        updates: {
                            type: 'object',
                            description: 'Object containing fields to update',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'New title',
                                },
                                description: {
                                    type: 'string',
                                    description: 'New description',
                                },
                                outline: {
                                    type: 'string',
                                    description: 'New outline',
                                },
                                targetWordCount: {
                                    type: 'number',
                                    description: 'New target word count',
                                },
                                status: {
                                    type: 'string',
                                    enum: ['planned', 'in_progress', 'draft', 'review', 'approved', 'published'],
                                    description: 'New status',
                                },
                                notes: {
                                    type: 'string',
                                    description: 'Chapter notes',
                                },
                            },
                        },
                    },
                    required: ['chapterId', 'updates'],
                },
                handler: this.handleUpdateChapter.bind(this),
            },
            {
                name: 'delete_chapter',
                description: 'Delete a chapter and all its pages',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chapterId: {
                            type: 'string',
                            description: 'Chapter identifier',
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author identifier for verification',
                        },
                    },
                    required: ['chapterId', 'authorId'],
                },
                handler: this.handleDeleteChapter.bind(this),
            },
        ];
    }

    private async handleCreateChapter(args: CreateChapterRequest): Promise<string> {
        try {
            const chapter = await this.chapterService.createChapter(args);

            return `✅ Chapter created successfully!

**Chapter Details:**
- **ID:** ${chapter._id}
- **Book ID:** ${chapter.bookId}
- **Chapter Number:** ${chapter.chapterNumber}
- **Title:** ${chapter.title}
- **Description:** ${chapter.description || 'Not provided'}
- **Target Word Count:** ${chapter.targetWordCount?.toLocaleString() || 'Not set'}
- **Status:** ${chapter.status}
- **Created:** ${new Date(chapter.createdAt).toLocaleDateString()}

The chapter is ready for page creation and content development!`;
        } catch (error) {
            this.logger.error('Failed to create chapter', error as Error, args);
            throw error;
        }
    }

    private async handleGetChapter(args: { chapterId: string; includePages?: boolean }): Promise<string> {
        try {
            const chapter = await this.chapterService.getChapter(args.chapterId, args.includePages);

            let result = `📝 **Chapter ${chapter.chapterNumber}: ${chapter.title}**

**Chapter Information:**
- **ID:** ${chapter._id}
- **Book ID:** ${chapter.bookId}
- **Status:** ${chapter.status}
- **Word Count:** ${chapter.wordCount.toLocaleString()}${chapter.targetWordCount ? ` / ${chapter.targetWordCount.toLocaleString()} target` : ''}
- **Created:** ${new Date(chapter.createdAt).toLocaleDateString()}
- **Last Updated:** ${new Date(chapter.updatedAt).toLocaleDateString()}`;

            if (chapter.description) {
                result += `\n\n**Description:**\n${chapter.description}`;
            }

            if (chapter.outline) {
                result += `\n\n**Outline:**\n${chapter.outline}`;
            }

            if (chapter.notes) {
                result += `\n\n**Notes:**\n${chapter.notes}`;
            }

            if (chapter.pages && chapter.pages.length > 0) {
                const completedPages = chapter.pages.filter(p => p.status === 'approved').length;
                const totalWords = chapter.pages.reduce((sum, p) => sum + p.wordCount, 0);

                result += `\n\n**Pages (${chapter.pages.length}):**`;
                result += `\n- **Completed:** ${completedPages}/${chapter.pages.length}`;
                result += `\n- **Total Words:** ${totalWords.toLocaleString()}`;

                chapter.pages.forEach((page) => {
                    result += `\n- Page ${page.pageNumber}: ${page.title} (${page.wordCount.toLocaleString()} words, ${page.status})`;
                });
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to get chapter', error as Error, args);
            throw error;
        }
    }

    private async handleListChapters(args: { bookId: string }): Promise<string> {
        try {
            const chapters = await this.chapterService.listChapters(args.bookId);

            if (chapters.length === 0) {
                return `📝 No chapters found for book ${args.bookId}. Create your first chapter to get started!`;
            }

            let response = `📝 **Chapters for Book ${args.bookId}**\n\n`;
            response += `Found ${chapters.length} chapter(s)\n\n`;

            const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
            const completedChapters = chapters.filter(c => c.status === 'approved').length;

            response += `**Summary:**\n`;
            response += `- **Total Chapters:** ${chapters.length}\n`;
            response += `- **Completed:** ${completedChapters}/${chapters.length}\n`;
            response += `- **Total Words:** ${totalWords.toLocaleString()}\n\n`;

            chapters.forEach((chapter) => {
                const progress = chapter.targetWordCount && chapter.targetWordCount > 0
                    ? Math.round((chapter.wordCount / chapter.targetWordCount) * 100)
                    : 0;

                response += `**Chapter ${chapter.chapterNumber}: ${chapter.title}**\n`;
                response += `- ID: ${chapter._id}\n`;
                response += `- Status: ${chapter.status}\n`;
                response += `- Words: ${chapter.wordCount.toLocaleString()}`;
                if (chapter.targetWordCount) {
                    response += ` / ${chapter.targetWordCount.toLocaleString()} (${progress}%)`;
                }
                response += `\n- Last Updated: ${new Date(chapter.updatedAt).toLocaleDateString()}\n`;
                if (chapter.description) {
                    response += `- Description: ${chapter.description.substring(0, 100)}${chapter.description.length > 100 ? '...' : ''}\n`;
                }
                response += `\n`;
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to list chapters', error as Error, args);
            throw error;
        }
    }

    private async handleUpdateChapter(args: { chapterId: string; updates: UpdateChapterRequest }): Promise<string> {
        try {
            const updatedChapter = await this.chapterService.updateChapter(args.chapterId, args.updates);

            const updatedFields = Object.keys(args.updates);

            return `✅ Chapter updated successfully!

**Updated Chapter: ${updatedChapter.title}**
- **ID:** ${updatedChapter._id}
- **Chapter Number:** ${updatedChapter.chapterNumber}
- **Updated Fields:** ${updatedFields.join(', ')}
- **Status:** ${updatedChapter.status}
- **Word Count:** ${updatedChapter.wordCount.toLocaleString()}
- **Last Updated:** ${new Date(updatedChapter.updatedAt).toLocaleDateString()}

The chapter information has been updated with the new values.`;
        } catch (error) {
            this.logger.error('Failed to update chapter', error as Error, args);
            throw error;
        }
    }

    private async handleDeleteChapter(args: { chapterId: string; authorId: string }): Promise<string> {
        try {
            await this.chapterService.deleteChapter(args.chapterId, args.authorId);

            return `✅ Chapter deleted successfully!

**Deleted Chapter ID:** ${args.chapterId}

The chapter and all associated pages have been permanently removed from the system.`;
        } catch (error) {
            this.logger.error('Failed to delete chapter', error as Error, args);
            throw error;
        }
    }
}

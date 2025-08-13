/**
 * Book Tool Handlers - MCP tools for book management
 */

import { z } from 'zod';
import {
    CreateBookRequest,
    GetBookOptions,
    IBookSpec,
    ListBooksOptions,
    UpdateBookRequest
} from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IBookService, IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';

export class BookToolHandlers {
    private logger: ILogger;
    private bookService: IBookService;

    constructor(logger: ILogger, bookService: IBookService) {
        this.logger = logger.child('BookToolHandlers');
        this.bookService = bookService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_book',
                description: 'Create a new book with specified theme, genre, and writing style',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Book title' },
                        subtitle: { type: 'string', description: 'Book subtitle (optional)' },
                        theme: { type: 'string', description: 'Main theme or subject matter' },
                        genre: { type: 'string', description: 'Book genre' },
                        targetAudience: { type: 'string', description: 'Target audience description (optional)' },
                        writingStyle: {
                            type: 'object',
                            description: 'Writing style configuration',
                            properties: {
                                tone: {
                                    type: 'string',
                                    description: 'Tone of the writing',
                                    enum: ['formal', 'informal', 'academic', 'conversational', 'humorous', 'serious', 'inspirational', 'dark', 'atmospheric', 'suspenseful', 'dramatic', 'mysterious', 'noir', 'romantic', 'melancholic', 'tense']
                                },
                                voice: {
                                    type: 'string',
                                    description: 'Narrative voice perspective',
                                    enum: ['first_person', 'second_person', 'third_person']
                                },
                                vocabulary: {
                                    type: 'string',
                                    description: 'Complexity level of vocabulary',
                                    enum: ['simple', 'intermediate', 'advanced', 'technical']
                                },
                                sentenceStructure: {
                                    type: 'string',
                                    description: 'Structure and complexity of sentences',
                                    enum: ['simple', 'complex', 'varied']
                                },
                                perspective: { type: 'string', description: 'Writing perspective description (optional)' },
                                specialInstructions: { type: 'string', description: 'Special writing instructions (optional)' }
                            },
                            required: ['tone', 'voice', 'vocabulary', 'sentenceStructure']
                        },
                        description: { type: 'string', description: 'Book description (optional)' },
                        targetWordCount: { type: 'number', description: 'Target word count (optional)' },
                        estimatedPages: { type: 'number', description: 'Estimated page count (optional)' },
                        authorId: { type: 'string', description: 'Author identifier' },
                    },
                    required: ['title', 'theme', 'genre', 'writingStyle', 'authorId'],
                },
                handler: async (args: any) => {
                    const writingStyleSchema = z.object({
                        tone: z.enum(['formal', 'informal', 'academic', 'conversational', 'humorous', 'serious', 'inspirational', 'dark', 'atmospheric', 'suspenseful', 'dramatic', 'mysterious', 'noir', 'romantic', 'melancholic', 'tense']),
                        voice: z.enum(['first_person', 'second_person', 'third_person']),
                        vocabulary: z.enum(['simple', 'intermediate', 'advanced', 'technical']),
                        sentenceStructure: z.enum(['simple', 'complex', 'varied']),
                        perspective: z.string().optional(),
                        specialInstructions: z.string().optional(),
                    });

                    const schema = z.object({
                        title: z.string().min(1),
                        subtitle: z.string().optional(),
                        theme: z.string().min(1),
                        genre: z.string().min(1),
                        targetAudience: z.string().optional(),
                        writingStyle: writingStyleSchema,
                        description: z.string().optional(),
                        targetWordCount: z.number().int().positive().optional(),
                        estimatedPages: z.number().int().positive().optional(),
                        authorId: z.string().min(1),
                    });

                    return ToolExecutor.run({
                        name: 'create_book',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.bookService.createBook(input as CreateBookRequest),
                        format: (book) => {
                            return `✅ Book created successfully!\n\n**Book Details:**\n- **ID:** ${book._id}\n- **Title:** ${book.title}${book.subtitle ? `\n- **Subtitle:** ${book.subtitle}` : ''}\n- **Theme:** ${book.theme}\n- **Genre:** ${book.genre}\n- **Target Audience:** ${book.targetAudience || 'Not specified'}\n- **Writing Style:** ${book.writingStyle.tone} tone, ${book.writingStyle.voice} voice\n- **Target Word Count:** ${book.targetWordCount?.toLocaleString() || 'Not set'}\n- **Status:** ${book.status}\n- **Created:** ${new Date(book.createdAt).toLocaleDateString()}\n\nThe book is ready for chapter creation and content development!`;
                        },
                    });
                },
            },
            {
                name: 'get_book',
                description: 'Retrieve a book by ID with optional chapter and page content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                        includeChapters: {
                            type: 'boolean',
                            description: 'Include chapter information (optional)',
                            default: false,
                        },
                        includePages: {
                            type: 'boolean',
                            description: 'Include page content (optional)',
                            default: false,
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleGetBook.bind(this),
            },
            {
                name: 'list_books',
                description: 'List books for an author with filtering options',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: {
                            type: 'string',
                            description: 'Author identifier',
                        },
                        status: {
                            type: 'string',
                            enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
                            description: 'Filter by book status (optional)',
                        },
                        genre: {
                            type: 'string',
                            description: 'Filter by genre (optional)',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum results (default: 20)',
                            default: 20,
                        },
                        offset: {
                            type: 'number',
                            description: 'Pagination offset (default: 0)',
                            default: 0,
                        },
                    },
                    required: ['authorId'],
                },
                handler: this.handleListBooks.bind(this),
            },
            {
                name: 'update_book',
                description: 'Update book information and settings',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                        updates: {
                            type: 'object',
                            description: 'Object containing fields to update',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'New title',
                                },
                                subtitle: {
                                    type: 'string',
                                    description: 'New subtitle',
                                },
                                theme: {
                                    type: 'string',
                                    description: 'New theme',
                                },
                                genre: {
                                    type: 'string',
                                    description: 'New genre',
                                },
                                targetAudience: {
                                    type: 'string',
                                    description: 'New target audience',
                                },
                                description: {
                                    type: 'string',
                                    description: 'New description',
                                },
                                targetWordCount: {
                                    type: 'number',
                                    description: 'New target word count',
                                },
                                estimatedPages: {
                                    type: 'number',
                                    description: 'New estimated page count',
                                },
                                status: {
                                    type: 'string',
                                    enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
                                    description: 'New status',
                                },
                                writingStyle: {
                                    type: 'object',
                                    description: 'Updated writing style',
                                    properties: {
                                        tone: {
                                            type: 'string',
                                            description: 'Tone of the writing',
                                            enum: ['formal', 'informal', 'academic', 'conversational', 'humorous', 'serious', 'inspirational', 'dark', 'atmospheric', 'suspenseful', 'dramatic', 'mysterious', 'noir', 'romantic', 'melancholic', 'tense']
                                        },
                                        voice: {
                                            type: 'string',
                                            description: 'Narrative voice perspective',
                                            enum: ['first_person', 'second_person', 'third_person']
                                        },
                                        vocabulary: {
                                            type: 'string',
                                            description: 'Complexity level of vocabulary',
                                            enum: ['simple', 'intermediate', 'advanced', 'technical']
                                        },
                                        sentenceStructure: {
                                            type: 'string',
                                            description: 'Structure and complexity of sentences',
                                            enum: ['simple', 'complex', 'varied']
                                        },
                                        perspective: { type: 'string', description: 'Writing perspective description (optional)' },
                                        specialInstructions: { type: 'string', description: 'Special writing instructions (optional)' }
                                    }
                                },
                            },
                        },
                    },
                    required: ['bookId', 'updates'],
                },
                handler: this.handleUpdateBook.bind(this),
            },
            {
                name: 'delete_book',
                description: 'Delete a book and all associated content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author identifier for verification',
                        },
                    },
                    required: ['bookId', 'authorId'],
                },
                handler: this.handleDeleteBook.bind(this),
            },
            {
                name: 'get_book_statistics',
                description: 'Retrieve detailed statistics about a book',
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
                handler: this.handleGetBookStatistics.bind(this),
            },
            {
                name: 'set_book_spec',
                description: 'Attach or update a spec-driven plan (characters, world, color palette, image style, rules) to a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        spec: { type: 'object', description: 'IBookSpec object' },
                    },
                    required: ['bookId', 'spec'],
                },
                handler: this.handleSetSpec.bind(this),
            },
            {
                name: 'get_book_spec',
                description: 'Get the current spec-driven plan for a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                    },
                    required: ['bookId'],
                },
                handler: this.handleGetSpec.bind(this),
            },
        ];
    }

    private async handleCreateBook(args: CreateBookRequest): Promise<string> {
        try {
            const book = await this.bookService.createBook(args);

            return `✅ Book created successfully!

**Book Details:**
- **ID:** ${book._id}
- **Title:** ${book.title}${book.subtitle ? `\n- **Subtitle:** ${book.subtitle}` : ''}
- **Theme:** ${book.theme}
- **Genre:** ${book.genre}
- **Target Audience:** ${book.targetAudience || 'Not specified'}
- **Writing Style:** ${book.writingStyle.tone} tone, ${book.writingStyle.voice} voice
- **Target Word Count:** ${book.targetWordCount?.toLocaleString() || 'Not set'}
- **Status:** ${book.status}
- **Created:** ${new Date(book.createdAt).toLocaleDateString()}

The book is ready for chapter creation and content development!`;
        } catch (error) {
            this.logger.error('Failed to create book', error as Error, args);
            throw error;
        }
    }

    private async handleGetBook(args: { bookId: string; includeChapters?: boolean; includePages?: boolean }): Promise<string> {
        try {
            const options: GetBookOptions = {
                includeChapters: args.includeChapters,
                includePages: args.includePages,
            };

            const book = await this.bookService.getBook(args.bookId, options);

            let result = `📖 **${book.title}**${book.subtitle ? `\n*${book.subtitle}*` : ''}

**Book Information:**
- **ID:** ${book._id}
- **Theme:** ${book.theme}
- **Genre:** ${book.genre}
- **Target Audience:** ${book.targetAudience || 'Not specified'}
- **Status:** ${book.status}
- **Word Count:** ${book.currentWordCount.toLocaleString()}${book.targetWordCount ? ` / ${book.targetWordCount.toLocaleString()} target` : ''}
- **Created:** ${new Date(book.createdAt).toLocaleDateString()}
- **Last Updated:** ${new Date(book.updatedAt).toLocaleDateString()}

**Writing Style:**
- **Tone:** ${book.writingStyle.tone}
- **Voice:** ${book.writingStyle.voice}
- **Vocabulary:** ${book.writingStyle.vocabulary}
- **Sentence Structure:** ${book.writingStyle.sentenceStructure}`;

            if (book.writingStyle.specialInstructions) {
                result += `\n- **Special Instructions:** ${book.writingStyle.specialInstructions}`;
            }

            if (book.description) {
                result += `\n\n**Description:**\n${book.description}`;
            }

            if (book.chapters && book.chapters.length > 0) {
                result += `\n\n**Chapters (${book.chapters.length}):**`;
                book.chapters.forEach((chapter) => {
                    result += `\n- Chapter ${chapter.chapterNumber}: ${chapter.title} (${chapter.wordCount.toLocaleString()} words, ${chapter.status})`;

                    if (args.includePages && chapter.pages && chapter.pages.length > 0) {
                        result += `\n  Pages: ${chapter.pages.length}`;
                    }
                });
            }

            return result;
        } catch (error) {
            this.logger.error('Failed to get book', error as Error, args);
            throw error;
        }
    }

    private async handleListBooks(args: ListBooksOptions): Promise<string> {
        try {
            const result = await this.bookService.listBooks(args);

            if (result.data.length === 0) {
                return `📚 No books found for author ${args.authorId}${args.status ? ` with status "${args.status}"` : ''}${args.genre ? ` in genre "${args.genre}"` : ''}.`;
            }

            let response = `📚 **Books for Author ${args.authorId}**\n\n`;
            response += `Found ${result.pagination.total} book(s)${args.status ? ` with status "${args.status}"` : ''}${args.genre ? ` in genre "${args.genre}"` : ''}\n`;
            response += `Showing ${result.data.length} of ${result.pagination.total} (${result.pagination.offset + 1}-${result.pagination.offset + result.data.length})\n\n`;

            result.data.forEach((book, index) => {
                const progress = book.targetWordCount && book.targetWordCount > 0
                    ? Math.round((book.currentWordCount / book.targetWordCount) * 100)
                    : 0;

                response += `**${index + 1}. ${book.title}**\n`;
                response += `- ID: ${book._id}\n`;
                response += `- Genre: ${book.genre}\n`;
                response += `- Status: ${book.status}\n`;
                response += `- Progress: ${book.currentWordCount.toLocaleString()} words`;
                if (book.targetWordCount) {
                    response += ` / ${book.targetWordCount.toLocaleString()} (${progress}%)`;
                }
                response += `\n- Last Updated: ${new Date(book.updatedAt).toLocaleDateString()}\n\n`;
            });

            if (result.pagination.hasMore) {
                response += `📄 More results available. Use offset ${result.pagination.offset + result.pagination.limit} to see more books.`;
            }

            return response;
        } catch (error) {
            this.logger.error('Failed to list books', error as Error, args);
            throw error;
        }
    }

    private async handleUpdateBook(args: { bookId: string; updates: UpdateBookRequest }): Promise<string> {
        try {
            const updatedBook = await this.bookService.updateBook(args.bookId, args.updates);

            const updatedFields = Object.keys(args.updates);

            return `✅ Book updated successfully!

**Updated Book: ${updatedBook.title}**
- **ID:** ${updatedBook._id}
- **Updated Fields:** ${updatedFields.join(', ')}
- **Status:** ${updatedBook.status}
- **Word Count:** ${updatedBook.currentWordCount.toLocaleString()}
- **Last Updated:** ${new Date(updatedBook.updatedAt).toLocaleDateString()}

The book information has been updated with the new values.`;
        } catch (error) {
            this.logger.error('Failed to update book', error as Error, args);
            throw error;
        }
    }

    private async handleDeleteBook(args: { bookId: string; authorId: string }): Promise<string> {
        try {
            await this.bookService.deleteBook(args.bookId, args.authorId);

            return `✅ Book deleted successfully!

**Deleted Book ID:** ${args.bookId}

The book and all associated content (chapters, pages, notes) have been permanently removed from the system.`;
        } catch (error) {
            this.logger.error('Failed to delete book', error as Error, args);
            throw error;
        }
    }

    private async handleGetBookStatistics(args: { bookId: string }): Promise<string> {
        try {
            const stats = await this.bookService.getBookStatistics(args.bookId);

            let response = `📊 **Statistics for "${stats.bookInfo.title}"**\n\n`;

            // Basic info
            response += `**Book Information:**\n`;
            response += `- **ID:** ${stats.bookInfo.id}\n`;
            response += `- **Genre:** ${stats.bookInfo.genre}\n`;
            response += `- **Theme:** ${stats.bookInfo.theme}\n`;
            response += `- **Status:** ${stats.bookInfo.status}\n\n`;

            // Progress
            response += `**Progress:**\n`;
            response += `- **Completion:** ${stats.progress.completionPercentage}%\n`;
            response += `- **Current Words:** ${stats.progress.currentWordCount.toLocaleString()}\n`;
            response += `- **Target Words:** ${stats.progress.targetWordCount.toLocaleString()}\n`;
            response += `- **Words Remaining:** ${stats.progress.wordsRemaining.toLocaleString()}\n\n`;

            // Chapters
            response += `**Chapters:**\n`;
            response += `- **Total:** ${stats.chapters.total}\n`;
            response += `- **Completed:** ${stats.chapters.completed}\n`;
            response += `- **Status Breakdown:**\n`;
            Object.entries(stats.chapters.statusBreakdown).forEach(([status, count]) => {
                response += `  - ${status}: ${count}\n`;
            });
            response += `\n`;

            // Pages
            response += `**Pages:**\n`;
            response += `- **Total:** ${stats.pages.total}\n`;
            response += `- **Completed:** ${stats.pages.completed}\n`;
            response += `- **Status Breakdown:**\n`;
            Object.entries(stats.pages.statusBreakdown).forEach(([status, count]) => {
                response += `  - ${status}: ${count}\n`;
            });

            response += `\n**Last Updated:** ${new Date(stats.lastUpdated).toLocaleString()}`;

            return response;
        } catch (error) {
            this.logger.error('Failed to get book statistics', error as Error, args);
            throw error;
        }
    }

    private async handleSetSpec(args: { bookId: string; spec: IBookSpec }): Promise<string> {
        const { bookId, spec } = args;
        try {
            const updated = await this.bookService.updateBook(bookId, { spec });
            const hasCharacters = updated.spec?.characters?.length || 0;
            return `✅ Spec updated for "${updated.title}"\n\n- Characters: ${hasCharacters}\n- World: ${updated.spec?.world?.setting ? 'yes' : 'no'}\n- Palette: ${updated.spec?.colorPalette?.primary ?? 'n/a'}\n- Image Style: ${updated.spec?.imageStyle?.style ?? 'n/a'}\n- Context Brackets: ${updated.spec?.contextBracketFormat ? 'on' : 'off'}`;
        } catch (error) {
            this.logger.error('Failed to set book spec', error as Error, args);
            throw error;
        }
    }

    private async handleGetSpec(args: { bookId: string }): Promise<string> {
        try {
            const book = await this.bookService.getBook(args.bookId, {});
            if (!book.spec) {
                return `ℹ️ No spec found for book ${args.bookId}. Use set_book_spec to define one.`;
            }
            return `📐 Spec for "${book.title}":\n\n${JSON.stringify(book.spec, null, 2)}`;
        } catch (error) {
            this.logger.error('Failed to get book spec', error as Error, args);
            throw error;
        }
    }
}

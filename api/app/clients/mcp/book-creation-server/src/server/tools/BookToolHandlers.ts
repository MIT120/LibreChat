/**
 * Book Tool Handlers - MCP tools for book management
 * Refactored to use BaseToolHandler and reusable components
 */

import { z } from 'zod';
import { CreateBookRequest, UpdateBookRequest, BookResponse, GetBookOptions, IBookSpec } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { BaseToolHandler } from '../../core/BaseToolHandler.js';
import { BookFormatters, GenericFormatters, StatisticsFormatters } from '../../core/ResponseFormatters.js';
import { SchemaUtils, getSchemaRegistry } from '../../core/SchemaRegistry.js';
import { ToolFactory } from '../../core/ToolFactory.js';
import { IBookService } from '../../interfaces/index.js';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService.js';

export class BookToolHandlers extends BaseToolHandler {
    private bookService: IBookService;
    private narrativeService?: NarrativeConsistencyService;

    constructor(logger: ILogger, bookService: IBookService, narrativeService?: NarrativeConsistencyService) {
        super(logger, 'BookToolHandlers');
        this.bookService = bookService;
        this.narrativeService = narrativeService;
        this.initialize();
    }

    protected defineTools(): void {
        // Register CRUD operations using the tool factory
        const crudTools = ToolFactory.createCrudTools<BookResponse, CreateBookRequest, UpdateBookRequest, any>(
            'Book',
            'book',
            {
                create: this.handleCreateBook.bind(this),
                get: this.handleGetBook.bind(this),
                list: this.handleListBooks.bind(this),
                update: this.handleUpdateBook.bind(this),
                delete: this.handleDeleteBook.bind(this),
            },
            {
                created: BookFormatters.created,
                detail: BookFormatters.detail,
                list: this.formatBookList.bind(this),
                updated: this.formatBookUpdate.bind(this),
                deleted: (bookId: string) => GenericFormatters.deleted('Book', bookId),
            }
        );

        // Register CRUD tools
        crudTools.forEach(tool => this.registerTool(tool));

        // Register custom tools
        this.registerCustomTools();
    }

    /**
     * Register custom book-specific tools
     */
    private registerCustomTools(): void {
        // Statistics tool
        this.registerTool(
            ToolFactory.createStatsTool(
                'Book',
                'book',
                this.handleGetBookStatistics.bind(this),
                StatisticsFormatters.bookStatistics
            )
        );

        // Set book spec tool
        this.registerTool(
            ToolFactory.createTool({
                name: 'set_book_spec',
                description: 'Attach or update a spec-driven plan to a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        spec: { type: 'object', description: 'IBookSpec object' },
                    },
                    required: ['bookId', 'spec'],
                },
                zodSchema: z.object({
                    bookId: z.string().min(1),
                    spec: z.any(), // This would be a proper spec schema in real implementation
                }),
                handler: this.handleSetSpec.bind(this),
                formatter: this.formatSpecUpdate.bind(this),
            })
        );

        // Get book spec tool
        this.registerTool(
            ToolFactory.createTool({
                name: 'get_book_spec',
                description: 'Get the current spec-driven plan for a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                    },
                    required: ['bookId'],
                },
                zodSchema: getSchemaRegistry().get('id')!,
                handler: this.handleGetSpec.bind(this),
                formatter: this.formatSpecResponse.bind(this),
            })
        );
    }

    // Handler methods - now much cleaner without validation logic

    private async handleCreateBook(input: CreateBookRequest): Promise<BookResponse> {
        return await this.bookService.createBook(input);
    }

    private async handleGetBook(id: string, options?: { includeChapters?: boolean; includePages?: boolean }): Promise<BookResponse> {
        const getOptions: GetBookOptions = {
            includeChapters: options?.includeChapters,
            includePages: options?.includePages,
        };
        return await this.bookService.getBook(id, getOptions);
    }

    private async handleListBooks(input: any): Promise<{ data: BookResponse[]; pagination: any }> {
        return await this.bookService.listBooks(input);
    }

    private async handleUpdateBook(id: string, updates: UpdateBookRequest): Promise<BookResponse> {
        return await this.bookService.updateBook(id, updates);
    }

    private async handleDeleteBook(id: string, authorId: string): Promise<void> {
        await this.bookService.deleteBook(id, authorId);
    }

    private async handleGetBookStatistics(id: string): Promise<any> {
        return await this.bookService.getBookStatistics(id);
    }

    private async handleSetSpec(input: { bookId: string; spec: IBookSpec }): Promise<BookResponse> {
        const updatedBook = await this.bookService.updateBook(input.bookId, { spec: input.spec });
        
        // Register characters and world elements from spec if narrative service available
        if (this.narrativeService && input.spec) {
            try {
                // Register characters from spec
                if (input.spec.characters) {
                    for (const charSpec of input.spec.characters) {
                        await this.narrativeService.upsertCharacter(
                            input.bookId,
                            input.bookId, // using bookId as conversationId
                            {
                                characterId: charSpec.id,
                                name: charSpec.name,
                                role: charSpec.role as any,
                                physicalTraits: {
                                    visualTraits: charSpec.visualTraits || []
                                },
                                personality: {
                                    coreTraits: charSpec.narrativeTraits || []
                                }
                            }
                        );
                    }
                }
                
                // Register world elements from spec
                if (input.spec.world) {
                    const worldSpec = input.spec.world;
                    await this.narrativeService.upsertWorldElement(
                        input.bookId,
                        input.bookId, // using bookId as conversationId
                        {
                            name: 'World Setting',
                            type: 'location',
                            description: worldSpec.setting || '',
                            properties: worldSpec.rules?.map(rule => ({
                                name: 'Rule',
                                value: rule,
                                description: 'World rule from book spec'
                            })) || [],
                            consistencyRules: worldSpec.rules || []
                        }
                    );
                }
                
                this.logger.info('Registered spec elements in narrative database', {
                    bookId: input.bookId,
                    characters: input.spec.characters?.length || 0,
                    worldElements: input.spec.world ? 1 : 0
                });
            } catch (error) {
                this.logger.warn('Failed to register spec elements in narrative database', error as Error);
            }
        }
        
        return updatedBook;
    }

    private async handleGetSpec(input: { bookId: string }): Promise<{ book: BookResponse }> {
        const book = await this.bookService.getBook(input.bookId, {});
        return { book };
    }

    // Custom formatters for specific responses

    private formatBookList(result: { data: BookResponse[]; pagination: any }): string {
        if (result.data.length === 0) {
            return `📚 No books found for the specified criteria.`;
        }

        return this.createListResponse(
            'Book',
            result.data,
            (book: BookResponse, index: number) => BookFormatters.listItem(book, index),
            result.pagination.total,
            result.pagination
        );
    }

    private formatBookUpdate(book: BookResponse): string {
        // We don't have updatedFields here in the new structure, so we'll use a generic message
        return BookFormatters.updated(book, ['updated']);
    }

    private formatSpecUpdate(book: BookResponse): string {
        const hasCharacters = book.spec?.characters?.length || 0;
        return this.createSuccessResponse(
            'Book spec',
            'updated',
            book,
            `- Characters: ${hasCharacters}\n` +
            `- World: ${book.spec?.world?.setting ? 'yes' : 'no'}\n` +
            `- Palette: ${book.spec?.colorPalette?.primary ?? 'n/a'}\n` +
            `- Image Style: ${book.spec?.imageStyle?.style ?? 'n/a'}\n` +
            `- Context Brackets: ${book.spec?.contextBracketFormat ? 'on' : 'off'}`
        );
    }

    private formatSpecResponse(result: { book: BookResponse }): string {
        if (!result.book.spec) {
            return `ℹ️ No spec found for book ${result.book._id}. Use set_book_spec to define one.`;
        }
        return `📐 Spec for "${result.book.title}":\n\n${JSON.stringify(result.book.spec, null, 2)}`;
    }
}

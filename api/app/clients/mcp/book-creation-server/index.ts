#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import mongoose from 'mongoose';
import { BookService, ConfigService } from './services/index.js';
import {
  CreateBookRequest,
  UpdateBookRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
  CreatePageRequest,
  UpdatePageRequest,
  GetBookOptions,
  ListBooksOptions
} from './types.js';
import { AppError, ValidationError, DatabaseError, NotFoundError, AuthorizationError } from './types.js';

interface ToolRequest {
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

class BookCreationServer {
  private server: Server;
  private bookService: BookService;
  private configService: ConfigService;

  constructor() {
    this.server = new Server(
      {
        name: 'book-creation-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.bookService = new BookService();
    this.configService = new ConfigService();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_book',
            description:
              'Creates a new book with specified theme, genre, and writing style. This is the primary tool for initializing a new book project that can be used by Anthropic models to generate content.',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the book',
                  minLength: 1,
                  maxLength: 300,
                },
                subtitle: {
                  type: 'string',
                  description: 'Optional subtitle for the book',
                  maxLength: 500,
                },
                theme: {
                  type: 'string',
                  description:
                    'The main theme or subject matter of the book (e.g., "artificial intelligence", "climate change", "fantasy adventure")',
                  minLength: 1,
                  maxLength: 200,
                },
                genre: {
                  type: 'string',
                  description:
                    'The genre of the book (e.g., "fiction", "non-fiction", "science fiction", "biography")',
                  minLength: 1,
                  maxLength: 100,
                },
                targetAudience: {
                  type: 'string',
                  description:
                    'Who the book is intended for (e.g., "young adults", "professionals", "general public")',
                  maxLength: 500,
                },
                writingStyle: {
                  type: 'object',
                  description:
                    'Detailed writing style configuration for consistent content generation',
                  properties: {
                    tone: {
                      type: 'string',
                      enum: [
                        'formal',
                        'informal',
                        'academic',
                        'conversational',
                        'humorous',
                        'serious',
                        'inspirational',
                      ],
                      description: 'The overall tone of the writing',
                    },
                    voice: {
                      type: 'string',
                      enum: ['first_person', 'second_person', 'third_person'],
                      description: 'The narrative voice/perspective',
                    },
                    perspective: {
                      type: 'string',
                      description: 'Additional perspective details or viewpoint',
                      maxLength: 500,
                    },
                    vocabulary: {
                      type: 'string',
                      enum: ['simple', 'intermediate', 'advanced', 'technical'],
                      description: 'The complexity level of vocabulary to use',
                    },
                    sentenceStructure: {
                      type: 'string',
                      enum: ['simple', 'complex', 'varied'],
                      description: 'The preferred sentence structure style',
                    },
                    specialInstructions: {
                      type: 'string',
                      description: 'Any special writing instructions or guidelines',
                      maxLength: 1000,
                    },
                  },
                  required: ['tone', 'voice', 'vocabulary', 'sentenceStructure'],
                },
                description: {
                  type: 'string',
                  description: 'A detailed description of what the book will cover',
                  maxLength: 2000,
                },
                targetWordCount: {
                  type: 'number',
                  description: 'Target word count for the completed book',
                  minimum: 0,
                },
                estimatedPages: {
                  type: 'number',
                  description: 'Estimated number of pages in the final book',
                  minimum: 0,
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author creating the book',
                },
              },
              required: ['title', 'theme', 'genre', 'writingStyle', 'authorId'],
            },
          },
          {
            name: 'get_book',
            description:
              'Retrieves a book by ID with all its details, chapters, and current status',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to retrieve',
                },
                includeChapters: {
                  type: 'boolean',
                  description: 'Whether to include chapter information',
                  default: false,
                },
                includePages: {
                  type: 'boolean',
                  description: 'Whether to include page content (only if includeChapters is true)',
                  default: false,
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'list_books',
            description: 'Lists all books for a specific author with filtering options',
            inputSchema: {
              type: 'object',
              properties: {
                authorId: {
                  type: 'string',
                  description: 'ID of the author whose books to list',
                },
                status: {
                  type: 'string',
                  enum: [
                    'planning',
                    'outlining',
                    'writing',
                    'editing',
                    'review',
                    'completed',
                    'published',
                  ],
                  description: 'Filter books by status',
                },
                genre: {
                  type: 'string',
                  description: 'Filter books by genre',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of books to return',
                  default: 20,
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: 'number',
                  description: 'Number of books to skip for pagination',
                  default: 0,
                  minimum: 0,
                },
              },
              required: ['authorId'],
            },
          },
          {
            name: 'create_chapter',
            description:
              'Creates a new chapter in a book with title, description, and optional outline',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                title: {
                  type: 'string',
                  description: 'The title of the chapter',
                  minLength: 1,
                  maxLength: 200,
                },
                description: {
                  type: 'string',
                  description: 'Optional description of what happens in this chapter',
                  maxLength: 1000,
                },
                outline: {
                  type: 'string',
                  description: 'Optional detailed outline for the chapter',
                },
                targetWordCount: {
                  type: 'number',
                  description: 'Target word count for this chapter',
                  minimum: 0,
                },
                chapterNumber: {
                  type: 'number',
                  description: 'Chapter number (auto-generated if not provided)',
                  minimum: 1,
                },
              },
              required: ['bookId', 'title'],
            },
          },
          {
            name: 'create_page',
            description:
              'Creates a new page in a chapter with title and content. Automatically calculates word count.',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                title: {
                  type: 'string',
                  description: 'The title of the page',
                  minLength: 1,
                  maxLength: 200,
                },
                content: {
                  type: 'string',
                  description: 'The actual content/text of the page',
                  minLength: 1,
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes about this page',
                },
                pageNumber: {
                  type: 'number',
                  description: 'Page number (auto-generated if not provided)',
                  minimum: 1,
                },
              },
              required: ['chapterId', 'title', 'content'],
            },
          },
          {
            name: 'get_content_suggestion',
            description:
              'Provides context and suggestions for generating content for a chapter, including book theme, writing style, and existing content context',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                context: {
                  type: 'object',
                  description: 'Additional context for content generation',
                  properties: {
                    specificFocus: {
                      type: 'string',
                      description: 'Specific aspect to focus on in this content',
                    },
                    mood: {
                      type: 'string',
                      description: 'Desired mood or atmosphere',
                    },
                  },
                },
              },
              required: ['chapterId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: ToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_book':
            return await this.handleCreateBook(args as CreateBookRequest);

          case 'get_book':
            return await this.handleGetBook(args);

          case 'list_books':
            return await this.handleListBooks(args as ListBooksOptions);

          case 'create_chapter':
            return await this.handleCreateChapter(args as CreateChapterRequest);

          case 'create_page':
            return await this.handleCreatePage(args as CreatePageRequest);

          case 'get_content_suggestion':
            return await this.handleGetContentSuggestion(args);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private async handleCreateBook(args: CreateBookRequest) {
    const book = await this.bookService.createBook(args);
    return {
      content: [
        {
          type: 'text',
          text: `Book "${book.title}" created successfully with ID: ${book._id}`,
        },
      ],
    };
  }

  private async handleGetBook(args: { bookId: string; includeChapters?: boolean; includePages?: boolean }) {
    const options: GetBookOptions = {
      includeChapters: args.includeChapters,
      includePages: args.includePages,
    };
    const book = await this.bookService.getBook(args.bookId, options);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(book, null, 2),
        },
      ],
    };
  }

  private async handleListBooks(args: ListBooksOptions) {
    const result = await this.bookService.listBooks(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleCreateChapter(args: CreateChapterRequest) {
    const chapter = await this.bookService.createChapter(args);
    return {
      content: [
        {
          type: 'text',
          text: `Chapter "${chapter.title}" created successfully with ID: ${chapter._id}`,
        },
      ],
    };
  }

  private async handleCreatePage(args: CreatePageRequest) {
    const page = await this.bookService.createPage(args);
    return {
      content: [
        {
          type: 'text',
          text: `Page "${page.title}" created successfully with ID: ${page._id}`,
        },
      ],
    };
  }

  private async handleGetContentSuggestion(args: { chapterId: string; context?: Record<string, any> }) {
    const suggestion = await this.bookService.generateContentSuggestion(args.chapterId, args.context);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(suggestion, null, 2),
        },
      ],
    };
  }

  private handleError(error: unknown) {
    console.error('Tool execution error:', error);

    if (error instanceof AppError) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    if (error instanceof McpError) {
      throw error;
    }

    // Handle unknown errors
    return {
      content: [
        {
          type: 'text',
          text: `Unexpected error: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Book Creation MCP Server running on stdio');
  }
}

// Start the server
const server = new BookCreationServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
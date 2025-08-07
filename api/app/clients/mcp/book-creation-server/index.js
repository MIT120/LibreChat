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
import { AIContentService } from './services/AIContentService.js';
import { BookService } from './services/BookService.js';
// import { CharacterService } from './services/CharacterService.js'; // Removed: Using WorldBuildingService instead
// import { CollaborationService } from './services/CollaborationService.js'; // Disabled: Service has only placeholder implementations
import { ConfigService } from './services/ConfigService.js';
import { ContentOrganizationService } from './services/ContentOrganizationService.js';
import { ExportService } from './services/ExportService.js';
import { InfluencerResearchService } from './services/InfluencerResearchService.js';
import { GrammarStyleService } from './services/GrammarStyleService.js';
import { ImageService } from './services/ImageService.js';
import { ResearchService } from './services/ResearchService.js';
import { WebScoutingService } from './services/WebScoutingService.js';
import { WorldBuildingService } from './services/WorldBuildingService.js';
import { WritingAnalyticsService } from './services/WritingAnalyticsService.js';

class BookCreationServer {
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
    this.imageService = new ImageService(this.bookService);
    this.exportService = new ExportService(this.bookService, this.imageService);
    this.aiContentService = new AIContentService();
    this.researchService = new ResearchService();
    this.worldBuildingService = new WorldBuildingService();
    this.writingAnalyticsService = new WritingAnalyticsService();
    this.contentOrganizationService = new ContentOrganizationService();
    this.influencerResearchService = new InfluencerResearchService();
    this.webScoutingService = new WebScoutingService();
    this.grammarStyleService = new GrammarStyleService();
    // this.collaborationService = new CollaborationService(); // Disabled: Service has only placeholder implementations
    // this.characterService = new CharacterService(); // Removed: Using WorldBuildingService instead

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
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
            name: 'update_book',
            description: 'Updates book information including status, writing style, and metadata',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to update',
                },
                updates: {
                  type: 'object',
                  description: 'Fields to update',
                  properties: {
                    title: { type: 'string', maxLength: 300 },
                    subtitle: { type: 'string', maxLength: 500 },
                    theme: { type: 'string', maxLength: 200 },
                    genre: { type: 'string', maxLength: 100 },
                    targetAudience: { type: 'string', maxLength: 500 },
                    description: { type: 'string', maxLength: 2000 },
                    targetWordCount: { type: 'number', minimum: 0 },
                    estimatedPages: { type: 'number', minimum: 0 },
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
                    },
                    writingStyle: {
                      type: 'object',
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
                        },
                        voice: {
                          type: 'string',
                          enum: ['first_person', 'second_person', 'third_person'],
                        },
                        perspective: { type: 'string', maxLength: 500 },
                        vocabulary: {
                          type: 'string',
                          enum: ['simple', 'intermediate', 'advanced', 'technical'],
                        },
                        sentenceStructure: {
                          type: 'string',
                          enum: ['simple', 'complex', 'varied'],
                        },
                        specialInstructions: { type: 'string', maxLength: 1000 },
                      },
                    },
                  },
                },
              },
              required: ['bookId', 'updates'],
            },
          },
          {
            name: 'delete_book',
            description: 'Deletes a book and all associated chapters and pages',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to delete',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author (for verification)',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'export_book',
            description: 'Exports a book in the specified format (PDF, EPUB, DOCX, HTML, or TXT)',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to export',
                },
                format: {
                  type: 'string',
                  enum: ['pdf', 'epub', 'docx', 'html', 'txt'],
                  description: 'The format to export the book in',
                },
                includeMetadata: {
                  type: 'boolean',
                  description: 'Whether to include book metadata in the export',
                  default: true,
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author (for verification)',
                },
              },
              required: ['bookId', 'format', 'authorId'],
            },
          },
          {
            name: 'get_book_statistics',
            description:
              'Retrieves detailed statistics about a book including word count, chapter progress, and completion percentage',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
              },
              required: ['bookId'],
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
            name: 'get_chapter',
            description: 'Retrieves a chapter by ID with optional page content',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                includePages: {
                  type: 'boolean',
                  description: 'Whether to include page content',
                  default: false,
                },
              },
              required: ['chapterId'],
            },
          },
          {
            name: 'list_chapters',
            description: 'Lists all chapters in a book',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'update_chapter',
            description:
              'Updates chapter information including title, description, status, and outline',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                updates: {
                  type: 'object',
                  description: 'Fields to update',
                  properties: {
                    title: { type: 'string', maxLength: 200 },
                    description: { type: 'string', maxLength: 1000 },
                    outline: { type: 'string' },
                    targetWordCount: { type: 'number', minimum: 0 },
                    status: {
                      type: 'string',
                      enum: ['planned', 'in_progress', 'draft', 'review', 'approved', 'published'],
                    },
                    notes: { type: 'string' },
                  },
                },
              },
              required: ['chapterId', 'updates'],
            },
          },
          {
            name: 'delete_chapter',
            description: 'Deletes a chapter and all its pages',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author (for verification)',
                },
              },
              required: ['chapterId', 'authorId'],
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
            name: 'get_page',
            description: 'Retrieves a page by ID with all its content',
            inputSchema: {
              type: 'object',
              properties: {
                pageId: {
                  type: 'string',
                  description: 'The unique identifier of the page',
                },
              },
              required: ['pageId'],
            },
          },
          {
            name: 'list_pages',
            description: 'Lists all pages in a chapter',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
              },
              required: ['chapterId'],
            },
          },
          {
            name: 'update_page',
            description:
              'Updates page content, title, or status. Automatically recalculates word count when content changes.',
            inputSchema: {
              type: 'object',
              properties: {
                pageId: {
                  type: 'string',
                  description: 'The unique identifier of the page',
                },
                updates: {
                  type: 'object',
                  description: 'Fields to update',
                  properties: {
                    title: { type: 'string', maxLength: 200 },
                    content: { type: 'string' },
                    notes: { type: 'string' },
                    status: {
                      type: 'string',
                      enum: ['draft', 'review', 'approved', 'published'],
                    },
                  },
                },
              },
              required: ['pageId', 'updates'],
            },
          },
          {
            name: 'delete_page',
            description: 'Deletes a page from a chapter',
            inputSchema: {
              type: 'object',
              properties: {
                pageId: {
                  type: 'string',
                  description: 'The unique identifier of the page',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author (for verification)',
                },
              },
              required: ['pageId', 'authorId'],
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
          {
            name: 'generate_chapter_content',
            description:
              "Generates AI-assisted content for a chapter based on book theme, writing style, chapter outline, and context. Creates natural, flowing text that matches the book's established tone and style.",
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter to generate content for',
                },
                contentType: {
                  type: 'string',
                  enum: ['full_chapter', 'opening', 'continuation', 'conclusion'],
                  description: 'Type of content to generate',
                  default: 'full_chapter',
                },
                wordCount: {
                  type: 'number',
                  description: 'Target word count for the generated content',
                  minimum: 100,
                  maximum: 10000,
                  default: 1500,
                },
                prompt: {
                  type: 'string',
                  description: 'Additional instructions or prompts for content generation',
                  maxLength: 2000,
                },
                includeDialogue: {
                  type: 'boolean',
                  description: 'Whether to include dialogue in the generated content',
                  default: true,
                },
                mood: {
                  type: 'string',
                  enum: [
                    'dramatic',
                    'suspenseful',
                    'romantic',
                    'humorous',
                    'melancholic',
                    'inspiring',
                    'mysterious',
                    'action-packed',
                  ],
                  description: 'Desired mood for the content',
                },
              },
              required: ['chapterId'],
            },
          },
          {
            name: 'generate_page_content',
            description:
              'Generates AI-assisted content for a specific page within a chapter. Useful for continuing existing content or creating focused sections.',
            inputSchema: {
              type: 'object',
              properties: {
                chapterId: {
                  type: 'string',
                  description: 'The unique identifier of the chapter',
                },
                pageTitle: {
                  type: 'string',
                  description: 'Title for the new page',
                  minLength: 1,
                  maxLength: 200,
                },
                contentPrompt: {
                  type: 'string',
                  description: 'Specific prompt or instruction for what this page should contain',
                  minLength: 10,
                  maxLength: 1000,
                },
                wordCount: {
                  type: 'number',
                  description: 'Target word count for the page',
                  minimum: 50,
                  maximum: 5000,
                  default: 500,
                },
                continuePrevious: {
                  type: 'boolean',
                  description: 'Whether this page should continue from the previous page content',
                  default: false,
                },
                pageNumber: {
                  type: 'number',
                  description: 'Specific page number (auto-generated if not provided)',
                  minimum: 1,
                },
              },
              required: ['chapterId', 'pageTitle', 'contentPrompt'],
            },
          },
          {
            name: 'improve_content',
            description:
              'Improves existing content by enhancing writing quality, style consistency, flow, grammar, and readability while maintaining the original intent and voice.',
            inputSchema: {
              type: 'object',
              properties: {
                contentId: {
                  type: 'string',
                  description: 'Page ID or Chapter ID containing the content to improve',
                },
                contentType: {
                  type: 'string',
                  enum: ['page', 'chapter'],
                  description: 'Whether improving a page or full chapter content',
                  default: 'page',
                },
                improvementType: {
                  type: 'string',
                  enum: ['grammar', 'style', 'flow', 'clarity', 'engagement', 'comprehensive'],
                  description: 'Type of improvement to focus on',
                  default: 'comprehensive',
                },
                preserveLength: {
                  type: 'boolean',
                  description: 'Whether to maintain approximately the same word count',
                  default: true,
                },
                specificInstructions: {
                  type: 'string',
                  description: 'Specific instructions for improvement',
                  maxLength: 1000,
                },
              },
              required: ['contentId'],
            },
          },
          {
            name: 'generate_chapter_outline',
            description:
              'Generates a detailed outline for a chapter based on book theme, genre, target audience, and specific chapter goals.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                chapterTitle: {
                  type: 'string',
                  description: 'Title for the new chapter',
                  minLength: 1,
                  maxLength: 200,
                },
                chapterGoals: {
                  type: 'string',
                  description:
                    'What this chapter should achieve (plot advancement, character development, etc.)',
                  maxLength: 1000,
                },
                previousChapterSummary: {
                  type: 'string',
                  description: 'Brief summary of what happened in the previous chapter',
                  maxLength: 500,
                },
                keyEvents: {
                  type: 'array',
                  items: {
                    type: 'string',
                    maxLength: 200,
                  },
                  description: 'Key events or scenes that should happen in this chapter',
                  maxItems: 10,
                },
                targetWordCount: {
                  type: 'number',
                  description: 'Target word count for this chapter',
                  minimum: 500,
                  maximum: 15000,
                  default: 3000,
                },
              },
              required: ['bookId', 'chapterTitle', 'chapterGoals'],
            },
          },
          {
            name: 'add_research_note',
            description:
              'Adds a research note with source information, categorization, and reliability rating. Useful for collecting facts, quotes, statistics, and background information for book writing.',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title or brief description of the research note',
                  minLength: 1,
                  maxLength: 200,
                },
                content: {
                  type: 'string',
                  description: 'The actual research content, findings, or notes',
                  minLength: 1,
                },
                source: {
                  type: 'string',
                  description:
                    'Source of the information (book title, website name, person interviewed, etc.)',
                  maxLength: 500,
                },
                sourceUrl: {
                  type: 'string',
                  description: 'URL of the source if available',
                },
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book this research relates to',
                },
                chapterId: {
                  type: 'string',
                  description: 'Optional chapter ID if research is specific to a chapter',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author adding the research',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string', maxLength: 50 },
                  description: 'Tags for categorizing and finding research',
                  maxItems: 10,
                },
                category: {
                  type: 'string',
                  enum: [
                    'fact',
                    'quote',
                    'statistic',
                    'reference',
                    'idea',
                    'background',
                    'expert_opinion',
                    'historical_data',
                    'technical_info',
                    'other',
                  ],
                  description: 'Category of research information',
                  default: 'other',
                },
                reliability: {
                  type: 'string',
                  enum: ['high', 'medium', 'low', 'unverified'],
                  description: 'Reliability rating of the source',
                  default: 'unverified',
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Priority level for using this research',
                  default: 'medium',
                },
                notes: {
                  type: 'string',
                  description: 'Additional notes or observations about this research',
                  maxLength: 1000,
                },
              },
              required: ['title', 'content', 'bookId', 'authorId'],
            },
          },
          {
            name: 'get_research_notes',
            description:
              'Retrieves research notes for a book or chapter with filtering and sorting options',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                chapterId: {
                  type: 'string',
                  description: 'Optional chapter ID to filter by specific chapter',
                },
                category: {
                  type: 'string',
                  enum: [
                    'fact',
                    'quote',
                    'statistic',
                    'reference',
                    'idea',
                    'background',
                    'expert_opinion',
                    'historical_data',
                    'technical_info',
                    'other',
                  ],
                  description: 'Filter by research category',
                },
                reliability: {
                  type: 'string',
                  enum: ['high', 'medium', 'low', 'unverified'],
                  description: 'Filter by reliability rating',
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Filter by priority level',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by tags',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 50,
                  minimum: 1,
                  maximum: 200,
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip for pagination',
                  default: 0,
                  minimum: 0,
                },
                sortBy: {
                  type: 'string',
                  enum: ['dateAdded', 'title', 'category', 'reliability', 'priority'],
                  description: 'Field to sort by',
                  default: 'dateAdded',
                },
                sortOrder: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  description: 'Sort order',
                  default: 'desc',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'create_citation',
            description:
              'Creates a bibliographic citation for books, articles, websites, and other sources. Supports various citation types and formats.',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: [
                    'book',
                    'journal_article',
                    'website',
                    'newspaper',
                    'magazine',
                    'thesis',
                    'conference_paper',
                    'government_document',
                    'interview',
                    'podcast',
                    'video',
                    'blog_post',
                    'other',
                  ],
                  description: 'Type of source being cited',
                },
                title: {
                  type: 'string',
                  description: 'Title of the work being cited',
                  minLength: 1,
                  maxLength: 500,
                },
                authors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                      fullName: { type: 'string' },
                    },
                  },
                  description: 'List of authors',
                },
                publicationInfo: {
                  type: 'object',
                  properties: {
                    publisher: { type: 'string' },
                    journal: { type: 'string' },
                    volume: { type: 'string' },
                    issue: { type: 'string' },
                    pages: { type: 'string' },
                    edition: { type: 'string' },
                    year: { type: 'number' },
                    month: { type: 'string' },
                    day: { type: 'number' },
                  },
                  description: 'Publication details',
                },
                url: {
                  type: 'string',
                  description: 'URL if available',
                },
                doi: {
                  type: 'string',
                  description: 'Digital Object Identifier',
                },
                isbn: {
                  type: 'string',
                  description: 'ISBN for books',
                },
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book this citation belongs to',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author creating the citation',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string', maxLength: 50 },
                  description: 'Tags for organizing citations',
                },
                notes: {
                  type: 'string',
                  description: 'Additional notes about this citation',
                  maxLength: 2000,
                },
              },
              required: ['type', 'title', 'bookId', 'authorId'],
            },
          },
          {
            name: 'generate_bibliography',
            description:
              'Generates a formatted bibliography from citations in APA, MLA, or other citation styles.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                style: {
                  type: 'string',
                  enum: ['apa', 'mla', 'chicago', 'harvard'],
                  description: 'Citation style format',
                  default: 'apa',
                },
                sortBy: {
                  type: 'string',
                  enum: ['authors', 'date', 'title'],
                  description: 'How to sort the bibliography',
                  default: 'authors',
                },
                filterByChapter: {
                  type: 'string',
                  description: 'Optional chapter ID to filter citations used in specific chapter',
                },
                includeTags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Include only citations with these tags',
                },
                excludeTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Exclude certain citation types',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'get_research_statistics',
            description:
              'Provides statistics and overview of research notes and citations for a book',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'initiate_influencer_research',
            description:
              'Initiates comprehensive research for an influencer profile to gather data for autobiography creation. This starts the research phase for collecting biographical, professional, and social media data.',
            inputSchema: {
              type: 'object',
              properties: {
                primaryName: {
                  type: 'string',
                  description: 'Primary name or handle of the influencer',
                  minLength: 1,
                  maxLength: 200,
                },
                category: {
                  type: 'string',
                  enum: [
                    'content_creator',
                    'entrepreneur',
                    'athlete',
                    'musician',
                    'actor',
                    'author',
                    'scientist',
                    'politician',
                    'activist',
                    'chef',
                    'fashion',
                    'beauty',
                    'gaming',
                    'fitness',
                    'tech',
                    'education',
                    'lifestyle',
                    'other',
                  ],
                  description: 'Primary category/industry of the influencer',
                },
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book this research is for',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author conducting the research',
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  default: 'medium',
                  description: 'Priority level for this research',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags to categorize this influencer research',
                },
                initialInfo: {
                  type: 'object',
                  description: 'Any initial information already known about the influencer',
                  properties: {
                    personalInfo: { type: 'object' },
                    professionalInfo: { type: 'object' },
                    socialMediaAccounts: { type: 'array' },
                  },
                },
              },
              required: ['primaryName', 'category', 'bookId', 'authorId'],
            },
          },
          {
            name: 'add_social_media_account',
            description:
              'Adds social media account data to an influencer profile including follower counts, engagement metrics, and account details.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
                platform: {
                  type: 'string',
                  enum: [
                    'twitter',
                    'instagram',
                    'youtube',
                    'tiktok',
                    'linkedin',
                    'facebook',
                    'twitch',
                    'snapchat',
                    'pinterest',
                    'reddit',
                    'discord',
                    'clubhouse',
                    'threads',
                    'other',
                  ],
                  description: 'Social media platform name',
                },
                username: {
                  type: 'string',
                  description: 'Username on the platform',
                },
                handle: {
                  type: 'string',
                  description: 'Handle or @ username if different',
                },
                url: {
                  type: 'string',
                  description: 'Direct URL to the profile',
                },
                followerCount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Number of followers',
                },
                followingCount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Number of accounts following',
                },
                postCount: {
                  type: 'number',
                  minimum: 0,
                  description: 'Total number of posts',
                },
                verificationStatus: {
                  type: 'boolean',
                  description: 'Whether the account is verified',
                },
                bio: {
                  type: 'string',
                  maxLength: 1000,
                  description: 'Account bio/description',
                },
                engagementRate: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Average engagement rate percentage',
                },
              },
              required: ['profileId', 'authorId', 'platform', 'username'],
            },
          },
          {
            name: 'add_career_milestone',
            description:
              "Adds a significant career milestone, achievement, or event to an influencer's timeline.",
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
                year: {
                  type: 'number',
                  description: 'Year when the milestone occurred',
                },
                event: {
                  type: 'string',
                  maxLength: 500,
                  description: 'Brief description of the milestone/event',
                },
                description: {
                  type: 'string',
                  maxLength: 2000,
                  description: 'Detailed description of the milestone',
                },
                source: {
                  type: 'string',
                  description: 'Source of this information',
                },
                sourceUrl: {
                  type: 'string',
                  description: 'URL of the source',
                },
                significance: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  default: 'medium',
                  description: 'Significance level of this milestone',
                },
                category: {
                  type: 'string',
                  enum: [
                    'award',
                    'achievement',
                    'collaboration',
                    'controversy',
                    'career_change',
                    'breakthrough',
                    'milestone',
                    'personal',
                    'other',
                  ],
                  default: 'other',
                  description: 'Category of the milestone',
                },
              },
              required: ['profileId', 'authorId', 'year', 'event'],
            },
          },
          {
            name: 'update_personal_info',
            description:
              'Updates personal information for an influencer including demographics, education, family details, and background.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
                fullName: {
                  type: 'string',
                  maxLength: 200,
                  description: 'Full legal name',
                },
                knownAs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Other names, nicknames, or stage names',
                },
                dateOfBirth: {
                  type: 'string',
                  format: 'date',
                  description: 'Date of birth',
                },
                birthPlace: {
                  type: 'string',
                  maxLength: 200,
                  description: 'Place of birth',
                },
                nationality: {
                  type: 'string',
                  maxLength: 100,
                  description: 'Nationality',
                },
                currentLocation: {
                  type: 'string',
                  maxLength: 200,
                  description: 'Current location/residence',
                },
                education: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      institution: { type: 'string' },
                      degree: { type: 'string' },
                      field: { type: 'string' },
                      year: { type: 'number' },
                    },
                  },
                  description: 'Education background',
                },
                family: {
                  type: 'object',
                  properties: {
                    spouse: { type: 'string' },
                    children: { type: 'number' },
                    siblings: { type: 'array', items: { type: 'string' } },
                    parents: { type: 'array', items: { type: 'string' } },
                  },
                  description: 'Family information',
                },
                languages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Languages spoken',
                },
                interests: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Personal interests and hobbies',
                },
                skills: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Skills and competencies',
                },
              },
              required: ['profileId', 'authorId'],
            },
          },
          {
            name: 'update_professional_info',
            description:
              'Updates professional information including occupation, companies, achievements, and business ventures.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
                primaryOccupation: {
                  type: 'string',
                  maxLength: 200,
                  description: 'Primary occupation or job title',
                },
                industry: {
                  type: 'string',
                  maxLength: 100,
                  description: 'Industry or sector',
                },
                specializations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Areas of specialization',
                },
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      role: { type: 'string' },
                      startDate: { type: 'string', format: 'date' },
                      endDate: { type: 'string', format: 'date' },
                      description: { type: 'string' },
                    },
                  },
                  description: 'Work history and companies',
                },
                achievements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      year: { type: 'number' },
                      description: { type: 'string' },
                      source: { type: 'string' },
                    },
                  },
                  description: 'Professional achievements and awards',
                },
                collaborations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      year: { type: 'number' },
                    },
                  },
                  description: 'Notable collaborations',
                },
                netWorth: {
                  type: 'object',
                  properties: {
                    estimated: { type: 'number' },
                    currency: { type: 'string' },
                    year: { type: 'number' },
                    source: { type: 'string' },
                  },
                  description: 'Estimated net worth information',
                },
                businessVentures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      startDate: { type: 'string', format: 'date' },
                      status: { type: 'string' },
                    },
                  },
                  description: 'Business ventures and investments',
                },
              },
              required: ['profileId', 'authorId'],
            },
          },
          {
            name: 'add_external_source',
            description:
              'Adds external sources and references for influencer research including news articles, interviews, and documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
                type: {
                  type: 'string',
                  description: 'Type of source (article, interview, video, etc.)',
                },
                url: {
                  type: 'string',
                  description: 'URL of the source',
                },
                title: {
                  type: 'string',
                  description: 'Title of the source material',
                },
                description: {
                  type: 'string',
                  description: 'Description or summary of the source content',
                },
                reliability: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  default: 'medium',
                  description: 'Reliability rating of the source',
                },
              },
              required: ['profileId', 'authorId', 'type', 'url', 'title'],
            },
          },
          {
            name: 'get_influencer_profile',
            description:
              'Retrieves a complete influencer profile with all research data including personal info, social media, career milestones, and sources.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
              },
              required: ['profileId', 'authorId'],
            },
          },
          {
            name: 'list_influencer_profiles',
            description:
              'Lists all influencer profiles for a book with filtering and sorting options.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                category: {
                  type: 'string',
                  enum: [
                    'content_creator',
                    'entrepreneur',
                    'athlete',
                    'musician',
                    'actor',
                    'author',
                    'scientist',
                    'politician',
                    'activist',
                    'chef',
                    'fashion',
                    'beauty',
                    'gaming',
                    'fitness',
                    'tech',
                    'education',
                    'lifestyle',
                    'other',
                  ],
                  description: 'Filter by influencer category',
                },
                status: {
                  type: 'string',
                  enum: ['research_started', 'data_gathering', 'verification', 'completed'],
                  description: 'Filter by research status',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by tags',
                },
                limit: {
                  type: 'number',
                  default: 50,
                  minimum: 1,
                  maximum: 100,
                  description: 'Maximum number of profiles to return',
                },
                offset: {
                  type: 'number',
                  default: 0,
                  minimum: 0,
                  description: 'Number of profiles to skip for pagination',
                },
                sortBy: {
                  type: 'string',
                  enum: ['lastUpdated', 'completion', 'name'],
                  default: 'lastUpdated',
                  description: 'Field to sort by',
                },
                sortOrder: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  default: 'desc',
                  description: 'Sort order',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'generate_research_summary',
            description:
              'Generates a comprehensive research summary for an influencer including metrics, completion status, and data gaps.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
              },
              required: ['profileId', 'authorId'],
            },
          },
          {
            name: 'get_influencer_research_statistics',
            description:
              'Provides comprehensive statistics for all influencer research in a book including completion rates and data metrics.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'generate_research_plan',
            description:
              'Generates a comprehensive research plan for gathering influencer data from the internet, including search strategies, recommended sources, and research tips.',
            inputSchema: {
              type: 'object',
              properties: {
                profileId: {
                  type: 'string',
                  description: 'The unique identifier of the influencer profile',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author for verification',
                },
              },
              required: ['profileId', 'authorId'],
            },
          },
          {
            name: 'get_platform_research_guide',
            description:
              'Provides platform-specific research guidance for gathering data from social media platforms.',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  enum: [
                    'twitter',
                    'instagram',
                    'youtube',
                    'tiktok',
                    'linkedin',
                    'facebook',
                    'twitch',
                    'snapchat',
                    'pinterest',
                    'reddit',
                    'discord',
                    'clubhouse',
                    'threads',
                    'other',
                  ],
                  description: 'Social media platform name',
                },
              },
              required: ['platform'],
            },
          },
          {
            name: 'generate_search_queries',
            description:
              'Generates targeted search queries for finding specific types of information about an influencer.',
            inputSchema: {
              type: 'object',
              properties: {
                influencerName: {
                  type: 'string',
                  description: 'Name of the influencer to research',
                },
                category: {
                  type: 'string',
                  enum: [
                    'content_creator',
                    'entrepreneur',
                    'athlete',
                    'musician',
                    'actor',
                    'author',
                    'scientist',
                    'politician',
                    'activist',
                    'chef',
                    'fashion',
                    'beauty',
                    'gaming',
                    'fitness',
                    'tech',
                    'education',
                    'lifestyle',
                    'other',
                  ],
                  description: 'Category of the influencer',
                },
                researchFocus: {
                  type: 'string',
                  enum: [
                    'biographical',
                    'professional',
                    'recent',
                    'media',
                    'social',
                    'controversies',
                  ],
                  description: 'Specific focus area for the search queries',
                },
              },
              required: ['influencerName', 'category'],
            },
          },
          {
            name: 'get_verification_checklist',
            description:
              'Provides a comprehensive checklist for verifying and fact-checking research data.',
            inputSchema: {
              type: 'object',
              properties: {
                dataType: {
                  type: 'string',
                  enum: [
                    'biographical',
                    'professional',
                    'social_media',
                    'achievements',
                    'controversies',
                  ],
                  description: 'Type of data to verify',
                },
              },
              required: ['dataType'],
            },
          },
          {
            name: 'get_ethical_guidelines',
            description:
              'Provides ethical guidelines and best practices for conducting influencer research.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'generate_research_timeline',
            description:
              'Generates a structured timeline for conducting influencer research with specific milestones and tasks.',
            inputSchema: {
              type: 'object',
              properties: {
                urgency: {
                  type: 'string',
                  enum: ['quick', 'normal', 'comprehensive'],
                  default: 'normal',
                  description: 'Urgency level of the research',
                },
                comprehensiveness: {
                  type: 'string',
                  enum: ['quick', 'standard', 'comprehensive'],
                  default: 'standard',
                  description: 'Level of detail required',
                },
              },
            },
          },
          {
            name: 'record_writing_session',
            description:
              'Records a writing session with word count, time spent, productivity metrics, and goals. Essential for tracking daily writing progress.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                chapterId: {
                  type: 'string',
                  description: 'Optional chapter ID if writing specific chapter',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                sessionDate: {
                  type: 'string',
                  description: 'Date of the writing session (ISO string)',
                  format: 'date-time',
                },
                startTime: {
                  type: 'string',
                  description: 'Start time of the session (ISO string)',
                  format: 'date-time',
                },
                endTime: {
                  type: 'string',
                  description: 'End time of the session (ISO string)',
                  format: 'date-time',
                },
                wordsWritten: {
                  type: 'number',
                  description: 'Number of words written in this session',
                  minimum: 0,
                },
                wordsBefore: {
                  type: 'number',
                  description: 'Word count before the session',
                  minimum: 0,
                  default: 0,
                },
                wordsAfter: {
                  type: 'number',
                  description: 'Word count after the session',
                  minimum: 0,
                },
                sessionType: {
                  type: 'string',
                  enum: [
                    'writing',
                    'editing',
                    'revision',
                    'outlining',
                    'research',
                    'planning',
                    'brainstorming',
                    'other',
                  ],
                  description: 'Type of writing session',
                  default: 'writing',
                },
                mood: {
                  type: 'string',
                  enum: ['excellent', 'good', 'okay', 'difficult', 'frustrated'],
                  description: 'Mood during the writing session',
                  default: 'okay',
                },
                productivity: {
                  type: 'string',
                  enum: ['very_high', 'high', 'medium', 'low', 'very_low'],
                  description: 'Perceived productivity level',
                  default: 'medium',
                },
                goals: {
                  type: 'object',
                  properties: {
                    wordGoal: {
                      type: 'number',
                      description: 'Word count goal for this session',
                    },
                    timeGoal: {
                      type: 'number',
                      description: 'Time goal in minutes for this session',
                    },
                  },
                  description: 'Session goals',
                },
                notes: {
                  type: 'string',
                  description: 'Notes about the writing session',
                  maxLength: 1000,
                },
                challenges: {
                  type: 'array',
                  items: { type: 'string', maxLength: 200 },
                  description: 'Challenges encountered during session',
                },
                accomplishments: {
                  type: 'array',
                  items: { type: 'string', maxLength: 200 },
                  description: 'What was accomplished in this session',
                },
                location: {
                  type: 'string',
                  description: 'Where the writing took place',
                  maxLength: 100,
                },
                interruptions: {
                  type: 'number',
                  description: 'Number of interruptions during session',
                  default: 0,
                },
                flowState: {
                  type: 'boolean',
                  description: 'Whether the writer achieved flow state',
                  default: false,
                },
              },
              required: ['bookId', 'authorId', 'wordsWritten'],
            },
          },
          {
            name: 'get_writing_statistics',
            description:
              'Retrieves comprehensive writing statistics and trends for a specified time period.',
            inputSchema: {
              type: 'object',
              properties: {
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                bookId: {
                  type: 'string',
                  description: 'Optional book ID to filter statistics',
                },
                period: {
                  type: 'string',
                  enum: ['day', 'week', 'month', 'year'],
                  description: 'Time period for statistics',
                  default: 'week',
                },
                startDate: {
                  type: 'string',
                  description: 'Custom start date (ISO string)',
                  format: 'date',
                },
                endDate: {
                  type: 'string',
                  description: 'Custom end date (ISO string)',
                  format: 'date',
                },
              },
              required: ['authorId'],
            },
          },
          {
            name: 'analyze_writing_style',
            description:
              'Performs comprehensive analysis of writing style, readability, sentence structure, vocabulary, and provides improvement suggestions.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to analyze',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                includeChapters: {
                  type: 'boolean',
                  description: 'Whether to include chapter content in analysis',
                  default: true,
                },
                forceReanalysis: {
                  type: 'boolean',
                  description: 'Force new analysis even if recent one exists',
                  default: false,
                },
              },
              required: ['bookId', 'authorId'],
            },
          },
          {
            name: 'generate_writing_report',
            description:
              'Generates a comprehensive writing report with progress summary, style analysis, and personalized recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                bookId: {
                  type: 'string',
                  description: 'Optional book ID for book-specific report',
                },
                reportType: {
                  type: 'string',
                  enum: ['comprehensive', 'progress', 'style', 'summary'],
                  description: 'Type of report to generate',
                  default: 'comprehensive',
                },
                period: {
                  type: 'string',
                  enum: ['week', 'month', 'quarter', 'year'],
                  description: 'Time period for the report',
                  default: 'month',
                },
              },
              required: ['authorId'],
            },
          },
          {
            name: 'get_daily_writing_stats',
            description:
              'Retrieves detailed writing statistics for a specific day, including sessions, word counts, and productivity metrics.',
            inputSchema: {
              type: 'object',
              properties: {
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                date: {
                  type: 'string',
                  description: 'Date to get statistics for (ISO string)',
                  format: 'date',
                },
                bookId: {
                  type: 'string',
                  description: 'Optional book ID to filter by specific book',
                },
              },
              required: ['authorId', 'date'],
            },
          },
          {
            name: 'create_book_outline',
            description:
              "Creates or updates a comprehensive book outline with support for different outline types (three-act, hero's journey, structured, custom).",
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                outline: {
                  type: 'object',
                  description: 'The outline content (structure depends on outlineType)',
                  properties: {
                    synopsis: { type: 'string' },
                    themes: { type: 'array', items: { type: 'string' } },
                    characters: { type: 'array' },
                    settings: { type: 'array' },
                    chapters: { type: 'array' },
                    plotPoints: { type: 'array' },
                    targetWordCount: { type: 'number' },
                  },
                },
                outlineType: {
                  type: 'string',
                  enum: ['structured', 'three_act', 'hero_journey', 'custom'],
                  description: 'Type of outline structure',
                  default: 'structured',
                },
                includeCharacterArcs: {
                  type: 'boolean',
                  description: 'Whether to include character arc tracking',
                  default: false,
                },
                includePlotPoints: {
                  type: 'boolean',
                  description: 'Whether to include major plot points',
                  default: false,
                },
                autoGenerateChapters: {
                  type: 'boolean',
                  description: 'Whether to auto-generate chapters from outline',
                  default: false,
                },
              },
              required: ['bookId', 'authorId', 'outline'],
            },
          },
          {
            name: 'generate_table_of_contents',
            description:
              'Generates a formatted table of contents for a book with customizable formatting options.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                includePageNumbers: {
                  type: 'boolean',
                  description: 'Whether to include page numbers',
                  default: false,
                },
                includeWordCounts: {
                  type: 'boolean',
                  description: 'Whether to include word counts for each section',
                  default: true,
                },
                includeSubsections: {
                  type: 'boolean',
                  description: 'Whether to include page-level subsections',
                  default: true,
                },
                format: {
                  type: 'string',
                  enum: ['standard', 'detailed', 'simple'],
                  description: 'Format style for the table of contents',
                  default: 'standard',
                },
                numbering: {
                  type: 'string',
                  enum: ['numeric', 'roman', 'none'],
                  description: 'Numbering style for chapters and sections',
                  default: 'numeric',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'reorder_chapters',
            description:
              'Reorders chapters in a book according to a specified sequence and optionally updates chapter numbers.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                chapterOrder: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of chapter IDs in the desired order',
                },
                updateChapterNumbers: {
                  type: 'boolean',
                  description: 'Whether to update chapter numbers to match new order',
                  default: true,
                },
              },
              required: ['bookId', 'authorId', 'chapterOrder'],
            },
          },
          {
            name: 'reorganize_book_structure',
            description:
              'Reorganizes book structure into parts, acts, or sections with advanced grouping options.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book',
                },
                authorId: {
                  type: 'string',
                  description: 'ID of the author',
                },
                structureType: {
                  type: 'string',
                  enum: ['parts', 'acts', 'sections'],
                  description: 'Type of structure to create',
                  default: 'parts',
                },
                groupings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      chapterIds: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                    required: ['name', 'chapterIds'],
                  },
                  description: 'Array of groupings with chapter assignments',
                },
                createDividers: {
                  type: 'boolean',
                  description: 'Whether to create divider pages between groups',
                  default: false,
                },
                updateOutline: {
                  type: 'boolean',
                  description: 'Whether to update the book outline with new structure',
                  default: true,
                },
              },
              required: ['bookId', 'authorId', 'groupings'],
            },
          },
          {
            name: 'analyze_book_structure',
            description:
              'Analyzes book structure and provides optimization suggestions for chapter organization, pacing, and balance.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The unique identifier of the book to analyze',
                },
                includeDetailedAnalysis: {
                  type: 'boolean',
                  description: 'Whether to include detailed chapter-by-chapter analysis',
                  default: true,
                },
              },
              required: ['bookId'],
            },
          },
          // Grammar and Style Tools
          {
            name: 'analyze_text_grammar',
            description:
              'Analyzes text for grammar, style, and readability issues using external tools like LanguageTool.',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'The text content to analyze',
                  minLength: 1,
                  maxLength: 50000,
                },
                language: {
                  type: 'string',
                  description: 'Language code for analysis (e.g., en-US)',
                  default: 'en-US',
                },
                checkGrammar: {
                  type: 'boolean',
                  description: 'Whether to check grammar',
                  default: true,
                },
                checkStyle: {
                  type: 'boolean',
                  description: 'Whether to check writing style',
                  default: true,
                },
                checkReadability: {
                  type: 'boolean',
                  description: 'Whether to calculate readability score',
                  default: true,
                },
                service: {
                  type: 'string',
                  enum: ['auto', 'languagetool', 'grammarly', 'builtin'],
                  description: 'Which grammar service to use',
                  default: 'auto',
                },
              },
              required: ['text'],
            },
          },
          {
            name: 'analyze_page_grammar',
            description: 'Analyzes grammar and style for a specific page or chapter content.',
            inputSchema: {
              type: 'object',
              properties: {
                pageId: {
                  type: 'string',
                  description: 'Page ID to analyze (optional if chapterId provided)',
                },
                chapterId: {
                  type: 'string',
                  description: 'Chapter ID to analyze all pages (optional if pageId provided)',
                },
                bookId: {
                  type: 'string',
                  description:
                    'Book ID to analyze entire book (optional if pageId/chapterId provided)',
                },
                language: {
                  type: 'string',
                  description: 'Language code for analysis',
                  default: 'en-US',
                },
              },
              required: [],
            },
          },
          {
            name: 'analyze_style_consistency',
            description:
              'Analyzes writing style consistency across a book based on the defined writing style.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID to analyze',
                },
                targetStyle: {
                  type: 'object',
                  description: "Override the book's writing style for comparison (optional)",
                  properties: {
                    tone: { type: 'string' },
                    voice: { type: 'string' },
                    vocabulary: { type: 'string' },
                    sentenceStructure: { type: 'string' },
                  },
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'proofread_content',
            description:
              'Performs automated proofreading with correction suggestions and optional auto-fixes.',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Text content to proofread',
                  minLength: 1,
                  maxLength: 50000,
                },
                language: {
                  type: 'string',
                  description: 'Language code',
                  default: 'en-US',
                },
                autoApplySimpleFixes: {
                  type: 'boolean',
                  description: 'Automatically apply high-confidence simple fixes',
                  default: false,
                },
                confidenceThreshold: {
                  type: 'number',
                  description: 'Minimum confidence for auto-fixes (0.0-1.0)',
                  default: 0.9,
                  minimum: 0,
                  maximum: 1,
                },
              },
              required: ['text'],
            },
          },
          // Collaboration Tools
          {
            name: 'add_collaborator',
            description: 'Adds a collaborator to a book with specified role and permissions.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                ownerId: {
                  type: 'string',
                  description: 'ID of the user adding the collaborator',
                },
                collaboratorId: {
                  type: 'string',
                  description: 'ID of the user being added as collaborator',
                },
                role: {
                  type: 'string',
                  enum: ['owner', 'editor', 'reviewer', 'viewer'],
                  description: 'Role to assign to the collaborator',
                  default: 'editor',
                },
                permissions: {
                  type: 'object',
                  description: 'Custom permissions (optional)',
                  properties: {
                    canEdit: { type: 'boolean' },
                    canComment: { type: 'boolean' },
                    canExport: { type: 'boolean' },
                    canManageCollaborators: { type: 'boolean' },
                    canDelete: { type: 'boolean' },
                  },
                },
                inviteMessage: {
                  type: 'string',
                  description: 'Optional invitation message',
                  maxLength: 1000,
                },
              },
              required: ['bookId', 'ownerId', 'collaboratorId'],
            },
          },
          {
            name: 'list_collaborators',
            description: 'Lists all collaborators for a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                requestingUserId: {
                  type: 'string',
                  description: 'ID of the user making the request',
                },
              },
              required: ['bookId', 'requestingUserId'],
            },
          },
          {
            name: 'accept_collaboration_invite',
            description: 'Accepts a collaboration invitation for a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the user accepting the invitation',
                },
              },
              required: ['bookId', 'userId'],
            },
          },
          {
            name: 'add_comment',
            description: 'Adds a comment to a page, chapter, or book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the user adding the comment',
                },
                targetType: {
                  type: 'string',
                  enum: ['page', 'chapter', 'book'],
                  description: 'What the comment is attached to',
                },
                targetId: {
                  type: 'string',
                  description: 'ID of the target (pageId, chapterId, or bookId)',
                },
                content: {
                  type: 'string',
                  description: 'Comment content',
                  minLength: 1,
                  maxLength: 5000,
                },
                commentType: {
                  type: 'string',
                  enum: ['general', 'suggestion', 'issue', 'approval', 'question'],
                  description: 'Type of comment',
                  default: 'general',
                },
                selectionStart: {
                  type: 'number',
                  description: 'Start position for text selection comments',
                  minimum: 0,
                },
                selectionEnd: {
                  type: 'number',
                  description: 'End position for text selection comments',
                  minimum: 0,
                },
                selectedText: {
                  type: 'string',
                  description: 'Selected text content',
                  maxLength: 1000,
                },
                parentCommentId: {
                  type: 'string',
                  description: 'Parent comment ID for replies',
                },
              },
              required: ['bookId', 'userId', 'targetType', 'targetId', 'content'],
            },
          },
          {
            name: 'list_comments',
            description: 'Lists comments for a target (page, chapter, or book).',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the requesting user',
                },
                targetType: {
                  type: 'string',
                  enum: ['page', 'chapter', 'book'],
                  description: 'What to get comments for',
                },
                targetId: {
                  type: 'string',
                  description: 'ID of the target',
                },
                includeResolved: {
                  type: 'boolean',
                  description: 'Include resolved comments',
                  default: true,
                },
                sortBy: {
                  type: 'string',
                  enum: ['createdAt', 'commentType'],
                  description: 'Sort field',
                  default: 'createdAt',
                },
                sortOrder: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  description: 'Sort order',
                  default: 'asc',
                },
              },
              required: ['bookId', 'userId', 'targetType', 'targetId'],
            },
          },
          {
            name: 'create_version',
            description: 'Creates a version snapshot of the current book state.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the user creating the version',
                },
                versionName: {
                  type: 'string',
                  description: 'Name for this version',
                  maxLength: 200,
                },
                description: {
                  type: 'string',
                  description: 'Description of changes in this version',
                  maxLength: 1000,
                },
                versionType: {
                  type: 'string',
                  enum: ['manual', 'auto', 'milestone', 'backup'],
                  description: 'Type of version',
                  default: 'manual',
                },
              },
              required: ['bookId', 'userId'],
            },
          },
          {
            name: 'list_versions',
            description: 'Lists version history for a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the requesting user',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of versions to return',
                  default: 20,
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: 'number',
                  description: 'Pagination offset',
                  default: 0,
                  minimum: 0,
                },
                versionType: {
                  type: 'string',
                  enum: ['manual', 'auto', 'milestone', 'backup'],
                  description: 'Filter by version type',
                },
              },
              required: ['bookId', 'userId'],
            },
          },
          {
            name: 'get_collaboration_analytics',
            description: 'Gets collaboration analytics and activity data for a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                userId: {
                  type: 'string',
                  description: 'ID of the requesting user',
                },
                timeRange: {
                  type: 'string',
                  enum: ['7d', '30d', '90d', 'all'],
                  description: 'Time range for analytics',
                  default: '30d',
                },
                includeDetailedActivity: {
                  type: 'boolean',
                  description: 'Include detailed activity log',
                  default: false,
                },
              },
              required: ['bookId', 'userId'],
            },
          },
          // Character Management Tools
          {
            name: 'create_character',
            description: 'Creates a new character for the book (fictional or non-fictional).',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                name: {
                  type: 'string',
                  description: 'Character name',
                },
                characterType: {
                  type: 'string',
                  enum: ['fictional', 'non-fictional', 'inspired-by-real'],
                  description: 'Type of character',
                },
                importance: {
                  type: 'string',
                  enum: ['main', 'secondary', 'minor'],
                  description: 'Character importance level',
                  default: 'main',
                },
                age: {
                  type: 'string',
                  description: 'Character age',
                },
                occupation: {
                  type: 'string',
                  description: 'Character occupation',
                },
                personalityTraits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      trait: { type: 'string' },
                      strength: { type: 'number', minimum: 1, maximum: 10 },
                      description: { type: 'string' },
                    },
                    required: ['trait'],
                  },
                  description: 'Character personality traits',
                },
                appearance: {
                  type: 'object',
                  properties: {
                    height: { type: 'string' },
                    build: { type: 'string' },
                    hairColor: { type: 'string' },
                    eyeColor: { type: 'string' },
                    distinctiveFeatures: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  description: 'Character physical appearance',
                },
                backstory: {
                  type: 'string',
                  description: 'Character background and history',
                },
                motivations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Character motivations and goals',
                },
                fears: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Character fears and weaknesses',
                },
              },
              required: ['bookId', 'name', 'characterType'],
            },
          },
          {
            name: 'get_character',
            description: 'Retrieves detailed information about a character.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'list_characters',
            description: 'Lists all characters for a book with optional filtering.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                characterType: {
                  type: 'string',
                  enum: ['fictional', 'non-fictional', 'inspired-by-real'],
                  description: 'Filter by character type',
                },
                importance: {
                  type: 'string',
                  enum: ['main', 'secondary', 'minor'],
                  description: 'Filter by importance level',
                },
                search: {
                  type: 'string',
                  description: 'Search characters by name, occupation, or tags',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'update_character',
            description: 'Updates character information.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
                updates: {
                  type: 'object',
                  description: 'Fields to update (any character property)',
                },
              },
              required: ['characterId', 'updates'],
            },
          },
          {
            name: 'delete_character',
            description: 'Deletes a character and all related data.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'create_character_relationship',
            description: 'Creates a relationship between two characters.',
            inputSchema: {
              type: 'object',
              properties: {
                character1Id: {
                  type: 'string',
                  description: 'First character ID',
                },
                character2Id: {
                  type: 'string',
                  description: 'Second character ID',
                },
                relationshipType: {
                  type: 'string',
                  enum: [
                    'family',
                    'romantic',
                    'friendship',
                    'mentorship',
                    'rivalry',
                    'enemity',
                    'professional',
                    'acquaintance',
                    'authority',
                    'dependency',
                    'alliance',
                    'betrayal',
                    'unknown',
                    'complex',
                  ],
                  description: 'Type of relationship',
                },
                description: {
                  type: 'string',
                  description: 'Description of the relationship',
                },
                strength: {
                  type: 'number',
                  minimum: 1,
                  maximum: 10,
                  description: 'Relationship strength (1-10)',
                  default: 5,
                },
              },
              required: ['character1Id', 'character2Id', 'relationshipType'],
            },
          },
          {
            name: 'get_character_relationships',
            description: 'Gets all relationships for a character.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'create_character_arc',
            description: 'Creates a character arc to track development over time.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
                arcType: {
                  type: 'string',
                  enum: [
                    'positive_change',
                    'negative_change',
                    'flat_arc',
                    'redemption',
                    'fall',
                    'coming_of_age',
                    'disillusionment',
                    'corruption',
                    'transformation',
                    'growth',
                    'testing',
                    'custom',
                  ],
                  description: 'Type of character arc',
                },
                arcTitle: {
                  type: 'string',
                  description: 'Title or name for the arc',
                },
                arcDescription: {
                  type: 'string',
                  description: 'Description of the character arc',
                },
                startingState: {
                  type: 'object',
                  properties: {
                    worldview: { type: 'string' },
                    primaryMotivation: { type: 'string' },
                    emotionalState: { type: 'string' },
                    skillLevel: { type: 'string' },
                  },
                  description: 'Character state at the beginning',
                },
                endingState: {
                  type: 'object',
                  properties: {
                    worldview: { type: 'string' },
                    primaryMotivation: { type: 'string' },
                    emotionalState: { type: 'string' },
                    skillLevel: { type: 'string' },
                  },
                  description: 'Character state at the end',
                },
              },
              required: ['characterId', 'arcType'],
            },
          },
          {
            name: 'get_character_arc',
            description: 'Gets the character arc for a character.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'add_character_milestone',
            description: 'Adds a development milestone to a character arc.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
                milestoneType: {
                  type: 'string',
                  enum: [
                    'introduction',
                    'inciting_incident',
                    'first_plot_point',
                    'midpoint',
                    'climax',
                    'resolution',
                    'character_reveal',
                    'transformation',
                    'realization',
                    'decision',
                    'action',
                    'setback',
                    'growth',
                    'custom',
                  ],
                  description: 'Type of milestone',
                },
                title: {
                  type: 'string',
                  description: 'Milestone title',
                },
                description: {
                  type: 'string',
                  description: 'Milestone description',
                },
                chapterId: {
                  type: 'string',
                  description: 'Chapter ID where this occurs',
                },
                pageId: {
                  type: 'string',
                  description: 'Page ID where this occurs',
                },
                changeIntensity: {
                  type: 'number',
                  minimum: 1,
                  maximum: 10,
                  description: 'Intensity of character change (1-10)',
                  default: 5,
                },
              },
              required: ['characterId', 'milestoneType', 'title'],
            },
          },
          {
            name: 'analyze_character_consistency',
            description: 'Analyzes character consistency and identifies potential issues.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'generate_character_development_suggestions',
            description: 'Generates suggestions for character development.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          {
            name: 'get_character_network',
            description: 'Gets the character relationship network for a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'get_character_statistics',
            description: 'Gets comprehensive statistics about characters in a book.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'suggest_character_archetype',
            description: 'Suggests character archetypes based on character data.',
            inputSchema: {
              type: 'object',
              properties: {
                characterData: {
                  type: 'object',
                  description: 'Character data for archetype analysis',
                },
                characterType: {
                  type: 'string',
                  enum: ['fictional', 'non-fictional'],
                  description: 'Type of character',
                  default: 'fictional',
                },
              },
              required: ['characterData'],
            },
          },
          {
            name: 'generate_character_template',
            description: 'Generates a character template based on specified type.',
            inputSchema: {
              type: 'object',
              properties: {
                templateType: {
                  type: 'string',
                  enum: ['basic', 'hero', 'villain', 'leader', 'innovator'],
                  description: 'Type of character template',
                },
                characterType: {
                  type: 'string',
                  enum: ['fictional', 'non-fictional'],
                  description: 'Whether character is fictional or non-fictional',
                  default: 'fictional',
                },
              },
              required: ['templateType'],
            },
          },
          {
            name: 'analyze_character_voice',
            description: 'Analyzes character voice and dialogue consistency.',
            inputSchema: {
              type: 'object',
              properties: {
                characterId: {
                  type: 'string',
                  description: 'The character ID',
                },
              },
              required: ['characterId'],
            },
          },
          // Image Generation Tools
          {
            name: 'generate_contextual_image',
            description:
              'Generates an AI image based on story context and placement. The image will be positioned optimally within the chapter flow.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                chapterId: {
                  type: 'string',
                  description: 'The chapter ID where the image should be placed',
                },
                targetPageNumber: {
                  type: 'number',
                  description: 'The page number around which to place the image',
                },
                imagePrompt: {
                  type: 'string',
                  description: 'Description of the image to generate',
                  minLength: 10,
                  maxLength: 500,
                },
                style: {
                  type: 'string',
                  enum: [
                    'book_illustration',
                    'realistic',
                    'artistic',
                    'fantasy',
                    'modern',
                    'vintage',
                  ],
                  description: 'Style of the image to generate',
                  default: 'book_illustration',
                },
                authorId: {
                  type: 'string',
                  description: 'Author ID for authorization',
                },
              },
              required: ['bookId', 'chapterId', 'targetPageNumber', 'imagePrompt', 'authorId'],
            },
          },
          {
            name: 'get_book_images',
            description: 'Gets all images for a book or specific chapter.',
            inputSchema: {
              type: 'object',
              properties: {
                bookId: {
                  type: 'string',
                  description: 'The book ID',
                },
                chapterId: {
                  type: 'string',
                  description: 'Optional chapter ID to filter images',
                },
                status: {
                  type: 'string',
                  enum: ['generating', 'generated', 'failed', 'approved'],
                  description: 'Optional status filter',
                },
              },
              required: ['bookId'],
            },
          },
          {
            name: 'approve_image',
            description: 'Approves an image for publication in the book.',
            inputSchema: {
              type: 'object',
              properties: {
                imageId: {
                  type: 'string',
                  description: 'The image ID to approve',
                },
                authorId: {
                  type: 'string',
                  description: 'Author ID for authorization',
                },
              },
              required: ['imageId', 'authorId'],
            },
          },
          {
            name: 'update_image_placement',
            description: 'Updates the placement of an image within the book.',
            inputSchema: {
              type: 'object',
              properties: {
                imageId: {
                  type: 'string',
                  description: 'The image ID to update',
                },
                placement: {
                  type: 'object',
                  properties: {
                    position: {
                      type: 'string',
                      enum: ['before', 'after', 'between'],
                      description: 'New position for the image',
                    },
                    reason: {
                      type: 'string',
                      description: 'Reason for the placement',
                    },
                    confidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1,
                      description: 'Confidence score for placement',
                    },
                  },
                  required: ['position'],
                },
                authorId: {
                  type: 'string',
                  description: 'Author ID for authorization',
                },
              },
              required: ['imageId', 'placement', 'authorId'],
            },
          },
          {
            name: 'regenerate_image',
            description: 'Regenerates an image with a new prompt while maintaining its placement.',
            inputSchema: {
              type: 'object',
              properties: {
                imageId: {
                  type: 'string',
                  description: 'The image ID to regenerate',
                },
                newPrompt: {
                  type: 'string',
                  description: 'New prompt for image generation',
                  minLength: 10,
                  maxLength: 500,
                },
                authorId: {
                  type: 'string',
                  description: 'Author ID for authorization',
                },
              },
              required: ['imageId', 'newPrompt', 'authorId'],
            },
          },
          {
            name: 'delete_image',
            description: 'Deletes an image from the book.',
            inputSchema: {
              type: 'object',
              properties: {
                imageId: {
                  type: 'string',
                  description: 'The image ID to delete',
                },
                authorId: {
                  type: 'string',
                  description: 'Author ID for authorization',
                },
              },
              required: ['imageId', 'authorId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_book':
            return await this.handleCreateBook(args);
          case 'get_book':
            return await this.handleGetBook(args);
          case 'list_books':
            return await this.handleListBooks(args);
          case 'update_book':
            return await this.handleUpdateBook(args);
          case 'delete_book':
            return await this.handleDeleteBook(args);
          case 'export_book':
            return await this.handleExportBook(args);
          case 'get_book_statistics':
            return await this.handleGetBookStatistics(args);
          case 'create_chapter':
            return await this.handleCreateChapter(args);
          case 'get_chapter':
            return await this.handleGetChapter(args);
          case 'list_chapters':
            return await this.handleListChapters(args);
          case 'update_chapter':
            return await this.handleUpdateChapter(args);
          case 'delete_chapter':
            return await this.handleDeleteChapter(args);
          case 'create_page':
            return await this.handleCreatePage(args);
          case 'get_page':
            return await this.handleGetPage(args);
          case 'list_pages':
            return await this.handleListPages(args);
          case 'update_page':
            return await this.handleUpdatePage(args);
          case 'delete_page':
            return await this.handleDeletePage(args);
          case 'get_content_suggestion':
            return await this.handleGetContentSuggestion(args);
          case 'generate_chapter_content':
            return await this.handleGenerateChapterContent(args);
          case 'generate_page_content':
            return await this.handleGeneratePageContent(args);
          case 'improve_content':
            return await this.handleImproveContent(args);
          case 'generate_chapter_outline':
            return await this.handleGenerateChapterOutline(args);
          case 'add_research_note':
            return await this.handleAddResearchNote(args);
          case 'get_research_notes':
            return await this.handleGetResearchNotes(args);
          case 'create_citation':
            return await this.handleCreateCitation(args);
          case 'generate_bibliography':
            return await this.handleGenerateBibliography(args);
          case 'get_research_statistics':
            return await this.handleGetResearchStatistics(args);
          case 'initiate_influencer_research':
            return await this.handleInitiateInfluencerResearch(args);
          case 'add_social_media_account':
            return await this.handleAddSocialMediaAccount(args);
          case 'add_career_milestone':
            return await this.handleAddCareerMilestone(args);
          case 'update_personal_info':
            return await this.handleUpdatePersonalInfo(args);
          case 'update_professional_info':
            return await this.handleUpdateProfessionalInfo(args);
          case 'add_external_source':
            return await this.handleAddExternalSource(args);
          case 'get_influencer_profile':
            return await this.handleGetInfluencerProfile(args);
          case 'list_influencer_profiles':
            return await this.handleListInfluencerProfiles(args);
          case 'generate_research_summary':
            return await this.handleGenerateResearchSummary(args);
          case 'get_influencer_research_statistics':
            return await this.handleGetInfluencerResearchStatistics(args);
          case 'generate_research_plan':
            return await this.handleGenerateResearchPlan(args);
          case 'get_platform_research_guide':
            return await this.handleGetPlatformResearchGuide(args);
          case 'generate_search_queries':
            return await this.handleGenerateSearchQueries(args);
          case 'get_verification_checklist':
            return await this.handleGetVerificationChecklist(args);
          case 'get_ethical_guidelines':
            return await this.handleGetEthicalGuidelines(args);
          case 'generate_research_timeline':
            return await this.handleGenerateResearchTimeline(args);
          case 'record_writing_session':
            return await this.handleRecordWritingSession(args);
          case 'get_writing_statistics':
            return await this.handleGetWritingStatistics(args);
          case 'analyze_writing_style':
            return await this.handleAnalyzeWritingStyle(args);
          case 'generate_writing_report':
            return await this.handleGenerateWritingReport(args);
          case 'get_daily_writing_stats':
            return await this.handleGetDailyWritingStats(args);
          case 'create_book_outline':
            return await this.handleCreateBookOutline(args);
          case 'generate_table_of_contents':
            return await this.handleGenerateTableOfContents(args);
          case 'reorder_chapters':
            return await this.handleReorderChapters(args);
          case 'reorganize_book_structure':
            return await this.handleReorganizeBookStructure(args);
          case 'analyze_book_structure':
            return await this.handleAnalyzeBookStructure(args);
          // Grammar and Style Tools
          case 'analyze_text_grammar':
            return await this.handleAnalyzeTextGrammar(args);
          case 'analyze_page_grammar':
            return await this.handleAnalyzePageGrammar(args);
          case 'analyze_style_consistency':
            return await this.handleAnalyzeStyleConsistency(args);
          case 'proofread_content':
            return await this.handleProofreadContent(args);
          // Collaboration Tools - DISABLED (placeholder implementations only)
          // case 'add_collaborator':
          //   return await this.handleAddCollaborator(args);
          // case 'list_collaborators':
          //   return await this.handleListCollaborators(args);
          // case 'accept_collaboration_invite':
          //   return await this.handleAcceptCollaborationInvite(args);
          // case 'add_comment':
          //   return await this.handleAddComment(args);
          // case 'list_comments':
          //   return await this.handleListComments(args);
          // case 'create_version':
          //   return await this.handleCreateVersion(args);
          // case 'list_versions':
          //   return await this.handleListVersions(args);
          // case 'get_collaboration_analytics':
          //   return await this.handleGetCollaborationAnalytics(args);
          // Character Management Tools
          case 'create_character':
            return await this.handleCreateCharacter(args);
          case 'get_character':
            return await this.handleGetCharacter(args);
          case 'list_characters':
            return await this.handleListCharacters(args);
          case 'update_character':
            return await this.handleUpdateCharacter(args);
          case 'delete_character':
            return await this.handleDeleteCharacter(args);
          case 'create_character_relationship':
            return await this.handleCreateCharacterRelationship(args);
          case 'get_character_relationships':
            return await this.handleGetCharacterRelationships(args);
          case 'create_character_arc':
            return await this.handleCreateCharacterArc(args);
          case 'get_character_arc':
            return await this.handleGetCharacterArc(args);
          case 'add_character_milestone':
            return await this.handleAddCharacterMilestone(args);
          case 'analyze_character_consistency':
            return await this.handleAnalyzeCharacterConsistency(args);
          case 'generate_character_development_suggestions':
            return await this.handleGenerateCharacterDevelopmentSuggestions(args);
          case 'get_character_network':
            return await this.handleGetCharacterNetwork(args);
          case 'get_character_statistics':
            return await this.handleGetCharacterStatistics(args);
          case 'suggest_character_archetype':
            return await this.handleSuggestCharacterArchetype(args);
          case 'generate_character_template':
            return await this.handleGenerateCharacterTemplate(args);
          case 'analyze_character_voice':
            return await this.handleAnalyzeCharacterVoice(args);
          // Image Generation Tools
          case 'generate_contextual_image':
            return await this.handleGenerateContextualImage(args);
          case 'get_book_images':
            return await this.handleGetBookImages(args);
          case 'approve_image':
            return await this.handleApproveImage(args);
          case 'update_image_placement':
            return await this.handleUpdateImagePlacement(args);
          case 'regenerate_image':
            return await this.handleRegenerateImage(args);
          case 'delete_image':
            return await this.handleDeleteImage(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`,
        );
      }
    });
  }

  async handleCreateBook(args) {
    const book = await this.bookService.createBook(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created book "${book.title}" with ID: ${book._id}. The book is ready for content generation with the specified writing style and theme.`,
        },
      ],
    };
  }

  async handleGetBook(args) {
    const book = await this.bookService.getBook(args.bookId, {
      includeChapters: args.includeChapters,
      includePages: args.includePages,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(book, null, 2),
        },
      ],
    };
  }

  async handleListBooks(args) {
    const books = await this.bookService.listBooks(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(books, null, 2),
        },
      ],
    };
  }

  async handleUpdateBook(args) {
    const book = await this.bookService.updateBook(args.bookId, args.updates);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated book "${book.title}". Updated fields: ${Object.keys(args.updates).join(', ')}`,
        },
      ],
    };
  }

  async handleDeleteBook(args) {
    await this.bookService.deleteBook(args.bookId, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted book with ID: ${args.bookId}`,
        },
      ],
    };
  }

  async handleExportBook(args) {
    const startTime = Date.now();
    console.log(`🚀 Starting export for book ${args.bookId} (format: ${args.format})`);

    try {
      // Validate required arguments
      if (!args.bookId) {
        throw new Error('Book ID is required');
      }
      if (!args.format) {
        throw new Error('Export format is required');
      }
      if (!args.authorId) {
        throw new Error('Author ID is required for export authorization');
      }

      const exportData = await this.exportService.exportBook(args.bookId, args.format, {
        includeMetadata: args.includeMetadata !== false, // Default to true
        authorId: args.authorId,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Export completed in ${duration}s for book ${args.bookId}`);

      // Prepare file information and download options
      const fileSizeKB = Math.round(exportData.size / 1024);
      const fileSizeMB = (exportData.size / (1024 * 1024)).toFixed(1);
      const displaySize = fileSizeKB > 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

      // Get the best download URL and method
      const downloadInfo = exportData.downloadInfo || {};
      const primaryMethod = downloadInfo.downloadMethods?.[0] || {};
      const downloadUrl =
        primaryMethod.url ||
        `files/${exportData.userId}/${exportData.file_id}/${exportData.filename}`;

      // Determine export status and method used
      let exportMethod = 'standard';
      let statusIcon = '✅';
      let statusMessage = 'Ready for download';

      if (exportData.exportMode === 'emergency') {
        exportMethod = 'emergency fallback';
        statusIcon = '🚨';
        statusMessage = 'Emergency export completed';
      } else if (!exportData.librechatRegistered) {
        statusIcon = '⚠️';
        statusMessage = 'File created (using fallback download)';
      }

      // Build the success message with enhanced information
      let message = `🎉 **Book Export Complete!**

📚 **"${exportData.bookTitle}"** has been successfully exported in **${args.format.toUpperCase()}** format.

📄 **File Details:**
- **Size:** ${displaySize}
- **Format:** ${exportData.format.toUpperCase()}
- **Exported:** ${new Date(exportData.exportedAt).toLocaleString()}
- **Status:** ${statusIcon} ${statusMessage}
- **Export Method:** ${exportMethod}

📥 **Download your book:** [${exportData.filename}](${downloadUrl})`;

      // Add download method information
      if (downloadInfo.downloadMethods?.length > 1) {
        message += `\n\n🔗 **Download Options:** ${downloadInfo.downloadMethods.length} access methods available`;
      }

      // Add verification status
      if (exportData.fileVerified === true) {
        message += `\n\n✅ **File Verified:** File saved successfully to filesystem`;
      } else if (exportData.fileVerified === false) {
        message += `\n\n⚠️ **File Warning:** File verification failed but export may still be accessible`;
      }

      // Add registration warnings if needed
      if (!exportData.librechatRegistered && exportData.registrationError) {
        message += `\n\n⚠️ **Download Notice:** LibreChat registration failed but file was created successfully. You may need to use alternative download methods.`;
      }

      // Add format-specific notes
      if (exportData.note) {
        message += `\n\n📝 **Note:** ${exportData.note}`;
      }

      // Add emergency mode explanation if applicable
      if (exportData.exportMode === 'emergency') {
        message += `\n\n🚨 **Emergency Mode:** This export was created using emergency fallback due to database connectivity issues. The file contains a notice about the export condition rather than your original book content.`;
      }

      message += `\n\n💡 **Tip:** Click the link above to download your exported book file. If the download doesn't work, please contact support.`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ Export failed after ${duration}s:`, error.message);

      // Provide helpful error messages based on error type
      let errorMessage = `❌ **Export Failed**\n\n`;

      if (error.message.includes('timeout')) {
        errorMessage += `**Database Timeout:** The export is taking longer than expected, likely due to database connectivity issues or a very large book.\n\n**What to try:**\n- Wait a moment and try again\n- Check if your book is very large (many chapters/pages)\n- Contact support if the issue persists`;
      } else if (error.message.includes('not found')) {
        errorMessage += `**Book Not Found:** The requested book could not be located.\n\n**What to check:**\n- Verify the book ID is correct\n- Ensure the book hasn't been deleted\n- Check that you have access to this book`;
      } else if (error.message.includes('Unauthorized') || error.message.includes('permission')) {
        errorMessage += `**Access Denied:** You don't have permission to export this book.\n\n**Note:** You can only export books that you've created.`;
      } else if (error.message.includes('connection') || error.message.includes('database')) {
        errorMessage += `**Database Issue:** There's a connectivity problem with the database.\n\n**What to try:**\n- Wait a moment and try again\n- Contact support if the issue persists`;
      } else {
        errorMessage += `**Error:** ${error.message}\n\n**What to try:**\n- Check that all parameters are correct\n- Try again in a moment\n- Contact support if the issue continues`;
      }

      return {
        content: [
          {
            type: 'text',
            text: errorMessage,
          },
        ],
      };
    }
  }

  async handleGetBookStatistics(args) {
    const stats = await this.bookService.getBookStatistics(args.bookId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  // Chapter Handlers
  async handleCreateChapter(args) {
    const chapter = await this.bookService.createChapter(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created chapter "${chapter.title}" (Chapter ${chapter.chapterNumber}) with ID: ${chapter._id}`,
        },
      ],
    };
  }

  async handleGetChapter(args) {
    const chapter = await this.bookService.getChapter(args.chapterId, {
      includePages: args.includePages,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(chapter, null, 2),
        },
      ],
    };
  }

  async handleListChapters(args) {
    const chapters = await this.bookService.listChapters(args.bookId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(chapters, null, 2),
        },
      ],
    };
  }

  async handleUpdateChapter(args) {
    const chapter = await this.bookService.updateChapter(args.chapterId, args.updates);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated chapter "${chapter.title}". Updated fields: ${Object.keys(args.updates).join(', ')}`,
        },
      ],
    };
  }

  async handleDeleteChapter(args) {
    await this.bookService.deleteChapter(args.chapterId, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted chapter with ID: ${args.chapterId}`,
        },
      ],
    };
  }

  // Page Handlers
  async handleCreatePage(args) {
    const page = await this.bookService.createPage(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created page "${page.title}" (Page ${page.pageNumber}) with ${page.wordCount} words. Page ID: ${page._id}`,
        },
      ],
    };
  }

  async handleGetPage(args) {
    const page = await this.bookService.getPage(args.pageId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(page, null, 2),
        },
      ],
    };
  }

  async handleListPages(args) {
    const pages = await this.bookService.listPages(args.chapterId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(pages, null, 2),
        },
      ],
    };
  }

  async handleUpdatePage(args) {
    const page = await this.bookService.updatePage(args.pageId, args.updates);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated page "${page.title}" (${page.wordCount} words). Updated fields: ${Object.keys(args.updates).join(', ')}`,
        },
      ],
    };
  }

  async handleDeletePage(args) {
    await this.bookService.deletePage(args.pageId, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted page with ID: ${args.pageId}`,
        },
      ],
    };
  }

  async handleGetContentSuggestion(args) {
    const suggestion = await this.bookService.generateContentSuggestion(
      args.chapterId,
      args.context || {},
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(suggestion, null, 2),
        },
      ],
    };
  }

  // AI Content Generation Handlers
  async handleGenerateChapterContent(args) {
    const result = await this.aiContentService.generateChapterContent(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGeneratePageContent(args) {
    const result = await this.aiContentService.generatePageContent(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleImproveContent(args) {
    const result = await this.aiContentService.improveContent(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGenerateChapterOutline(args) {
    const result = await this.aiContentService.generateChapterOutline(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // Research Management Handlers
  async handleAddResearchNote(args) {
    const note = await this.researchService.createResearchNote(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created research note "${note.title}" with ID: ${note._id}. Category: ${note.category}, Reliability: ${note.reliability}, Priority: ${note.priority}`,
        },
      ],
    };
  }

  async handleGetResearchNotes(args) {
    const result = await this.researchService.getResearchNotes(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleCreateCitation(args) {
    const citation = await this.researchService.createCitation(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created citation "${citation.title}" (${citation.type}) with ID: ${citation._id}. Citation key: ${citation.citationKey}`,
        },
      ],
    };
  }

  async handleGenerateBibliography(args) {
    const bibliography = await this.researchService.generateBibliography(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(bibliography, null, 2),
        },
      ],
    };
  }

  async handleGetResearchStatistics(args) {
    const stats = await this.researchService.getResearchStatistics(args.bookId, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  // Influencer Research Handlers
  async handleInitiateInfluencerResearch(args) {
    const profile = await this.influencerResearchService.initiateInfluencerResearch(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully initiated influencer research for "${profile.primaryName}" (${profile.category}). Profile ID: ${profile._id}. Research status: ${profile.status}. You can now start adding social media accounts, career milestones, and other biographical data.`,
        },
      ],
    };
  }

  async handleAddSocialMediaAccount(args) {
    await this.influencerResearchService.addSocialMediaAccount(args.profileId, args, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully added ${args.platform} account (@${args.username}) to influencer profile. ${args.followerCount ? `Followers: ${args.followerCount.toLocaleString()}` : ''} ${args.verificationStatus ? 'Verified account.' : ''}`,
        },
      ],
    };
  }

  async handleAddCareerMilestone(args) {
    await this.influencerResearchService.addCareerMilestone(args.profileId, args, args.authorId);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully added career milestone: "${args.event}" (${args.year}). Significance: ${args.significance}, Category: ${args.category}. ${args.source ? `Source: ${args.source}` : ''}`,
        },
      ],
    };
  }

  async handleUpdatePersonalInfo(args) {
    const { profileId, authorId, ...personalData } = args;
    const profile = await this.influencerResearchService.updatePersonalInfo(
      profileId,
      personalData,
      authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated personal information for "${profile.primaryName}". Research completion: ${profile.researchMetadata.completionPercentage}%`,
        },
      ],
    };
  }

  async handleUpdateProfessionalInfo(args) {
    const { profileId, authorId, ...professionalData } = args;
    const profile = await this.influencerResearchService.updateProfessionalInfo(
      profileId,
      professionalData,
      authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated professional information for "${profile.primaryName}". Primary occupation: ${profile.professionalInfo.primaryOccupation || 'Not specified'}`,
        },
      ],
    };
  }

  async handleAddExternalSource(args) {
    const { profileId, authorId, ...sourceData } = args;
    const profile = await this.influencerResearchService.addExternalSource(
      profileId,
      sourceData,
      authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Successfully added external source: "${sourceData.title}" (${sourceData.type}). Total sources: ${profile.externalSources.length}, Reliability: ${sourceData.reliability}`,
        },
      ],
    };
  }

  async handleGetInfluencerProfile(args) {
    const profile = await this.influencerResearchService.getInfluencerProfile(
      args.profileId,
      args.authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  }

  async handleListInfluencerProfiles(args) {
    const result = await this.influencerResearchService.listInfluencerProfiles(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGenerateResearchSummary(args) {
    const summary = await this.influencerResearchService.generateResearchSummary(
      args.profileId,
      args.authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  async handleGetInfluencerResearchStatistics(args) {
    const stats = await this.influencerResearchService.getInfluencerResearchStatistics(
      args.bookId,
      args.authorId,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  // Web Scouting Handlers
  async handleGenerateResearchPlan(args) {
    const profile = await this.influencerResearchService.getInfluencerProfile(
      args.profileId,
      args.authorId,
    );
    const plan = await this.webScoutingService.generateResearchPlan(profile);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(plan, null, 2),
        },
      ],
    };
  }

  async handleGetPlatformResearchGuide(args) {
    const guide = this.webScoutingService.getPlatformResearchGuide(args.platform);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(guide, null, 2),
        },
      ],
    };
  }

  async handleGenerateSearchQueries(args) {
    const queries = this.webScoutingService.generateSearchQueries(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(queries, null, 2),
        },
      ],
    };
  }

  async handleGetVerificationChecklist(args) {
    const checklist = this.webScoutingService.generateVerificationChecklist({
      type: args.dataType,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(checklist, null, 2),
        },
      ],
    };
  }

  async handleGetEthicalGuidelines() {
    const guidelines = this.webScoutingService.getEthicalGuidelines();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(guidelines, null, 2),
        },
      ],
    };
  }

  async handleGenerateResearchTimeline(args) {
    const timeline = this.webScoutingService.generateResearchTimeline(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(timeline, null, 2),
        },
      ],
    };
  }

  // Writing Analytics Handlers
  async handleRecordWritingSession(args) {
    const session = await this.writingAnalyticsService.recordWritingSession(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully recorded writing session. Words written: ${session.wordsWritten}, Duration: ${session.duration} minutes, Efficiency: ${session.efficiency} words/minute. Goal achieved: ${session.goals.achieved}`,
        },
      ],
    };
  }

  async handleGetWritingStatistics(args) {
    const stats = await this.writingAnalyticsService.getWritingStatistics(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  async handleAnalyzeWritingStyle(args) {
    const analysis = await this.writingAnalyticsService.analyzeWritingStyle(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  async handleGenerateWritingReport(args) {
    const report = await this.writingAnalyticsService.generateWritingReport(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }

  async handleGetDailyWritingStats(args) {
    const stats = await this.writingAnalyticsService.getDailyStats(
      args.authorId,
      new Date(args.date),
      args.bookId,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  // Content Organization Handlers
  async handleCreateBookOutline(args) {
    const result = await this.contentOrganizationService.createBookOutline(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created ${result.outline.type} outline for book "${result.book.title}". ${result.chaptersGenerated > 0 ? `Generated ${result.chaptersGenerated} chapters from outline.` : ''}`,
        },
      ],
    };
  }

  async handleGenerateTableOfContents(args) {
    const toc = await this.contentOrganizationService.generateTableOfContents(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(toc, null, 2),
        },
      ],
    };
  }

  async handleReorderChapters(args) {
    const result = await this.contentOrganizationService.reorderChapters(args);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully reordered ${result.reorderSummary.totalChapters} chapters. ${result.reorderSummary.numbersUpdated ? 'Chapter numbers updated.' : 'Chapter numbers preserved.'}`,
        },
      ],
    };
  }

  async handleReorganizeBookStructure(args) {
    const structure = await this.contentOrganizationService.reorganizeBookStructure(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structure, null, 2),
        },
      ],
    };
  }

  async handleAnalyzeBookStructure(args) {
    const analysis = await this.contentOrganizationService.analyzeBookStructure(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  // Grammar and Style Tool Handlers
  async handleAnalyzeTextGrammar(args) {
    const analysis = await this.grammarStyleService.analyzeText(args);
    return {
      content: [
        {
          type: 'text',
          text: `Grammar and Style Analysis Results:

**Service Used:** ${analysis.service}
**Text Statistics:**
- Length: ${analysis.textLength} characters
- Word Count: ${analysis.wordCount} words

**Issues Found:** ${analysis.issues.length}

**Issue Summary:**
${analysis.summary.errorCount > 0 ? `- Errors: ${analysis.summary.errorCount}` : ''}
${analysis.summary.warningCount > 0 ? `- Warnings: ${analysis.summary.warningCount}` : ''}
${analysis.summary.infoCount > 0 ? `- Info: ${analysis.summary.infoCount}` : ''}

${analysis.readabilityScore ? `**Readability Score:** ${analysis.readabilityScore.score} (${analysis.readabilityScore.level})` : ''}

**Detailed Issues:**
${analysis.issues.map((issue) => `- ${issue.message} (${issue.severity})`).join('\n')}

**Suggestions:**
${analysis.issues
              .filter((i) => i.suggestions && i.suggestions.length > 0)
              .map((issue) => `- "${issue.context}" → "${issue.suggestions[0].text}"`)
              .join('\n')}`,
        },
      ],
    };
  }

  async handleAnalyzePageGrammar(args) {
    const analysis = await this.grammarStyleService.analyzePageContent(args);

    if (analysis.chapterAnalysis) {
      return {
        content: [
          {
            type: 'text',
            text: `Chapter Grammar Analysis:

${analysis.chapterAnalysis
                .map(
                  (pageAnalysis) =>
                    `**${pageAnalysis.pageTitle} (Page ${pageAnalysis.pageNumber}):**
- Issues: ${pageAnalysis.analysis.summary.totalIssues}
- Readability: ${pageAnalysis.analysis.readabilityScore?.level || 'Not analyzed'}
`,
                )
                .join('\n')}

Use analyze_text_grammar with specific page content for detailed analysis.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Page Grammar Analysis for "${analysis.pageTitle}":

**Page:** ${analysis.pageNumber} in Chapter
**Issues Found:** ${analysis.analysis.summary.totalIssues}
**Readability:** ${analysis.analysis.readabilityScore?.level || 'Not analyzed'}

${analysis.analysis.issues.length > 0
              ? `**Top Issues:**\n${analysis.analysis.issues
                .slice(0, 5)
                .map((issue) => `- ${issue.message}`)
                .join('\n')}`
              : 'No significant issues found!'
            }`,
        },
      ],
    };
  }

  async handleAnalyzeStyleConsistency(args) {
    const analysis = await this.grammarStyleService.analyzeStyleConsistency(args);
    return {
      content: [
        {
          type: 'text',
          text: `Style Consistency Analysis for "${analysis.bookTitle}":

**Overall Consistency:** ${analysis.overallConsistency.consistency} (${analysis.overallConsistency.averageScore}/100)
**Pages Analyzed:** ${analysis.overallConsistency.pagesAnalyzed}
**Total Issues:** ${analysis.overallConsistency.issueCount}

**Expected Style:**
- Tone: ${analysis.expectedStyle.tone}
- Voice: ${analysis.expectedStyle.voice}
- Vocabulary: ${analysis.expectedStyle.vocabulary}

**Recommendations:**
${analysis.recommendations
              .map((rec) => `- ${rec.suggestion} (Priority: ${rec.priority})`)
              .join('\n')}

**Page-by-Page Analysis:**
${analysis.pageAnalysis
              .slice(0, 10)
              .map(
                (page) =>
                  `- ${page.pageTitle}: ${page.styleScore}/100 ${page.deviations.length > 0 ? `(${page.deviations.length} deviations)` : ''}`,
              )
              .join('\n')}`,
        },
      ],
    };
  }

  async handleProofreadContent(args) {
    const result = await this.grammarStyleService.proofreadContent(args);
    return {
      content: [
        {
          type: 'text',
          text: `Proofreading Results:

**Summary:**
- Total Issues: ${result.summary.totalIssues}
- Auto-Fixed: ${result.summary.autoFixed}
- Needs Review: ${result.summary.needsReview}

**Corrected Text:**
${result.correctedText}

**Applied Corrections:**
${result.appliedCorrections
              .map(
                (corr) =>
                  `- "${corr.original}" → "${corr.suggestion}" (${Math.round(corr.confidence * 100)}% confidence)`,
              )
              .join('\n')}

**Manual Review Needed:**
${result.manualReviewNeeded
              .map(
                (corr) =>
                  `- "${corr.original}" → "${corr.suggestion}" (${Math.round(corr.confidence * 100)}% confidence) - ${corr.type}`,
              )
              .join('\n')}`,
        },
      ],
    };
  }

  // Collaboration Tool Handlers
  async handleAddCollaborator(args) {
    const result = await this.collaborationService.addCollaborator(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}

**Collaborator Details:**
- User ID: ${result.collaborator.userId}
- Role: ${result.collaborator.role}
- Status: ${result.collaborator.status}
- Added: ${result.collaborator.addedAt}

**Permissions:**
${Object.entries(result.collaborator.permissions)
              .filter(([, value]) => value === true)
              .map(([key]) => `- ${key}`)
              .join('\n')}`,
        },
      ],
    };
  }

  async handleListCollaborators(args) {
    const result = await this.collaborationService.listCollaborators(args);
    return {
      content: [
        {
          type: 'text',
          text: `Collaborators for "${result.bookTitle}":

**Owner:** ${result.owner.userId} (since ${result.owner.joinedAt})

**Collaborators (${result.collaborators.length}):**
${result.collaborators
              .map(
                (collab) =>
                  `- ${collab.userId} (${collab.role}) - ${collab.status} ${collab.lastActiveAt ? `- Last active: ${collab.lastActiveAt}` : ''}`,
              )
              .join('\n')}

**Total:** ${result.totalCollaborators} people`,
        },
      ],
    };
  }

  async handleAcceptCollaborationInvite(args) {
    const result = await this.collaborationService.acceptInvitation(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}

**Your Permissions:**
${Object.entries(result.permissions)
              .filter(([, value]) => value === true)
              .map(([key]) => `- ${key}`)
              .join('\n')}`,
        },
      ],
    };
  }

  async handleAddComment(args) {
    const result = await this.collaborationService.addComment(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}

**Comment Details:**
- Type: ${result.comment.commentType}
- Target: ${result.comment.targetType} (${result.comment.targetId})
- Created: ${result.comment.createdAt}
${result.comment.selection ? `- Text Selection: "${result.comment.selection.text}"` : ''}

**Content:**
${result.comment.content}`,
        },
      ],
    };
  }

  async handleListComments(args) {
    const result = await this.collaborationService.listComments(args);
    return {
      content: [
        {
          type: 'text',
          text: `Comments for ${result.targetType}: ${result.targetId}

**Summary:**
- Total Comments: ${result.totalComments}
- Unresolved: ${result.unresolvedCount}

**Comments:**
${result.comments
              .map(
                (comment) =>
                  `**${comment.userId} (${comment.userRole})** - ${comment.createdAt}
Type: ${comment.commentType} ${comment.isResolved ? '✅ Resolved' : '⏳ Open'}
${comment.selection ? `Selection: "${comment.selection.text}"` : ''}
Content: ${comment.content}
${comment.replyCount > 0 ? `Replies: ${comment.replyCount}` : ''}
---`,
              )
              .join('\n\n')}`,
        },
      ],
    };
  }

  async handleCreateVersion(args) {
    const result = await this.collaborationService.createVersion(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}

**Version Details:**
- Name: ${result.version.name}
- ID: ${result.version.id}
- Type: ${result.version.versionType}
- Created: ${result.version.createdAt}
- Created by: ${result.version.userId}

**Statistics:**
- Chapters: ${result.version.stats.totalChapters}
- Pages: ${result.version.stats.totalPages}
- Words: ${result.version.stats.wordCount}

${result.version.description ? `**Description:** ${result.version.description}` : ''}`,
        },
      ],
    };
  }

  async handleListVersions(args) {
    const result = await this.collaborationService.listVersions(args);
    return {
      content: [
        {
          type: 'text',
          text: `Version History for Book ${result.bookId}:

**Total Versions:** ${result.pagination.total}
**Showing:** ${result.versions.length} versions

${result.versions
              .map(
                (version) =>
                  `**${version.name}** (${version.versionType})
- Created: ${version.createdAt} by ${version.userId}
- ${version.restorable ? '✅ Restorable' : '❌ Not restorable'}
${version.description ? `- Description: ${version.description}` : ''}
---`,
              )
              .join('\n\n')}

${result.pagination.hasMore ? `\nUse offset ${result.pagination.offset + result.pagination.limit} to see more versions.` : ''}`,
        },
      ],
    };
  }

  async handleGetCollaborationAnalytics(args) {
    const result = await this.collaborationService.getCollaborationAnalytics(args);
    return {
      content: [
        {
          type: 'text',
          text: `Collaboration Analytics for Book ${result.bookId}:

**Time Period:** ${result.timeRange} (${result.period.from} to ${result.period.to})

**Collaborators:**
- Total: ${result.collaborators.total}
- Active: ${result.collaborators.active}
- Pending Invites: ${result.collaborators.pending}

**Activity:**
- Total Actions: ${result.activity.totalActions}
- Most Active Users:
${result.activity.mostActiveUsers
              .map((user) => `  - ${user.userId}: ${user.total} actions`)
              .join('\n')}

**Comments:**
- Total: ${result.comments.totalComments}
- Unresolved: ${result.comments.unresolvedComments}

**Daily Activity:**
${Object.entries(result.activity.activityByDay)
              .slice(-7)
              .map(([date, count]) => `- ${date}: ${count} actions`)
              .join('\n')}`,
        },
      ],
    };
  }

  // Character Management Handlers
  async handleCreateCharacter(args) {
    // Convert UUID bookId to MongoDB ObjectId
    const characterData = {
      ...args,
      bookId: new mongoose.Types.ObjectId(args.bookId),
    };
    const result = await this.worldBuildingService.createCharacter(characterData);
    return {
      content: [
        {
          type: 'text',
          text: `✅ Character "${result.name}" created successfully!

**Character Details:**
- ID: ${result._id}
- Role: ${result.role}
- Importance: ${result.importance}
- Age: ${result.physicalDescription?.age || 'Not specified'}
- Occupation: ${result.background?.occupation || 'Not specified'}

**Personality Traits:**
${result.personality?.traits?.map((trait) => `- ${trait}`).join('\n') || 'None added yet'}

**Description:** ${result.description || 'No description provided'}

${result.importance === 'main' ? '🎭 A character arc has been automatically created for this main character.' : ''}`,
        },
      ],
    };
  }

  async handleGetCharacter(args) {
    const result = await this.worldBuildingService.getCharacter(args.characterId);
    return {
      content: [
        {
          type: 'text',
          text: `📖 Character: **${result.name}**

**Basic Information:**
- Role: ${result.role}
- Importance: ${result.importance}
- Age: ${result.physicalDescription?.age || 'Not specified'}
- Occupation: ${result.background?.occupation || 'Not specified'}
- Status: ${result.status || 'Active'}

**Physical Appearance:**
${result.physicalDescription
              ? Object.entries(result.physicalDescription)
                .filter(([key, value]) => value)
                .map(([key, value]) => `- ${key}: ${value}`)
                .join('\n') || 'Not described'
              : 'Not described'
            }

**Personality Traits:**
${result.personality?.traits?.map((trait) => `- ${trait}`).join('\n') || 'None defined'}

**Motivations:**
${result.personality?.motivations?.map((m) => `- ${m}`).join('\n') || 'None defined'}

**Fears:**
${result.personality?.fears?.map((f) => `- ${f}`).join('\n') || 'None defined'}

**Backstory:**
${result.background?.backstory || 'Not provided'}

**Relationships:** ${result.relationships?.length || 0} relationships
**Character Arc:** ${result.characterArc ? 'Available' : 'Not created'}

**Description:**
${result.description || 'No description provided'}`,
        },
      ],
    };
  }

  async handleListCharacters(args) {
    const result = await this.worldBuildingService.listCharacters(args.bookId, {
      importance: args.importance,
      search: args.search,
    });

    return {
      content: [
        {
          type: 'text',
          text: `📚 Characters in Book

**Total Characters:** ${result.length}

${result
              .map(
                (char) => `**${char.name}** (${char.role})
- Importance: ${char.importance}
- Occupation: ${char.background?.occupation || 'Not specified'}
- Status: ${char.status || 'Active'}
- ID: ${char._id}`,
              )
              .join('\n\n') || 'No characters found'
            }`,
        },
      ],
    };
  }

  async handleUpdateCharacter(args) {
    const result = await this.worldBuildingService.updateCharacter(args.characterId, args.updates);
    return {
      content: [
        {
          type: 'text',
          text: `✅ Character "${result.name}" updated successfully!

**Updated Fields:** ${Object.keys(args.updates).join(', ')}

**Character Updated Successfully**
- Role: ${result.role}
- Importance: ${result.importance}`,
        },
      ],
    };
  }

  async handleDeleteCharacter(args) {
    await this.worldBuildingService.deleteCharacter(args.characterId, args.authorId);
    const result = { message: `Character deleted successfully` };
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${result.message}

⚠️ All related relationships and character arc data have also been removed.`,
        },
      ],
    };
  }

  async handleCreateCharacterRelationship(args) {
    const result = await this.worldBuildingService.createRelationship(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ Relationship created between "${result.character1Name}" and "${result.character2Name}"

**Relationship Details:**
- Type: ${result.relationshipType}
- Strength: ${result.strength}/10
- Status: ${result.status}
- Description: ${result.description || 'No description provided'}

**Dynamics:**
- Power Balance: ${result.dynamics.powerBalance}
- Communication: ${result.dynamics.communicationStyle}
- Trust Level: ${result.dynamics.trustLevel}/10
- Conflict Level: ${result.dynamics.conflictLevel}/10`,
        },
      ],
    };
  }

  async handleGetCharacterRelationships(args) {
    const result = await this.worldBuildingService.getRelationships(args.characterId);
    return {
      content: [
        {
          type: 'text',
          text: `🤝 Character Relationships

**Total Relationships:** ${result.length}

${result
              .map(
                (rel) => `**${rel.character1Name} ↔ ${rel.character2Name}**
- Type: ${rel.relationshipType}
- Strength: ${rel.strength}/10
- Status: ${rel.status}
- Conflicts: ${rel.conflicts.length}
- Key Moments: ${rel.keyMoments.length}
- Stability Score: ${rel.analytics.stabilityScore.toFixed(1)}/10`,
              )
              .join('\n\n') || 'No relationships found'
            }`,
        },
      ],
    };
  }

  async handleCreateCharacterArc(args) {
    const result = await this.worldBuildingService.createCharacterArc(args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ Character arc created for "${result.characterName}"!

**Arc Details:**
- Type: ${result.arcType}
- Title: ${result.arcTitle || 'Untitled'}
- Status: ${result.status}

**Starting State:**
${result.startingState
              ? Object.entries(result.startingState)
                .filter(([key, value]) => value)
                .map(([key, value]) => `- ${key}: ${value}`)
                .join('\n') || 'Not defined'
              : 'Not defined'
            }

**Ending State:**
${result.endingState
              ? Object.entries(result.endingState)
                .filter(([key, value]) => value)
                .map(([key, value]) => `- ${key}: ${value}`)
                .join('\n') || 'Not defined'
              : 'Not defined'
            }

**Metrics:**
- Completeness: ${result.arcMetrics.completeness}/100
- Consistency: ${result.arcMetrics.consistency}/100
- Overall Score: ${result.arcMetrics.overallScore.toFixed(1)}/100`,
        },
      ],
    };
  }

  async handleGetCharacterArc(args) {
    const result = await this.worldBuildingService.getCharacterArc(args.characterId);

    if (!result) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ No character arc found for this character. Use create_character_arc to create one.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `🎭 Character Arc: **${result.characterName}**

**Arc Type:** ${result.arcType}
**Status:** ${result.status}
**Progress:** ${result.arcProgress.toFixed(1)}%

**Milestones:** ${result.milestones.length}
**Internal Conflicts:** ${result.internalConflicts.length} (${result.unresolvedConflicts.length} unresolved)
**Major Decisions:** ${result.majorDecisions.length}

**Metrics:**
- Completeness: ${result.arcMetrics.completeness}/100
- Consistency: ${result.arcMetrics.consistency}/100
- Believability: ${result.arcMetrics.believability}/100
- Engagement: ${result.arcMetrics.engagement}/100
- Overall Score: ${result.arcMetrics.overallScore.toFixed(1)}/100

**Recent Milestones:**
${result.milestones
              .slice(-3)
              .map((m) => `- ${m.title} (${m.milestoneType})`)
              .join('\n') || 'None yet'
            }`,
        },
      ],
    };
  }

  async handleAddCharacterMilestone(args) {
    const result = await this.worldBuildingService.addArcMilestone(args.characterId, args);
    return {
      content: [
        {
          type: 'text',
          text: `✅ Milestone "${args.title}" added to character arc!

**Milestone Details:**
- Type: ${args.milestoneType}
- Change Intensity: ${args.changeIntensity || 5}/10
- Chapter: ${args.chapterId || 'Not specified'}
- Page: ${args.pageId || 'Not specified'}

**Updated Arc Metrics:**
- Completeness: ${result.arcMetrics.completeness}/100
- Overall Score: ${result.arcMetrics.overallScore.toFixed(1)}/100`,
        },
      ],
    };
  }

  async handleAnalyzeCharacterConsistency(args) {
    const result = await this.worldBuildingService.analyzeCharacterConsistency(args.characterId);
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Character Consistency Analysis: **${result.characterName}**

**Overall Consistency Score:** ${result.consistencyScore}/100

**Issues Found:**
${result.issues
              .map(
                (issue) => `**${issue.type}** (${issue.count} items)
${issue.details.map((detail) => `- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`).join('\n')}`,
              )
              .join('\n\n') || 'No issues found'
            }

**Decision Consistency:**
${result.decisionConsistency ? `Score: ${result.decisionConsistency.score.toFixed(1)}/100` : 'No decision data available'}

**Recommendations:**
${result.recommendations.map((rec) => `- ${rec}`).join('\n') || 'Character appears consistent'}`,
        },
      ],
    };
  }

  async handleGenerateCharacterDevelopmentSuggestions(args) {
    const result = await this.worldBuildingService.generateCharacterDevelopmentSuggestions(
      args.characterId,
    );
    return {
      content: [
        {
          type: 'text',
          text: `💡 Development Suggestions for **${result.characterName}**

**Current Development Score:** ${result.developmentScore}/100

**Suggestions:**
${result.suggestions
              .map(
                (sugg) => `**${sugg.category.toUpperCase()}** (${sugg.priority} priority)
${sugg.suggestion}
Action: ${sugg.action}`,
              )
              .join('\n\n') || 'Character is well developed'
            }

**Next Steps:**
1. Focus on high-priority suggestions first
2. Consider adding character relationships for depth
3. Develop internal conflicts for complexity
4. Track character growth through milestones`,
        },
      ],
    };
  }

  async handleGetCharacterNetwork(args) {
    const result = await this.worldBuildingService.getCharacterNetwork(args.bookId);
    return {
      content: [
        {
          type: 'text',
          text: `🕸️ Character Relationship Network

**Characters:** ${result.characters.length}
**Total Relationships:** ${result.relationships.reduce((sum, rel) => sum + rel.count, 0)}

**Character List:**
${result.characters.map((char) => `- **${char.name}** (${char.importance}, ${char.characterType})`).join('\n')}

**Relationship Types:**
${result.relationships.map((rel) => `**${rel._id}:** ${rel.count} relationships (avg strength: ${rel.averageStrength.toFixed(1)}/10)`).join('\n')}`,
        },
      ],
    };
  }

  async handleGetCharacterStatistics(args) {
    const result = await this.worldBuildingService.getCharacterStatistics(args.bookId);
    return {
      content: [
        {
          type: 'text',
          text: `📊 Character Statistics

**Character Overview:**
- Total Characters: ${result.characters.totalCharacters || 0}
- Fictional: ${result.characters.fictionalCount || 0}
- Non-fictional: ${result.characters.nonFictionalCount || 0}
- Main Characters: ${result.characters.mainCharacterCount || 0}

**Development Metrics:**
- Average Development Score: ${result.characters.averageDevelopmentScore ? result.characters.averageDevelopmentScore.toFixed(1) : 'N/A'}/100
- Average Consistency Score: ${result.characters.averageConsistencyScore ? result.characters.averageConsistencyScore.toFixed(1) : 'N/A'}/100

**Relationships:**
- Total Relationships: ${result.relationships.totalRelationships || 0}
- Average Strength: ${result.relationships.averageStrength ? result.relationships.averageStrength.toFixed(1) : 'N/A'}/10
- Active Relationships: ${result.relationships.activeRelationships || 0}

**Character Arcs:**
- Total Arcs: ${result.arcs.totalArcs || 0}
- Complete Arcs: ${result.arcs.completeArcs || 0}
- Average Arc Score: ${result.arcs.averageScore ? result.arcs.averageScore.toFixed(1) : 'N/A'}/100`,
        },
      ],
    };
  }

  async handleSuggestCharacterArchetype(args) {
    const result = await this.worldBuildingService.suggestCharacterArchetype(
      args.characterData,
      args.characterType,
    );
    return {
      content: [
        {
          type: 'text',
          text: `🎭 Character Archetype Suggestions

**Recommended Archetypes:**
${result.suggested.map((archetype) => `- **${archetype}**`).join('\n')}

**All Available Archetypes:**
${result.allArchetypes.map((archetype) => `- ${archetype}`).join('\n')}

💡 **Tip:** Choose an archetype that matches your character's role in the story and personality traits.`,
        },
      ],
    };
  }

  async handleGenerateCharacterTemplate(args) {
    const result = await this.worldBuildingService.generateCharacterTemplate(
      args.templateType,
      args.characterType,
    );
    return {
      content: [
        {
          type: 'text',
          text: `📋 Character Template: **${args.templateType}** (${args.characterType || 'fictional'})

**Template Structure:**
\`\`\`json
${JSON.stringify(result.template, null, 2)}
\`\`\`

**Available Templates:**
${result.availableTemplates.map((template) => `- ${template}`).join('\n')}

💡 **Usage:** Copy this template and modify it to create your character using create_character.`,
        },
      ],
    };
  }

  async handleAnalyzeCharacterVoice(args) {
    const result = await this.worldBuildingService.analyzeCharacterVoice(args.characterId);
    return {
      content: [
        {
          type: 'text',
          text: `🗣️ Character Voice Analysis: **${result.characterName}**

**Voice Profile:**
- Vocabulary: ${result.voiceProfile.vocabulary || 'Not defined'}
- Tone: ${result.voiceProfile.tone || 'Not defined'}
- Accent: ${result.voiceProfile.accent || 'Not defined'}

**Dialogue Analysis:**
${result.dialogueCount
              ? `- Total Dialogue Quotes: ${result.dialogueCount}
- Average Quote Length: ${result.averageQuoteLength.toFixed(1)} characters
- Complexity Score: ${result.complexityScore ? result.complexityScore.toFixed(1) : 'N/A'}%`
              : 'No dialogue found'
            }

**Recommendations:**
${result.recommendations.map((rec) => `- ${rec}`).join('\n') || 'Voice profile is complete'}

💡 **Tip:** Add more dialogue quotes to improve voice analysis accuracy.`,
        },
      ],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // Image Generation Tool Handlers
  async handleGenerateContextualImage(args) {
    try {
      const image = await this.imageService.generateContextualImage(args);

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Image Generated Successfully**

**Image Details:**
- Image ID: ${image._id}
- Book ID: ${image.bookId}
- Chapter ID: ${image.chapterId}
- Target Page: ${image.targetPageNumber}
- Style: ${image.style}
- Status: ${image.status}

**Placement Analysis:**
- Position: ${image.placement.position}
- Reason: ${image.placement.reason}
- Confidence: ${(image.placement.confidence * 100).toFixed(1)}%

**Content Analysis:**
- Themes: ${image.contextAnalysis.themes.join(', ') || 'None detected'}
- Characters: ${image.contextAnalysis.characters.join(', ') || 'None detected'}
- Setting: ${image.contextAnalysis.setting}
- Mood: ${image.contextAnalysis.mood}
- Story Beat: ${image.contextAnalysis.storyBeat}

**Prompt:**
- Original: ${image.prompt.original}
- Enhanced: ${image.prompt.enhanced.substring(0, 200)}${image.prompt.enhanced.length > 200 ? '...' : ''}

The image has been generated and will appear at the optimal position when the book is exported to HTML, PDF, TXT, or DOCX formats.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to generate image:** ${error.message}`,
          },
        ],
      };
    }
  }

  async handleGetBookImages(args) {
    try {
      const images = await this.imageService.getBookImages(args.bookId, {
        chapterId: args.chapterId,
        status: args.status,
      });

      if (images.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📷 **No images found** for the specified criteria.`,
            },
          ],
        };
      }

      const imageList = images
        .map((image) => {
          return `**Image ${image._id.substring(0, 8)}...**
- Chapter: ${image.chapterId}
- Page: ${image.targetPageNumber}
- Position: ${image.placement.position}
- Status: ${image.status}
- Prompt: ${image.prompt.original.substring(0, 100)}${image.prompt.original.length > 100 ? '...' : ''}
- Generated: ${new Date(image.createdAt).toLocaleDateString()}`;
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `📷 **Book Images (${images.length} found)**

${imageList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to get images:** ${error.message}`,
          },
        ],
      };
    }
  }

  async handleApproveImage(args) {
    try {
      const image = await this.imageService.approveImage(args.imageId, args.authorId);

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Image Approved**

Image ${args.imageId.substring(0, 8)}... has been approved for publication.
- Status: ${image.status}
- Approved at: ${new Date(image.approvedAt).toLocaleString()}

The image will now be included in book exports.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to approve image:** ${error.message}`,
          },
        ],
      };
    }
  }

  async handleUpdateImagePlacement(args) {
    try {
      const image = await this.imageService.updateImagePlacement(
        args.imageId,
        args.placement,
        args.authorId,
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Image Placement Updated**

Image ${args.imageId.substring(0, 8)}... placement has been updated.
- New position: ${image.placement.position}
- Reason: ${image.placement.reason || 'User specified'}
- Confidence: ${(image.placement.confidence * 100).toFixed(1)}%

The updated placement will be reflected in future exports.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to update image placement:** ${error.message}`,
          },
        ],
      };
    }
  }

  async handleRegenerateImage(args) {
    try {
      const image = await this.imageService.regenerateImage(
        args.imageId,
        args.newPrompt,
        args.authorId,
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Image Regenerated**

Image ${args.imageId.substring(0, 8)}... has been regenerated with a new prompt.
- New prompt: ${image.prompt.original}
- Enhanced prompt: ${image.prompt.enhanced.substring(0, 200)}${image.prompt.enhanced.length > 200 ? '...' : ''}
- Status: ${image.status}
- Updated context analysis: ${image.contextAnalysis.themes.join(', ')}

The placement and style remain the same, but the image content has been updated.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to regenerate image:** ${error.message}`,
          },
        ],
      };
    }
  }

  async handleDeleteImage(args) {
    try {
      const result = await this.imageService.deleteImage(args.imageId, args.authorId);

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Image Deleted**

Image ${args.imageId.substring(0, 8)}... has been successfully deleted.
- Deleted at: ${new Date(result.deletedAt).toLocaleString()}

The image has been removed from the book and will no longer appear in exports.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Failed to delete image:** ${error.message}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Book Creation MCP server running on stdio');
  }
}

const server = new BookCreationServer();
server.run().catch(console.error);

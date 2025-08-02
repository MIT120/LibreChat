#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { AIContentService } from './services/AIContentService.js';
import { BookService } from './services/BookService.js';
import { ConfigService } from './services/ConfigService.js';
import { ContentOrganizationService } from './services/ContentOrganizationService.js';
import { ExportService } from './services/ExportService.js';
import { ResearchService } from './services/ResearchService.js';
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
        this.exportService = new ExportService(this.bookService);
        this.aiContentService = new AIContentService();
        this.researchService = new ResearchService();
        this.worldBuildingService = new WorldBuildingService();
        this.writingAnalyticsService = new WritingAnalyticsService();
        this.contentOrganizationService = new ContentOrganizationService();

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

    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };

        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Book Creation MCP server running on stdio');
    }
}

const server = new BookCreationServer();
server.run().catch(console.error);

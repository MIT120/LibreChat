/**
 * Advanced Book Tool Handlers - MCP tools for advanced book features
 */

import { ValidationError } from '../../../types/errors.js';
import { ILogger } from '../../core/Logger.js';
import { IToolHandler } from '../../interfaces/index.js';
import BookImportService from '../../services/BookImportService.js';
import NaturalLanguageQueryService from '../../services/NaturalLanguageQueryService.js';
import SmartLibraryService from '../../services/SmartLibraryService.js';

export class AdvancedBookToolHandlers {
    private logger: ILogger;
    private importService: BookImportService;
    private queryService: NaturalLanguageQueryService;
    private libraryService: SmartLibraryService;

    constructor(
        logger: ILogger,
        importService: BookImportService,
        queryService: NaturalLanguageQueryService,
        libraryService: SmartLibraryService
    ) {
        this.logger = logger.child('AdvancedBookToolHandlers');
        this.importService = importService;
        this.queryService = queryService;
        this.libraryService = libraryService;
    }

    getTools(): IToolHandler[] {
        return [
            // Book Import Tools
            {
                name: 'import_book_file',
                description: 'Import books from EPUB, PDF, DOCX, or TXT files with metadata extraction',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the book file to import',
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author ID to assign to the imported book',
                        },
                        options: {
                            type: 'object',
                            description: 'Import options',
                            properties: {
                                extractImages: {
                                    type: 'boolean',
                                    description: 'Extract images from the book',
                                    default: false,
                                },
                                preserveFormatting: {
                                    type: 'boolean',
                                    description: 'Preserve original formatting',
                                    default: true,
                                },
                                chunkByChapters: {
                                    type: 'boolean',
                                    description: 'Split content into chapters automatically',
                                    default: true,
                                },
                                detectGenre: {
                                    type: 'boolean',
                                    description: 'Auto-detect book genre from content',
                                    default: true,
                                },
                                analyzeContent: {
                                    type: 'boolean',
                                    description: 'Perform content analysis for metadata',
                                    default: true,
                                },
                            },
                        },
                        metadata: {
                            type: 'object',
                            description: 'Additional metadata to override or supplement detected metadata',
                            properties: {
                                title: { type: 'string' },
                                genre: { type: 'string' },
                                description: { type: 'string' },
                                language: { type: 'string' },
                            },
                        },
                    },
                    required: ['filePath', 'authorId'],
                },
                handler: this.handleImportBookFile.bind(this),
            },
            {
                name: 'validate_import_file',
                description: 'Validate a file before importing to check format support and file integrity',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to validate',
                        },
                    },
                    required: ['filePath'],
                },
                handler: this.handleValidateImportFile.bind(this),
            },

            // Natural Language Query Tools
            {
                name: 'query_book_content',
                description: 'Ask questions about book content using natural language',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to query',
                        },
                        question: {
                            type: 'string',
                            description: 'Natural language question about the book content',
                        },
                        userId: {
                            type: 'string',
                            description: 'User ID for authentication',
                        },
                        options: {
                            type: 'object',
                            description: 'Query options',
                            properties: {
                                includeChapters: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific chapter IDs to search in',
                                },
                                maxResults: {
                                    type: 'number',
                                    description: 'Maximum number of results to return',
                                    default: 5,
                                },
                                useRAG: {
                                    type: 'boolean',
                                    description: 'Use RAG system for enhanced results',
                                    default: true,
                                },
                            },
                        },
                    },
                    required: ['bookId', 'question', 'userId'],
                },
                handler: this.handleQueryBookContent.bind(this),
            },
            {
                name: 'generate_book_summary',
                description: 'Generate comprehensive summaries of book content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to summarize',
                        },
                        options: {
                            type: 'object',
                            description: 'Summary options',
                            properties: {
                                includeChapters: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific chapter IDs to include',
                                },
                                summaryType: {
                                    type: 'string',
                                    enum: ['brief', 'detailed', 'academic'],
                                    description: 'Type of summary to generate',
                                    default: 'brief',
                                },
                                maxLength: {
                                    type: 'number',
                                    description: 'Maximum length of summary in words',
                                },
                            },
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleGenerateBookSummary.bind(this),
            },
            {
                name: 'generate_quiz_from_book',
                description: 'Generate quizzes and learning aids from book content',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to create quiz from',
                        },
                        options: {
                            type: 'object',
                            description: 'Quiz generation options',
                            properties: {
                                includeChapters: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific chapter IDs to include',
                                },
                                questionCount: {
                                    type: 'number',
                                    description: 'Number of questions to generate',
                                    default: 10,
                                },
                                difficulty: {
                                    type: 'string',
                                    enum: ['easy', 'medium', 'hard', 'mixed'],
                                    description: 'Quiz difficulty level',
                                    default: 'mixed',
                                },
                                questionTypes: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: ['multiple_choice', 'true_false', 'short_answer', 'essay'],
                                    },
                                    description: 'Types of questions to include',
                                    default: ['multiple_choice', 'true_false', 'short_answer'],
                                },
                                topics: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific topics to focus on',
                                },
                            },
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleGenerateQuizFromBook.bind(this),
            },
            {
                name: 'extract_learning_objectives',
                description: 'Extract learning objectives from book content using Bloom\'s taxonomy',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to analyze',
                        },
                        options: {
                            type: 'object',
                            description: 'Analysis options',
                            properties: {
                                includeChapters: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Specific chapter IDs to analyze',
                                },
                                taxonomyLevel: {
                                    type: 'string',
                                    enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
                                    description: 'Specific Bloom\'s taxonomy level to focus on',
                                },
                            },
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleExtractLearningObjectives.bind(this),
            },

            // Smart Library Management Tools
            {
                name: 'smart_search_books',
                description: 'Perform intelligent search across books with natural language and filters',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Natural language search query',
                        },
                        filters: {
                            type: 'object',
                            description: 'Search filters',
                            properties: {
                                genres: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Filter by genres',
                                },
                                themes: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Filter by themes',
                                },
                                tags: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Filter by tags',
                                },
                                authors: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Filter by authors',
                                },
                                status: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Filter by book status',
                                },
                                wordCountRange: {
                                    type: 'object',
                                    properties: {
                                        min: { type: 'number' },
                                        max: { type: 'number' },
                                    },
                                    description: 'Filter by word count range',
                                },
                            },
                        },
                        options: {
                            type: 'object',
                            description: 'Search options',
                            properties: {
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of results',
                                    default: 20,
                                },
                                offset: {
                                    type: 'number',
                                    description: 'Offset for pagination',
                                    default: 0,
                                },
                                sortBy: {
                                    type: 'string',
                                    enum: ['relevance', 'date', 'title', 'wordCount', 'rating'],
                                    description: 'Sort results by',
                                    default: 'relevance',
                                },
                                sortOrder: {
                                    type: 'string',
                                    enum: ['asc', 'desc'],
                                    description: 'Sort order',
                                    default: 'desc',
                                },
                            },
                        },
                    },
                    required: ['query'],
                },
                handler: this.handleSmartSearchBooks.bind(this),
            },
            {
                name: 'suggest_book_tags',
                description: 'Auto-suggest tags for a book based on content analysis',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to analyze for tags',
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleSuggestBookTags.bind(this),
            },
            {
                name: 'create_book_tag',
                description: 'Create a new tag for book categorization',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Tag name',
                        },
                        category: {
                            type: 'string',
                            enum: ['genre', 'theme', 'audience', 'style', 'custom'],
                            description: 'Tag category',
                        },
                        color: {
                            type: 'string',
                            description: 'Tag color (hex code)',
                        },
                        description: {
                            type: 'string',
                            description: 'Tag description',
                        },
                        createdBy: {
                            type: 'string',
                            description: 'User ID creating the tag',
                        },
                    },
                    required: ['name', 'category', 'createdBy'],
                },
                handler: this.handleCreateBookTag.bind(this),
            },
            {
                name: 'tag_book',
                description: 'Apply tags to a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier to tag',
                        },
                        tagIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Tag IDs to apply to the book',
                        },
                    },
                    required: ['bookId', 'tagIds'],
                },
                handler: this.handleTagBook.bind(this),
            },
            {
                name: 'create_book_collection',
                description: 'Create a collection of books',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Collection name',
                        },
                        description: {
                            type: 'string',
                            description: 'Collection description',
                        },
                        bookIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Initial book IDs to include',
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Tags for the collection',
                        },
                        createdBy: {
                            type: 'string',
                            description: 'User ID creating the collection',
                        },
                        isPublic: {
                            type: 'boolean',
                            description: 'Whether the collection is public',
                            default: false,
                        },
                    },
                    required: ['name', 'createdBy'],
                },
                handler: this.handleCreateBookCollection.bind(this),
            },
            {
                name: 'get_library_stats',
                description: 'Get comprehensive library statistics and analytics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: {
                            type: 'string',
                            description: 'Filter stats by specific author (optional)',
                        },
                    },
                },
                handler: this.handleGetLibraryStats.bind(this),
            },
            {
                name: 'find_similar_books',
                description: 'Find books similar to a given book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Source book ID to find similar books for',
                        },
                        options: {
                            type: 'object',
                            description: 'Similarity search options',
                            properties: {
                                limit: {
                                    type: 'number',
                                    description: 'Maximum number of similar books to return',
                                    default: 10,
                                },
                                similarityThreshold: {
                                    type: 'number',
                                    description: 'Minimum similarity score (0-1)',
                                    default: 0.3,
                                },
                                includeSameAuthor: {
                                    type: 'boolean',
                                    description: 'Include books by the same author',
                                    default: true,
                                },
                            },
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleFindSimilarBooks.bind(this),
            },
            {
                name: 'categorize_books',
                description: 'Automatically categorize books in the library',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: {
                            type: 'string',
                            description: 'Filter by specific author (optional)',
                        },
                    },
                },
                handler: this.handleCategorizeBooks.bind(this),
            },
        ];
    }

    // Import Tool Handlers
    async handleImportBookFile(args: any): Promise<any> {
        try {
            this.logger.info('Book import requested', args);

            if (!args.filePath || !args.authorId) {
                throw new ValidationError('Missing required fields for book import', [
                    { field: 'filePath', message: 'File path is required', code: 'REQUIRED' },
                    { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.importService.importBook(args.filePath, args.options || {});

                if (!result.success) {
                    const errorResponse = {
                        type: 'text',
                        text: `❌ **Book Import Failed**\n\n📁 **File:** ${args.filePath}\n\n**Errors:**\n${result.errors?.map(e => `• ${e}`).join('\n') || 'Unknown error'}\n\n**Warnings:**\n${result.warnings?.map(w => `• ${w}`).join('\n') || 'None'}`
                    };
                    return [errorResponse];
                }

                // Create book from import if metadata override provided
                let bookId: string | undefined;
                if (args.metadata) {
                    const mergedMetadata = { ...result.metadata, ...args.metadata };
                    bookId = await this.importService.createBookFromImport(
                        { ...result, metadata: mergedMetadata },
                        args.authorId,
                        args.metadata
                    );
                }

                const formatNotes = this.getFormatSpecificImportNotes(result.format);
                const processingTime = (result.processingTime / 1000).toFixed(2);

                const textResponse = {
                    type: 'text',
                    text: `✅ **Book Import Successful!**\n\n📁 **File:** ${args.filePath}\n📖 **Format:** ${result.format.toUpperCase()}\n📊 **Size:** ${(result.fileSize / 1024 / 1024).toFixed(2)} MB\n⏱️ **Processing Time:** ${processingTime}s\n\n**📚 Extracted Metadata:**\n• **Title:** ${result.metadata.title}\n• **Author:** ${result.metadata.author?.join(', ') || 'Unknown'}\n• **Language:** ${result.metadata.language || 'Unknown'}\n• **Genre:** ${result.metadata.genre || 'Auto-detected'}\n• **Word Count:** ${result.metadata.wordCount?.toLocaleString() || 'Unknown'}\n• **Chapters:** ${result.content.chapters.length}\n\n**📋 Content Summary:**\n• **Full Text Length:** ${result.content.fullText.length.toLocaleString()} characters\n• **Chapters Detected:** ${result.content.chapters.length}\n• **Table of Contents:** ${result.metadata.tableOfContents?.length || 0} entries\n\n${bookId ? `**📖 Book Created:** ${bookId}\n\n` : ''}${formatNotes}\n\n**Next Steps:**\n• Review and edit metadata if needed\n• Organize content into chapters\n• Apply tags and categorization\n• Generate summaries or quizzes from content`
                };

                return [textResponse];
            } catch (importError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Book Import Failed**\n\n📁 **File:** ${args.filePath}\n\n**Error:** ${(importError as Error).message}\n\n**Common Solutions:**\n• Check file format is supported (EPUB, PDF, DOCX, TXT, MOBI)\n• Verify file is not corrupted\n• Ensure file size is under limit\n• Check file permissions\n\n**Supported Formats:** ${this.importService.getSupportedFormats().join(', ')}`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to import book file', error as Error, { args });
            throw error;
        }
    }

    async handleValidateImportFile(args: any): Promise<any> {
        try {
            this.logger.info('File validation requested', args);

            if (!args.filePath) {
                throw new ValidationError('File path is required', [
                    { field: 'filePath', message: 'File path is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const validation = await this.importService.validateImportFile(args.filePath);
                const supportedFormats = this.importService.getSupportedFormats();

                if (validation.valid) {
                    const textResponse = {
                        type: 'text',
                        text: `✅ **File Validation Successful**\n\n📁 **File:** ${args.filePath}\n\n**Status:** Ready for import\n**Supported Formats:** ${supportedFormats.join(', ')}\n\n**Next Step:** Use \`import_book_file\` to import this file.`
                    };
                    return [textResponse];
                } else {
                    const textResponse = {
                        type: 'text',
                        text: `❌ **File Validation Failed**\n\n📁 **File:** ${args.filePath}\n\n**Issues Found:**\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\n**Supported Formats:** ${supportedFormats.join(', ')}\n\n**Solutions:**\n• Check file format and extension\n• Verify file is not corrupted\n• Ensure file size is reasonable\n• Check file permissions`
                    };
                    return [textResponse];
                }
            } catch (validationError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **File Validation Error**\n\n📁 **File:** ${args.filePath}\n\n**Error:** ${(validationError as Error).message}\n\n**Possible Causes:**\n• File does not exist\n• Permission denied\n• File is locked by another process`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to validate import file', error as Error, { args });
            throw error;
        }
    }

    // Query Tool Handlers
    async handleQueryBookContent(args: any): Promise<any> {
        try {
            this.logger.info('Book content query requested', args);

            if (!args.bookId || !args.question || !args.userId) {
                throw new ValidationError('Missing required fields for book query', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'question', message: 'Question is required', code: 'REQUIRED' },
                    { field: 'userId', message: 'User ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.queryService.queryBookContent(
                    args.bookId,
                    args.question,
                    args.userId,
                    args.options || {}
                );

                const sourcesText = result.sources.slice(0, 3).map((source, i) => 
                    `**Source ${i + 1}:** ${source.title}\n${source.content}\n*Confidence: ${(source.confidence * 100).toFixed(0)}%*`
                ).join('\n\n');

                const chaptersText = result.relevantChapters.slice(0, 3).map(chapter => 
                    `• **${chapter.title}** (${(chapter.relevance * 100).toFixed(0)}% relevant)\n  "${chapter.excerpt}"`
                ).join('\n\n');

                const followUpText = result.followUpQuestions.map(q => `• ${q}`).join('\n');

                const textResponse = {
                    type: 'text',
                    text: `🤖 **Book Content Query Results**\n\n❓ **Question:** "${args.question}"\n📖 **Book:** ${args.bookId}\n🎯 **Confidence:** ${(result.confidence * 100).toFixed(0)}%\n\n**📝 Answer:**\n${result.answer}\n\n**📚 Relevant Chapters:**\n${chaptersText}\n\n**📄 Sources:**\n${sourcesText}\n\n**🏷️ Related Topics:**\n${result.relatedTopics.map(t => `\`${t}\``).join(', ')}\n\n**❓ Follow-up Questions:**\n${followUpText}\n\n**Next Steps:**\n• Ask follow-up questions for deeper insights\n• Query specific chapters for detailed information\n• Generate a summary of relevant sections`
                };

                return [textResponse];
            } catch (queryError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Query Failed**\n\n❓ **Question:** "${args.question}"\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(queryError as Error).message}\n\n**Suggestions:**\n• Verify the book exists and has content\n• Try simpler or more specific questions\n• Check if RAG system is properly configured\n• Ensure book content has been processed`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to query book content', error as Error, { args });
            throw error;
        }
    }

    async handleGenerateBookSummary(args: any): Promise<any> {
        try {
            this.logger.info('Book summary generation requested', args);

            if (!args.bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.queryService.generateBookSummary(args.bookId, args.options || {});

                const keyPointsText = result.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n');
                const themesText = result.themes.map(theme => `\`${theme}\``).join(', ');
                const charactersText = result.characters.map(char => 
                    `• **${char.name}**: ${char.description}`
                ).join('\n');
                const plotPointsText = result.plotPoints.map((point, i) => `${i + 1}. ${point}`).join('\n');

                const readingTimeText = result.readingTime > 60 
                    ? `${Math.floor(result.readingTime / 60)}h ${result.readingTime % 60}m`
                    : `${result.readingTime}m`;

                const textResponse = {
                    type: 'text',
                    text: `📚 **Book Summary Generated**\n\n📖 **Book:** ${args.bookId}\n📊 **Word Count:** ${result.wordCount.toLocaleString()}\n⏱️ **Reading Time:** ${readingTimeText}\n📈 **Difficulty:** ${result.difficulty}\n\n**📝 Summary:**\n${result.summary}\n\n**🎯 Key Points:**\n${keyPointsText}\n\n**🏷️ Themes:**\n${themesText}\n\n**👥 Characters:**\n${charactersText}\n\n**📖 Plot Points:**\n${plotPointsText}\n\n**Usage Ideas:**\n• Use as book description or back cover text\n• Create study guides from key points\n• Generate discussion questions\n• Extract themes for categorization`
                };

                return [textResponse];
            } catch (summaryError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Summary Generation Failed**\n\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(summaryError as Error).message}\n\n**Possible Causes:**\n• Book not found or has no content\n• Insufficient content for meaningful summary\n• Selected chapters don't contain enough text\n• Content processing issues`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to generate book summary', error as Error, { args });
            throw error;
        }
    }

    async handleGenerateQuizFromBook(args: any): Promise<any> {
        try {
            this.logger.info('Quiz generation requested', args);

            if (!args.bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.queryService.generateQuiz(args.bookId, args.options || {});

                const questionsText = result.questions.slice(0, 5).map((q, i) => {
                    let questionText = `**Question ${i + 1}** (${q.difficulty}, ${q.type})\n${q.question}`;
                    
                    if (q.options) {
                        questionText += `\n${q.options.map((opt, j) => String.fromCharCode(65 + j) + '. ' + opt).join('\n')}`;
                    }
                    
                    questionText += `\n*Answer: ${q.correctAnswer}*\n*Topic: ${q.topic}*`;
                    return questionText;
                }).join('\n\n');

                const difficultyText = Object.entries(result.metadata.difficultyDistribution)
                    .map(([level, count]) => `• ${level}: ${count} questions`)
                    .join('\n');

                const topicsText = result.metadata.topicsCovered.map(topic => `\`${topic}\``).join(', ');

                const estimatedTimeText = result.metadata.estimatedTime > 60
                    ? `${Math.floor(result.metadata.estimatedTime / 60)}h ${result.metadata.estimatedTime % 60}m`
                    : `${result.metadata.estimatedTime}m`;

                const textResponse = {
                    type: 'text',
                    text: `🧠 **Quiz Generated Successfully!**\n\n📖 **Book:** ${args.bookId}\n📊 **Questions:** ${result.metadata.totalQuestions}\n⏱️ **Estimated Time:** ${estimatedTimeText}\n\n**📈 Difficulty Distribution:**\n${difficultyText}\n\n**🏷️ Topics Covered:**\n${topicsText}\n\n**📚 Source Chapters:**\n${result.metadata.sourceChapters.join(', ')}\n\n**📝 Sample Questions:**\n${questionsText}\n\n${result.questions.length > 5 ? `\n**Note:** Showing 5 of ${result.questions.length} questions. Full quiz includes all generated questions.\n` : ''}\n**Educational Uses:**\n• Assess reading comprehension\n• Create study materials\n• Test knowledge retention\n• Generate discussion points\n• Evaluate learning outcomes`
                };

                return [textResponse];
            } catch (quizError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Quiz Generation Failed**\n\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(quizError as Error).message}\n\n**Common Issues:**\n• Insufficient content for quiz generation\n• Selected chapters too short\n• Book content not properly processed\n• Invalid question type or difficulty settings`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to generate quiz', error as Error, { args });
            throw error;
        }
    }

    async handleExtractLearningObjectives(args: any): Promise<any> {
        try {
            this.logger.info('Learning objectives extraction requested', args);

            if (!args.bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.queryService.extractLearningObjectives(args.bookId, args.options || {});

                const objectivesText = result.objectives.slice(0, 10).map((obj, i) => 
                    `${i + 1}. **${obj.objective}** (${obj.level})\n   📖 Chapter: ${obj.chapter}\n   📋 Assessment: ${obj.assessmentSuggestion}`
                ).join('\n\n');

                const distributionText = Object.entries(result.bloomsDistribution)
                    .map(([level, count]) => `• **${level}**: ${count} objectives`)
                    .join('\n');

                const textResponse = {
                    type: 'text',
                    text: `🎯 **Learning Objectives Extracted**\n\n📖 **Book:** ${args.bookId}\n📊 **Total Objectives:** ${result.objectives.length}\n\n**📈 Bloom's Taxonomy Distribution:**\n${distributionText}\n\n**🎓 Learning Objectives:**\n${objectivesText}\n\n${result.objectives.length > 10 ? `\n**Note:** Showing 10 of ${result.objectives.length} objectives.\n` : ''}\n**Educational Applications:**\n• Design curriculum and lesson plans\n• Create assessment rubrics\n• Align teaching methods with learning goals\n• Develop competency frameworks\n• Structure educational programs\n\n**Bloom's Taxonomy Levels:**\n• **Remember**: Recall facts and basic concepts\n• **Understand**: Explain ideas or concepts\n• **Apply**: Use information in new situations\n• **Analyze**: Draw connections among ideas\n• **Evaluate**: Justify a decision or course of action\n• **Create**: Produce new or original work`
                };

                return [textResponse];
            } catch (objectivesError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Learning Objectives Extraction Failed**\n\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(objectivesError as Error).message}\n\n**Possible Issues:**\n• Book content insufficient for analysis\n• Selected chapters lack educational content\n• Content structure not suitable for objective extraction\n• Invalid taxonomy level specified`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to extract learning objectives', error as Error, { args });
            throw error;
        }
    }

    // Library Management Tool Handlers
    async handleSmartSearchBooks(args: any): Promise<any> {
        try {
            this.logger.info('Smart book search requested', args);

            if (!args.query) {
                throw new ValidationError('Search query is required', [
                    { field: 'query', message: 'Query is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.libraryService.searchBooks(
                    args.query,
                    args.filters || {},
                    args.options || {}
                );

                const booksText = result.books.slice(0, 10).map((book, i) => 
                    `${i + 1}. **"${book.title}"**${book.subtitle ? ` - ${book.subtitle}` : ''}\n   👤 Author: ${book.author}\n   🎭 Genre: ${book.genre} | 🎯 Theme: ${book.theme}\n   📊 ${book.wordCount.toLocaleString()} words | Status: ${book.status}\n   🏷️ Tags: ${book.tags.map(t => t.name).join(', ') || 'None'}\n   🎯 Match: ${(book.matchScore * 100).toFixed(0)}% (${book.matchReason})\n   🆔 ID: \`${book.id}\``
                ).join('\n\n');

                const facetsText = Object.entries(result.facets.genres).slice(0, 5)
                    .map(([genre, count]) => `• ${genre}: ${count}`)
                    .join('\n') || 'None';

                const tagsText = Object.entries(result.facets.tags).slice(0, 5)
                    .map(([tag, count]) => `• ${tag}: ${count}`)
                    .join('\n') || 'None';

                const suggestionsText = result.suggestions.map(s => `• ${s}`).join('\n');

                const textResponse = {
                    type: 'text',
                    text: `🔍 **Smart Search Results**\n\n🔎 **Query:** "${args.query}"\n📊 **Found:** ${result.totalCount} books (showing ${Math.min(result.books.length, 10)})\n\n**📚 Books:**\n${booksText}\n\n**📈 Facets:**\n**Genres:**\n${facetsText}\n\n**Tags:**\n${tagsText}\n\n${result.totalCount > 10 ? `\n**Note:** Showing 10 of ${result.totalCount} results. Use pagination options for more.\n` : ''}\n**💡 Suggestions:**\n${suggestionsText}\n\n**Search Tips:**\n• Use specific terms for better results\n• Apply filters to narrow down results\n• Sort by different criteria (relevance, date, etc.)\n• Explore similar books using book IDs`
                };

                return [textResponse];
            } catch (searchError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Search Failed**\n\n🔎 **Query:** "${args.query}"\n\n**Error:** ${(searchError as Error).message}\n\n**Troubleshooting:**\n• Try simpler search terms\n• Remove or adjust filters\n• Check database connectivity\n• Verify search index is up to date`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to perform smart search', error as Error, { args });
            throw error;
        }
    }

    async handleSuggestBookTags(args: any): Promise<any> {
        try {
            this.logger.info('Tag suggestion requested', args);

            if (!args.bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const suggestedTags = await this.libraryService.suggestTags(args.bookId);

                if (suggestedTags.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `🏷️ **No Tag Suggestions**\n\n📖 **Book:** ${args.bookId}\n\n**No specific tags could be suggested based on the book content.**\n\n**Manual Tagging:**\n• Use \`create_book_tag\` to create custom tags\n• Apply existing tags with \`tag_book\`\n• Review book content and metadata for tagging ideas`
                    };
                    return [textResponse];
                }

                const tagsText = suggestedTags.map((tag, i) => 
                    `${i + 1}. **${tag.name}** (${tag.category})\n   📝 ${tag.description || 'No description'}\n   🆔 ID: \`${tag.id}\``
                ).join('\n\n');

                const categoriesText = [...new Set(suggestedTags.map(t => t.category))]
                    .map(cat => `• ${cat}: ${suggestedTags.filter(t => t.category === cat).length} tags`)
                    .join('\n');

                const textResponse = {
                    type: 'text',
                    text: `🏷️ **Tag Suggestions for Book**\n\n📖 **Book:** ${args.bookId}\n📊 **Suggested Tags:** ${suggestedTags.length}\n\n**📈 By Category:**\n${categoriesText}\n\n**🏷️ Suggested Tags:**\n${tagsText}\n\n**Next Steps:**\n• Review suggestions and select relevant tags\n• Use \`tag_book\` with selected tag IDs\n• Create custom tags if needed with \`create_book_tag\`\n• Apply tags to improve searchability and organization\n\n**Tag Categories:**\n• **genre**: Book genre classifications\n• **theme**: Thematic content tags\n• **audience**: Target audience indicators\n• **style**: Writing style characteristics\n• **custom**: User-defined tags`
                };

                return [textResponse];
            } catch (suggestionError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Tag Suggestion Failed**\n\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(suggestionError as Error).message}\n\n**Common Issues:**\n• Book not found or has no content\n• Insufficient content for analysis\n• Book content not properly processed\n• Content analysis service unavailable`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to suggest book tags', error as Error, { args });
            throw error;
        }
    }

    async handleCreateBookTag(args: any): Promise<any> {
        try {
            this.logger.info('Tag creation requested', args);

            if (!args.name || !args.category || !args.createdBy) {
                throw new ValidationError('Missing required fields for tag creation', [
                    { field: 'name', message: 'Tag name is required', code: 'REQUIRED' },
                    { field: 'category', message: 'Tag category is required', code: 'REQUIRED' },
                    { field: 'createdBy', message: 'Creator ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const tag = await this.libraryService.createTag({
                    name: args.name,
                    category: args.category,
                    color: args.color,
                    description: args.description,
                    createdBy: args.createdBy
                });

                const textResponse = {
                    type: 'text',
                    text: `🏷️ **Tag Created Successfully!**\n\n**Tag Details:**\n• **Name:** ${tag.name}\n• **Category:** ${tag.category}\n• **Description:** ${tag.description || 'No description'}\n• **Color:** ${tag.color || 'Default'}\n• **Created By:** ${tag.createdBy}\n• **Usage Count:** ${tag.usageCount}\n🆔 **Tag ID:** \`${tag.id}\`\n\n**Next Steps:**\n• Apply this tag to books using \`tag_book\`\n• Use in search filters\n• Create collections based on this tag\n\n**Tag Categories:**\n• **genre**: For book genre classification\n• **theme**: For thematic content\n• **audience**: For target audience\n• **style**: For writing style characteristics\n• **custom**: For user-specific organization`
                };

                return [textResponse];
            } catch (creationError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Tag Creation Failed**\n\n**Tag Name:** ${args.name}\n**Category:** ${args.category}\n\n**Error:** ${(creationError as Error).message}\n\n**Common Issues:**\n• Tag name already exists\n• Invalid category specified\n• Name contains invalid characters\n• System storage issues`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to create book tag', error as Error, { args });
            throw error;
        }
    }

    async handleTagBook(args: any): Promise<any> {
        try {
            this.logger.info('Book tagging requested', args);

            if (!args.bookId || !args.tagIds || !Array.isArray(args.tagIds)) {
                throw new ValidationError('Missing required fields for book tagging', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'tagIds', message: 'Tag IDs array is required', code: 'REQUIRED' },
                ]);
            }

            try {
                await this.libraryService.tagBook(args.bookId, args.tagIds);

                const textResponse = {
                    type: 'text',
                    text: `🏷️ **Book Tagged Successfully!**\n\n📖 **Book:** ${args.bookId}\n📊 **Tags Applied:** ${args.tagIds.length}\n🆔 **Tag IDs:** ${args.tagIds.map(id => `\`${id}\``).join(', ')}\n\n**Benefits:**\n• Improved searchability\n• Better organization\n• Enhanced filtering options\n• Collection grouping capabilities\n\n**Next Steps:**\n• Search for books with these tags\n• Create collections based on tags\n• Use tags as search filters\n• Apply additional tags as needed`
                };

                return [textResponse];
            } catch (taggingError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Book Tagging Failed**\n\n📖 **Book:** ${args.bookId}\n🆔 **Tag IDs:** ${args.tagIds.join(', ')}\n\n**Error:** ${(taggingError as Error).message}\n\n**Possible Issues:**\n• Book not found\n• One or more tag IDs don't exist\n• Insufficient permissions\n• Database connection issues`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to tag book', error as Error, { args });
            throw error;
        }
    }

    async handleCreateBookCollection(args: any): Promise<any> {
        try {
            this.logger.info('Collection creation requested', args);

            if (!args.name || !args.createdBy) {
                throw new ValidationError('Missing required fields for collection creation', [
                    { field: 'name', message: 'Collection name is required', code: 'REQUIRED' },
                    { field: 'createdBy', message: 'Creator ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const collection = await this.libraryService.createCollection({
                    name: args.name,
                    description: args.description,
                    bookIds: args.bookIds || [],
                    tags: args.tags || [],
                    createdBy: args.createdBy,
                    isPublic: args.isPublic || false
                });

                const textResponse = {
                    type: 'text',
                    text: `📚 **Collection Created Successfully!**\n\n**Collection Details:**\n• **Name:** ${collection.name}\n• **Description:** ${collection.description || 'No description'}\n• **Books:** ${collection.bookIds.length}\n• **Tags:** ${collection.tags.length}\n• **Public:** ${collection.isPublic ? 'Yes' : 'No'}\n• **Created By:** ${collection.createdBy}\n🆔 **Collection ID:** \`${collection.id}\`\n\n**Next Steps:**\n• Add more books to the collection\n• Share collection if public\n• Use collection for organized browsing\n• Apply tags for better categorization\n\n**Collection Uses:**\n• Group related books together\n• Create reading lists\n• Organize by themes or topics\n• Share curated book sets\n• Build subject-specific libraries`
                };

                return [textResponse];
            } catch (creationError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Collection Creation Failed**\n\n**Collection Name:** ${args.name}\n\n**Error:** ${(creationError as Error).message}\n\n**Common Issues:**\n• Collection name already exists\n• Invalid book IDs provided\n• Insufficient permissions\n• System storage issues`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to create book collection', error as Error, { args });
            throw error;
        }
    }

    async handleGetLibraryStats(args: any): Promise<any> {
        try {
            this.logger.info('Library stats requested', args);

            try {
                const stats = await this.libraryService.getLibraryStats(args.authorId);

                const genreText = Object.entries(stats.genreDistribution).slice(0, 5)
                    .map(([genre, count]) => `• ${genre}: ${count} books`)
                    .join('\n') || 'No genres';

                const statusText = Object.entries(stats.statusDistribution)
                    .map(([status, count]) => `• ${status}: ${count} books`)
                    .join('\n') || 'No books';

                const tagsText = Object.entries(stats.tagsDistribution).slice(0, 5)
                    .map(([tag, count]) => `• ${tag}: ${count} books`)
                    .join('\n') || 'No tags';

                const activityText = stats.recentActivity.slice(0, 5).map(activity => 
                    `• ${activity.type}: "${activity.bookTitle}" (${activity.timestamp.toLocaleDateString()})`
                ).join('\n') || 'No recent activity';

                const avgWordsFormatted = stats.averageWordCount.toLocaleString();
                const totalWordsFormatted = stats.totalWordCount.toLocaleString();

                const textResponse = {
                    type: 'text',
                    text: `📊 **Library Statistics**\n\n${args.authorId ? `👤 **Author:** ${args.authorId}\n\n` : ''}**📚 Overview:**\n• **Total Books:** ${stats.totalBooks}\n• **Total Words:** ${totalWordsFormatted}\n• **Average Words per Book:** ${avgWordsFormatted}\n• **Collections:** ${stats.collectionsCount}\n\n**📈 Genre Distribution:**\n${genreText}\n\n**📋 Status Distribution:**\n${statusText}\n\n**🏷️ Popular Tags:**\n${tagsText}\n\n**📅 Recent Activity:**\n${activityText}\n\n**💡 Insights:**\n• Most popular genre: ${Object.entries(stats.genreDistribution)[0]?.[0] || 'N/A'}\n• Library diversity: ${Object.keys(stats.genreDistribution).length} genres\n• Tag usage: ${Object.keys(stats.tagsDistribution).length} different tags\n• Organization level: ${stats.collectionsCount} collections created\n\n**Recommendations:**\n• Diversify genres for broader appeal\n• Complete books in progress\n• Use more tags for better organization\n• Create themed collections`
                };

                return [textResponse];
            } catch (statsError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Library Stats Failed**\n\n${args.authorId ? `👤 **Author:** ${args.authorId}\n\n` : ''}**Error:** ${(statsError as Error).message}\n\n**Possible Issues:**\n• Database connection problems\n• Invalid author ID\n• Insufficient data for statistics\n• System processing issues`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to get library stats', error as Error, { args });
            throw error;
        }
    }

    async handleFindSimilarBooks(args: any): Promise<any> {
        try {
            this.logger.info('Similar books search requested', args);

            if (!args.bookId) {
                throw new ValidationError('Book ID is required', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const similarBooks = await this.libraryService.findSimilarBooks(args.bookId, args.options || {});

                if (similarBooks.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `🔍 **No Similar Books Found**\n\n📖 **Source Book:** ${args.bookId}\n\n**No books meet the similarity criteria.**\n\n**Suggestions:**\n• Lower the similarity threshold\n• Include books by the same author\n• Check if there are other books in the library\n• Add more books to increase comparison pool`
                    };
                    return [textResponse];
                }

                const booksText = similarBooks.map((item, i) => {
                    const book = item.book;
                    const reasonsText = item.reasons.join(', ');
                    
                    return `${i + 1}. **"${book.title}"**\n   👤 Author: ${book.authorId}\n   🎭 Genre: ${book.genre} | 🎯 Theme: ${book.theme}\n   📊 ${(book.currentWordCount || 0).toLocaleString()} words\n   🎯 Similarity: ${(item.similarity * 100).toFixed(0)}%\n   📝 Reasons: ${reasonsText}\n   🆔 ID: \`${book._id}\``;
                }).join('\n\n');

                const avgSimilarity = (similarBooks.reduce((sum, item) => sum + item.similarity, 0) / similarBooks.length * 100).toFixed(0);

                const textResponse = {
                    type: 'text',
                    text: `🔍 **Similar Books Found**\n\n📖 **Source Book:** ${args.bookId}\n📊 **Found:** ${similarBooks.length} similar books\n📈 **Average Similarity:** ${avgSimilarity}%\n\n**📚 Similar Books:**\n${booksText}\n\n**🎯 Similarity Factors:**\n• **Genre match**: Same or related genre\n• **Theme match**: Similar themes or topics\n• **Audience match**: Same target audience\n• **Style match**: Similar writing style\n\n**Applications:**\n• Discover books with similar content\n• Find books in the same series or style\n• Recommend to readers who enjoyed this book\n• Group books for collections or reading lists\n• Analyze writing patterns and trends`
                };

                return [textResponse];
            } catch (similarityError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Similar Books Search Failed**\n\n📖 **Source Book:** ${args.bookId}\n\n**Error:** ${(similarityError as Error).message}\n\n**Common Issues:**\n• Source book not found\n• Insufficient book metadata for comparison\n• Database connection issues\n• Similarity calculation errors`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to find similar books', error as Error, { args });
            throw error;
        }
    }

    async handleCategorizeBooks(args: any): Promise<any> {
        try {
            this.logger.info('Book categorization requested', args);

            try {
                const result = await this.libraryService.categorizeBooks(args.authorId);

                const categoriesText = Object.entries(result.categories)
                    .filter(([, bookIds]) => bookIds.length > 0)
                    .map(([category, bookIds]) => `• **${category}**: ${bookIds.length} books`)
                    .join('\n') || 'No categories';

                const uncategorizedText = result.uncategorized.length > 0 
                    ? `\n**📋 Uncategorized Books:** ${result.uncategorized.length}\n🆔 **IDs:** ${result.uncategorized.slice(0, 5).map(id => `\`${id}\``).join(', ')}${result.uncategorized.length > 5 ? ` and ${result.uncategorized.length - 5} more` : ''}`
                    : '';

                const successRate = ((result.categorized / (result.categorized + result.uncategorized.length)) * 100).toFixed(0);

                const textResponse = {
                    type: 'text',
                    text: `📂 **Book Categorization Complete**\n\n${args.authorId ? `👤 **Author:** ${args.authorId}\n\n` : ''}**📊 Results:**\n• **Categorized:** ${result.categorized} books\n• **Uncategorized:** ${result.uncategorized.length} books\n• **Success Rate:** ${successRate}%\n\n**📚 Categories:**\n${categoriesText}${uncategorizedText}\n\n**🎯 Categorization Criteria:**\n• **Fiction/Non-Fiction**: Based on genre classification\n• **Genre-Specific**: Romance, Fantasy, Mystery, etc.\n• **Audience-Based**: Children, Young Adult, Academic\n• **Content Analysis**: Automatic content detection\n\n**Next Steps:**\n• Review categorization results\n• Manually categorize uncategorized books\n• Create collections based on categories\n• Use categories for improved organization\n• Apply additional tags for finer classification`
                };

                return [textResponse];
            } catch (categorizationError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Book Categorization Failed**\n\n${args.authorId ? `👤 **Author:** ${args.authorId}\n\n` : ''}**Error:** ${(categorizationError as Error).message}\n\n**Possible Issues:**\n• No books found for categorization\n• Insufficient metadata for analysis\n• Content analysis service unavailable\n• Database connection problems`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to categorize books', error as Error, { args });
            throw error;
        }
    }

    // Helper methods
    private getFormatSpecificImportNotes(format: string): string {
        switch (format.toLowerCase()) {
            case 'epub':
                return `📚 **EPUB Import Notes:**\n• Metadata extracted from EPUB manifest\n• Table of contents preserved from navigation\n• Chapter structure maintained\n• Images extracted if requested\n• DRM-protected files not supported`;

            case 'pdf':
                return `📄 **PDF Import Notes:**\n• Text extracted using OCR if needed\n• Page numbers preserved where possible\n• Complex layouts may affect text flow\n• Images extracted if requested\n• Password-protected PDFs not supported`;

            case 'docx':
                return `📝 **DOCX Import Notes:**\n• Document structure preserved\n• Styles and formatting maintained\n• Headers used for chapter detection\n• Comments and track changes ignored\n• Embedded objects may not transfer`;

            case 'txt':
                return `📝 **TXT Import Notes:**\n• Plain text format processed\n• Chapters detected by common patterns\n• No formatting preserved\n• Encoding auto-detected\n• Most reliable format for text extraction`;

            case 'mobi':
                return `📱 **MOBI Import Notes:**\n• Limited format support\n• Consider converting to EPUB for better results\n• Metadata extraction may be incomplete\n• DRM protection not supported`;

            default:
                return '';
        }
    }
}

export default AdvancedBookToolHandlers;

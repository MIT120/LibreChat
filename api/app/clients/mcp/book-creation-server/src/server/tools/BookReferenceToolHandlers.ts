/**
 * Book Reference Tool Handlers - MCP tools for discovering and analyzing reference books
 */

import { ValidationError } from '../../../types/errors.js';
import { ILogger } from '../../core/Logger.js';
import { IToolHandler } from '../../interfaces/index.js';
import BookReferenceService from '../../services/BookReferenceService.js';
import { Book } from '../../../models/Book.js';

export class BookReferenceToolHandlers {
    private logger: ILogger;
    private referenceService: BookReferenceService;

    constructor(logger: ILogger, referenceService: BookReferenceService) {
        this.logger = logger.child('BookReferenceToolHandlers');
        this.referenceService = referenceService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'find_similar_books',
                description: 'Find books with similar writing styles for reference and inspiration',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Source book identifier to find similar books for',
                        },
                        genre: {
                            type: 'string', 
                            description: 'Genre to search for (e.g., romance, fantasy, mystery)',
                        },
                        targetAudience: {
                            type: 'string',
                            description: 'Target audience (e.g., children, young adult, adult)',
                        },
                        theme: {
                            type: 'string',
                            description: 'Book theme or subject matter',
                        },
                        writingStyle: {
                            type: 'object',
                            description: 'Writing style characteristics',
                            properties: {
                                tone: {
                                    type: 'string',
                                    description: 'Writing tone (e.g., humorous, serious, romantic)',
                                },
                                vocabulary: {
                                    type: 'string',
                                    description: 'Vocabulary complexity (simple, intermediate, advanced)',
                                },
                                voice: {
                                    type: 'string',
                                    description: 'Narrative voice (first_person, third_person)',
                                },
                            },
                            required: ['tone', 'vocabulary', 'voice'],
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of similar books to find',
                            default: 10,
                        },
                        minSimilarityScore: {
                            type: 'number',
                            description: 'Minimum similarity score (0-1)',
                            default: 0.6,
                        },
                    },
                    required: ['bookId', 'genre', 'theme', 'writingStyle'],
                },
                handler: this.handleFindSimilarBooks.bind(this),
            },
            {
                name: 'analyze_reference_styles',
                description: 'Analyze writing styles from discovered reference books',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Source book identifier',
                        },
                        referenceIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of reference book IDs to analyze',
                        },
                        targetStyle: {
                            type: 'object',
                            description: 'Target writing style to compare against',
                            properties: {
                                tone: { type: 'string' },
                                vocabulary: { type: 'string' },
                                voice: { type: 'string' },
                                targetAudience: { type: 'string' },
                            },
                        },
                    },
                    required: ['bookId', 'referenceIds', 'targetStyle'],
                },
                handler: this.handleAnalyzeReferenceStyles.bind(this),
            },
            {
                name: 'query_reference_content',
                description: 'Search through reference book content for specific writing examples',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query for finding specific content or examples',
                        },
                        userId: {
                            type: 'string',
                            description: 'User identifier for RAG authentication',
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 5,
                        },
                        bookGenre: {
                            type: 'string',
                            description: 'Filter by book genre for more relevant results',
                        },
                        writingStyle: {
                            type: 'string',
                            description: 'Filter by writing style characteristics',
                        },
                    },
                    required: ['query', 'userId'],
                },
                handler: this.handleQueryReferenceContent.bind(this),
            },
            {
                name: 'get_book_recommendations',
                description: 'Get writing recommendations based on similar books analysis',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Source book identifier',
                        },
                        focusArea: {
                            type: 'string',
                            enum: ['style', 'structure', 'dialogue', 'description', 'pacing', 'character'],
                            description: 'Specific writing aspect to get recommendations for',
                        },
                        includeExamples: {
                            type: 'boolean',
                            description: 'Include text examples from reference books',
                            default: true,
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleGetBookRecommendations.bind(this),
            },
            {
                name: 'scrape_specific_book',
                description: 'Manually scrape a specific book for reference (by URL or Open Library ID)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        identifier: {
                            type: 'string',
                            description: 'URL, Open Library ID (/works/OL123456W), or ISBN',
                        },
                        bookId: {
                            type: 'string',
                            description: 'Source book ID this reference is for',
                        },
                        forceRescrape: {
                            type: 'boolean',
                            description: 'Force re-scraping even if already exists in RAG',
                            default: false,
                        },
                    },
                    required: ['identifier', 'bookId'],
                },
                handler: this.handleScrapeSpecificBook.bind(this),
            },
            {
                name: 'manage_reference_cache',
                description: 'Manage the reference book cache (clear, status, etc.)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['status', 'clear', 'list'],
                            description: 'Action to perform on the cache',
                        },
                        bookId: {
                            type: 'string',
                            description: 'Filter by book ID (for list action)',
                        },
                    },
                    required: ['action'],
                },
                handler: this.handleManageReferenceCache.bind(this),
            },
        ];
    }

    async handleFindSimilarBooks(args: any): Promise<any> {
        try {
            this.logger.info('Finding similar books requested', args);

            // Validate inputs
            if (!args.bookId || !args.genre || !args.theme || !args.writingStyle) {
                throw new ValidationError('Missing required fields for finding similar books', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'genre', message: 'Genre is required', code: 'REQUIRED' },
                    { field: 'theme', message: 'Theme is required', code: 'REQUIRED' },
                    { field: 'writingStyle', message: 'Writing style is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const similarBooks = await this.referenceService.findSimilarBooks({
                    bookId: args.bookId,
                    genre: args.genre,
                    targetAudience: args.targetAudience,
                    writingStyle: args.writingStyle,
                    theme: args.theme,
                    maxResults: args.maxResults || 10,
                    minSimilarityScore: args.minSimilarityScore || 0.6,
                });

                if (similarBooks.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `🔍 **No Similar Books Found**\n\n📖 **Book:** ${args.bookId}\n🎭 **Genre:** ${args.genre}\n🎯 **Theme:** ${args.theme}\n\n**Search Parameters:**\n• Target Audience: ${args.targetAudience || 'Any'}\n• Writing Tone: ${args.writingStyle.tone}\n• Vocabulary Level: ${args.writingStyle.vocabulary}\n• Narrative Voice: ${args.writingStyle.voice}\n• Min Similarity: ${((args.minSimilarityScore || 0.6) * 100).toFixed(0)}%\n\n**Suggestions:**\n• Try broadening the genre (use more general terms)\n• Lower the minimum similarity score\n• Check if the theme is too specific\n• Verify the book characteristics are correctly set`
                    };
                    return [textResponse];
                }

                // Format results
                const bookList = similarBooks.map((book, index) => {
                    const similarity = (book.similarity.overallScore * 100).toFixed(0);
                    const authors = book.authors.length > 0 ? book.authors.slice(0, 2).join(', ') : 'Unknown';
                    const year = book.publishYear ? ` (${book.publishYear})` : '';
                    const ragStatus = book.ragFileId ? '✅ In RAG' : '⏳ Scraping';
                    
                    return `${index + 1}. **"${book.title}"**${year}\n   📝 By: ${authors}\n   🎭 Genre: ${book.genre}\n   👥 Audience: ${book.targetAudience || 'General'}\n   📊 Similarity: ${similarity}%\n   💾 Status: ${ragStatus}\n   🆔 Reference ID: \`${book.id}\``;
                }).join('\n\n');

                const scrapedCount = similarBooks.filter(b => b.ragFileId).length;
                const pendingCount = similarBooks.length - scrapedCount;

                const textResponse = {
                    type: 'text',
                    text: `📚 **Similar Books Discovered**\n\n📖 **For Book:** ${args.bookId}\n🎭 **Genre:** ${args.genre}\n🎯 **Theme:** ${args.theme}\n\n**Found ${similarBooks.length} Similar Books:**\n\n${bookList}\n\n**Status Summary:**\n• ✅ Ready for Analysis: ${scrapedCount} books\n• ⏳ Currently Scraping: ${pendingCount} books\n\n**Next Steps:**\n• Use \`analyze_reference_styles\` with the Reference IDs above\n• Use \`query_reference_content\` to search for specific examples\n• Use \`get_book_recommendations\` for writing suggestions`
                };

                return [textResponse];
            } catch (searchError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Similar Books Search Failed**\n\n📖 **Book:** ${args.bookId}\n🎭 **Genre:** ${args.genre}\n\n**Error:** ${(searchError as Error).message}\n\n**Suggestions:**\n• Check internet connectivity\n• Verify Open Library API availability\n• Try with different search parameters\n• Ensure FIRECRAWL_API_KEY is configured for scraping`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to find similar books', error as Error, { args });
            throw error;
        }
    }

    async handleAnalyzeReferenceStyles(args: any): Promise<any> {
        try {
            this.logger.info('Analyzing reference styles requested', args);

            // Validate inputs
            if (!args.bookId || !args.referenceIds || !args.targetStyle) {
                throw new ValidationError('Missing required fields for style analysis', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'referenceIds', message: 'Reference IDs are required', code: 'REQUIRED' },
                    { field: 'targetStyle', message: 'Target style is required', code: 'REQUIRED' },
                ]);
            }

            try {
                // Get reference books
                const references = args.referenceIds
                    .map((id: string) => this.referenceService.getReference(id))
                    .filter((ref: any) => ref !== undefined);

                if (references.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `❌ **No Reference Books Found**\n\n📖 **Book:** ${args.bookId}\n🆔 **Reference IDs:** ${args.referenceIds.join(', ')}\n\n**Issue:** None of the provided reference IDs could be found in the cache.\n\n**Suggestions:**\n• First run \`find_similar_books\` to discover references\n• Use the Reference IDs from the discovery results\n• Check if the reference cache was cleared`
                    };
                    return [textResponse];
                }

                // Analyze styles
                const analysis = await this.referenceService.analyzeWritingStyleFromReferences(
                    references,
                    args.targetStyle
                );

                // Format analysis results
                const patternsText = analysis.stylePatterns.length > 0 
                    ? analysis.stylePatterns.map((pattern, i) => `${i + 1}. ${pattern}`).join('\n')
                    : 'No specific patterns identified';

                const recommendationsText = analysis.recommendations.length > 0
                    ? analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
                    : 'No specific recommendations generated';

                const examplesText = analysis.examples.length > 0
                    ? analysis.examples.map((example, i) => 
                        `**Example ${i + 1}:**\n"${example.text}"\n*Analysis: ${example.analysis}*`
                    ).join('\n\n')
                    : 'No examples extracted';

                const textResponse = {
                    type: 'text',
                    text: `📊 **Writing Style Analysis Complete**\n\n📖 **Book:** ${args.bookId}\n🔍 **Analyzed:** ${references.length} reference books\n\n**🎯 Target Style:**\n• Tone: ${args.targetStyle.tone}\n• Vocabulary: ${args.targetStyle.vocabulary}\n• Voice: ${args.targetStyle.voice}\n• Audience: ${args.targetStyle.targetAudience || 'Not specified'}\n\n**📈 Identified Writing Patterns:**\n${patternsText}\n\n**💡 Style Recommendations:**\n${recommendationsText}\n\n**📝 Writing Examples:**\n${examplesText}\n\n**Next Steps:**\n• Apply recommendations to your writing\n• Use \`query_reference_content\` for more specific examples\n• Generate content using insights from similar books`
                };

                return [textResponse];
            } catch (analysisError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Style Analysis Failed**\n\n📖 **Book:** ${args.bookId}\n🆔 **Reference IDs:** ${args.referenceIds.join(', ')}\n\n**Error:** ${(analysisError as Error).message}\n\n**Suggestion:** Ensure reference books have been successfully scraped and contain content for analysis.`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to analyze reference styles', error as Error, { args });
            throw error;
        }
    }

    async handleQueryReferenceContent(args: any): Promise<any> {
        try {
            this.logger.info('Querying reference content requested', args);

            // Validate inputs
            if (!args.query || !args.userId) {
                throw new ValidationError('Missing required fields for content query', [
                    { field: 'query', message: 'Search query is required', code: 'REQUIRED' },
                    { field: 'userId', message: 'User ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const results = await this.referenceService.queryReferenceContent(
                    args.query,
                    args.userId,
                    args.maxResults || 5
                );

                if (results.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `🔍 **No Reference Content Found**\n\n🔎 **Query:** "${args.query}"\n👤 **User:** ${args.userId}\n\n**No matching content found in the reference book database.**\n\n**Suggestions:**\n• Try broader search terms\n• Ensure reference books have been scraped and stored\n• Check if RAG system is properly configured\n• Use \`find_similar_books\` first to populate references`
                    };
                    return [textResponse];
                }

                // Format search results
                const resultsText = results.map((result, index) => {
                    const snippet = result.content?.substring(0, 200) + '...' || 'No content preview';
                    const score = result.score ? ` (${(result.score * 100).toFixed(0)}% match)` : '';
                    const metadata = result.metadata || {};
                    
                    return `**Result ${index + 1}:**${score}\n📖 **Book:** ${metadata.title || 'Unknown'}\n✍️ **Author:** ${metadata.authors?.join(', ') || 'Unknown'}\n🎭 **Genre:** ${metadata.genre || 'Unknown'}\n📝 **Content:** "${snippet}"\n🆔 **Reference:** \`${metadata.referenceId || 'Unknown'}\``;
                }).join('\n\n');

                const textResponse = {
                    type: 'text',
                    text: `📚 **Reference Content Search Results**\n\n🔎 **Query:** "${args.query}"\n👤 **User:** ${args.userId}\n📊 **Found:** ${results.length} results\n\n${resultsText}\n\n**Usage Tips:**\n• Use specific terms for better matches\n• Filter by genre or writing style for focused results\n• Reference IDs can be used for further analysis`
                };

                return [textResponse];
            } catch (queryError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Reference Content Query Failed**\n\n🔎 **Query:** "${args.query}"\n👤 **User:** ${args.userId}\n\n**Error:** ${(queryError as Error).message}\n\n**Suggestions:**\n• Check RAG system configuration\n• Verify user permissions\n• Ensure reference books have been stored in RAG\n• Try a simpler query`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to query reference content', error as Error, { args });
            throw error;
        }
    }

    async handleGetBookRecommendations(args: any): Promise<any> {
        try {
            this.logger.info('Getting book recommendations requested', args);

            // Validate inputs
            if (!args.bookId) {
                throw new ValidationError('Missing required fields for recommendations', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                // Get the source book
                const book = await Book.findById(args.bookId);
                if (!book) {
                    throw new Error(`Book not found: ${args.bookId}`);
                }

                // Find similar books for recommendations
                const similarBooks = await this.referenceService.findSimilarBooks({
                    bookId: args.bookId,
                    genre: book.genre,
                    targetAudience: book.targetAudience,
                    writingStyle: book.writingStyle,
                    theme: book.theme,
                    maxResults: 5,
                    minSimilarityScore: 0.6,
                });

                if (similarBooks.length === 0) {
                    const textResponse = {
                        type: 'text',
                        text: `💡 **No Recommendations Available**\n\n📖 **Book:** "${book.title}"\n🎭 **Genre:** ${book.genre}\n\n**No similar reference books found to generate recommendations.**\n\n**To get recommendations:**\n1. Run \`find_similar_books\` first to discover references\n2. Ensure the book has genre, audience, and style information\n3. Try broadening search criteria\n\n**Current Book Details:**\n• Genre: ${book.genre}\n• Audience: ${book.targetAudience || 'Not specified'}\n• Theme: ${book.theme}\n• Writing Style: ${book.writingStyle.tone} tone, ${book.writingStyle.vocabulary} vocabulary`
                    };
                    return [textResponse];
                }

                // Analyze styles for recommendations
                const analysis = await this.referenceService.analyzeWritingStyleFromReferences(
                    similarBooks,
                    book.writingStyle
                );

                // Focus on specific area if requested
                let focusedRecommendations: string[] = [];
                if (args.focusArea) {
                    focusedRecommendations = this.generateFocusedRecommendations(
                        args.focusArea,
                        analysis,
                        similarBooks
                    );
                }

                // Format recommendations
                const generalRecs = analysis.recommendations.slice(0, 5).map((rec, i) => `${i + 1}. ${rec}`).join('\n');
                const focusedRecs = focusedRecommendations.length > 0 
                    ? focusedRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
                    : '';

                const examplesText = args.includeExamples !== false && analysis.examples.length > 0
                    ? analysis.examples.slice(0, 3).map((example, i) => 
                        `**Example ${i + 1}:**\n"${example.text}"\n*${example.analysis}*`
                    ).join('\n\n')
                    : '';

                const referenceList = similarBooks.slice(0, 3).map(book => 
                    `• "${book.title}" by ${book.authors.join(', ')} (${(book.similarity.overallScore * 100).toFixed(0)}% match)`
                ).join('\n');

                const textResponse = {
                    type: 'text',
                    text: `💡 **Writing Recommendations**\n\n📖 **For Book:** "${book.title}"\n🎯 **Focus Area:** ${args.focusArea || 'General'}\n📚 **Based on:** ${similarBooks.length} reference books\n\n**📋 General Recommendations:**\n${generalRecs}\n\n${focusedRecs ? `**🎯 ${args.focusArea} Specific Recommendations:**\n${focusedRecs}\n\n` : ''}${examplesText ? `**📝 Style Examples:**\n${examplesText}\n\n` : ''}**📚 Key Reference Books:**\n${referenceList}\n\n**Next Steps:**\n• Apply these recommendations to your current writing\n• Use \`query_reference_content\` for more specific examples\n• Study the reference books for deeper insights`
                };

                return [textResponse];
            } catch (recommendationError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Recommendation Generation Failed**\n\n📖 **Book:** ${args.bookId}\n🎯 **Focus:** ${args.focusArea || 'General'}\n\n**Error:** ${(recommendationError as Error).message}\n\n**Suggestions:**\n• Ensure the book exists and has proper metadata\n• Run \`find_similar_books\` first to populate references\n• Check that reference books have been successfully scraped`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to get book recommendations', error as Error, { args });
            throw error;
        }
    }

    async handleScrapeSpecificBook(args: any): Promise<any> {
        try {
            this.logger.info('Scraping specific book requested', args);

            // Validate inputs
            if (!args.identifier || !args.bookId) {
                throw new ValidationError('Missing required fields for book scraping', [
                    { field: 'identifier', message: 'Book identifier is required', code: 'REQUIRED' },
                    { field: 'bookId', message: 'Source book ID is required', code: 'REQUIRED' },
                ]);
            }

            const textResponse = {
                type: 'text',
                text: `🚧 **Manual Book Scraping**\n\n🆔 **Identifier:** ${args.identifier}\n📖 **For Book:** ${args.bookId}\n🔄 **Force Rescrape:** ${args.forceRescrape ? 'Yes' : 'No'}\n\n**⚠️ Feature Under Development**\n\nManual book scraping is currently being implemented. This feature will support:\n• Direct URL scraping with FIRECRAWL\n• Open Library work ID processing\n• ISBN-based book discovery and scraping\n• Manual addition to reference collection\n\n**Current Workaround:**\nUse \`find_similar_books\` which automatically discovers and scrapes relevant books based on your book's characteristics.\n\n**Coming Soon:**\n• Custom URL scraping\n• Manual reference management\n• Advanced scraping options`
            };

            return [textResponse];
        } catch (error) {
            this.logger.error('Failed to scrape specific book', error as Error, { args });
            throw error;
        }
    }

    async handleManageReferenceCache(args: any): Promise<any> {
        try {
            this.logger.info('Managing reference cache requested', args);

            // Validate inputs
            if (!args.action) {
                throw new ValidationError('Missing required fields for cache management', [
                    { field: 'action', message: 'Action is required', code: 'REQUIRED' },
                ]);
            }

            try {
                switch (args.action) {
                    case 'status':
                        const allReferences = this.referenceService.getAllReferences();
                        const scrapedCount = allReferences.filter(ref => ref.ragFileId).length;
                        const pendingCount = allReferences.length - scrapedCount;
                        
                        const textResponse = {
                            type: 'text',
                            text: `📊 **Reference Cache Status**\n\n**📚 Total References:** ${allReferences.length}\n**✅ Fully Scraped:** ${scrapedCount}\n**⏳ Pending Scrape:** ${pendingCount}\n\n**🎭 By Genre:**\n${this.getCacheStatsByGenre(allReferences)}\n\n**👥 By Audience:**\n${this.getCacheStatsByAudience(allReferences)}\n\n**💾 Storage:**\n• RAG System: ${scrapedCount} books stored\n• Cache Memory: ${allReferences.length} references\n\n**Actions Available:**\n• \`action: "clear"\` - Clear entire cache\n• \`action: "list"\` - List all references`
                        };
                        return [textResponse];

                    case 'clear':
                        this.referenceService.clearCache();
                        const clearResponse = {
                            type: 'text',
                            text: `🗑️ **Reference Cache Cleared**\n\n**All cached reference books have been removed.**\n\n**Note:** This only clears the in-memory cache. Books stored in the RAG system remain available.\n\n**To rebuild cache:**\n• Run \`find_similar_books\` for any book\n• References will be automatically rediscovered and cached\n\n**Status:** Cache is now empty and ready for fresh discoveries.`
                        };
                        return [clearResponse];

                    case 'list':
                        const references = this.referenceService.getAllReferences();
                        const filteredRefs = args.bookId 
                            ? references.filter(ref => ref.id.includes(args.bookId))
                            : references;

                        if (filteredRefs.length === 0) {
                            const emptyResponse = {
                                type: 'text',
                                text: `📋 **Reference List**\n\n${args.bookId ? `**Filtered by Book ID:** ${args.bookId}\n\n` : ''}**No references found.**\n\n**To populate cache:**\n• Run \`find_similar_books\` to discover references\n• References will be automatically cached for future use`
                            };
                            return [emptyResponse];
                        }

                        const listText = filteredRefs.slice(0, 20).map((ref, index) => {
                            const status = ref.ragFileId ? '✅' : '⏳';
                            const similarity = ref.similarity ? ` (${(ref.similarity.overallScore * 100).toFixed(0)}%)` : '';
                            
                            return `${index + 1}. ${status} **"${ref.title}"**${similarity}\n   📝 ${ref.authors.join(', ')}\n   🎭 ${ref.genre} | 👥 ${ref.targetAudience || 'General'}\n   🆔 \`${ref.id}\``;
                        }).join('\n\n');

                        const listResponse = {
                            type: 'text',
                            text: `📋 **Reference Book List**\n\n${args.bookId ? `**Filtered by Book ID:** ${args.bookId}\n\n` : ''}**Showing ${Math.min(filteredRefs.length, 20)} of ${filteredRefs.length} references:**\n\n${listText}\n\n**Legend:**\n• ✅ = Fully scraped and stored in RAG\n• ⏳ = Pending scrape or partial data\n\n**Use Reference IDs with:**\n• \`analyze_reference_styles\`\n• Other analysis tools`
                        };
                        return [listResponse];

                    default:
                        throw new ValidationError('Invalid action specified', [
                            { field: 'action', message: 'Action must be "status", "clear", or "list"', code: 'INVALID' },
                        ]);
                }
            } catch (cacheError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Cache Management Failed**\n\n🎯 **Action:** ${args.action}\n\n**Error:** ${(cacheError as Error).message}\n\n**Available Actions:**\n• "status" - Show cache statistics\n• "clear" - Clear entire cache\n• "list" - List cached references`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to manage reference cache', error as Error, { args });
            throw error;
        }
    }

    private generateFocusedRecommendations(
        focusArea: string,
        analysis: any,
        references: any[]
    ): string[] {
        const recommendations: string[] = [];

        switch (focusArea) {
            case 'style':
                recommendations.push(
                    'Maintain consistent tone throughout chapters',
                    'Vary sentence structure for better flow',
                    'Use active voice for more engaging prose'
                );
                break;

            case 'structure':
                recommendations.push(
                    'Follow the three-act structure for compelling narrative',
                    'Use chapter breaks to create natural pacing',
                    'Build tension gradually toward climactic moments'
                );
                break;

            case 'dialogue':
                recommendations.push(
                    'Give each character a distinct voice and speech pattern',
                    'Use dialogue to reveal character personality and advance plot',
                    'Balance dialogue with narrative description'
                );
                break;

            case 'description':
                recommendations.push(
                    'Use sensory details to immerse readers in the scene',
                    'Show character emotions through actions, not just words',
                    'Balance descriptive passages with action sequences'
                );
                break;

            case 'pacing':
                recommendations.push(
                    'Alternate between fast-paced action and slower character moments',
                    'Use shorter paragraphs for tension, longer for contemplation',
                    'End chapters with hooks to maintain reader engagement'
                );
                break;

            case 'character':
                recommendations.push(
                    'Develop clear character motivations and goals',
                    'Show character growth through actions and decisions',
                    'Create realistic character flaws and strengths'
                );
                break;

            default:
                return analysis.recommendations.slice(0, 3);
        }

        return recommendations;
    }

    private getCacheStatsByGenre(references: any[]): string {
        const genreCounts: Record<string, number> = {};
        references.forEach(ref => {
            genreCounts[ref.genre] = (genreCounts[ref.genre] || 0) + 1;
        });

        return Object.entries(genreCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([genre, count]) => `• ${genre}: ${count} books`)
            .join('\n') || '• No genres categorized';
    }

    private getCacheStatsByAudience(references: any[]): string {
        const audienceCounts: Record<string, number> = {};
        references.forEach(ref => {
            const audience = ref.targetAudience || 'General';
            audienceCounts[audience] = (audienceCounts[audience] || 0) + 1;
        });

        return Object.entries(audienceCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([audience, count]) => `• ${audience}: ${count} books`)
            .join('\n') || '• No audiences categorized';
    }
}

export default BookReferenceToolHandlers;

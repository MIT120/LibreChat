/**
 * Smart Library Service - Advanced book management with tagging, categorization, and search
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';

export interface BookTag {
    id: string;
    name: string;
    category: 'genre' | 'theme' | 'audience' | 'style' | 'custom';
    color?: string;
    description?: string;
    createdBy: string;
    usageCount: number;
    createdAt: Date;
}

export interface BookCollection {
    id: string;
    name: string;
    description?: string;
    bookIds: string[];
    tags: string[];
    createdBy: string;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface SearchFilters {
    genres?: string[];
    themes?: string[];
    tags?: string[];
    authors?: string[];
    status?: string[];
    dateRange?: {
        from: Date;
        to: Date;
    };
    wordCountRange?: {
        min: number;
        max: number;
    };
    collections?: string[];
    rating?: {
        min: number;
        max: number;
    };
}

export interface SearchResult {
    books: Array<{
        id: string;
        title: string;
        subtitle?: string;
        author: string;
        genre: string;
        theme: string;
        tags: BookTag[];
        description?: string;
        wordCount: number;
        status: string;
        rating?: number;
        coverImage?: string;
        matchScore: number;
        matchReason: string;
        createdAt: Date;
    }>;
    totalCount: number;
    facets: {
        genres: Record<string, number>;
        themes: Record<string, number>;
        tags: Record<string, number>;
        authors: Record<string, number>;
        status: Record<string, number>;
    };
    suggestions: string[];
}

export interface LibraryStats {
    totalBooks: number;
    totalWordCount: number;
    averageWordCount: number;
    genreDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    tagsDistribution: Record<string, number>;
    collectionsCount: number;
    recentActivity: Array<{
        type: 'created' | 'updated' | 'tagged' | 'collection_added';
        bookId: string;
        bookTitle: string;
        timestamp: Date;
        details: string;
    }>;
}

export class SmartLibraryService extends BaseService {
    private tags: Map<string, BookTag> = new Map();
    private collections: Map<string, BookCollection> = new Map();

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        await this.loadTags();
        await this.loadCollections();
    }

    protected async onDispose(): Promise<void> {
        await this.saveTags();
        await this.saveCollections();
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Smart Library Service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Perform intelligent search across books
     */
    async searchBooks(
        query: string,
        filters: SearchFilters = {},
        options: {
            limit?: number;
            offset?: number;
            sortBy?: 'relevance' | 'date' | 'title' | 'wordCount' | 'rating';
            sortOrder?: 'asc' | 'desc';
        } = {}
    ): Promise<SearchResult> {
        return this.executeWithLogging('searchBooks', async () => {
            const { limit = 20, offset = 0, sortBy = 'relevance', sortOrder = 'desc' } = options;

            // Build MongoDB query
            const mongoQuery: any = {};

            // Apply filters
            if (filters.genres && filters.genres.length > 0) {
                mongoQuery.genre = { $in: filters.genres };
            }

            if (filters.status && filters.status.length > 0) {
                mongoQuery.status = { $in: filters.status };
            }

            if (filters.authors && filters.authors.length > 0) {
                mongoQuery.authorId = { $in: filters.authors };
            }

            if (filters.dateRange) {
                mongoQuery.createdAt = {
                    $gte: filters.dateRange.from,
                    $lte: filters.dateRange.to
                };
            }

            if (filters.wordCountRange) {
                mongoQuery.currentWordCount = {
                    $gte: filters.wordCountRange.min,
                    $lte: filters.wordCountRange.max
                };
            }

            // Text search
            if (query.trim()) {
                mongoQuery.$or = [
                    { title: { $regex: query, $options: 'i' } },
                    { subtitle: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { theme: { $regex: query, $options: 'i' } },
                    { genre: { $regex: query, $options: 'i' } },
                    { 'metadata.keywords': { $in: [new RegExp(query, 'i')] } },
                    { 'metadata.tags': { $in: [new RegExp(query, 'i')] } }
                ];
            }

            // Execute search
            const books = await Book.find(mongoQuery)
                .sort(this.buildSortCriteria(sortBy, sortOrder))
                .skip(offset)
                .limit(limit);

            const totalCount = await Book.countDocuments(mongoQuery);

            // Process results
            const results = await Promise.all(books.map(book => this.processSearchResult(book, query)));

            // Calculate facets
            const facets = await this.calculateFacets(mongoQuery);

            // Generate suggestions
            const suggestions = this.generateSearchSuggestions(query, results.length);

            this.logger.info('Smart search completed', {
                query,
                resultsCount: results.length,
                totalCount,
                filters: Object.keys(filters).length
            });

            return {
                books: results,
                totalCount,
                facets,
                suggestions
            };
        }, { query, filtersCount: Object.keys(filters).length });
    }

    /**
     * Auto-suggest tags for a book based on content analysis
     */
    async suggestTags(bookId: string): Promise<BookTag[]> {
        return this.executeWithLogging('suggestTags', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Get book content for analysis
            const chapters = await Chapter.find({ bookId });
            const chapterIds = chapters.map(c => c._id);
            const pages = await Page.find({ chapterId: { $in: chapterIds } });
            const fullContent = pages.map(p => p.content).join('\n\n');

            const suggestedTags: BookTag[] = [];

            // Genre-based suggestions
            const genreTags = this.suggestGenreTags(book.genre, fullContent);
            suggestedTags.push(...genreTags);

            // Theme-based suggestions
            const themeTags = this.suggestThemeTags(book.theme, fullContent);
            suggestedTags.push(...themeTags);

            // Audience-based suggestions
            if (book.targetAudience) {
                const audienceTags = this.suggestAudienceTags(book.targetAudience, fullContent);
                suggestedTags.push(...audienceTags);
            }

            // Content-based suggestions
            const contentTags = this.suggestContentTags(fullContent);
            suggestedTags.push(...contentTags);

            // Style-based suggestions
            const styleTags = this.suggestStyleTags(book.writingStyle, fullContent);
            suggestedTags.push(...styleTags);

            // Remove duplicates and limit
            const uniqueTags = this.deduplicateTags(suggestedTags);
            
            this.logger.info('Tags suggested for book', {
                bookId,
                suggestedCount: uniqueTags.length
            });

            return uniqueTags.slice(0, 10);
        }, { bookId });
    }

    /**
     * Create or update a tag
     */
    async createTag(tagData: {
        name: string;
        category: BookTag['category'];
        color?: string;
        description?: string;
        createdBy: string;
    }): Promise<BookTag> {
        return this.executeWithLogging('createTag', async () => {
            const tag: BookTag = {
                id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: tagData.name.toLowerCase().trim(),
                category: tagData.category,
                color: tagData.color,
                description: tagData.description,
                createdBy: tagData.createdBy,
                usageCount: 0,
                createdAt: new Date()
            };

            this.tags.set(tag.id, tag);
            await this.saveTags();

            this.logger.info('Tag created', {
                tagId: tag.id,
                name: tag.name,
                category: tag.category
            });

            return tag;
        }, { tagName: tagData.name });
    }

    /**
     * Apply tags to a book
     */
    async tagBook(bookId: string, tagIds: string[]): Promise<void> {
        return this.executeWithLogging('tagBook', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Update book metadata with tags
            const currentTags = book.metadata?.tags || [];
            const newTags = [...new Set([...currentTags, ...tagIds])];

            await Book.findByIdAndUpdate(bookId, {
                'metadata.tags': newTags
            });

            // Update tag usage counts
            for (const tagId of tagIds) {
                const tag = this.tags.get(tagId);
                if (tag) {
                    tag.usageCount++;
                    this.tags.set(tagId, tag);
                }
            }

            await this.saveTags();

            this.logger.info('Book tagged', {
                bookId,
                tagsAdded: tagIds.length,
                totalTags: newTags.length
            });
        }, { bookId, tagCount: tagIds.length });
    }

    /**
     * Create a book collection
     */
    async createCollection(collectionData: {
        name: string;
        description?: string;
        bookIds?: string[];
        tags?: string[];
        createdBy: string;
        isPublic?: boolean;
    }): Promise<BookCollection> {
        return this.executeWithLogging('createCollection', async () => {
            const collection: BookCollection = {
                id: `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: collectionData.name,
                description: collectionData.description,
                bookIds: collectionData.bookIds || [],
                tags: collectionData.tags || [],
                createdBy: collectionData.createdBy,
                isPublic: collectionData.isPublic || false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            this.collections.set(collection.id, collection);
            await this.saveCollections();

            this.logger.info('Collection created', {
                collectionId: collection.id,
                name: collection.name,
                bookCount: collection.bookIds.length
            });

            return collection;
        }, { collectionName: collectionData.name });
    }

    /**
     * Add books to a collection
     */
    async addBooksToCollection(collectionId: string, bookIds: string[]): Promise<void> {
        return this.executeWithLogging('addBooksToCollection', async () => {
            const collection = this.collections.get(collectionId);
            if (!collection) {
                throw new Error(`Collection not found: ${collectionId}`);
            }

            // Verify books exist
            const existingBooks = await Book.find({ _id: { $in: bookIds } }).select('_id');
            const validBookIds = existingBooks.map(b => b._id);

            // Add books to collection
            collection.bookIds = [...new Set([...collection.bookIds, ...validBookIds])];
            collection.updatedAt = new Date();

            this.collections.set(collectionId, collection);
            await this.saveCollections();

            this.logger.info('Books added to collection', {
                collectionId,
                booksAdded: validBookIds.length,
                totalBooks: collection.bookIds.length
            });
        }, { collectionId, bookCount: bookIds.length });
    }

    /**
     * Get library statistics
     */
    async getLibraryStats(authorId?: string): Promise<LibraryStats> {
        return this.executeWithLogging('getLibraryStats', async () => {
            const query = authorId ? { authorId } : {};
            
            const books = await Book.find(query);
            const totalBooks = books.length;
            const totalWordCount = books.reduce((sum, book) => sum + (book.currentWordCount || 0), 0);
            const averageWordCount = totalBooks > 0 ? Math.round(totalWordCount / totalBooks) : 0;

            // Calculate distributions
            const genreDistribution = this.calculateDistribution(books, 'genre');
            const statusDistribution = this.calculateDistribution(books, 'status');
            const tagsDistribution = this.calculateTagsDistribution(books);

            // Get collections count
            const userCollections = Array.from(this.collections.values())
                .filter(c => !authorId || c.createdBy === authorId);
            const collectionsCount = userCollections.length;

            // Get recent activity
            const recentActivity = await this.getRecentActivity(authorId);

            const stats: LibraryStats = {
                totalBooks,
                totalWordCount,
                averageWordCount,
                genreDistribution,
                statusDistribution,
                tagsDistribution,
                collectionsCount,
                recentActivity
            };

            this.logger.info('Library stats calculated', {
                totalBooks,
                totalWordCount,
                collectionsCount
            });

            return stats;
        }, { authorId });
    }

    /**
     * Get books similar to a given book
     */
    async findSimilarBooks(
        bookId: string,
        options: {
            limit?: number;
            similarityThreshold?: number;
            includeSameAuthor?: boolean;
        } = {}
    ): Promise<Array<{ book: any; similarity: number; reasons: string[] }>> {
        return this.executeWithLogging('findSimilarBooks', async () => {
            const { limit = 10, similarityThreshold = 0.3, includeSameAuthor = true } = options;

            const sourceBook = await Book.findById(bookId);
            if (!sourceBook) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Find all other books
            const query: any = { _id: { $ne: bookId } };
            if (!includeSameAuthor) {
                query.authorId = { $ne: sourceBook.authorId };
            }

            const allBooks = await Book.find(query);
            
            // Calculate similarity for each book
            const similarities = allBooks.map(book => {
                const similarity = this.calculateBookSimilarity(sourceBook, book);
                return {
                    book,
                    similarity: similarity.score,
                    reasons: similarity.reasons
                };
            });

            // Filter and sort
            const results = similarities
                .filter(s => s.similarity >= similarityThreshold)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            this.logger.info('Similar books found', {
                sourceBookId: bookId,
                similarBooksCount: results.length,
                avgSimilarity: results.reduce((sum, r) => sum + r.similarity, 0) / results.length
            });

            return results;
        }, { bookId });
    }

    /**
     * Categorize books automatically
     */
    async categorizeBooks(authorId?: string): Promise<{
        categorized: number;
        categories: Record<string, string[]>;
        uncategorized: string[];
    }> {
        return this.executeWithLogging('categorizeBooks', async () => {
            const query = authorId ? { authorId } : {};
            const books = await Book.find(query);

            const categories: Record<string, string[]> = {
                'Fiction': [],
                'Non-Fiction': [],
                'Romance': [],
                'Fantasy': [],
                'Mystery': [],
                'Children': [],
                'Young Adult': [],
                'Academic': [],
                'Other': []
            };

            const uncategorized: string[] = [];
            let categorized = 0;

            for (const book of books) {
                const category = this.determineBookCategory(book);
                if (category && categories[category]) {
                    categories[category].push(book._id);
                    categorized++;
                } else {
                    uncategorized.push(book._id);
                }
            }

            this.logger.info('Books categorized', {
                totalBooks: books.length,
                categorized,
                uncategorized: uncategorized.length
            });

            return { categorized, categories, uncategorized };
        }, { authorId });
    }

    // Private helper methods

    private async processSearchResult(book: any, query: string): Promise<any> {
        // Calculate match score
        const matchScore = this.calculateMatchScore(book, query);
        const matchReason = this.generateMatchReason(book, query);

        // Get tags for this book
        const bookTags = await this.getBookTags(book.metadata?.tags || []);

        return {
            id: book._id,
            title: book.title,
            subtitle: book.subtitle,
            author: book.authorId, // Would resolve to actual author name
            genre: book.genre,
            theme: book.theme,
            tags: bookTags,
            description: book.description,
            wordCount: book.currentWordCount,
            status: book.status,
            matchScore,
            matchReason,
            createdAt: book.createdAt
        };
    }

    private calculateMatchScore(book: any, query: string): number {
        if (!query.trim()) return 1.0;

        const queryLower = query.toLowerCase();
        let score = 0;

        // Title match (highest weight)
        if (book.title.toLowerCase().includes(queryLower)) {
            score += 0.4;
        }

        // Genre match
        if (book.genre.toLowerCase().includes(queryLower)) {
            score += 0.2;
        }

        // Theme match
        if (book.theme.toLowerCase().includes(queryLower)) {
            score += 0.2;
        }

        // Description match
        if (book.description && book.description.toLowerCase().includes(queryLower)) {
            score += 0.1;
        }

        // Keywords match
        if (book.metadata?.keywords) {
            const keywordMatches = book.metadata.keywords.filter((kw: string) => 
                kw.toLowerCase().includes(queryLower)
            ).length;
            score += Math.min(keywordMatches * 0.05, 0.1);
        }

        return Math.min(score, 1.0);
    }

    private generateMatchReason(book: any, query: string): string {
        if (!query.trim()) return 'All books';

        const reasons: string[] = [];
        const queryLower = query.toLowerCase();

        if (book.title.toLowerCase().includes(queryLower)) {
            reasons.push('title match');
        }
        if (book.genre.toLowerCase().includes(queryLower)) {
            reasons.push('genre match');
        }
        if (book.theme.toLowerCase().includes(queryLower)) {
            reasons.push('theme match');
        }

        return reasons.length > 0 ? reasons.join(', ') : 'content match';
    }

    private buildSortCriteria(sortBy: string, sortOrder: string): any {
        const order = sortOrder === 'desc' ? -1 : 1;

        switch (sortBy) {
            case 'date':
                return { createdAt: order };
            case 'title':
                return { title: order };
            case 'wordCount':
                return { currentWordCount: order };
            case 'rating':
                return { 'metadata.rating': order };
            case 'relevance':
            default:
                return { updatedAt: -1 }; // Most recently updated first for relevance
        }
    }

    private async calculateFacets(baseQuery: any): Promise<any> {
        // Calculate facet counts for filters
        const [genreFacets, statusFacets, tagFacets] = await Promise.all([
            Book.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$genre', count: { $sum: 1 } } }
            ]),
            Book.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Book.aggregate([
                { $match: baseQuery },
                { $unwind: '$metadata.tags' },
                { $group: { _id: '$metadata.tags', count: { $sum: 1 } } }
            ])
        ]);

        return {
            genres: this.aggregationToRecord(genreFacets),
            themes: {}, // Would implement theme facets
            tags: this.aggregationToRecord(tagFacets),
            authors: {}, // Would implement author facets
            status: this.aggregationToRecord(statusFacets)
        };
    }

    private aggregationToRecord(aggregation: any[]): Record<string, number> {
        return aggregation.reduce((record, item) => {
            record[item._id] = item.count;
            return record;
        }, {});
    }

    private generateSearchSuggestions(query: string, resultCount: number): string[] {
        const suggestions: string[] = [];

        if (resultCount === 0) {
            suggestions.push(
                'Try broader search terms',
                'Check spelling',
                'Use fewer filters',
                'Browse by genre instead'
            );
        } else if (resultCount > 100) {
            suggestions.push(
                'Try more specific terms',
                'Add filters to narrow results',
                'Search within a specific genre'
            );
        }

        // Add common search suggestions
        suggestions.push(
            'Try searching by author',
            'Browse popular tags',
            'Explore collections'
        );

        return suggestions.slice(0, 5);
    }

    private suggestGenreTags(genre: string, content: string): BookTag[] {
        const genreTags: BookTag[] = [];
        const genreLower = genre.toLowerCase();

        // Primary genre tag
        genreTags.push(this.createSuggestedTag(genre, 'genre', 'Primary genre classification'));

        // Sub-genre suggestions based on content analysis
        if (genreLower.includes('fiction')) {
            if (content.toLowerCase().includes('love') || content.toLowerCase().includes('romance')) {
                genreTags.push(this.createSuggestedTag('Romance', 'genre', 'Contains romantic elements'));
            }
            if (content.toLowerCase().includes('mystery') || content.toLowerCase().includes('detective')) {
                genreTags.push(this.createSuggestedTag('Mystery', 'genre', 'Contains mystery elements'));
            }
        }

        return genreTags;
    }

    private suggestThemeTags(theme: string, content: string): BookTag[] {
        const themeTags: BookTag[] = [];
        
        // Primary theme tag
        themeTags.push(this.createSuggestedTag(theme, 'theme', 'Primary book theme'));

        // Additional theme suggestions
        const themeKeywords = {
            'friendship': ['friend', 'friendship', 'companion'],
            'family': ['family', 'parent', 'child', 'sibling'],
            'adventure': ['journey', 'quest', 'adventure', 'exploration'],
            'love': ['love', 'heart', 'romance', 'relationship'],
            'courage': ['brave', 'courage', 'hero', 'fearless']
        };

        const contentLower = content.toLowerCase();
        for (const [themeTag, keywords] of Object.entries(themeKeywords)) {
            const matches = keywords.filter(kw => contentLower.includes(kw)).length;
            if (matches >= 2 && themeTag !== theme.toLowerCase()) {
                themeTags.push(this.createSuggestedTag(themeTag, 'theme', `Detected theme: ${themeTag}`));
            }
        }

        return themeTags;
    }

    private suggestAudienceTags(targetAudience: string, content: string): BookTag[] {
        const audienceTags: BookTag[] = [];
        const audienceLower = targetAudience.toLowerCase();

        if (audienceLower.includes('children') || audienceLower.includes('kid')) {
            audienceTags.push(this.createSuggestedTag('Children', 'audience', 'Suitable for children'));
        } else if (audienceLower.includes('young adult') || audienceLower.includes('teen')) {
            audienceTags.push(this.createSuggestedTag('Young Adult', 'audience', 'Suitable for young adults'));
        } else if (audienceLower.includes('adult')) {
            audienceTags.push(this.createSuggestedTag('Adult', 'audience', 'Suitable for adults'));
        }

        return audienceTags;
    }

    private suggestContentTags(content: string): BookTag[] {
        const contentTags: BookTag[] = [];
        const contentLower = content.toLowerCase();

        // Content-based suggestions
        if (contentLower.includes('historical') || contentLower.includes('history')) {
            contentTags.push(this.createSuggestedTag('Historical', 'custom', 'Contains historical elements'));
        }
        if (contentLower.includes('magic') || contentLower.includes('magical')) {
            contentTags.push(this.createSuggestedTag('Magic', 'custom', 'Contains magical elements'));
        }
        if (contentLower.includes('science') || contentLower.includes('technology')) {
            contentTags.push(this.createSuggestedTag('Science', 'custom', 'Contains scientific elements'));
        }

        return contentTags;
    }

    private suggestStyleTags(writingStyle: any, content: string): BookTag[] {
        const styleTags: BookTag[] = [];

        // Writing style based tags
        if (writingStyle.tone) {
            styleTags.push(this.createSuggestedTag(`${writingStyle.tone} tone`, 'style', `Writing tone: ${writingStyle.tone}`));
        }

        if (writingStyle.vocabulary) {
            styleTags.push(this.createSuggestedTag(`${writingStyle.vocabulary} vocabulary`, 'style', `Vocabulary level: ${writingStyle.vocabulary}`));
        }

        // Content style analysis
        const sentences = content.split(/[.!?]+/);
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;

        if (avgSentenceLength < 10) {
            styleTags.push(this.createSuggestedTag('Concise', 'style', 'Concise writing style'));
        } else if (avgSentenceLength > 20) {
            styleTags.push(this.createSuggestedTag('Descriptive', 'style', 'Descriptive writing style'));
        }

        return styleTags;
    }

    private createSuggestedTag(name: string, category: BookTag['category'], description: string): BookTag {
        return {
            id: `suggested_${name.replace(/\s+/g, '_').toLowerCase()}`,
            name: name.toLowerCase(),
            category,
            description,
            createdBy: 'system',
            usageCount: 0,
            createdAt: new Date()
        };
    }

    private deduplicateTags(tags: BookTag[]): BookTag[] {
        const seen = new Set<string>();
        return tags.filter(tag => {
            if (seen.has(tag.name)) {
                return false;
            }
            seen.add(tag.name);
            return true;
        });
    }

    private async getBookTags(tagIds: string[]): Promise<BookTag[]> {
        return tagIds.map(id => this.tags.get(id)).filter(Boolean) as BookTag[];
    }

    private calculateDistribution(books: any[], field: string): Record<string, number> {
        return books.reduce((dist, book) => {
            const value = book[field] || 'Unknown';
            dist[value] = (dist[value] || 0) + 1;
            return dist;
        }, {});
    }

    private calculateTagsDistribution(books: any[]): Record<string, number> {
        const tagCounts: Record<string, number> = {};
        
        books.forEach(book => {
            const tags = book.metadata?.tags || [];
            tags.forEach((tagId: string) => {
                const tag = this.tags.get(tagId);
                if (tag) {
                    tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
                }
            });
        });

        return tagCounts;
    }

    private async getRecentActivity(authorId?: string): Promise<LibraryStats['recentActivity']> {
        const query = authorId ? { authorId } : {};
        const recentBooks = await Book.find(query)
            .sort({ updatedAt: -1 })
            .limit(10);

        return recentBooks.map(book => ({
            type: 'updated' as const,
            bookId: book._id,
            bookTitle: book.title,
            timestamp: book.updatedAt,
            details: `Updated "${book.title}"`
        }));
    }

    private calculateBookSimilarity(book1: any, book2: any): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];

        // Genre similarity (40% weight)
        if (book1.genre === book2.genre) {
            score += 0.4;
            reasons.push('same genre');
        }

        // Theme similarity (30% weight)
        if (book1.theme === book2.theme) {
            score += 0.3;
            reasons.push('same theme');
        } else if (book1.theme.toLowerCase().includes(book2.theme.toLowerCase()) || 
                   book2.theme.toLowerCase().includes(book1.theme.toLowerCase())) {
            score += 0.15;
            reasons.push('related theme');
        }

        // Target audience similarity (20% weight)
        if (book1.targetAudience === book2.targetAudience) {
            score += 0.2;
            reasons.push('same audience');
        }

        // Writing style similarity (10% weight)
        if (book1.writingStyle?.tone === book2.writingStyle?.tone) {
            score += 0.05;
            reasons.push('similar tone');
        }
        if (book1.writingStyle?.vocabulary === book2.writingStyle?.vocabulary) {
            score += 0.05;
            reasons.push('similar vocabulary');
        }

        return { score, reasons };
    }

    private determineBookCategory(book: any): string | null {
        const genre = book.genre.toLowerCase();
        const theme = book.theme.toLowerCase();
        const audience = book.targetAudience?.toLowerCase() || '';

        if (audience.includes('children') || audience.includes('kid')) {
            return 'Children';
        }
        if (audience.includes('young adult') || audience.includes('teen')) {
            return 'Young Adult';
        }
        if (genre.includes('romance')) {
            return 'Romance';
        }
        if (genre.includes('fantasy') || genre.includes('magic')) {
            return 'Fantasy';
        }
        if (genre.includes('mystery') || genre.includes('detective')) {
            return 'Mystery';
        }
        if (genre.includes('fiction')) {
            return 'Fiction';
        }
        if (genre.includes('academic') || theme.includes('educational')) {
            return 'Academic';
        }
        if (genre.includes('non-fiction') || genre.includes('biography')) {
            return 'Non-Fiction';
        }

        return null;
    }

    private async loadTags(): Promise<void> {
        // In a real implementation, load from database
        this.tags.clear();
        this.logger.info('Tags loaded', { count: this.tags.size });
    }

    private async saveTags(): Promise<void> {
        // In a real implementation, save to database
        this.logger.debug('Tags saved', { count: this.tags.size });
    }

    private async loadCollections(): Promise<void> {
        // In a real implementation, load from database
        this.collections.clear();
        this.logger.info('Collections loaded', { count: this.collections.size });
    }

    private async saveCollections(): Promise<void> {
        // In a real implementation, save to database
        this.logger.debug('Collections saved', { count: this.collections.size });
    }

    /**
     * Get all tags
     */
    getAllTags(): BookTag[] {
        return Array.from(this.tags.values());
    }

    /**
     * Get all collections for a user
     */
    getUserCollections(userId: string): BookCollection[] {
        return Array.from(this.collections.values())
            .filter(c => c.createdBy === userId || c.isPublic);
    }

    /**
     * Get collection by ID
     */
    getCollection(collectionId: string): BookCollection | undefined {
        return this.collections.get(collectionId);
    }
}

export default SmartLibraryService;

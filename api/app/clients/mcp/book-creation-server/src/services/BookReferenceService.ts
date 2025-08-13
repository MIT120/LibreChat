/**
 * Book Reference Service - Discovers and stores reference books for writing style analysis
 */

import axios from 'axios';
import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { IBook } from '../../types/book.js';
import { generateShortLivedToken } from '../stubs/authService.js';

export interface OpenLibrarySearchResult {
    docs: Array<{
        key: string;
        title: string;
        author_name?: string[];
        first_publish_year?: number;
        subject?: string[];
        language?: string[];
        publisher?: string[];
        isbn?: string[];
        ia?: string[]; // Internet Archive identifiers
        has_fulltext?: boolean;
        public_scan_b?: boolean;
        ebook_access?: string;
        ebook_count_i?: number;
    }>;
    numFound: number;
    start: number;
}

export interface BookReference {
    id: string;
    openLibraryKey: string;
    title: string;
    authors: string[];
    publishYear?: number;
    isbn?: string[];
    subjects: string[];
    language: string;
    internetArchiveId?: string;
    hasFulltext: boolean;
    scrapedAt?: Date;
    ragFileId?: string; // ID in RAG system
    genre: string;
    targetAudience?: string;
    writingStyle: {
        tone?: string;
        complexity?: string;
        narrativeStyle?: string;
    };
    similarity: {
        genreMatch: number; // 0-1
        audienceMatch: number;
        styleMatch: number;
        overallScore: number;
    };
    contentSample?: string; // First few paragraphs for style analysis
    analysisComplete: boolean;
}

export interface StyleAnalysisRequest {
    bookId: string;
    genre: string;
    targetAudience?: string;
    writingStyle: {
        tone: string;
        vocabulary: string;
        voice: string;
    };
    theme: string;
    maxResults?: number;
    minSimilarityScore?: number;
}

export interface FirecrawlScrapeResult {
    success: boolean;
    data?: {
        content: string;
        markdown: string;
        html?: string;
        metadata: {
            title: string;
            description?: string;
            ogTitle?: string;
            sourceURL: string;
        };
    };
    error?: string;
}

export class BookReferenceService extends BaseService {
    private readonly OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
    private readonly INTERNET_ARCHIVE_BASE_URL = 'https://archive.org';
    private referenceBooks: Map<string, BookReference> = new Map();

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        // Load existing reference books from database/storage
        await this.loadExistingReferences();
    }

    protected async onDispose(): Promise<void> {
        // Save any pending reference data
        await this.saveReferences();
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Book Reference Service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Find reference books with similar writing styles
     */
    async findSimilarBooks(request: StyleAnalysisRequest): Promise<BookReference[]> {
        return this.executeWithLogging('findSimilarBooks', async () => {
            const { genre, targetAudience, writingStyle, theme, maxResults = 10, minSimilarityScore = 0.6 } = request;

            // First, check if we already have suitable references in our cache
            const cachedReferences = this.findCachedReferences(request);
            if (cachedReferences.length >= maxResults) {
                this.logger.info('Found sufficient cached references', {
                    bookId: request.bookId,
                    cachedCount: cachedReferences.length
                });
                return cachedReferences.slice(0, maxResults);
            }

            // Search Open Library for similar books
            const searchResults = await this.searchOpenLibrary({
                genre,
                targetAudience,
                theme,
                limit: 50 // Get more candidates for better filtering
            });

            this.logger.info('Open Library search completed', {
                bookId: request.bookId,
                resultsFound: searchResults.docs.length
            });

            // Convert search results to BookReference objects
            const references: BookReference[] = [];
            for (const doc of searchResults.docs) {
                const reference = await this.createBookReference(doc, request);
                if (reference && reference.similarity.overallScore >= minSimilarityScore) {
                    references.push(reference);
                }
            }

            // Sort by similarity score
            references.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore);

            // Scrape content for top candidates that don't exist in RAG yet
            const topReferences = references.slice(0, maxResults);
            await this.scrapeAndStoreReferences(topReferences, request.bookId);

            // Combine with cached results
            const allReferences = [...cachedReferences, ...topReferences];
            const uniqueReferences = this.deduplicateReferences(allReferences);

            return uniqueReferences.slice(0, maxResults);
        }, { bookId: request.bookId });
    }

    /**
     * Get existing reference content from RAG system
     */
    async queryReferenceContent(query: string, userId: string, limit: number = 5): Promise<any[]> {
        return this.executeWithLogging('queryReferenceContent', async () => {
            if (!process.env.RAG_API_URL) {
                throw new Error('RAG_API_URL not configured');
            }

            const jwtToken = generateShortLivedToken(userId);
            
            try {
                const response = await axios.post(
                    `${process.env.RAG_API_URL}/query`,
                    {
                        query,
                        k: limit,
                        collection: 'book_references' // Use specific collection for book references
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${jwtToken}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                return response.data.results || [];
            } catch (error) {
                this.logger.error('Failed to query RAG system', error as Error, { query, userId });
                return [];
            }
        }, { query, userId });
    }

    /**
     * Analyze writing style from reference books
     */
    async analyzeWritingStyleFromReferences(references: BookReference[], targetStyle: any): Promise<{
        stylePatterns: string[];
        recommendations: string[];
        examples: Array<{ text: string; analysis: string }>;
    }> {
        return this.executeWithLogging('analyzeWritingStyleFromReferences', async () => {
            const stylePatterns: string[] = [];
            const recommendations: string[] = [];
            const examples: Array<{ text: string; analysis: string }> = [];

            for (const reference of references) {
                if (!reference.contentSample) continue;

                // Analyze writing patterns
                const patterns = this.extractWritingPatterns(reference.contentSample, reference.writingStyle);
                stylePatterns.push(...patterns);

                // Generate recommendations based on style comparison
                const recs = this.generateStyleRecommendations(reference, targetStyle);
                recommendations.push(...recs);

                // Extract notable examples
                const textExamples = this.extractStyleExamples(reference.contentSample, reference.writingStyle);
                examples.push(...textExamples);
            }

            // Deduplicate and prioritize
            const uniquePatterns = [...new Set(stylePatterns)];
            const uniqueRecommendations = [...new Set(recommendations)];

            return {
                stylePatterns: uniquePatterns.slice(0, 10),
                recommendations: uniqueRecommendations.slice(0, 8),
                examples: examples.slice(0, 5)
            };
        }, { referenceCount: references.length });
    }

    private async searchOpenLibrary(params: {
        genre: string;
        targetAudience?: string;
        theme: string;
        limit: number;
    }): Promise<OpenLibrarySearchResult> {
        const searchTerms: string[] = [];

        // Add genre-based search terms
        searchTerms.push(`subject:"${params.genre}"`);

        // Add audience-specific terms
        if (params.targetAudience) {
            if (params.targetAudience.toLowerCase().includes('children')) {
                searchTerms.push('subject:"juvenile fiction"');
            } else if (params.targetAudience.toLowerCase().includes('young adult')) {
                searchTerms.push('subject:"young adult fiction"');
            }
        }

        // Add theme-based terms
        searchTerms.push(`"${params.theme}"`);

        // Ensure books have available content
        searchTerms.push('has_fulltext:true');
        searchTerms.push('public_scan:true');

        const query = searchTerms.join(' AND ');
        const url = `${this.OPEN_LIBRARY_BASE_URL}/search.json`;

        try {
            const response = await axios.get(url, {
                params: {
                    q: query,
                    limit: params.limit,
                    fields: 'key,title,author_name,first_publish_year,subject,language,publisher,isbn,ia,has_fulltext,public_scan_b,ebook_access,ebook_count_i',
                    sort: 'rating desc' // Get highest rated books first
                }
            });

            return response.data;
        } catch (error) {
            this.logger.error('Failed to search Open Library', error as Error, { query });
            return { docs: [], numFound: 0, start: 0 };
        }
    }

    private async createBookReference(doc: any, request: StyleAnalysisRequest): Promise<BookReference | null> {
        try {
            const reference: BookReference = {
                id: `ref_${doc.key.replace('/works/', '')}`,
                openLibraryKey: doc.key,
                title: doc.title,
                authors: doc.author_name || [],
                publishYear: doc.first_publish_year,
                isbn: doc.isbn || [],
                subjects: doc.subject || [],
                language: doc.language?.[0] || 'en',
                internetArchiveId: doc.ia?.[0],
                hasFulltext: doc.has_fulltext || false,
                genre: this.extractGenre(doc.subject || []),
                targetAudience: this.extractTargetAudience(doc.subject || []),
                writingStyle: {
                    tone: this.inferTone(doc.subject || [], doc.title),
                    complexity: this.inferComplexity(doc.subject || []),
                    narrativeStyle: this.inferNarrativeStyle(doc.subject || [])
                },
                similarity: this.calculateSimilarity(doc, request),
                analysisComplete: false
            };

            // Check if this reference already exists in our RAG system
            const exists = await this.checkIfReferenceExists(reference.id);
            if (exists) {
                reference.ragFileId = exists.ragFileId;
                reference.analysisComplete = true;
            }

            return reference;
        } catch (error) {
            this.logger.error('Failed to create book reference', error as Error, { docKey: doc.key });
            return null;
        }
    }

    private calculateSimilarity(doc: any, request: StyleAnalysisRequest): BookReference['similarity'] {
        const subjects = doc.subject || [];
        const title = doc.title || '';

        // Genre matching
        let genreMatch = 0;
        const targetGenre = request.genre.toLowerCase();
        for (const subject of subjects) {
            if (subject.toLowerCase().includes(targetGenre)) {
                genreMatch = 1;
                break;
            }
            // Partial matches
            if (this.isRelatedGenre(subject.toLowerCase(), targetGenre)) {
                genreMatch = Math.max(genreMatch, 0.7);
            }
        }

        // Audience matching
        let audienceMatch = 0.5; // Default neutral
        if (request.targetAudience) {
            const targetAudience = request.targetAudience.toLowerCase();
            for (const subject of subjects) {
                if (this.isAudienceMatch(subject.toLowerCase(), targetAudience)) {
                    audienceMatch = 1;
                    break;
                }
            }
        }

        // Style matching (based on subject tags and inferred complexity)
        let styleMatch = 0.5;
        const inferredTone = this.inferTone(subjects, title);
        const targetTone = request.writingStyle.tone.toLowerCase();
        if (inferredTone && this.isToneMatch(inferredTone, targetTone)) {
            styleMatch = 0.8;
        }

        // Theme matching
        let themeMatch = 0;
        const theme = request.theme.toLowerCase();
        if (title.toLowerCase().includes(theme)) {
            themeMatch = 0.8;
        }
        for (const subject of subjects) {
            if (subject.toLowerCase().includes(theme)) {
                themeMatch = Math.max(themeMatch, 0.6);
            }
        }

        // Calculate overall score with weights
        const overallScore = (
            genreMatch * 0.3 +
            audienceMatch * 0.2 +
            styleMatch * 0.3 +
            themeMatch * 0.2
        );

        return {
            genreMatch,
            audienceMatch,
            styleMatch: styleMatch,
            overallScore
        };
    }

    private async scrapeAndStoreReferences(references: BookReference[], bookId: string): Promise<void> {
        for (const reference of references) {
            if (reference.ragFileId) {
                continue; // Already in RAG system
            }

            try {
                // Attempt to scrape content
                const content = await this.scrapeBookContent(reference);
                if (content) {
                    reference.contentSample = content.substring(0, 2000); // First 2k chars for analysis
                    
                    // Store in RAG system
                    const ragFileId = await this.storeInRAG(reference, content, bookId);
                    if (ragFileId) {
                        reference.ragFileId = ragFileId;
                        reference.analysisComplete = true;
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to scrape reference book', {
                    error: error as Error,
                    referenceId: reference.id,
                    title: reference.title
                });
            }
        }
    }

    private async scrapeBookContent(reference: BookReference): Promise<string | null> {
        if (!process.env.FIRECRAWL_API_KEY) {
            this.logger.warn('FIRECRAWL_API_KEY not configured');
            return null;
        }

        // Try Internet Archive first
        if (reference.internetArchiveId) {
            const iaUrl = `${this.INTERNET_ARCHIVE_BASE_URL}/details/${reference.internetArchiveId}`;
            const iaContent = await this.scrapeWithFirecrawl(iaUrl);
            if (iaContent) {
                this.logger.info('Successfully scraped from Internet Archive', {
                    referenceId: reference.id,
                    iaId: reference.internetArchiveId
                });
                return iaContent;
            }
        }

        // Try Open Library text if available
        const olUrl = `${this.OPEN_LIBRARY_BASE_URL}${reference.openLibraryKey}`;
        const olContent = await this.scrapeWithFirecrawl(olUrl);
        if (olContent) {
            this.logger.info('Successfully scraped from Open Library', {
                referenceId: reference.id,
                openLibraryKey: reference.openLibraryKey
            });
            return olContent;
        }

        // Try alternative sources (Project Gutenberg, etc.)
        const alternativeContent = await this.scrapeAlternativeSources(reference);
        if (alternativeContent) {
            return alternativeContent;
        }

        return null;
    }

    private async scrapeWithFirecrawl(url: string): Promise<string | null> {
        try {
            const response = await axios.post(
                `${process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev'}/v1/scrape`,
                {
                    url,
                    formats: ['markdown', 'html'],
                    onlyMainContent: true,
                    removeTags: ['script', 'style', 'nav', 'footer', 'header'],
                    maxCharacters: 50000 // Limit content size
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const result: FirecrawlScrapeResult = response.data;
            
            if (result.success && result.data?.content) {
                // Clean and extract main text content
                return this.cleanScrapedContent(result.data.content);
            }

            return null;
        } catch (error) {
            this.logger.error('Firecrawl scraping failed', error as Error, { url });
            return null;
        }
    }

    private async scrapeAlternativeSources(reference: BookReference): Promise<string | null> {
        // Try Project Gutenberg if it's a classic
        if (reference.publishYear && reference.publishYear < 1928) {
            const gutenbergContent = await this.searchAndScrapeGutenberg(reference);
            if (gutenbergContent) {
                return gutenbergContent;
            }
        }

        // Try Google Books preview
        const googleBooksContent = await this.scrapeGoogleBooksPreview(reference);
        if (googleBooksContent) {
            return googleBooksContent;
        }

        return null;
    }

    private async searchAndScrapeGutenberg(reference: BookReference): Promise<string | null> {
        // Project Gutenberg search and scrape logic
        try {
            const searchUrl = `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(reference.title)}`;
            const searchContent = await this.scrapeWithFirecrawl(searchUrl);
            
            if (searchContent) {
                // Extract book URLs from search results and scrape the first match
                const bookUrlMatch = searchContent.match(/\/ebooks\/(\d+)/);
                if (bookUrlMatch) {
                    const bookId = bookUrlMatch[1];
                    const bookUrl = `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`;
                    return await this.scrapeWithFirecrawl(bookUrl);
                }
            }
        } catch (error) {
            this.logger.debug('Gutenberg search failed', { error: error as Error, title: reference.title });
        }
        
        return null;
    }

    private async scrapeGoogleBooksPreview(reference: BookReference): Promise<string | null> {
        // Google Books preview scraping logic
        if (!reference.isbn || reference.isbn.length === 0) {
            return null;
        }

        try {
            const isbn = reference.isbn[0];
            const previewUrl = `https://books.google.com/books?isbn=${isbn}`;
            return await this.scrapeWithFirecrawl(previewUrl);
        } catch (error) {
            this.logger.debug('Google Books preview failed', { error: error as Error, isbn: reference.isbn?.[0] });
        }

        return null;
    }

    private async storeInRAG(reference: BookReference, content: string, bookId: string): Promise<string | null> {
        if (!process.env.RAG_API_URL) {
            return null;
        }

        try {
            // Create a synthetic file ID for the reference
            const fileId = `book_ref_${reference.id}`;
            
            // Store in RAG with metadata
            const jwtToken = generateShortLivedToken('system'); // Use system token for book references
            
            const response = await axios.post(
                `${process.env.RAG_API_URL}/embed_text`,
                {
                    file_id: fileId,
                    content: content,
                    metadata: {
                        type: 'book_reference',
                        bookId: bookId,
                        referenceId: reference.id,
                        title: reference.title,
                        authors: reference.authors,
                        genre: reference.genre,
                        targetAudience: reference.targetAudience,
                        writingStyle: reference.writingStyle,
                        similarity: reference.similarity,
                        openLibraryKey: reference.openLibraryKey
                    },
                    collection: 'book_references'
                },
                {
                    headers: {
                        Authorization: `Bearer ${jwtToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data.success) {
                this.logger.info('Successfully stored reference in RAG', {
                    referenceId: reference.id,
                    ragFileId: fileId
                });
                return fileId;
            }

            return null;
        } catch (error) {
            this.logger.error('Failed to store reference in RAG', error as Error, {
                referenceId: reference.id
            });
            return null;
        }
    }

    // Helper methods for style analysis
    private cleanScrapedContent(content: string): string {
        // Remove excess whitespace, clean up formatting
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
    }

    private extractGenre(subjects: string[]): string {
        for (const subject of subjects) {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('fiction')) return 'fiction';
            if (subjectLower.includes('romance')) return 'romance';
            if (subjectLower.includes('mystery')) return 'mystery';
            if (subjectLower.includes('fantasy')) return 'fantasy';
            if (subjectLower.includes('science fiction')) return 'science fiction';
            if (subjectLower.includes('horror')) return 'horror';
            if (subjectLower.includes('thriller')) return 'thriller';
        }
        return 'general';
    }

    private extractTargetAudience(subjects: string[]): string | undefined {
        for (const subject of subjects) {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('juvenile') || subjectLower.includes('children')) return 'children';
            if (subjectLower.includes('young adult')) return 'young adult';
        }
        return undefined;
    }

    private inferTone(subjects: string[], title: string): string | undefined {
        const allText = [...subjects, title].join(' ').toLowerCase();
        
        if (allText.includes('humor') || allText.includes('comedy')) return 'humorous';
        if (allText.includes('dark') || allText.includes('gothic')) return 'serious';
        if (allText.includes('romantic') || allText.includes('love')) return 'romantic';
        if (allText.includes('adventure') || allText.includes('action')) return 'adventurous';
        
        return undefined;
    }

    private inferComplexity(subjects: string[]): string {
        for (const subject of subjects) {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('juvenile') || subjectLower.includes('easy reader')) return 'simple';
            if (subjectLower.includes('literary') || subjectLower.includes('classic')) return 'complex';
        }
        return 'intermediate';
    }

    private inferNarrativeStyle(subjects: string[]): string {
        for (const subject of subjects) {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('biography') || subjectLower.includes('memoir')) return 'first_person';
            if (subjectLower.includes('historical')) return 'third_person';
        }
        return 'varied';
    }

    private isRelatedGenre(subject: string, targetGenre: string): boolean {
        const genreRelations: Record<string, string[]> = {
            'romance': ['love story', 'romantic', 'relationships'],
            'fantasy': ['magic', 'magical', 'supernatural', 'fairy tale'],
            'mystery': ['detective', 'crime', 'suspense'],
            'horror': ['scary', 'supernatural', 'gothic', 'dark'],
            'adventure': ['action', 'exploration', 'journey']
        };

        const related = genreRelations[targetGenre] || [];
        return related.some(rel => subject.includes(rel));
    }

    private isAudienceMatch(subject: string, targetAudience: string): boolean {
        if (targetAudience.includes('children') && (subject.includes('juvenile') || subject.includes('children'))) {
            return true;
        }
        if (targetAudience.includes('young adult') && subject.includes('young adult')) {
            return true;
        }
        if (targetAudience.includes('adult') && !subject.includes('juvenile') && !subject.includes('young adult')) {
            return true;
        }
        return false;
    }

    private isToneMatch(inferredTone: string, targetTone: string): boolean {
        const toneGroups: Record<string, string[]> = {
            'humorous': ['funny', 'comedy', 'comic', 'humorous'],
            'serious': ['serious', 'dark', 'dramatic', 'somber'],
            'romantic': ['romantic', 'love', 'passionate'],
            'adventurous': ['adventurous', 'exciting', 'thrilling']
        };

        const targetGroup = toneGroups[targetTone] || [targetTone];
        return targetGroup.includes(inferredTone);
    }

    private findCachedReferences(request: StyleAnalysisRequest): BookReference[] {
        const cached: BookReference[] = [];
        
        for (const reference of this.referenceBooks.values()) {
            if (reference.similarity.overallScore >= (request.minSimilarityScore || 0.6)) {
                const similarity = this.calculateSimilarityToRequest(reference, request);
                if (similarity >= (request.minSimilarityScore || 0.6)) {
                    cached.push({
                        ...reference,
                        similarity: { ...reference.similarity, overallScore: similarity }
                    });
                }
            }
        }

        return cached.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore);
    }

    private calculateSimilarityToRequest(reference: BookReference, request: StyleAnalysisRequest): number {
        // Recalculate similarity based on current request
        let score = 0;

        // Genre match
        if (reference.genre.toLowerCase().includes(request.genre.toLowerCase())) {
            score += 0.3;
        }

        // Audience match
        if (request.targetAudience && reference.targetAudience) {
            if (reference.targetAudience.toLowerCase().includes(request.targetAudience.toLowerCase())) {
                score += 0.2;
            }
        } else if (!request.targetAudience && !reference.targetAudience) {
            score += 0.1; // Neutral match
        }

        // Style match
        if (reference.writingStyle.tone === request.writingStyle.tone) {
            score += 0.3;
        }

        // Theme match (basic keyword matching)
        const referenceText = `${reference.title} ${reference.subjects.join(' ')}`.toLowerCase();
        if (referenceText.includes(request.theme.toLowerCase())) {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    private deduplicateReferences(references: BookReference[]): BookReference[] {
        const seen = new Set<string>();
        return references.filter(ref => {
            if (seen.has(ref.id)) {
                return false;
            }
            seen.add(ref.id);
            return true;
        });
    }

    private async checkIfReferenceExists(referenceId: string): Promise<{ ragFileId: string } | null> {
        // Check if reference already exists in RAG system
        // This would query the RAG database to see if we have this reference
        try {
            if (!process.env.RAG_API_URL) {
                return null;
            }

            const jwtToken = generateShortLivedToken('system');
            const response = await axios.get(
                `${process.env.RAG_API_URL}/documents/book_ref_${referenceId}/exists`,
                {
                    headers: {
                        Authorization: `Bearer ${jwtToken}`,
                    },
                }
            );

            if (response.data.exists) {
                return { ragFileId: `book_ref_${referenceId}` };
            }
        } catch (error) {
            // Ignore errors, assume doesn't exist
        }

        return null;
    }

    private extractWritingPatterns(content: string, style: BookReference['writingStyle']): string[] {
        const patterns: string[] = [];

        // Sentence length analysis
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
        
        if (avgSentenceLength < 10) {
            patterns.push('Short, concise sentences for clarity and pace');
        } else if (avgSentenceLength > 20) {
            patterns.push('Long, complex sentences with detailed descriptions');
        } else {
            patterns.push('Balanced sentence structure mixing short and long sentences');
        }

        // Dialogue analysis
        const dialogueMatches = content.match(/["'][^"']*["']/g) || [];
        const dialogueRatio = dialogueMatches.length / sentences.length;
        
        if (dialogueRatio > 0.3) {
            patterns.push('Heavy use of dialogue to drive narrative');
        } else if (dialogueRatio > 0.1) {
            patterns.push('Moderate dialogue balanced with narrative description');
        } else {
            patterns.push('Primarily narrative-driven with minimal dialogue');
        }

        // Descriptive language analysis
        const descriptiveWords = content.match(/\b(beautiful|gorgeous|magnificent|terrible|awful|bright|dark|mysterious|gentle|harsh|vivid|dull)\b/gi) || [];
        const descriptiveRatio = descriptiveWords.length / content.split(' ').length;
        
        if (descriptiveRatio > 0.02) {
            patterns.push('Rich descriptive language with vivid imagery');
        } else {
            patterns.push('Minimal descriptive language, focus on action and plot');
        }

        return patterns;
    }

    private generateStyleRecommendations(reference: BookReference, targetStyle: any): string[] {
        const recommendations: string[] = [];

        // Compare tones
        if (reference.writingStyle.tone && reference.writingStyle.tone !== targetStyle.tone) {
            recommendations.push(`Consider adopting a ${reference.writingStyle.tone} tone like "${reference.title}" for better genre alignment`);
        }

        // Compare complexity
        if (reference.writingStyle.complexity === 'simple' && targetStyle.vocabulary === 'advanced') {
            recommendations.push(`Simplify vocabulary similar to "${reference.title}" for broader appeal`);
        } else if (reference.writingStyle.complexity === 'complex' && targetStyle.vocabulary === 'simple') {
            recommendations.push(`Add complexity inspired by "${reference.title}" for literary depth`);
        }

        // Audience considerations
        if (reference.targetAudience && reference.targetAudience !== targetStyle.targetAudience) {
            recommendations.push(`Adjust content appropriateness following "${reference.title}"'s approach to ${reference.targetAudience} audience`);
        }

        return recommendations;
    }

    private extractStyleExamples(content: string, style: BookReference['writingStyle']): Array<{ text: string; analysis: string }> {
        const examples: Array<{ text: string; analysis: string }> = [];

        // Extract first paragraph as opening style example
        const firstParagraph = content.split('\n\n')[0];
        if (firstParagraph && firstParagraph.length > 50) {
            examples.push({
                text: firstParagraph.substring(0, 200) + '...',
                analysis: `Opening style example showing ${style.tone || 'neutral'} tone and ${style.complexity || 'moderate'} complexity`
            });
        }

        // Extract dialogue example if present
        const dialogueMatch = content.match(/["'][^"']{20,}["']/);
        if (dialogueMatch) {
            examples.push({
                text: dialogueMatch[0],
                analysis: 'Dialogue style example showing character voice and conversation flow'
            });
        }

        return examples;
    }

    private async loadExistingReferences(): Promise<void> {
        // In a real implementation, this would load from database
        this.logger.info('Reference books loaded', {
            count: this.referenceBooks.size
        });
    }

    private async saveReferences(): Promise<void> {
        // In a real implementation, this would save to database
        this.logger.info('Reference books saved', {
            count: this.referenceBooks.size
        });
    }

    /**
     * Get reference book by ID
     */
    getReference(referenceId: string): BookReference | undefined {
        return this.referenceBooks.get(referenceId);
    }

    /**
     * Get all cached references
     */
    getAllReferences(): BookReference[] {
        return Array.from(this.referenceBooks.values());
    }

    /**
     * Clear cache and force fresh search
     */
    clearCache(): void {
        this.referenceBooks.clear();
        this.logger.info('Reference cache cleared');
    }
}

export default BookReferenceService;

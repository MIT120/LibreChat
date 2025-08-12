/**
 * Natural Language Query Service - Enable natural language interactions with book content
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { generateShortLivedToken } from '~/server/services/AuthService.js';
import axios from 'axios';

export interface QueryResult {
    answer: string;
    relevantChapters: Array<{
        id: string;
        title: string;
        relevance: number;
        excerpt: string;
    }>;
    sources: Array<{
        type: 'chapter' | 'page' | 'metadata';
        id: string;
        title: string;
        content: string;
        confidence: number;
    }>;
    confidence: number;
    relatedTopics: string[];
    followUpQuestions: string[];
}

export interface SummaryResult {
    summary: string;
    keyPoints: string[];
    themes: string[];
    characters: Array<{ name: string; description: string }>;
    plotPoints: string[];
    wordCount: number;
    readingTime: number; // in minutes
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
    id: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    question: string;
    options?: string[]; // for multiple choice
    correctAnswer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topic: string;
    sourceChapter?: string;
}

export interface QuizResult {
    questions: QuizQuestion[];
    metadata: {
        totalQuestions: number;
        difficultyDistribution: Record<string, number>;
        topicsCovered: string[];
        estimatedTime: number; // in minutes
        sourceChapters: string[];
    };
}

export class NaturalLanguageQueryService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        // No async initialization needed
    }

    protected async onDispose(): Promise<void> {
        // No cleanup needed
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Natural Language Query Service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Answer questions about book content using natural language
     */
    async queryBookContent(
        bookId: string,
        question: string,
        userId: string,
        options: {
            includeChapters?: string[];
            maxResults?: number;
            useRAG?: boolean;
        } = {}
    ): Promise<QueryResult> {
        return this.executeWithLogging('queryBookContent', async () => {
            // Get book and content
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            let relevantContent: string = '';
            let chapters: any[] = [];
            let pages: any[] = [];

            // Filter chapters if specified
            if (options.includeChapters && options.includeChapters.length > 0) {
                chapters = await Chapter.find({
                    bookId,
                    _id: { $in: options.includeChapters }
                }).sort({ chapterNumber: 1 });
            } else {
                chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
            }

            // Get pages for relevant chapters
            const chapterIds = chapters.map(c => c._id);
            pages = await Page.find({ chapterId: { $in: chapterIds } }).sort({ pageNumber: 1 });

            // Combine content for analysis
            relevantContent = pages.map(page => `[Chapter: ${chapters.find(c => c._id === page.chapterId)?.title || 'Unknown'}]\n${page.content}`).join('\n\n');

            // Use RAG system if available and requested
            let ragResults: any[] = [];
            if (options.useRAG && process.env.RAG_API_URL) {
                ragResults = await this.queryRAGSystem(question, userId, bookId);
            }

            // Analyze question and content
            const analysis = await this.analyzeQuestionAndContent(question, relevantContent, book, chapters, pages);

            // Generate answer
            const answer = await this.generateAnswer(question, analysis, ragResults);

            // Find relevant chapters
            const relevantChapters = this.findRelevantChapters(question, chapters, pages);

            // Extract sources
            const sources = this.extractSources(analysis, ragResults);

            // Generate follow-up questions
            const followUpQuestions = this.generateFollowUpQuestions(question, analysis);

            // Calculate confidence
            const confidence = this.calculateConfidence(analysis, ragResults);

            const result: QueryResult = {
                answer,
                relevantChapters: relevantChapters.slice(0, options.maxResults || 5),
                sources,
                confidence,
                relatedTopics: analysis.topics,
                followUpQuestions
            };

            this.logger.info('Book content query completed', {
                bookId,
                question: question.substring(0, 50) + '...',
                relevantChapters: result.relevantChapters.length,
                confidence: result.confidence
            });

            return result;
        }, { bookId, questionLength: question.length });
    }

    /**
     * Generate book summary
     */
    async generateBookSummary(
        bookId: string,
        options: {
            includeChapters?: string[];
            summaryType?: 'brief' | 'detailed' | 'academic';
            maxLength?: number;
        } = {}
    ): Promise<SummaryResult> {
        return this.executeWithLogging('generateBookSummary', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Get content
            let chapters: any[] = [];
            if (options.includeChapters && options.includeChapters.length > 0) {
                chapters = await Chapter.find({
                    bookId,
                    _id: { $in: options.includeChapters }
                }).sort({ chapterNumber: 1 });
            } else {
                chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
            }

            const chapterIds = chapters.map(c => c._id);
            const pages = await Page.find({ chapterId: { $in: chapterIds } }).sort({ pageNumber: 1 });

            const fullContent = pages.map(page => page.content).join('\n\n');

            // Analyze content
            const summary = await this.generateContentSummary(fullContent, book, options.summaryType || 'brief');
            const keyPoints = this.extractKeyPoints(fullContent, chapters);
            const themes = this.extractThemes(fullContent, book);
            const characters = this.extractCharacters(fullContent);
            const plotPoints = this.extractPlotPoints(fullContent, chapters);

            // Calculate metrics
            const wordCount = fullContent.split(/\s+/).filter(word => word.length > 0).length;
            const readingTime = Math.ceil(wordCount / 250); // Average reading speed
            const difficulty = this.assessDifficulty(fullContent);

            const result: SummaryResult = {
                summary,
                keyPoints,
                themes,
                characters,
                plotPoints,
                wordCount,
                readingTime,
                difficulty
            };

            this.logger.info('Book summary generated', {
                bookId,
                wordCount,
                readingTime,
                difficulty,
                themes: themes.length
            });

            return result;
        }, { bookId });
    }

    /**
     * Generate quiz from book content
     */
    async generateQuiz(
        bookId: string,
        options: {
            includeChapters?: string[];
            questionCount?: number;
            difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
            questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer' | 'essay')[];
            topics?: string[];
        } = {}
    ): Promise<QuizResult> {
        return this.executeWithLogging('generateQuiz', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Get content
            let chapters: any[] = [];
            if (options.includeChapters && options.includeChapters.length > 0) {
                chapters = await Chapter.find({
                    bookId,
                    _id: { $in: options.includeChapters }
                }).sort({ chapterNumber: 1 });
            } else {
                chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
            }

            const chapterIds = chapters.map(c => c._id);
            const pages = await Page.find({ chapterId: { $in: chapterIds } }).sort({ pageNumber: 1 });

            const fullContent = pages.map(page => page.content).join('\n\n');

            // Extract quiz topics
            const availableTopics = this.extractQuizTopics(fullContent, book, chapters);
            const targetTopics = options.topics || availableTopics.slice(0, 5);

            // Generate questions
            const questionCount = options.questionCount || 10;
            const questionTypes = options.questionTypes || ['multiple_choice', 'true_false', 'short_answer'];
            
            const questions: QuizQuestion[] = [];
            const questionsPerTopic = Math.ceil(questionCount / targetTopics.length);

            for (const topic of targetTopics) {
                const topicQuestions = await this.generateQuestionsForTopic(
                    topic,
                    fullContent,
                    chapters,
                    questionsPerTopic,
                    options.difficulty || 'mixed',
                    questionTypes
                );
                questions.push(...topicQuestions);
            }

            // Limit to requested count and shuffle
            const finalQuestions = this.shuffleArray(questions).slice(0, questionCount);

            // Calculate metadata
            const difficultyDistribution = this.calculateDifficultyDistribution(finalQuestions);
            const estimatedTime = this.estimateQuizTime(finalQuestions);
            const sourceChapters = [...new Set(finalQuestions.map(q => q.sourceChapter).filter(Boolean))];

            const result: QuizResult = {
                questions: finalQuestions,
                metadata: {
                    totalQuestions: finalQuestions.length,
                    difficultyDistribution,
                    topicsCovered: targetTopics,
                    estimatedTime,
                    sourceChapters
                }
            };

            this.logger.info('Quiz generated', {
                bookId,
                questionCount: finalQuestions.length,
                topics: targetTopics.length,
                estimatedTime
            });

            return result;
        }, { bookId, questionCount: options.questionCount });
    }

    /**
     * Extract learning objectives from content
     */
    async extractLearningObjectives(
        bookId: string,
        options: {
            includeChapters?: string[];
            taxonomyLevel?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
        } = {}
    ): Promise<{
        objectives: Array<{
            objective: string;
            level: string;
            chapter: string;
            assessmentSuggestion: string;
        }>;
        bloomsDistribution: Record<string, number>;
    }> {
        return this.executeWithLogging('extractLearningObjectives', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }

            // Get chapters
            let chapters: any[] = [];
            if (options.includeChapters && options.includeChapters.length > 0) {
                chapters = await Chapter.find({
                    bookId,
                    _id: { $in: options.includeChapters }
                }).sort({ chapterNumber: 1 });
            } else {
                chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
            }

            const objectives: Array<{
                objective: string;
                level: string;
                chapter: string;
                assessmentSuggestion: string;
            }> = [];

            // Bloom's taxonomy verbs for each level
            const bloomsVerbs = {
                remember: ['define', 'list', 'recall', 'identify', 'name'],
                understand: ['explain', 'describe', 'summarize', 'interpret', 'compare'],
                apply: ['demonstrate', 'solve', 'use', 'implement', 'execute'],
                analyze: ['analyze', 'examine', 'investigate', 'categorize', 'differentiate'],
                evaluate: ['evaluate', 'critique', 'judge', 'assess', 'validate'],
                create: ['create', 'design', 'develop', 'compose', 'formulate']
            };

            // Extract objectives from each chapter
            for (const chapter of chapters) {
                const chapterPages = await Page.find({ chapterId: chapter._id });
                const chapterContent = chapterPages.map(p => p.content).join('\n\n');

                // Generate objectives at different Bloom's levels
                const levels = options.taxonomyLevel ? [options.taxonomyLevel] : Object.keys(bloomsVerbs);
                
                for (const level of levels) {
                    const levelObjectives = this.generateObjectivesForLevel(
                        chapterContent,
                        chapter.title,
                        level,
                        bloomsVerbs[level as keyof typeof bloomsVerbs]
                    );
                    objectives.push(...levelObjectives);
                }
            }

            // Calculate Bloom's distribution
            const bloomsDistribution = objectives.reduce((dist, obj) => {
                dist[obj.level] = (dist[obj.level] || 0) + 1;
                return dist;
            }, {} as Record<string, number>);

            return { objectives, bloomsDistribution };
        }, { bookId });
    }

    // Private helper methods

    private async queryRAGSystem(question: string, userId: string, bookId?: string): Promise<any[]> {
        if (!process.env.RAG_API_URL) {
            return [];
        }

        try {
            const jwtToken = generateShortLivedToken(userId);
            const response = await axios.post(
                `${process.env.RAG_API_URL}/query`,
                {
                    query: question,
                    k: 5,
                    collection: bookId ? `book_${bookId}` : undefined
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
            this.logger.error('RAG query failed', error as Error, { question, userId });
            return [];
        }
    }

    private async analyzeQuestionAndContent(
        question: string,
        content: string,
        book: any,
        chapters: any[],
        pages: any[]
    ): Promise<any> {
        // Analyze question intent
        const questionType = this.classifyQuestion(question);
        const questionTopics = this.extractQuestionTopics(question);
        
        // Analyze content
        const contentTopics = this.extractContentTopics(content);
        const relevantSections = this.findRelevantSections(question, chapters, pages);

        return {
            questionType,
            questionTopics,
            contentTopics,
            topics: [...new Set([...questionTopics, ...contentTopics])],
            relevantSections,
            book,
            chapters,
            pages
        };
    }

    private async generateAnswer(question: string, analysis: any, ragResults: any[]): Promise<string> {
        // This would integrate with an AI service to generate natural answers
        // For now, provide a structured response based on analysis
        
        const questionType = analysis.questionType;
        const topics = analysis.topics;
        const relevantSections = analysis.relevantSections;

        if (questionType === 'factual') {
            return this.generateFactualAnswer(question, relevantSections, ragResults);
        } else if (questionType === 'analytical') {
            return this.generateAnalyticalAnswer(question, analysis, ragResults);
        } else if (questionType === 'summary') {
            return this.generateSummaryAnswer(question, analysis);
        } else {
            return this.generateGeneralAnswer(question, analysis, ragResults);
        }
    }

    private classifyQuestion(question: string): string {
        const questionLower = question.toLowerCase();
        
        if (questionLower.includes('what') || questionLower.includes('who') || questionLower.includes('when')) {
            return 'factual';
        } else if (questionLower.includes('why') || questionLower.includes('how') || questionLower.includes('analyze')) {
            return 'analytical';
        } else if (questionLower.includes('summarize') || questionLower.includes('overview')) {
            return 'summary';
        } else {
            return 'general';
        }
    }

    private extractQuestionTopics(question: string): string[] {
        // Simple keyword extraction - would use NLP in production
        const words = question.toLowerCase().split(/\s+/);
        const stopWords = new Set(['what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'the', 'a', 'an']);
        
        return words
            .filter(word => word.length > 3 && !stopWords.has(word))
            .slice(0, 5);
    }

    private extractContentTopics(content: string): string[] {
        // Extract key topics from content using frequency analysis
        const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const frequency: Record<string, number> = {};
        
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
    }

    private findRelevantSections(question: string, chapters: any[], pages: any[]): any[] {
        const questionLower = question.toLowerCase();
        const questionWords = questionLower.split(/\s+/);
        
        return pages
            .map(page => {
                const contentLower = page.content.toLowerCase();
                const matches = questionWords.filter(word => 
                    word.length > 3 && contentLower.includes(word)
                ).length;
                
                return {
                    ...page,
                    relevanceScore: matches / questionWords.length,
                    chapter: chapters.find(c => c._id === page.chapterId)
                };
            })
            .filter(page => page.relevanceScore > 0.1)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    private findRelevantChapters(question: string, chapters: any[], pages: any[]): any[] {
        const questionLower = question.toLowerCase();
        const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
        
        return chapters.map(chapter => {
            const chapterPages = pages.filter(p => p.chapterId === chapter._id);
            const allContent = chapterPages.map(p => p.content).join(' ').toLowerCase();
            
            const matches = questionWords.filter(word => allContent.includes(word)).length;
            const relevance = matches / questionWords.length;
            
            // Extract excerpt
            const excerpt = this.extractRelevantExcerpt(questionWords, allContent);
            
            return {
                id: chapter._id,
                title: chapter.title,
                relevance,
                excerpt
            };
        })
        .filter(chapter => chapter.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);
    }

    private extractRelevantExcerpt(questionWords: string[], content: string): string {
        // Find the most relevant sentence containing question words
        const sentences = content.split(/[.!?]+/);
        let bestSentence = '';
        let maxMatches = 0;
        
        for (const sentence of sentences) {
            const matches = questionWords.filter(word => sentence.toLowerCase().includes(word)).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestSentence = sentence.trim();
            }
        }
        
        return bestSentence.substring(0, 200) + (bestSentence.length > 200 ? '...' : '');
    }

    private generateFactualAnswer(question: string, relevantSections: any[], ragResults: any[]): string {
        if (relevantSections.length === 0 && ragResults.length === 0) {
            return "I couldn't find specific information to answer this question in the book content.";
        }

        const sources = [...relevantSections, ...ragResults]
            .sort((a, b) => (b.relevanceScore || b.score || 0) - (a.relevanceScore || a.score || 0))
            .slice(0, 3);

        const answer = sources
            .map(source => source.content || source.excerpt || 'No content available')
            .join('\n\n');

        return `Based on the book content:\n\n${answer}`;
    }

    private generateAnalyticalAnswer(question: string, analysis: any, ragResults: any[]): string {
        const topics = analysis.topics.slice(0, 3);
        const chapters = analysis.relevantSections.map((s: any) => s.chapter?.title).filter(Boolean);
        
        return `This question involves analyzing ${topics.join(', ')}. Based on the content from chapters including ${chapters.slice(0, 3).join(', ')}, here's the analysis:\n\n[This would contain AI-generated analytical response based on the book content and themes identified.]`;
    }

    private generateSummaryAnswer(question: string, analysis: any): string {
        const book = analysis.book;
        const chapters = analysis.chapters;
        
        return `Summary of "${book.title}":\n\nThis ${book.genre} book explores ${book.theme} across ${chapters.length} chapters. [Detailed summary would be generated here based on content analysis.]`;
    }

    private generateGeneralAnswer(question: string, analysis: any, ragResults: any[]): string {
        return `Based on the book content and your question, here's what I found:\n\n[AI-generated response combining content analysis and question context would be provided here.]`;
    }

    private extractSources(analysis: any, ragResults: any[]): any[] {
        const sources: any[] = [];
        
        // Add chapter sources
        analysis.relevantSections.slice(0, 3).forEach((section: any) => {
            sources.push({
                type: 'page',
                id: section._id,
                title: section.title || `Page ${section.pageNumber}`,
                content: section.content.substring(0, 200) + '...',
                confidence: section.relevanceScore || 0.5
            });
        });

        // Add RAG sources
        ragResults.slice(0, 2).forEach(result => {
            sources.push({
                type: 'chapter',
                id: result.id || 'unknown',
                title: result.metadata?.title || 'Unknown',
                content: result.content?.substring(0, 200) + '...' || '',
                confidence: result.score || 0.5
            });
        });

        return sources;
    }

    private generateFollowUpQuestions(question: string, analysis: any): string[] {
        const topics = analysis.topics.slice(0, 2);
        const questionType = analysis.questionType;
        
        const followUps: string[] = [];
        
        if (questionType === 'factual') {
            followUps.push(`How does ${topics[0]} relate to the main theme?`);
            followUps.push(`What other examples of ${topics[0]} appear in the book?`);
        } else if (questionType === 'analytical') {
            followUps.push(`What are the implications of this analysis?`);
            followUps.push(`How does this compare to other parts of the book?`);
        }
        
        followUps.push(`Can you tell me more about ${topics[0] || 'the main theme'}?`);
        
        return followUps.slice(0, 3);
    }

    private calculateConfidence(analysis: any, ragResults: any[]): number {
        const hasRelevantSections = analysis.relevantSections.length > 0;
        const hasRAGResults = ragResults.length > 0;
        const topicMatch = analysis.questionTopics.some((qt: string) => 
            analysis.contentTopics.includes(qt)
        );
        
        let confidence = 0.3; // Base confidence
        
        if (hasRelevantSections) confidence += 0.3;
        if (hasRAGResults) confidence += 0.2;
        if (topicMatch) confidence += 0.2;
        
        return Math.min(confidence, 1.0);
    }

    // Quiz generation helpers
    private async generateContentSummary(content: string, book: any, type: string): Promise<string> {
        // Generate summary based on type
        const wordCount = content.split(/\s+/).length;
        const targetLength = type === 'brief' ? 100 : type === 'detailed' ? 500 : 300;
        
        // This would use AI to generate actual summaries
        return `This ${book.genre} book "${book.title}" explores ${book.theme}. [AI-generated summary of ${targetLength} words would be provided here based on the content analysis.]`;
    }

    private extractKeyPoints(content: string, chapters: any[]): string[] {
        // Extract key points using chapter titles and content analysis
        const points = chapters.slice(0, 5).map(chapter => 
            `Chapter ${chapter.chapterNumber}: ${chapter.title} - [Key point extracted from content]`
        );
        
        return points;
    }

    private extractThemes(content: string, book: any): string[] {
        const themes = [book.theme];
        
        // Add detected themes from content
        const themeKeywords = {
            'love': ['love', 'heart', 'romance', 'relationship'],
            'friendship': ['friend', 'friendship', 'companion', 'ally'],
            'adventure': ['journey', 'quest', 'adventure', 'exploration'],
            'family': ['family', 'parent', 'child', 'sibling'],
            'courage': ['brave', 'courage', 'hero', 'fearless']
        };

        const contentLower = content.toLowerCase();
        for (const [theme, keywords] of Object.entries(themeKeywords)) {
            const matches = keywords.filter(keyword => contentLower.includes(keyword)).length;
            if (matches > 2 && !themes.includes(theme)) {
                themes.push(theme);
            }
        }

        return themes;
    }

    private extractCharacters(content: string): Array<{ name: string; description: string }> {
        // Simple character extraction - would use NER in production
        const characters: Array<{ name: string; description: string }> = [];
        
        // Look for patterns like "John said" or "Mary thought"
        const speakingPattern = /([A-Z][a-z]+)\s+(said|thought|asked|replied|whispered)/g;
        const matches = content.matchAll(speakingPattern);
        
        const characterNames = new Set<string>();
        for (const match of matches) {
            characterNames.add(match[1]);
        }

        characterNames.forEach(name => {
            characters.push({
                name,
                description: `Character mentioned in the story` // Would extract actual descriptions
            });
        });

        return characters.slice(0, 5);
    }

    private extractPlotPoints(content: string, chapters: any[]): string[] {
        return chapters.slice(0, 3).map(chapter => 
            `Chapter ${chapter.chapterNumber}: [Plot point extracted from ${chapter.title}]`
        );
    }

    private assessDifficulty(content: string): 'easy' | 'medium' | 'hard' {
        const sentences = content.split(/[.!?]+/);
        const avgWordsPerSentence = sentences.reduce((sum, s) => 
            sum + s.split(/\s+/).length, 0) / sentences.length;
        
        const words = content.split(/\s+/);
        const longWords = words.filter(word => word.length > 6).length;
        const longWordRatio = longWords / words.length;
        
        if (avgWordsPerSentence < 12 && longWordRatio < 0.15) {
            return 'easy';
        } else if (avgWordsPerSentence < 18 && longWordRatio < 0.25) {
            return 'medium';
        } else {
            return 'hard';
        }
    }

    private extractQuizTopics(content: string, book: any, chapters: any[]): string[] {
        const topics = [book.theme, book.genre];
        
        // Add chapter titles as topics
        chapters.forEach(chapter => {
            topics.push(chapter.title);
        });

        // Add content-based topics
        const contentTopics = this.extractContentTopics(content);
        topics.push(...contentTopics.slice(0, 3));

        return [...new Set(topics)];
    }

    private async generateQuestionsForTopic(
        topic: string,
        content: string,
        chapters: any[],
        count: number,
        difficulty: string,
        types: string[]
    ): Promise<QuizQuestion[]> {
        const questions: QuizQuestion[] = [];
        
        for (let i = 0; i < count; i++) {
            const type = types[i % types.length] as QuizQuestion['type'];
            const questionDifficulty = difficulty === 'mixed' 
                ? ['easy', 'medium', 'hard'][i % 3] as QuizQuestion['difficulty']
                : difficulty as QuizQuestion['difficulty'];
            
            const question = this.generateQuestionForTopic(topic, content, type, questionDifficulty);
            if (question) {
                questions.push(question);
            }
        }

        return questions;
    }

    private generateQuestionForTopic(
        topic: string,
        content: string,
        type: QuizQuestion['type'],
        difficulty: QuizQuestion['difficulty']
    ): QuizQuestion | null {
        const id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        switch (type) {
            case 'multiple_choice':
                return {
                    id,
                    type,
                    question: `Which of the following best describes ${topic}?`,
                    options: [
                        'Option A (correct answer)',
                        'Option B (distractor)',
                        'Option C (distractor)',
                        'Option D (distractor)'
                    ],
                    correctAnswer: 'Option A (correct answer)',
                    explanation: `The correct answer relates to ${topic} as described in the content.`,
                    difficulty,
                    topic
                };
                
            case 'true_false':
                return {
                    id,
                    type,
                    question: `True or False: ${topic} is a central theme in this book.`,
                    correctAnswer: 'True',
                    explanation: `This is true because ${topic} appears throughout the narrative.`,
                    difficulty,
                    topic
                };
                
            case 'short_answer':
                return {
                    id,
                    type,
                    question: `Briefly explain the significance of ${topic} in the story.`,
                    correctAnswer: `${topic} is significant because...`,
                    explanation: `A good answer would include specific examples and analysis.`,
                    difficulty,
                    topic
                };
                
            case 'essay':
                return {
                    id,
                    type,
                    question: `Analyze the role of ${topic} throughout the book, providing specific examples.`,
                    correctAnswer: `A comprehensive essay analyzing ${topic}...`,
                    explanation: `Essays should demonstrate deep understanding with textual evidence.`,
                    difficulty,
                    topic
                };
                
            default:
                return null;
        }
    }

    private calculateDifficultyDistribution(questions: QuizQuestion[]): Record<string, number> {
        return questions.reduce((dist, q) => {
            dist[q.difficulty] = (dist[q.difficulty] || 0) + 1;
            return dist;
        }, {} as Record<string, number>);
    }

    private estimateQuizTime(questions: QuizQuestion[]): number {
        // Estimate time based on question types
        const timePerType = {
            multiple_choice: 1,
            true_false: 0.5,
            short_answer: 3,
            essay: 10
        };

        return questions.reduce((total, q) => {
            return total + (timePerType[q.type] || 2);
        }, 0);
    }

    private generateObjectivesForLevel(
        content: string,
        chapterTitle: string,
        level: string,
        verbs: string[]
    ): Array<{ objective: string; level: string; chapter: string; assessmentSuggestion: string }> {
        const objectives = [];
        const verb = verbs[Math.floor(Math.random() * verbs.length)];
        
        // Generate 1-2 objectives per chapter/level
        objectives.push({
            objective: `Students will be able to ${verb} key concepts from ${chapterTitle}`,
            level,
            chapter: chapterTitle,
            assessmentSuggestion: this.getAssessmentSuggestion(level, verb)
        });

        return objectives;
    }

    private getAssessmentSuggestion(level: string, verb: string): string {
        const suggestions = {
            remember: 'Multiple choice or matching questions',
            understand: 'Short answer explanations',
            apply: 'Problem-solving scenarios',
            analyze: 'Compare and contrast essays',
            evaluate: 'Critique or judgment tasks',
            create: 'Project or design assignments'
        };

        return suggestions[level as keyof typeof suggestions] || 'Appropriate assessment method';
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

export default NaturalLanguageQueryService;

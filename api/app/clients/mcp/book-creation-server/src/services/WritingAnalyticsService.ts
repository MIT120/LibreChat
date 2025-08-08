/**
 * Writing Analytics Service - Provides detailed analytics and insights for writing
 */

import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { NotFoundError } from '../interfaces/index.js';

export interface WritingMetrics {
    wordCount: number;
    characterCount: number;
    sentenceCount: number;
    paragraphCount: number;
    averageWordsPerSentence: number;
    averageWordsPerParagraph: number;
    averageSentencesPerParagraph: number;
    readingTime: {
        minutes: number;
        seconds: number;
    };
}

export interface VocabularyAnalysis {
    uniqueWords: number;
    vocabularyRichness: number; // unique words / total words
    averageWordLength: number;
    complexWords: number; // words with 3+ syllables
    commonWords: Array<{ word: string; count: number; frequency: number }>;
    rareWords: Array<{ word: string; count: number }>;
    wordLengthDistribution: Record<number, number>;
}

export interface ReadabilityScores {
    fleschKincaidGradeLevel: number;
    fleschReadingEase: number;
    gunningFogIndex: number;
    colemanLiauIndex: number;
    automatedReadabilityIndex: number;
    smogIndex: number;
    overallDifficulty: 'very_easy' | 'easy' | 'fairly_easy' | 'standard' | 'fairly_difficult' | 'difficult' | 'very_difficult';
}

export interface SentimentAnalysis {
    overallSentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    sentimentScore: number; // -1 to 1
    emotionalTone: {
        joy: number;
        sadness: number;
        anger: number;
        fear: number;
        surprise: number;
        disgust: number;
    };
    subjectivity: number; // 0 to 1 (objective to subjective)
}

export interface StyleAnalysis {
    sentenceVariety: {
        simple: number;
        compound: number;
        complex: number;
        compoundComplex: number;
    };
    toneConsistency: number; // 0 to 1
    voiceConsistency: number; // 0 to 1
    passiveVoicePercentage: number;
    adverbUsage: number;
    clicheCount: number;
    repetitiveWords: Array<{ word: string; count: number }>;
}

export interface WritingProgress {
    dailyWordCounts: Array<{ date: string; words: number; pages: number }>;
    weeklyProgress: Array<{ week: string; words: number; pages: number; chapters: number }>;
    monthlyProgress: Array<{ month: string; words: number; pages: number; chapters: number }>;
    writingStreak: number; // consecutive days with writing
    averageWordsPerDay: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
    totalWritingTime: number; // in minutes
}

export interface ComparisonAnalysis {
    comparedTo: 'genre_average' | 'author_previous' | 'target_audience';
    metrics: {
        wordCount: { value: number; percentile: number; comparison: 'above' | 'below' | 'average' };
        readability: { value: number; percentile: number; comparison: 'above' | 'below' | 'average' };
        vocabulary: { value: number; percentile: number; comparison: 'above' | 'below' | 'average' };
        sentiment: { value: number; percentile: number; comparison: 'above' | 'below' | 'average' };
    };
}

export interface WritingGoals {
    dailyWordTarget: number;
    weeklyWordTarget: number;
    monthlyWordTarget: number;
    completionDeadline?: Date;
    currentProgress: {
        todayWords: number;
        weekWords: number;
        monthWords: number;
        percentageComplete: number;
        daysRemaining?: number;
        wordsRemaining: number;
        requiredDailyWords: number;
    };
    achievements: Array<{
        id: string;
        name: string;
        description: string;
        unlockedAt: Date;
        type: 'milestone' | 'streak' | 'quality' | 'consistency';
    }>;
}

export interface DetailedAnalysisReport {
    bookInfo: {
        id: string;
        title: string;
        genre: string;
        theme: string;
        status: string;
    };
    metrics: WritingMetrics;
    vocabulary: VocabularyAnalysis;
    readability: ReadabilityScores;
    sentiment: SentimentAnalysis;
    style: StyleAnalysis;
    progress: WritingProgress;
    comparison: ComparisonAnalysis;
    goals: WritingGoals;
    recommendations: Array<{
        category: 'readability' | 'vocabulary' | 'style' | 'structure' | 'pacing';
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        actionItems: string[];
    }>;
    generatedAt: Date;
}

export class WritingAnalyticsService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('WritingAnalyticsService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('WritingAnalyticsService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Writing analytics service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Generate comprehensive analytics report for a book
     */
    async generateBookAnalyticsReport(bookId: string): Promise<DetailedAnalysisReport> {
        return this.executeWithLogging('generateBookAnalyticsReport', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
            const chapterIds = chapters.map(c => c._id);
            const pages = await Page.find({ chapterId: { $in: chapterIds } }).sort({ pageNumber: 1 });

            // Combine all content
            const allContent = pages.map(page => page.content).join('\n\n');

            const report: DetailedAnalysisReport = {
                bookInfo: {
                    id: book._id,
                    title: book.title,
                    genre: book.genre,
                    theme: book.theme,
                    status: book.status,
                },
                metrics: this.calculateWritingMetrics(allContent),
                vocabulary: this.analyzeVocabulary(allContent),
                readability: this.calculateReadabilityScores(allContent),
                sentiment: this.analyzeSentiment(allContent),
                style: this.analyzeWritingStyle(allContent),
                progress: await this.analyzeWritingProgress(bookId, chapters, pages),
                comparison: this.generateComparisonAnalysis(book, allContent),
                goals: await this.analyzeWritingGoals(bookId, book),
                recommendations: this.generateRecommendations(allContent, book),
                generatedAt: new Date(),
            };

            this.logger.info('Analytics report generated', {
                bookId,
                contentLength: allContent.length,
                chaptersAnalyzed: chapters.length,
                pagesAnalyzed: pages.length,
            });

            return report;
        }, { bookId });
    }

    /**
     * Get analytics for a specific chapter
     */
    async analyzeChapter(chapterId: string): Promise<Partial<DetailedAnalysisReport>> {
        return this.executeWithLogging('analyzeChapter', async () => {
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
            const content = pages.map(page => page.content).join('\n\n');

            return {
                metrics: this.calculateWritingMetrics(content),
                vocabulary: this.analyzeVocabulary(content),
                readability: this.calculateReadabilityScores(content),
                sentiment: this.analyzeSentiment(content),
                style: this.analyzeWritingStyle(content),
                generatedAt: new Date(),
            };
        }, { chapterId });
    }

    /**
     * Get analytics for a specific page
     */
    async analyzePage(pageId: string): Promise<Partial<DetailedAnalysisReport>> {
        return this.executeWithLogging('analyzePage', async () => {
            const page = await Page.findOne({ pageId });
            if (!page) {
                throw new NotFoundError('Page', pageId);
            }

            const content = page.content;

            return {
                metrics: this.calculateWritingMetrics(content),
                vocabulary: this.analyzeVocabulary(content),
                readability: this.calculateReadabilityScores(content),
                sentiment: this.analyzeSentiment(content),
                style: this.analyzeWritingStyle(content),
                generatedAt: new Date(),
            };
        }, { pageId });
    }

    /**
     * Track writing progress over time
     */
    async trackDailyProgress(bookId: string, words: number, pages: number): Promise<void> {
        return this.executeWithLogging('trackDailyProgress', async () => {
            const today = new Date().toISOString().split('T')[0];

            // In a real implementation, this would be stored in a database
            // For now, we just log the progress
            this.logger.info('Daily progress tracked', {
                bookId,
                date: today,
                words,
                pages,
            });
        }, { bookId, words, pages });
    }

    /**
     * Get writing insights and recommendations
     */
    async getWritingInsights(bookId: string): Promise<Array<{
        type: 'strength' | 'improvement' | 'suggestion';
        category: string;
        title: string;
        description: string;
        confidence: number;
    }>> {
        return this.executeWithLogging('getWritingInsights', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            // Mock insights - in a real implementation, these would be generated using NLP and ML
            const insights = [
                {
                    type: 'strength' as const,
                    category: 'Vocabulary',
                    title: 'Rich Vocabulary Usage',
                    description: 'Your writing demonstrates excellent vocabulary diversity with effective use of descriptive language.',
                    confidence: 0.85,
                },
                {
                    type: 'improvement' as const,
                    category: 'Readability',
                    title: 'Sentence Length Variation',
                    description: 'Consider varying sentence lengths more to improve reading flow and engagement.',
                    confidence: 0.72,
                },
                {
                    type: 'suggestion' as const,
                    category: 'Style',
                    title: 'Dialogue Enhancement',
                    description: 'Adding more dialogue could help bring characters to life and improve reader engagement.',
                    confidence: 0.68,
                },
            ];

            return insights;
        }, { bookId });
    }

    private calculateWritingMetrics(content: string): WritingMetrics {
        const words = content.match(/\b\w+\b/g) || [];
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        const wordCount = words.length;
        const characterCount = content.length;
        const sentenceCount = sentences.length;
        const paragraphCount = paragraphs.length;

        return {
            wordCount,
            characterCount,
            sentenceCount,
            paragraphCount,
            averageWordsPerSentence: sentenceCount > 0 ? Math.round(wordCount / sentenceCount * 10) / 10 : 0,
            averageWordsPerParagraph: paragraphCount > 0 ? Math.round(wordCount / paragraphCount * 10) / 10 : 0,
            averageSentencesPerParagraph: paragraphCount > 0 ? Math.round(sentenceCount / paragraphCount * 10) / 10 : 0,
            readingTime: {
                minutes: Math.ceil(wordCount / 200), // 200 words per minute average
                seconds: Math.ceil((wordCount / 200) * 60),
            },
        };
    }

    private analyzeVocabulary(content: string): VocabularyAnalysis {
        const words = (content.match(/\b\w+\b/g) || []).map(w => w.toLowerCase());
        const uniqueWords = new Set(words);
        const wordFrequency: Record<string, number> = {};

        words.forEach(word => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });

        const sortedWords = Object.entries(wordFrequency)
            .sort(([, a], [, b]) => b - a);

        const commonWords = sortedWords.slice(0, 20).map(([word, count]) => ({
            word,
            count,
            frequency: count / words.length,
        }));

        const rareWords = sortedWords
            .filter(([, count]) => count === 1)
            .slice(0, 20)
            .map(([word, count]) => ({ word, count }));

        const wordLengthDistribution: Record<number, number> = {};
        words.forEach(word => {
            const length = word.length;
            wordLengthDistribution[length] = (wordLengthDistribution[length] || 0) + 1;
        });

        return {
            uniqueWords: uniqueWords.size,
            vocabularyRichness: words.length > 0 ? uniqueWords.size / words.length : 0,
            averageWordLength: words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
            complexWords: words.filter(word => word.length > 6).length, // Simplified complexity measure
            commonWords,
            rareWords,
            wordLengthDistribution,
        };
    }

    private calculateReadabilityScores(content: string): ReadabilityScores {
        // Simplified readability calculations (real implementation would use proper algorithms)
        const words = (content.match(/\b\w+\b/g) || []).length;
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const syllables = this.estimateSyllables(content);

        const avgSentenceLength = sentences > 0 ? words / sentences : 0;
        const avgSyllablesPerWord = words > 0 ? syllables / words : 0;

        // Simplified Flesch Reading Ease
        const fleschReadingEase = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

        // Simplified Flesch-Kincaid Grade Level
        const fleschKincaidGradeLevel = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;

        const overallDifficulty = this.interpretReadabilityScore(fleschReadingEase);

        return {
            fleschKincaidGradeLevel: Math.max(0, fleschKincaidGradeLevel),
            fleschReadingEase: Math.max(0, Math.min(100, fleschReadingEase)),
            gunningFogIndex: 0.4 * (avgSentenceLength + (100 * (syllables >= 3 ? 0.1 : 0.05))),
            colemanLiauIndex: (5.89 * (content.length / words)) - (30 * (sentences / words)) - 15.8,
            automatedReadabilityIndex: (4.71 * (content.length / words)) + (0.5 * (words / sentences)) - 21.43,
            smogIndex: Math.sqrt(syllables >= 3 ? syllables * 30 / sentences : 10) + 3,
            overallDifficulty,
        };
    }

    private analyzeSentiment(content: string): SentimentAnalysis {
        // Mock sentiment analysis - real implementation would use NLP libraries
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];

        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        const positiveCount = words.filter(word => positiveWords.includes(word)).length;
        const negativeCount = words.filter(word => negativeWords.includes(word)).length;

        const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length / 100, 1);
        const normalizedScore = Math.max(-1, Math.min(1, sentimentScore));

        let overallSentiment: SentimentAnalysis['overallSentiment'];
        if (normalizedScore >= 0.6) overallSentiment = 'very_positive';
        else if (normalizedScore >= 0.2) overallSentiment = 'positive';
        else if (normalizedScore >= -0.2) overallSentiment = 'neutral';
        else if (normalizedScore >= -0.6) overallSentiment = 'negative';
        else overallSentiment = 'very_negative';

        return {
            overallSentiment,
            sentimentScore: normalizedScore,
            emotionalTone: {
                joy: Math.random() * 0.3,
                sadness: Math.random() * 0.2,
                anger: Math.random() * 0.1,
                fear: Math.random() * 0.15,
                surprise: Math.random() * 0.1,
                disgust: Math.random() * 0.05,
            },
            subjectivity: Math.random() * 0.5 + 0.3, // Mock subjectivity
        };
    }

    private analyzeWritingStyle(content: string): StyleAnalysis {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.match(/\b\w+\b/g) || [];

        // Mock style analysis
        return {
            sentenceVariety: {
                simple: Math.floor(sentences.length * 0.4),
                compound: Math.floor(sentences.length * 0.3),
                complex: Math.floor(sentences.length * 0.2),
                compoundComplex: Math.floor(sentences.length * 0.1),
            },
            toneConsistency: Math.random() * 0.3 + 0.7,
            voiceConsistency: Math.random() * 0.2 + 0.8,
            passiveVoicePercentage: Math.random() * 20 + 5,
            adverbUsage: words.filter(word => word.endsWith('ly')).length,
            clicheCount: 0, // Would analyze common cliches
            repetitiveWords: [],
        };
    }

    private async analyzeWritingProgress(bookId: string, chapters: any[], pages: any[]): Promise<WritingProgress> {
        // Mock progress data - real implementation would fetch from database
        return {
            dailyWordCounts: [
                { date: '2024-01-01', words: 500, pages: 2 },
                { date: '2024-01-02', words: 750, pages: 3 },
                { date: '2024-01-03', words: 600, pages: 2 },
            ],
            weeklyProgress: [
                { week: '2024-W01', words: 3500, pages: 14, chapters: 2 },
                { week: '2024-W02', words: 4200, pages: 16, chapters: 1 },
            ],
            monthlyProgress: [
                { month: '2024-01', words: 15000, pages: 60, chapters: 8 },
            ],
            writingStreak: 5,
            averageWordsPerDay: 650,
            mostProductiveHour: 14, // 2 PM
            mostProductiveDay: 'Tuesday',
            totalWritingTime: 1200, // 20 hours
        };
    }

    private generateComparisonAnalysis(book: any, content: string): ComparisonAnalysis {
        // Mock comparison - real implementation would compare against genre/author averages
        return {
            comparedTo: 'genre_average',
            metrics: {
                wordCount: { value: content.length, percentile: 75, comparison: 'above' },
                readability: { value: 65, percentile: 60, comparison: 'average' },
                vocabulary: { value: 0.45, percentile: 80, comparison: 'above' },
                sentiment: { value: 0.2, percentile: 55, comparison: 'average' },
            },
        };
    }

    private async analyzeWritingGoals(bookId: string, book: any): Promise<WritingGoals> {
        // Mock goals - real implementation would fetch user-defined goals
        const goals: WritingGoals = {
            dailyWordTarget: 500,
            weeklyWordTarget: 3500,
            monthlyWordTarget: 15000,
            currentProgress: {
                todayWords: 320,
                weekWords: 2100,
                monthWords: 8500,
                percentageComplete: book.targetWordCount ? (book.currentWordCount / book.targetWordCount) * 100 : 0,
                daysRemaining: 90,
                wordsRemaining: Math.max(0, (book.targetWordCount || 0) - book.currentWordCount),
                requiredDailyWords: 450,
            },
            achievements: [
                {
                    id: 'first-chapter',
                    name: 'Chapter Pioneer',
                    description: 'Completed your first chapter',
                    unlockedAt: new Date(),
                    type: 'milestone',
                },
            ],
        };

        if (book.targetWordCount) {
            goals.completionDeadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        }

        return goals;
    }

    private generateRecommendations(content: string, book: any): DetailedAnalysisReport['recommendations'] {
        return [
            {
                category: 'readability',
                priority: 'medium',
                title: 'Improve Sentence Flow',
                description: 'Your sentences could benefit from more variation in length and structure to improve readability.',
                actionItems: [
                    'Mix short and long sentences',
                    'Use transitional phrases between ideas',
                    'Break up complex sentences where possible',
                ],
            },
            {
                category: 'vocabulary',
                priority: 'low',
                title: 'Expand Descriptive Language',
                description: 'Consider using more vivid and specific adjectives to enhance imagery.',
                actionItems: [
                    'Replace generic adjectives with specific ones',
                    'Add sensory details to descriptions',
                    'Use metaphors and similes sparingly but effectively',
                ],
            },
        ];
    }

    private estimateSyllables(content: string): number {
        const words = content.match(/\b\w+\b/g) || [];
        return words.reduce((total, word) => {
            // Simple syllable estimation
            const vowels = word.toLowerCase().match(/[aeiouy]+/g) || [];
            return total + Math.max(1, vowels.length);
        }, 0);
    }

    private interpretReadabilityScore(score: number): ReadabilityScores['overallDifficulty'] {
        if (score >= 90) return 'very_easy';
        if (score >= 80) return 'easy';
        if (score >= 70) return 'fairly_easy';
        if (score >= 60) return 'standard';
        if (score >= 50) return 'fairly_difficult';
        if (score >= 30) return 'difficult';
        return 'very_difficult';
    }
}

export default WritingAnalyticsService;

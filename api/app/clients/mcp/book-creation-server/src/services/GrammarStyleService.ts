/**
 * Grammar and Style Service - Advanced grammar checking and style improvement
 */

import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

export interface GrammarIssue {
    type: 'grammar' | 'spelling' | 'punctuation' | 'syntax';
    severity: 'error' | 'warning' | 'suggestion';
    message: string;
    position: { start: number; end: number };
    suggestions: string[];
    rule: string;
}

export interface StyleIssue {
    type: 'wordiness' | 'clarity' | 'consistency' | 'tone' | 'formality';
    severity: 'high' | 'medium' | 'low';
    message: string;
    position: { start: number; end: number };
    suggestions: string[];
    explanation: string;
}

export interface GrammarCheckResult {
    text: string;
    issues: GrammarIssue[];
    statistics: {
        totalIssues: number;
        errorCount: number;
        warningCount: number;
        suggestionCount: number;
    };
    score: number; // 0-100
}

export interface StyleAnalysisResult {
    text: string;
    issues: StyleIssue[];
    recommendations: Array<{
        category: string;
        recommendation: string;
        impact: 'high' | 'medium' | 'low';
    }>;
    score: number; // 0-100
}

export class GrammarStyleService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('GrammarStyleService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('GrammarStyleService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Grammar and style service operational',
            lastCheck: new Date(),
        };
    }

    async checkGrammar(text: string): Promise<GrammarCheckResult> {
        return this.executeWithLogging('checkGrammar', async () => {
            // Mock grammar checking - real implementation would use grammar checking library
            const issues: GrammarIssue[] = [];

            // Simple checks for demonstration
            const sentences = text.split(/[.!?]+/);
            sentences.forEach((sentence, index) => {
                if (sentence.trim().length > 0 && !sentence.trim().match(/^[A-Z]/)) {
                    issues.push({
                        type: 'grammar',
                        severity: 'error',
                        message: 'Sentence should start with a capital letter',
                        position: { start: index * 50, end: index * 50 + 10 },
                        suggestions: [sentence.trim().charAt(0).toUpperCase() + sentence.trim().slice(1)],
                        rule: 'capitalization',
                    });
                }
            });

            const errorCount = issues.filter(i => i.severity === 'error').length;
            const warningCount = issues.filter(i => i.severity === 'warning').length;
            const suggestionCount = issues.filter(i => i.severity === 'suggestion').length;

            const score = Math.max(0, 100 - (errorCount * 10 + warningCount * 5 + suggestionCount * 2));

            return {
                text,
                issues,
                statistics: {
                    totalIssues: issues.length,
                    errorCount,
                    warningCount,
                    suggestionCount,
                },
                score,
            };
        }, { textLength: text.length });
    }

    async analyzeStyle(text: string, targetStyle?: 'formal' | 'informal' | 'academic' | 'creative'): Promise<StyleAnalysisResult> {
        return this.executeWithLogging('analyzeStyle', async () => {
            const issues: StyleIssue[] = [];
            const recommendations = [];

            // Mock style analysis
            const words = text.split(/\s+/);
            const longSentences = text.split(/[.!?]+/).filter(s => s.trim().split(/\s+/).length > 20);

            if (longSentences.length > 0) {
                issues.push({
                    type: 'clarity',
                    severity: 'medium',
                    message: 'Consider breaking up long sentences for better readability',
                    position: { start: 0, end: 100 },
                    suggestions: ['Break into shorter sentences', 'Use transitional phrases'],
                    explanation: 'Long sentences can be difficult to follow',
                });
            }

            if (targetStyle === 'formal') {
                recommendations.push({
                    category: 'Formality',
                    recommendation: 'Avoid contractions and informal language',
                    impact: 'high' as const,
                });
            }

            const score = Math.max(60, 100 - issues.length * 5);

            return {
                text,
                issues,
                recommendations,
                score,
            };
        }, { textLength: text.length, targetStyle });
    }

    async suggestImprovements(text: string): Promise<Array<{
        type: 'word_choice' | 'sentence_structure' | 'flow' | 'clarity';
        original: string;
        improved: string;
        reason: string;
        confidence: number;
    }>> {
        return this.executeWithLogging('suggestImprovements', async () => {
            // Mock improvement suggestions
            return [
                {
                    type: 'word_choice' as const,
                    original: 'very good',
                    improved: 'excellent',
                    reason: 'More precise and impactful word choice',
                    confidence: 0.8,
                },
                {
                    type: 'sentence_structure' as const,
                    original: 'The book that I wrote',
                    improved: 'The book I wrote',
                    reason: 'More concise phrasing',
                    confidence: 0.9,
                },
            ];
        }, { textLength: text.length });
    }
}

export default GrammarStyleService;

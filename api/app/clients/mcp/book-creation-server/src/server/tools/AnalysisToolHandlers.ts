/**
 * Analysis Tool Handlers - MCP tools for page analysis and auto-review
 */

import { z } from 'zod';
import { Book } from '../../../models/Book.js';
import { Chapter } from '../../../models/Chapter.js';
import { Page } from '../../../models/Page.js';
import { PageStatus } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IBookService, IPageService, IToolHandler } from '../../interfaces/index.js';
import AIContentService from '../../services/AIContentService.js';
import WritingAnalyticsService from '../../services/WritingAnalyticsService.js';
import { ToolExecutor } from '../ToolExecutor.js';

type AnalysisDecision = 'accept' | 'needs_improvement' | 'needs_rewrite';

export class AnalysisToolHandlers {
    private logger: ILogger;
    private analyticsService: WritingAnalyticsService;
    private bookService: IBookService & IPageService;
    private aiContentService: AIContentService;

    constructor(
        logger: ILogger,
        analyticsService: WritingAnalyticsService,
        bookService: IBookService & IPageService,
        aiContentService: AIContentService
    ) {
        this.logger = logger.child('AnalysisToolHandlers');
        this.analyticsService = analyticsService;
        this.bookService = bookService;
        this.aiContentService = aiContentService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'analyze_page',
                description: 'Analyze a page for readability, style, sentiment, and make a rewrite decision',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'Page identifier' },
                    },
                    required: ['pageId'],
                },
                handler: async (args: any) => {
                    const schema = z.object({ pageId: z.string().min(1) });
                    return ToolExecutor.run({
                        name: 'analyze_page',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ pageId }) => {
                            const report = await this.analyticsService.analyzePage(pageId);
                            const decision = this.makeDecision(report);
                            return { report, decision } as { report: any; decision: AnalysisDecision };
                        },
                        format: (result) => this.formatAnalysisResult(result),
                    });
                },
            },
            {
                name: 'review_page',
                description:
                    'Analyze a page and, if needed, set status to review with notes. Optionally apply AI improvements.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'Page identifier' },
                        applyImprovements: { type: 'boolean', description: 'Apply AI improvement to the content', default: false },
                    },
                    required: ['pageId'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        pageId: z.string().min(1),
                        applyImprovements: z.boolean().optional().default(false),
                    });

                    return ToolExecutor.run({
                        name: 'review_page',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ pageId, applyImprovements }) => {
                            const analysis = await this.analyticsService.analyzePage(pageId);
                            const decision = this.makeDecision(analysis);

                            // Load context objects for potential improvement
                            const page = await Page.findOne({ pageId });
                            if (!page) {
                                throw new Error(`Page ${pageId} not found`);
                            }
                            const chapter = await Chapter.findById(page.chapterId);
                            const book = chapter ? await Book.findById(chapter.bookId) : null;

                            let improvedDraft: string | undefined;
                            if (applyImprovements && book) {
                                try {
                                    improvedDraft = await this.aiContentService.improveContent(
                                        page.content,
                                        book.writingStyle,
                                        { improvementType: 'comprehensive', preserveLength: true }
                                    );
                                } catch (err) {
                                    this.logger.warn('AI improvement failed; proceeding without applying draft', {
                                        pageId,
                                        error: (err as Error).message,
                                    });
                                }
                            }

                            // Build notes
                            const summary = this.buildNotesSummary(analysis, decision);

                            // Update page status/notes (and optionally content)
                            const updates: any = { notes: summary };
                            if (decision !== 'accept') {
                                updates.status = PageStatus.REVIEW;
                            }
                            if (applyImprovements && improvedDraft) {
                                updates.content = improvedDraft;
                            }

                            const updated = await this.bookService.updatePage(pageId, updates);
                            return { analysis, decision, updatedPage: updated, improvedDraft };
                        },
                        format: ({ analysis, decision, updatedPage, improvedDraft }) => {
                            let out = `🧪 Page Analysis Decision: ${decision.toUpperCase()}`;
                            out += this.formatKeyMetrics(analysis);
                            out += `\n\nStatus: ${updatedPage.status}`;
                            if (updatedPage.notes) {
                                out += `\nNotes:\n${updatedPage.notes}`;
                            }
                            if (improvedDraft) {
                                out += `\n\nProposed Improved Draft (applied: yes):\n${improvedDraft.substring(0, 1000)}${improvedDraft.length > 1000 ? '...' : ''
                                    }`;
                            }
                            return out;
                        },
                    });
                },
            },
        ];
    }

    private makeDecision(report: any): AnalysisDecision {
        const readability = report.readability;
        const style = report.style;
        const metrics = report.metrics;

        // Basic heuristic thresholds
        const tooDifficult = readability && readability.fleschReadingEase !== undefined && readability.fleschReadingEase < 50;
        const tooSimple = readability && readability.fleschReadingEase !== undefined && readability.fleschReadingEase > 90;
        const toneLow = style && typeof style.toneConsistency === 'number' && style.toneConsistency < 0.65;
        const passiveHigh = style && typeof style.passiveVoicePercentage === 'number' && style.passiveVoicePercentage > 25;
        const tooShort = metrics && typeof metrics.wordCount === 'number' && metrics.wordCount < 150;

        if (tooDifficult || toneLow || (passiveHigh && tooShort)) {
            return 'needs_rewrite';
        }
        if (tooSimple || passiveHigh) {
            return 'needs_improvement';
        }
        return 'accept';
    }

    private formatAnalysisResult(result: { report: any; decision: AnalysisDecision }): string {
        const { report, decision } = result;
        let out = `🧪 Page Analysis Decision: ${decision.toUpperCase()}`;
        out += this.formatKeyMetrics(report);
        return out;
    }

    private formatKeyMetrics(report: any): string {
        const metrics = report.metrics || {};
        const readability = report.readability || {};
        const style = report.style || {};
        const sentiment = report.sentiment || {};

        let out = '\n\nKey Metrics:';
        out += `\n- Words: ${metrics.wordCount ?? 'n/a'} | Sentences: ${metrics.sentenceCount ?? 'n/a'}`;
        out += `\n- Readability (Flesch): ${readability.fleschReadingEase ?? 'n/a'} | Grade: ${readability.fleschKincaidGradeLevel ?? 'n/a'}`;
        out += `\n- Tone Consistency: ${style.toneConsistency ?? 'n/a'} | Passive Voice %: ${style.passiveVoicePercentage ?? 'n/a'}`;
        out += `\n- Sentiment: ${sentiment.overallSentiment ?? 'n/a'} (${sentiment.sentimentScore ?? 'n/a'})`;
        return out;
    }

    private buildNotesSummary(report: any, decision: AnalysisDecision): string {
        const readability = report.readability || {};
        const style = report.style || {};
        const metrics = report.metrics || {};

        const reasons: string[] = [];
        if (readability.fleschReadingEase !== undefined && readability.fleschReadingEase < 50) {
            reasons.push('Readability is low (Flesch < 50). Consider shorter sentences and simpler words.');
        } else if (readability.fleschReadingEase !== undefined && readability.fleschReadingEase > 90) {
            reasons.push('Readability is very high (Flesch > 90). Consider adding depth and varied structure.');
        }
        if (typeof style.toneConsistency === 'number' && style.toneConsistency < 0.65) {
            reasons.push('Tone consistency is low; align with the book tone guide.');
        }
        if (typeof style.passiveVoicePercentage === 'number' && style.passiveVoicePercentage > 25) {
            reasons.push('High passive voice; prefer active constructions.');
        }
        if (typeof metrics.wordCount === 'number' && metrics.wordCount < 150) {
            reasons.push('Very short page; add more substance and narrative progression.');
        }

        return `Decision: ${decision.toUpperCase()}\n${reasons.map((r) => `- ${r}`).join('\n')}`;
    }
}

export default AnalysisToolHandlers;



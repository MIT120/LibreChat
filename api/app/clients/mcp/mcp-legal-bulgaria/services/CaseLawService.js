/**
 * Case Law Service for Bulgarian legal research
 * Handles searching, filtering, and analysis of Bulgarian court decisions
 */

import { CaseLaw } from '../models/CaseLaw.js';
import { BulgarianLegalParser } from '../utils/BulgarianLegalParser.js';

export class CaseLawService {
    constructor() {
        this.parser = new BulgarianLegalParser();
        // In a real implementation, this would connect to actual legal databases
        this.mockDatabase = this.initializeMockDatabase();
    }

    /**
     * Search case law based on criteria
     */
    async searchCaseLaw(criteria) {
        try {
            const {
                articles = [],
                laws = [],
                parties = [],
                court = '',
                dateFrom = null,
                dateTo = null,
                outcome = '',
                limit = 20,
                keywords = [],
            } = criteria;

            // Filter cases based on criteria
            let results = this.mockDatabase.filter((caseData) => {
                const caseLaw = new CaseLaw(caseData);
                return caseLaw.matchesCriteria({
                    articles,
                    laws,
                    partyType: parties.length > 0 ? parties[0] : null,
                    court,
                    dateFrom: dateFrom ? new Date(dateFrom) : null,
                    dateTo: dateTo ? new Date(dateTo) : null,
                    outcome,
                });
            });

            // Keyword filtering if provided
            if (keywords.length > 0) {
                results = results.filter((caseData) => {
                    const searchText =
                        `${caseData.summary} ${caseData.reasoning} ${caseData.keyPoints.join(' ')}`.toLowerCase();
                    return keywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
                });
            }

            // Sort by date (newest first) and limit results
            results.sort((a, b) => new Date(b.date) - new Date(a.date));
            results = results.slice(0, limit);

            return {
                results: results.map((data) => new CaseLaw(data)),
                total: results.length,
                criteria: criteria,
            };
        } catch (error) {
            throw new Error(`Case law search failed: ${error.message}`);
        }
    }

    /**
     * Find cases similar to a given case or legal situation
     */
    async findSimilarCases(referenceCase, limit = 10) {
        try {
            const similarities = this.mockDatabase.map((caseData) => {
                const caseLaw = new CaseLaw(caseData);
                const similarity = this.calculateCaseSimilarity(referenceCase, caseLaw);
                return { caseLaw, similarity };
            });

            // Sort by similarity score and return top matches
            similarities.sort((a, b) => b.similarity - a.similarity);
            const topMatches = similarities.slice(0, limit);

            return {
                results: topMatches.map((item) => ({
                    case: item.caseLaw,
                    similarity: item.similarity,
                    reasoning: this.generateSimilarityReasoning(referenceCase, item.caseLaw),
                })),
                total: topMatches.length,
            };
        } catch (error) {
            throw new Error(`Similar cases search failed: ${error.message}`);
        }
    }

    /**
     * Generate summary for a set of cases
     */
    async generateCasesSummary(cases) {
        try {
            if (!cases || cases.length === 0) {
                return {
                    count: 0,
                    summary: 'No cases found matching the criteria.',
                    commonElements: [],
                    trends: [],
                };
            }

            const summary = {
                count: cases.length,
                courts: this.extractCommonCourts(cases),
                timeRange: this.getTimeRange(cases),
                commonLegalBasis: this.extractCommonLegalBasis(cases),
                outcomes: this.analyzeOutcomes(cases),
                keyTrends: this.identifyTrends(cases),
            };

            summary.summary = this.generateTextualSummary(summary);

            return summary;
        } catch (error) {
            throw new Error(`Cases summary generation failed: ${error.message}`);
        }
    }

    /**
     * Verify if a specific clause was part of agreements in past cases
     */
    async verifyContractClause(clauseText, criteria = {}) {
        try {
            const relevantCases = await this.searchCaseLaw(criteria);
            const clauseMatches = [];

            for (const caseLaw of relevantCases.results) {
                const similarity = this.parser.calculateSimilarity(clauseText, caseLaw.fullText);

                if (similarity > 0.7) {
                    // High similarity threshold
                    clauseMatches.push({
                        case: caseLaw,
                        similarity,
                        context: this.extractClauseContext(caseLaw.fullText, clauseText),
                    });
                }
            }

            return {
                clauseFound: clauseMatches.length > 0,
                matches: clauseMatches,
                enforceability: this.assessClauseEnforceability(clauseMatches),
                recommendations: this.generateClauseRecommendations(clauseMatches),
            };
        } catch (error) {
            throw new Error(`Clause verification failed: ${error.message}`);
        }
    }

    /**
     * Calculate similarity between two cases
     */
    calculateCaseSimilarity(case1, case2) {
        let score = 0;
        let factors = 0;

        // Legal basis similarity
        const commonArticles = case1.legalBasis.articles.filter((a1) =>
            case2.legalBasis.articles.some((a2) => a2.article === a1.article),
        );
        if (commonArticles.length > 0) {
            score +=
                (commonArticles.length /
                    Math.max(case1.legalBasis.articles.length, case2.legalBasis.articles.length)) *
                0.3;
        }
        factors++;

        // Outcome similarity
        if (case1.outcome === case2.outcome) {
            score += 0.2;
        }
        factors++;

        // Court level similarity
        if (case1.court === case2.court) {
            score += 0.1;
        }
        factors++;

        // Text similarity
        const textSimilarity = this.parser.calculateSimilarity(
            case1.summary + ' ' + case1.keyPoints.join(' '),
            case2.summary + ' ' + case2.keyPoints.join(' '),
        );
        score += textSimilarity * 0.4;
        factors++;

        return score / factors;
    }

    /**
     * Extract common courts from cases
     */
    extractCommonCourts(cases) {
        const courtCounts = {};
        cases.forEach((caseLaw) => {
            courtCounts[caseLaw.court] = (courtCounts[caseLaw.court] || 0) + 1;
        });

        return Object.entries(courtCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([court, count]) => ({ court, count }));
    }

    /**
     * Get time range of cases
     */
    getTimeRange(cases) {
        const dates = cases
            .map((c) => c.date)
            .filter((d) => d)
            .sort();
        return {
            from: dates[0],
            to: dates[dates.length - 1],
            span: dates.length > 1 ? dates[dates.length - 1] - dates[0] : 0,
        };
    }

    /**
     * Extract common legal basis
     */
    extractCommonLegalBasis(cases) {
        const articleCounts = {};
        const lawCounts = {};

        cases.forEach((caseLaw) => {
            caseLaw.legalBasis.articles.forEach((article) => {
                const key = `${article.article} ${article.law || ''}`.trim();
                articleCounts[key] = (articleCounts[key] || 0) + 1;
            });

            caseLaw.legalBasis.laws.forEach((law) => {
                lawCounts[law] = (lawCounts[law] || 0) + 1;
            });
        });

        return {
            articles: Object.entries(articleCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([article, count]) => ({ article, count })),
            laws: Object.entries(lawCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([law, count]) => ({ law, count })),
        };
    }

    /**
     * Analyze outcomes distribution
     */
    analyzeOutcomes(cases) {
        const outcomeCounts = {};
        cases.forEach((caseLaw) => {
            outcomeCounts[caseLaw.outcome] = (outcomeCounts[caseLaw.outcome] || 0) + 1;
        });

        return Object.entries(outcomeCounts).map(([outcome, count]) => ({
            outcome,
            count,
            percentage: ((count / cases.length) * 100).toFixed(1),
        }));
    }

    /**
     * Identify trends in cases
     */
    identifyTrends(cases) {
        const trends = [];

        // Time-based trends
        if (cases.length > 5) {
            const recentCases = cases.filter(
                (c) => c.date && c.date > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            );

            if (recentCases.length > cases.length * 0.6) {
                trends.push('Increasing activity in recent year');
            }
        }

        // Outcome trends
        const outcomes = this.analyzeOutcomes(cases);
        const dominantOutcome = outcomes.reduce((max, current) =>
            current.count > max.count ? current : max,
        );

        if (dominantOutcome.percentage > 70) {
            trends.push(
                `Strong tendency towards ${dominantOutcome.outcome} outcomes (${dominantOutcome.percentage}%)`,
            );
        }

        return trends;
    }

    /**
     * Generate textual summary
     */
    generateTextualSummary(summaryData) {
        const { count, courts, outcomes, keyTrends } = summaryData;

        let text = `Анализ на ${count} съдебни решения:\n\n`;

        if (courts.length > 0) {
            text += `Най-активни съдилища: ${courts
                .slice(0, 3)
                .map((c) => `${c.court} (${c.count})`)
                .join(', ')}\n\n`;
        }

        if (outcomes.length > 0) {
            text += `Разпределение на решенията: ${outcomes.map((o) => `${o.outcome} - ${o.percentage}%`).join(', ')}\n\n`;
        }

        if (keyTrends.length > 0) {
            text += `Ключови тенденции:\n${keyTrends.map((t) => `• ${t}`).join('\n')}`;
        }

        return text;
    }

    /**
     * Extract context around a clause in case text
     */
    extractClauseContext(fullText, clauseText) {
        const index = fullText.toLowerCase().indexOf(clauseText.toLowerCase());
        if (index === -1) return '';

        const start = Math.max(0, index - 200);
        const end = Math.min(fullText.length, index + clauseText.length + 200);

        return fullText.substring(start, end);
    }

    /**
     * Assess clause enforceability based on past cases
     */
    assessClauseEnforceability(matches) {
        if (matches.length === 0) {
            return { score: 0, assessment: 'No precedents found' };
        }

        const enforcedCount = matches.filter(
            (m) => m.case.outcome.includes('liable') || m.case.outcome.includes('guilty'),
        ).length;

        const score = enforcedCount / matches.length;

        let assessment;
        if (score > 0.8) assessment = 'High enforceability';
        else if (score > 0.5) assessment = 'Moderate enforceability';
        else assessment = 'Low enforceability';

        return { score, assessment, precedents: matches.length };
    }

    /**
     * Generate clause recommendations
     */
    generateClauseRecommendations(matches) {
        if (matches.length === 0) {
            return ['Consider adding precedent-based clauses', 'Consult recent case law'];
        }

        const recommendations = [];

        if (matches.length > 5) {
            recommendations.push('Strong precedent support for this clause');
        }

        const highSimilarityMatches = matches.filter((m) => m.similarity > 0.8);
        if (highSimilarityMatches.length > 0) {
            recommendations.push('Very similar clauses have been enforced in past cases');
        }

        return recommendations;
    }

    /**
     * Generate similarity reasoning
     */
    generateSimilarityReasoning(case1, case2) {
        const reasons = [];

        const commonArticles = case1.legalBasis.articles.filter((a1) =>
            case2.legalBasis.articles.some((a2) => a2.article === a1.article),
        );

        if (commonArticles.length > 0) {
            reasons.push(`Common legal basis: ${commonArticles.map((a) => a.article).join(', ')}`);
        }

        if (case1.outcome === case2.outcome) {
            reasons.push(`Same outcome: ${case1.outcome}`);
        }

        if (case1.court === case2.court) {
            reasons.push(`Same court: ${case1.court}`);
        }

        return reasons.join('; ');
    }

    /**
     * Initialize mock database with sample Bulgarian cases
     */
    initializeMockDatabase() {
        return [
            {
                id: '1',
                caseNumber: '123/2023',
                court: 'Върховен касационен съд',
                date: new Date('2023-03-15'),
                parties: {
                    plaintiff: 'АД "Примерна компания"',
                    defendant: 'ООД "Друга фирма"',
                    type: 'seller',
                },
                legalBasis: {
                    articles: [
                        { article: 'чл. 15', law: 'ЗЗД' },
                        { article: 'чл. 220', law: 'ТЗ' },
                    ],
                    laws: ['ЗЗД', 'ТЗ'],
                },
                summary:
                    'Дело за неизпълнение на договорни задължения. Продавачът не е доставил стоката в договорения срок.',
                reasoning:
                    'Съдът установи, че ответникът е нарушил договорните условия като не е доставил стоката в 30-дневния срок.',
                decision:
                    'Осъждане на ответника да изплати неустойка в размер на 10% от стойността на сделката.',
                outcome: 'liable',
                keyPoints: ['неизпълнение на договор', 'неустойка', 'срок за доставка'],
                precedentValue: 'high',
                documentUrl: 'https://example.com/case1',
                fullText: 'Пълен текст на решението...',
                tags: ['договор', 'неизпълнение', 'търговско право'],
                lastUpdated: new Date(),
            },
            {
                id: '2',
                caseNumber: '456/2023',
                court: 'Апелативен съд - София',
                date: new Date('2023-05-20'),
                parties: {
                    plaintiff: 'Физическо лице',
                    defendant: 'Застрахователно дружество',
                    type: 'buyer',
                },
                legalBasis: {
                    articles: [{ article: 'чл. 125', law: 'ЗЗД' }],
                    laws: ['ЗЗД', 'Кодекс за застраховане'],
                },
                summary: 'Спор относно застрахователно обезщетение при ДТП.',
                reasoning: 'Застрахователят неправилно е отказал изплащане на обезщетението.',
                decision: 'Осъждане на застрахователя да изплати пълното обезщетение.',
                outcome: 'liable',
                keyPoints: ['застраховка', 'ДТП', 'обезщетение'],
                precedentValue: 'medium',
                documentUrl: 'https://example.com/case2',
                fullText: 'Пълен текст на решението...',
                tags: ['застраховане', 'ДТП', 'обезщетение'],
                lastUpdated: new Date(),
            },
            // More mock cases would be added here
        ];
    }
}

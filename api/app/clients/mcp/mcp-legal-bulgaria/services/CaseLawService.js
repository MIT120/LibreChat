/**
 * Case Law Service for Bulgarian legal research
 * Handles searching, filtering, and analysis of Bulgarian court decisions
 */

import { CaseLaw } from '../models/CaseLaw.js';
import { BulgarianLegalParser } from '../utils/BulgarianLegalParser.js';
import { CaseLawFirecrawlService } from './CaseLawFirecrawlService.js';
import { RagIntegrationService } from './RagIntegrationService.js';

export class CaseLawService {
  constructor() {
    this.parser = new BulgarianLegalParser();
    this.firecrawlService = new CaseLawFirecrawlService();
    this.ragService = new RagIntegrationService();
    // Keep mock database for fallback
    this.mockDatabase = this.initializeMockDatabase();
  }

  /**
   * Enhanced search case law with Firecrawl and RAG integration
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
        useFirecrawl = true,
        useRag = true,
        saveToRag = true,
      } = criteria;

      console.log('🔍 Starting enhanced case law search...');

      let allResults = [];
      let searchMethods = [];

      // 1. First check RAG database for existing cases
      if (useRag && process.env.RAG_API_URL) {
        try {
          console.log('📚 Searching RAG database...');
          const ragQuery = this.buildRagQuery(criteria);
          const ragResults = await this.ragService.queryLegalDocuments(
            ragQuery,
            limit,
            0.7, // minimum similarity score
          );

          if (ragResults.success && ragResults.results.length > 0) {
            console.log(`✅ Found ${ragResults.results.length} cases in RAG database`);
            allResults.push(...this.convertRagResultsToCaseLaw(ragResults.results));
            searchMethods.push('RAG Database');
          }
        } catch (error) {
          console.warn('⚠️ RAG search failed, continuing with live search:', error.message);
        }
      }

      // 2. If we don't have enough results, use Firecrawl for live scraping
      const remainingLimit = Math.max(0, limit - allResults.length);
      if (remainingLimit > 0 && useFirecrawl && process.env.FIRECRAWL_API_KEY) {
        try {
          console.log('🔥 Performing live case law scraping with Firecrawl...');
          const firecrawlResults = await this.firecrawlService.searchAndScrapeCaseLaw({
            ...criteria,
            limit: remainingLimit,
            saveToRag,
          });

          if (firecrawlResults.success && firecrawlResults.results.length > 0) {
            console.log(`✅ Found ${firecrawlResults.results.length} cases via Firecrawl`);
            allResults.push(...firecrawlResults.results);
            searchMethods.push('Firecrawl Live Scraping');
          }
        } catch (error) {
          console.warn('⚠️ Firecrawl search failed, falling back to mock data:', error.message);
        }
      }

      // 3. Fallback to mock database if needed
      if (allResults.length === 0) {
        console.log('📋 Using mock database as fallback...');
        allResults = this.searchMockDatabase(criteria);
        searchMethods.push('Mock Database');
      }

      // Remove duplicates and sort
      const uniqueResults = this.removeDuplicateCases(allResults);
      const sortedResults = this.sortCasesByRelevance(uniqueResults, criteria);
      const finalResults = sortedResults.slice(0, limit);

      return {
        results: finalResults,
        total: finalResults.length,
        criteria: criteria,
        searchMethods: searchMethods,
        ragResultsCount: searchMethods.includes('RAG Database')
          ? Math.min(finalResults.length, limit / 2)
          : 0,
        liveScrapingCount: searchMethods.includes('Firecrawl Live Scraping')
          ? finalResults.length - (searchMethods.includes('RAG Database') ? limit / 2 : 0)
          : 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Enhanced case law search failed: ${error.message}`);
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
   * Build RAG query from search criteria
   */
  buildRagQuery(criteria) {
    const queryParts = [];

    if (criteria.articles && criteria.articles.length > 0) {
      queryParts.push(`articles: ${criteria.articles.join(', ')}`);
    }

    if (criteria.laws && criteria.laws.length > 0) {
      queryParts.push(`laws: ${criteria.laws.join(', ')}`);
    }

    if (criteria.keywords && criteria.keywords.length > 0) {
      queryParts.push(criteria.keywords.join(' '));
    }

    if (criteria.parties && criteria.parties.length > 0) {
      queryParts.push(`parties: ${criteria.parties.join(', ')}`);
    }

    if (criteria.outcome) {
      queryParts.push(`outcome: ${criteria.outcome}`);
    }

    return queryParts.join(' ');
  }

  /**
   * Convert RAG results to CaseLaw objects
   */
  convertRagResultsToCaseLaw(ragResults) {
    return ragResults
      .map((result) => {
        try {
          // Extract case data from RAG result
          const metadata = result.metadata || {};

          const caseData = {
            id: result.id || `rag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: 'rag_database',
            caseNumber: metadata.caseNumber || '',
            court: metadata.court || '',
            date: metadata.date ? new Date(metadata.date) : null,
            parties: metadata.parties || { plaintiff: '', defendant: '', type: '' },
            legalBasis: metadata.legalBasis || { articles: [], laws: [], regulations: [] },
            summary: this.extractSummaryFromContent(result.content),
            reasoning: this.extractReasoningFromContent(result.content),
            decision: this.extractDecisionFromContent(result.content),
            outcome: metadata.outcome || '',
            keyPoints: this.extractKeyPointsFromContent(result.content),
            precedentValue: metadata.precedentValue || 'medium',
            documentUrl: result.url || '',
            fullText: result.content || '',
            tags: metadata.tags || [],
            relatedCases: [],
            lastUpdated: new Date(result.updated_at || Date.now()),
            ragScore: result.similarity_score || 0,
          };

          return new CaseLaw(caseData);
        } catch (error) {
          console.warn('Failed to convert RAG result to CaseLaw:', error.message);
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Search mock database (fallback method)
   */
  searchMockDatabase(criteria) {
    const {
      articles = [],
      laws = [],
      parties = [],
      court = '',
      dateFrom = null,
      dateTo = null,
      outcome = '',
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

    return results.map((data) => new CaseLaw(data));
  }

  /**
   * Remove duplicate cases
   */
  removeDuplicateCases(cases) {
    const seen = new Map();
    return cases.filter((caseObj) => {
      const key = `${caseObj.caseNumber}_${caseObj.court}`;
      if (seen.has(key)) return false;
      seen.add(key, true);
      return true;
    });
  }

  /**
   * Sort cases by relevance to search criteria
   */
  sortCasesByRelevance(cases, criteria) {
    return cases
      .map((caseObj) => ({
        case: caseObj,
        score: this.calculateRelevanceScore(caseObj, criteria),
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.case);
  }

  /**
   * Calculate relevance score for a case
   */
  calculateRelevanceScore(caseObj, criteria) {
    let score = 0;

    // RAG similarity score (if available)
    if (caseObj.ragScore) {
      score += caseObj.ragScore * 10;
    }

    // Article matches (high weight)
    if (criteria.articles) {
      for (const article of criteria.articles) {
        if (
          caseObj.legalBasis.articles.some(
            (a) => a.article && a.article.toLowerCase().includes(article.toLowerCase()),
          )
        ) {
          score += 10;
        }
      }
    }

    // Law matches (medium weight)
    if (criteria.laws) {
      for (const law of criteria.laws) {
        if (caseObj.legalBasis.laws.some((l) => l.toLowerCase().includes(law.toLowerCase()))) {
          score += 7;
        }
      }
    }

    // Party type matches
    if (criteria.parties && criteria.parties.length > 0) {
      if (criteria.parties.includes(caseObj.parties.type)) {
        score += 6;
      }
    }

    // Court matches
    if (criteria.court && caseObj.court.toLowerCase().includes(criteria.court.toLowerCase())) {
      score += 3;
    }

    // Outcome matches
    if (criteria.outcome && caseObj.outcome === criteria.outcome) {
      score += 5;
    }

    // Keyword matches
    if (criteria.keywords) {
      const caseText =
        `${caseObj.summary} ${caseObj.reasoning} ${caseObj.keyPoints.join(' ')}`.toLowerCase();
      for (const keyword of criteria.keywords) {
        if (caseText.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }
    }

    // Precedent value bonus
    if (caseObj.precedentValue === 'high') {
      score += 5;
    } else if (caseObj.precedentValue === 'medium') {
      score += 2;
    }

    // Recency bonus
    if (caseObj.date) {
      const daysAgo = (Date.now() - new Date(caseObj.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo < 365) score += 2;
      else if (daysAgo < 365 * 3) score += 1;
    }

    return score;
  }

  /**
   * Extract summary from RAG content
   */
  extractSummaryFromContent(content) {
    const summaryMatch = content.match(/РЕЗЮМЕ:\s*([\s\S]*?)(?=\n\n[А-Я]+:|$)/);
    return summaryMatch
      ? summaryMatch[1].trim().substring(0, 500)
      : content.substring(0, 300) + '...';
  }

  /**
   * Extract reasoning from RAG content
   */
  extractReasoningFromContent(content) {
    const reasoningMatch = content.match(/МОТИВИ:\s*([\s\S]*?)(?=\n\n[А-Я]+:|$)/);
    return reasoningMatch ? reasoningMatch[1].trim() : '';
  }

  /**
   * Extract decision from RAG content
   */
  extractDecisionFromContent(content) {
    const decisionMatch = content.match(/РЕШЕНИЕ:\s*([\s\S]*?)(?=\n\n[А-Я]+:|$)/);
    return decisionMatch ? decisionMatch[1].trim() : '';
  }

  /**
   * Extract key points from RAG content
   */
  extractKeyPointsFromContent(content) {
    const keyPointsMatch = content.match(/КЛЮЧОВИ ТОЧКИ:\s*([\s\S]*?)(?=\n\n[А-Я]+:|$)/);
    if (keyPointsMatch) {
      return keyPointsMatch[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, ''))
        .slice(0, 5);
    }
    return [];
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

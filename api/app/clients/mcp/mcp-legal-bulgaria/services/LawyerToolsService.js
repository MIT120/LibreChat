/**
 * Lawyer Tools Service
 * Specialized tools for Bulgarian lawyers including document analysis,
 * case research, and legal strategy assistance
 */

import { ApisService } from './ApisService.js';
import { LexBgService } from './LexBgService.js';
import { RagIntegrationService } from './RagIntegrationService.js';

export class LawyerToolsService {
  constructor() {
    this.lexBgService = new LexBgService();
    this.apisService = new ApisService();
    this.ragService = new RagIntegrationService();

    // Common Bulgarian legal abbreviations
    this.legalAbbreviations = {
      ЗЗД: 'Закон за задълженията и договорите',
      ТЗ: 'Търговски закон',
      ГПК: 'Граждански процесуален кодекс',
      НПК: 'Наказателно-процесуален кодекс',
      НК: 'Наказателен кодекс',
      КТ: 'Кодекс на труда',
      ДОПК: 'Данъчно-осигурителен процесуален кодекс',
      ЗКПО: 'Закон за кадастъра и имотния регистър',
      ЗСВ: 'Закон за съдебната власт',
      АПК: 'Административнопроцесуален кодекс',
    };

    // Bulgarian court types
    this.courtTypes = {
      районен: 'Районен съд',
      окръжен: 'Окръжен съд',
      апелативен: 'Апелативен съд',
      административен: 'Административен съд',
      военен: 'Военен съд',
      вкс: 'Върховен касационен съд',
      вас: 'Върховен административен съд',
    };
  }

  /**
   * Search Supreme Court of Cassation (VKS) decisions
   * Specialized search for the highest court in Bulgaria
   */
  async searchSupremeCourt(searchCriteria) {
    try {
      const {
        query,
        chamber = 'any', // civil, criminal, commercial
        decisionType = 'any', // cassation, interpretation, unification
        dateRange,
        caseNumber,
        legalArticle,
        maxResults = 15,
      } = searchCriteria;

      // Build enhanced query for Supreme Court
      let enhancedQuery = `Върховен касационен съд ${query}`;

      // Add chamber-specific terms
      if (chamber !== 'any') {
        const chamberTerms = {
          civil: 'гражданска колегия гражданско право',
          criminal: 'наказателна колегия наказателно право',
          commercial: 'търговска колегия търговско право',
        };
        enhancedQuery += ` ${chamberTerms[chamber] || ''}`;
      }

      // Add decision type terms
      if (decisionType !== 'any') {
        const decisionTerms = {
          cassation: 'касационно решение касация',
          interpretation: 'тълкувателно решение тълкуване',
          unification: 'обединително решение обединяване',
        };
        enhancedQuery += ` ${decisionTerms[decisionType] || ''}`;
      }

      // Add case number if provided
      if (caseNumber) {
        enhancedQuery += ` ${caseNumber}`;
      }

      // Add legal article if provided
      if (legalArticle) {
        enhancedQuery += ` ${legalArticle}`;
      }

      // Search parameters
      const searchParams = {
        query: enhancedQuery,
        useRag: true,
        storeResults: true,
        limit: maxResults,
      };

      // Add date filtering if provided
      if (dateRange) {
        if (dateRange.lastYears) {
          const currentYear = new Date().getFullYear();
          searchParams.dateFrom = `${currentYear - dateRange.lastYears}-01-01`;
          searchParams.dateTo = `${currentYear}-12-31`;
        } else {
          if (dateRange.from) searchParams.dateFrom = dateRange.from;
          if (dateRange.to) searchParams.dateTo = dateRange.to;
        }
      }

      // Search using both sources for comprehensive coverage
      const lexResults = await this.lexBgService.searchLegalDocuments(searchParams);
      const apisResults = await this.apisService.searchLegislation(searchParams);

      // Combine and process results
      const combinedResults = this.combineSupremeCourtResults(
        lexResults,
        apisResults,
        searchCriteria,
      );

      return {
        success: true,
        totalResults: combinedResults.length,
        searchQuery: enhancedQuery,
        court: 'Върховен касационен съд',
        chamber: chamber,
        decisionType: decisionType,
        results: combinedResults,
        precedentValue: 'high', // VKS decisions have high precedent value
        metadata: {
          searchDate: new Date().toISOString(),
          sources: ['lex.bg', 'apis.bg'],
          legalSystem: 'Bulgaria',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        court: 'Върховен касационен съд',
        results: [],
      };
    }
  }

  /**
   * Combine and deduplicate Supreme Court results from multiple sources
   */
  combineSupremeCourtResults(lexResults, apisResults, originalCriteria) {
    const combinedResults = [];
    const seenTitles = new Set();

    // Process lex.bg results
    if (lexResults && lexResults.results) {
      for (const result of lexResults.results) {
        if (!seenTitles.has(result.title)) {
          seenTitles.add(result.title);
          combinedResults.push({
            ...result,
            source: 'lex.bg',
            court: 'Върховен касационен съд',
            precedentValue: this.assessPrecedentValue(result, originalCriteria),
            legalSignificance: this.assessLegalSignificance(result),
          });
        }
      }
    }

    // Process APIS results
    if (apisResults && apisResults.results) {
      for (const result of apisResults.results) {
        if (!seenTitles.has(result.title)) {
          seenTitles.add(result.title);
          combinedResults.push({
            ...result,
            source: 'apis.bg',
            court: 'Върховен касационен съд',
            precedentValue: this.assessPrecedentValue(result, originalCriteria),
            legalSignificance: this.assessLegalSignificance(result),
          });
        }
      }
    }

    // Sort by relevance and precedent value
    return combinedResults.sort((a, b) => {
      // Prioritize interpretative decisions (highest precedent value)
      if (a.precedentValue === 'binding' && b.precedentValue !== 'binding') return -1;
      if (b.precedentValue === 'binding' && a.precedentValue !== 'binding') return 1;

      // Then by legal significance
      if (a.legalSignificance !== b.legalSignificance) {
        return b.legalSignificance - a.legalSignificance;
      }

      // Finally by date (newer first)
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }

  /**
   * Assess precedent value of a Supreme Court decision
   */
  assessPrecedentValue(result, _criteria) {
    const title = (result.title || '').toLowerCase();
    const content = (result.content || result.summary || '').toLowerCase();

    // Interpretative decisions are binding
    if (title.includes('тълкувателно') || content.includes('тълкувателно')) {
      return 'binding';
    }

    // Unification decisions resolve conflicts
    if (title.includes('обединително') || content.includes('обединително')) {
      return 'binding';
    }

    // Cassation decisions create important precedents
    if (title.includes('касационно') || content.includes('касационно')) {
      return 'persuasive_high';
    }

    return 'persuasive';
  }

  /**
   * Assess legal significance (1-10 scale)
   */
  assessLegalSignificance(result) {
    let score = 5; // base score

    const title = (result.title || '').toLowerCase();
    const content = (result.content || result.summary || '').toLowerCase();

    // Boost for interpretative decisions
    if (title.includes('тълкувателно') || content.includes('тълкувателно')) {
      score += 3;
    }

    // Boost for unification decisions
    if (title.includes('обединително') || content.includes('обединително')) {
      score += 2;
    }

    // Boost for frequently cited legal articles
    const importantArticles = ['чл. 1', 'чл. 45', 'чл. 220', 'чл. 281'];
    for (const article of importantArticles) {
      if (content.includes(article)) {
        score += 1;
        break;
      }
    }

    // Boost for recent decisions
    if (result.date) {
      const decisionYear = new Date(result.date).getFullYear();
      const currentYear = new Date().getFullYear();
      if (currentYear - decisionYear <= 2) {
        score += 1;
      }
    }

    return Math.min(score, 10);
  }

  /**
   * Comprehensive legal research combining multiple sources
   */
  async comprehensiveLegalResearch(query, options = {}) {
    try {
      const {
        includeLegislation = true,
        includeCaselaw = true,
        includeNews = true,
        includeEULaw = false,
        maxResults = 50,
      } = options;

      const results = {
        legislation: [],
        caselaw: [],
        news: [],
        euLaw: [],
        summary: '',
        sources: [],
      };

      const promises = [];

      // Search АПИС for legislation
      if (includeLegislation) {
        promises.push(
          this.apisService
            .searchLegislation({
              query,
              database: 'law',
              limit: Math.floor(maxResults * 0.4),
            })
            .then((res) => ({ type: 'legislation', data: res })),
        );
      }

      // Search lex.bg for case law and documents
      if (includeCaselaw) {
        promises.push(
          this.lexBgService
            .searchLegalDocuments({
              query,
              limit: Math.floor(maxResults * 0.3),
            })
            .then((res) => ({ type: 'caselaw', data: res })),
        );
      }

      // Search for legal news and updates
      if (includeNews) {
        promises.push(
          this.lexBgService
            .getLegalNews({
              limit: Math.floor(maxResults * 0.2),
            })
            .then((res) => ({ type: 'news', data: res })),
        );

        promises.push(
          this.apisService
            .getLatestUpdates('law', Math.floor(maxResults * 0.1))
            .then((res) => ({ type: 'updates', data: res })),
        );
      }

      // Search EU law if requested
      if (includeEULaw) {
        promises.push(
          this.apisService
            .searchEULaw(query, Math.floor(maxResults * 0.1))
            .then((res) => ({ type: 'euLaw', data: res })),
        );
      }

      // Execute all searches in parallel
      const searchResults = await Promise.allSettled(promises);

      // Process results
      for (const result of searchResults) {
        if (result.status === 'fulfilled' && result.value.data.success) {
          const { type, data } = result.value;

          switch (type) {
            case 'legislation':
              results.legislation = data.results || [];
              break;
            case 'caselaw':
              results.caselaw = data.results || [];
              break;
            case 'news':
              results.news = data.news || [];
              break;
            case 'updates':
              results.news = [...(results.news || []), ...(data.updates || [])];
              break;
            case 'euLaw':
              results.euLaw = data.results || [];
              break;
          }
        }
      }

      // Generate summary
      results.summary = this.generateResearchSummary(query, results);
      results.sources = this.extractSources(results);

      return {
        success: true,
        query,
        results,
        totalItems: this.countTotalItems(results),
      };
    } catch (error) {
      console.error('Error in comprehensive legal research:', error);
      return {
        success: false,
        error: error.message,
        results: {},
      };
    }
  }

  /**
   * Analyze legal document for compliance and risks
   */
  async analyzeLegalDocument(documentText, analysisType = 'general') {
    try {
      const analysis = {
        documentType: this.identifyDocumentType(documentText),
        legalReferences: this.extractLegalReferences(documentText),
        keyTerms: this.extractKeyLegalTerms(documentText),
        riskAssessment: await this.assessDocumentRisks(documentText),
        complianceCheck: this.checkCompliance(documentText),
        recommendations: [],
        relatedCases: [],
      };

      // Find related case law based on legal references
      if (analysis.legalReferences.length > 0) {
        analysis.relatedCases = await this.findRelatedCaselaw(analysis.legalReferences);
      }

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);

      return {
        success: true,
        analysis,
        confidence: this.calculateAnalysisConfidence(analysis),
      };
    } catch (error) {
      console.error('Error analyzing legal document:', error);
      return {
        success: false,
        error: error.message,
        analysis: null,
      };
    }
  }

  /**
   * Generate case strategy based on similar cases
   */
  async generateCaseStrategy(caseDetails) {
    try {
      const {
        caseType,
        legalBasis = [],
        facts = '',
        desiredOutcome = '',
        timeline = '',
      } = caseDetails;

      // Search for similar cases
      const similarCases = await this.findSimilarCases(caseDetails);

      // Analyze precedents
      const precedentAnalysis = this.analyzePrecedents(similarCases);

      // Generate strategy
      const strategy = {
        legalArguments: this.buildLegalArguments(legalBasis, precedentAnalysis),
        procedureSteps: this.recommendProcedureSteps(caseType),
        riskFactors: this.identifyRiskFactors(caseDetails, precedentAnalysis),
        timeline: this.estimateTimeline(caseType, timeline),
        successProbability: this.calculateSuccessProbability(precedentAnalysis),
        requiredDocuments: this.identifyRequiredDocuments(caseType),
        strategicRecommendations: this.generateStrategicRecommendations(precedentAnalysis),
      };

      return {
        success: true,
        strategy,
        similarCases: similarCases.slice(0, 10), // Top 10 similar cases
        confidence: precedentAnalysis.confidence,
      };
    } catch (error) {
      console.error('Error generating case strategy:', error);
      return {
        success: false,
        error: error.message,
        strategy: null,
      };
    }
  }

  /**
   * Monitor legal changes relevant to practice areas
   */
  async monitorLegalChanges(practiceAreas = [], keywords = []) {
    try {
      const changes = {
        legislation: [],
        caselaw: [],
        regulations: [],
        alerts: [],
      };

      const searchTerms = [...practiceAreas, ...keywords];

      for (const term of searchTerms) {
        // Get recent updates from АПИС
        const apisUpdates = await this.apisService.getLatestUpdates('law', 5);
        if (apisUpdates.success) {
          changes.legislation.push(...apisUpdates.updates);
        }

        // Get legal news from lex.bg
        const lexNews = await this.lexBgService.getLegalNews({ limit: 5 });
        if (lexNews.success) {
          changes.caselaw.push(...lexNews.news);
        }
      }

      // Remove duplicates and prioritize
      changes.legislation = this.deduplicateAndPrioritize(changes.legislation);
      changes.caselaw = this.deduplicateAndPrioritize(changes.caselaw);

      // Generate alerts for important changes
      changes.alerts = this.generateChangeAlerts(changes, practiceAreas);

      return {
        success: true,
        changes,
        practiceAreas,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error monitoring legal changes:', error);
      return {
        success: false,
        error: error.message,
        changes: {},
      };
    }
  }

  /**
   * Generate client advice based on legal research
   */
  async generateClientAdvice(clientSituation) {
    try {
      const {
        situation = '',
        legalQuestions = [],
        urgency = 'normal',
        clientType = 'individual',
      } = clientSituation;

      // Research relevant legal framework
      const research = await this.comprehensiveLegalResearch(situation, {
        maxResults: 30,
      });

      // Analyze legal options
      const legalOptions = this.analyzeLegalOptions(situation, research.results);

      // Generate advice
      const advice = {
        summary: this.generateAdviceSummary(situation, legalOptions),
        legalOptions: legalOptions,
        recommendedActions: this.recommendActions(legalOptions, urgency),
        timeframes: this.estimateTimeframes(legalOptions),
        costs: this.estimateCosts(legalOptions, clientType),
        risks: this.identifyRisks(legalOptions),
        documents: this.listRequiredDocuments(legalOptions),
        nextSteps: this.recommendNextSteps(legalOptions, urgency),
      };

      return {
        success: true,
        advice,
        research: research.results,
        confidence: this.calculateAdviceConfidence(advice, research),
      };
    } catch (error) {
      console.error('Error generating client advice:', error);
      return {
        success: false,
        error: error.message,
        advice: null,
      };
    }
  }

  // Helper methods

  identifyDocumentType(text) {
    const text_lower = text.toLowerCase();
    if (text_lower.includes('договор')) return 'contract';
    if (text_lower.includes('решение') && text_lower.includes('съд')) return 'court_decision';
    if (text_lower.includes('закон')) return 'law';
    if (text_lower.includes('наредба')) return 'regulation';
    if (text_lower.includes('заповед')) return 'court_order';
    return 'unknown';
  }

  extractLegalReferences(text) {
    const references = [];

    // Extract article references (чл. 123, член 45, etc.)
    const articleRegex = /(?:чл\.|член)\s*(\d+)/gi;
    let match;
    while ((match = articleRegex.exec(text)) !== null) {
      references.push({
        type: 'article',
        number: match[1],
        context: text.substring(Math.max(0, match.index - 50), match.index + 50),
      });
    }

    // Extract law references
    for (const [abbr, fullName] of Object.entries(this.legalAbbreviations)) {
      if (text.includes(abbr)) {
        references.push({
          type: 'law',
          abbreviation: abbr,
          fullName: fullName,
        });
      }
    }

    return references;
  }

  extractKeyLegalTerms(text) {
    const legalTerms = [
      'договор',
      'задължение',
      'права',
      'отговорност',
      'неустойка',
      'възнаграждение',
      'срок',
      'условие',
      'гаранция',
      'обезщетение',
      'наказание',
      'санкция',
      'процедура',
      'производство',
      'съд',
      'съдия',
      'адвокат',
      'прокурор',
      'ищец',
      'ответник',
      'свидетел',
    ];

    const foundTerms = [];
    const text_lower = text.toLowerCase();

    for (const term of legalTerms) {
      if (text_lower.includes(term)) {
        foundTerms.push(term);
      }
    }

    return foundTerms;
  }

  async assessDocumentRisks(text) {
    const risks = {
      high: [],
      medium: [],
      low: [],
    };

    // High risk indicators
    if (text.toLowerCase().includes('неустойка')) {
      risks.high.push('Penalty clause detected - review amount and conditions');
    }
    if (text.toLowerCase().includes('безусловно задължение')) {
      risks.high.push('Unconditional obligation - ensure feasibility');
    }

    // Medium risk indicators
    if (text.toLowerCase().includes('гаранция')) {
      risks.medium.push('Guarantee clause - verify scope and duration');
    }

    // Low risk indicators
    if (text.toLowerCase().includes('право на откуп')) {
      risks.low.push('Right of redemption clause - standard provision');
    }

    return risks;
  }

  checkCompliance(text) {
    const compliance = {
      passed: [],
      failed: [],
      warnings: [],
    };

    // Basic compliance checks for Bulgarian legal documents
    if (text.includes('ЕГН') || text.includes('ЕИК')) {
      compliance.passed.push('Contains proper identification numbers');
    } else {
      compliance.warnings.push('Missing identification numbers');
    }

    return compliance;
  }

  async findRelatedCaselaw(legalReferences) {
    const relatedCases = [];

    for (const ref of legalReferences) {
      if (ref.type === 'article' && ref.number) {
        try {
          const searchResult = await this.lexBgService.searchLegalDocuments({
            query: `чл. ${ref.number}`,
            limit: 3,
          });

          if (searchResult.success) {
            relatedCases.push(...searchResult.results);
          }
        } catch (error) {
          console.warn('Error finding related caselaw:', error.message);
        }
      }
    }

    return relatedCases.slice(0, 10); // Limit to top 10
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.riskAssessment.high.length > 0) {
      recommendations.push('High risk factors identified - legal review recommended');
    }

    if (analysis.legalReferences.length > 5) {
      recommendations.push('Complex legal framework - consider specialized consultation');
    }

    if (analysis.complianceCheck.failed.length > 0) {
      recommendations.push('Compliance issues detected - revisions needed');
    }

    return recommendations;
  }

  calculateAnalysisConfidence(analysis) {
    let confidence = 0.5; // Base confidence

    if (analysis.legalReferences.length > 0) confidence += 0.2;
    if (analysis.keyTerms.length > 5) confidence += 0.2;
    if (analysis.complianceCheck.passed.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  async findSimilarCases(caseDetails) {
    try {
      const searchQuery = `${caseDetails.caseType} ${caseDetails.facts}`.substring(0, 100);

      const lexResults = await this.lexBgService.searchLegalDocuments({
        query: searchQuery,
        limit: 15,
      });

      return lexResults.success ? lexResults.results : [];
    } catch (error) {
      console.warn('Error finding similar cases:', error.message);
      return [];
    }
  }

  generateResearchSummary(query, results) {
    const total = this.countTotalItems(results);
    return `Research for "${query}" found ${total} relevant items including ${results.legislation.length} legislative documents, ${results.caselaw.length} cases, and ${results.news.length} news items.`;
  }

  extractSources(results) {
    const sources = new Set();

    ['legislation', 'caselaw', 'news', 'euLaw'].forEach((category) => {
      if (results[category]) {
        results[category].forEach((item) => {
          if (item.source) sources.add(item.source);
        });
      }
    });

    return Array.from(sources);
  }

  countTotalItems(results) {
    return (
      (results.legislation?.length || 0) +
      (results.caselaw?.length || 0) +
      (results.news?.length || 0) +
      (results.euLaw?.length || 0)
    );
  }

  deduplicateAndPrioritize(items) {
    const seen = new Set();
    const unique = [];

    for (const item of items) {
      const key = (item.title || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    // Sort by date (newest first)
    return unique.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
  }

  generateChangeAlerts(changes, practiceAreas) {
    const alerts = [];

    // High-priority alerts for significant changes
    changes.legislation.forEach((item) => {
      if (
        item.title.toLowerCase().includes('изменение') ||
        item.title.toLowerCase().includes('нов')
      ) {
        alerts.push({
          type: 'legislation_change',
          priority: 'high',
          title: item.title,
          url: item.url,
          relevantAreas: practiceAreas.filter((area) =>
            item.title.toLowerCase().includes(area.toLowerCase()),
          ),
        });
      }
    });

    return alerts;
  }

  analyzeLegalOptions(situation, results) {
    // Simplified legal options analysis
    return [
      {
        option: 'Direct negotiation',
        viability: 'high',
        cost: 'low',
        timeframe: 'short',
        risks: ['No legal protection'],
        benefits: ['Quick resolution', 'Low cost'],
      },
      {
        option: 'Mediation',
        viability: 'medium',
        cost: 'medium',
        timeframe: 'medium',
        risks: ['Not binding'],
        benefits: ['Preserves relationships', 'Confidential'],
      },
      {
        option: 'Court proceedings',
        viability: 'medium',
        cost: 'high',
        timeframe: 'long',
        risks: ['Uncertain outcome', 'Public record'],
        benefits: ['Binding decision', 'Legal precedent'],
      },
    ];
  }

  generateAdviceSummary(situation, options) {
    return `Based on the legal analysis, there are ${options.length} potential approaches to address your situation. The recommended path depends on your priorities regarding time, cost, and desired outcomes.`;
  }

  recommendActions(options, urgency) {
    if (urgency === 'urgent') {
      return ['Immediate consultation', 'Document preservation', 'Interim measures'];
    }
    return ['Gather documentation', 'Consider all options', 'Prepare strategy'];
  }

  calculateAdviceConfidence(advice, research) {
    const researchQuality = research.legislation.length + research.caselaw.length;
    return Math.min(0.3 + researchQuality * 0.05, 0.95);
  }

  // Additional placeholder methods for completeness
  analyzePrecedents(cases) {
    return { confidence: 0.7, patterns: [] };
  }
  buildLegalArguments(basis, analysis) {
    return [];
  }
  recommendProcedureSteps(type) {
    return [];
  }
  identifyRiskFactors(details, analysis) {
    return [];
  }
  estimateTimeline(type, timeline) {
    return '6-12 months';
  }
  calculateSuccessProbability(analysis) {
    return 0.6;
  }
  identifyRequiredDocuments(type) {
    return [];
  }
  generateStrategicRecommendations(analysis) {
    return [];
  }
  estimateTimeframes(options) {
    return {};
  }
  estimateCosts(options, type) {
    return {};
  }
  identifyRisks(options) {
    return [];
  }
  listRequiredDocuments(options) {
    return [];
  }
  recommendNextSteps(options, urgency) {
    return [];
  }
}

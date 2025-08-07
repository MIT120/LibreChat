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

      // Build precise legal query using enhanced methods
      const enhancedQuery = this.buildPreciseLegalQuery({
        baseQuery: query,
        court: 'ВКС',
        chamber,
        decisionType,
        legalArticle,
        caseNumber,
        partyLiability: searchCriteria.partyLiability,
        contractClause: searchCriteria.contractClause,
        legalOutcome: searchCriteria.legalOutcome,
      });

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

      // Search using both sources for comprehensive coverage with deep analysis
      const lexResults = await this.lexBgService.searchLegalDocuments({
        ...searchParams,
        deepAnalysis: true, // Enable deep content scraping
        relevanceThreshold: 70,
      });
      const apisResults = await this.apisService.searchLegislation(searchParams);

      // Combine initial results
      const combinedResults = this.combineSupremeCourtResults(
        lexResults,
        apisResults,
        searchCriteria,
      );

      // Apply advanced legal filtering for accuracy
      const filteredResults = this.applyAdvancedLegalFiltering(combinedResults, searchCriteria);

      // Rank by legal relevance for lawyers
      const rankedResults = this.rankByLegalRelevance(filteredResults, searchCriteria);

      return {
        success: true,
        totalResults: rankedResults.length,
        filteredResults: rankedResults.length, // Results after filtering
        originalResults: combinedResults.length, // Results before filtering
        searchQuery: enhancedQuery,
        court: 'Върховен касационен съд',
        chamber,
        decisionType,
        results: rankedResults.slice(0, maxResults),
        precedentValue: 'high', // VKS decisions have high precedent value
        searchAccuracy: this.calculateSearchAccuracy(rankedResults, searchCriteria),
        legalRelevanceScore: this.calculateLegalRelevance(rankedResults),
        metadata: {
          searchDate: new Date().toISOString(),
          sources: ['lex.bg', 'apis.bg', 'vks.bg'],
          legalSystem: 'Bulgaria',
          queryComplexity: this.assessQueryComplexity(searchCriteria),
          resultsFreshness: this.assessResultsFreshness(rankedResults),
          filteringApplied: true,
          accuracyEnhanced: true,
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

  // ===== ENHANCED LEGAL SEARCH ACCURACY METHODS =====

  /**
   * Enhanced precise legal query building with Bulgarian legal terminology
   */
  buildPreciseLegalQuery({
    baseQuery,
    court = 'ВКС',
    chamber,
    decisionType,
    legalArticle,
    caseNumber,
    partyLiability,
    contractClause,
    legalOutcome,
  }) {
    let query = `${court} ${baseQuery}`;

    // Add chamber-specific legal terminology
    if (chamber !== 'any') {
      const chamberTerms = {
        civil: 'гражданска колегия гражданско дело граждански спор договор',
        criminal: 'наказателна колегия наказателно дело престъпление НК',
        commercial: 'търговска колегия търговско дело търговски спор ТЗ',
      };
      query += ` ${chamberTerms[chamber]}`;
    }

    // Add precise decision type terminology
    if (decisionType !== 'any') {
      const decisionTerms = {
        cassation: 'касационно решение касационна жалба отмяна потвърждаване',
        interpretation: 'тълкувателно решение тълкуване принципно значение',
        unification: 'обединително решение обединяване противоречива практика',
      };
      query += ` ${decisionTerms[decisionType]}`;
    }

    // Add legal article with variations
    if (legalArticle) {
      const articleVariations = this.generateArticleVariations(legalArticle);
      query += ` ${articleVariations.join(' ')}`;
    }

    // Add party liability terms (NEW - Critical for lawyer queries)
    if (partyLiability) {
      const liabilityTerms = {
        seller_liable: 'продавач отговорен виновен задължен обезщетение скрити недостатъци',
        buyer_liable: 'купувач отговорен виновен задължен неплащане нарушение',
        plaintiff_wins: 'иск уважен присъдил в полза на ищеца възстановяване',
        defendant_wins: 'иск отхвърлен ответник оправдан основателен',
        partial_liability: 'частична отговорност частично уважаване намаление',
      };
      query += ` ${liabilityTerms[partyLiability] || partyLiability}`;
    }

    // Add contract clause specifics (NEW)
    if (contractClause) {
      query += ` "${contractClause}" клауза условие договорено уговорено`;
    }

    // Add legal outcome terms (NEW)
    if (legalOutcome) {
      const outcomeTerms = {
        upheld: 'потвърдено запазено в сила',
        overturned: 'отменено отхвърлено изменено касирано',
        remanded: 'върнато нов разглед допълнително разследване',
        settled: 'споразумение мирно решение извънсъдебно',
      };
      query += ` ${outcomeTerms[legalOutcome] || legalOutcome}`;
    }

    return query.trim();
  }

  /**
   * Generate Bulgarian legal article variations for precise matching
   */
  generateArticleVariations(article) {
    const variations = [article];

    // Add common Bulgarian legal article formats
    if (article.includes('чл.')) {
      variations.push(article.replace('чл.', 'член'));
      variations.push(article.replace('чл.', 'чл'));
      variations.push(article.replace('чл.', 'Член')); // Capitalized
    }

    // Add law abbreviation expansions for precision
    const lawExpansions = {
      ГК: ['Гражданския кодекс', 'граждански кодекс', 'ГрК'],
      ТЗ: ['Търговския закон', 'търговски закон'],
      НК: ['Наказателния кодекс', 'наказателен кодекс'],
      ГПК: ['Гражданския процесуален кодекс', 'ГрПК'],
      НПК: ['Наказателно-процесуалния кодекс'],
      КТ: ['Кодекса на труда', 'трудов кодекс'],
      ЗЗД: ['Закона за защита на данните', 'ЗЗЛД'],
      ЗСПЗЗ: ['Закона за специалните залози', 'залог'],
    };

    Object.entries(lawExpansions).forEach(([abbrev, expansions]) => {
      if (article.includes(abbrev)) {
        expansions.forEach((expansion) => {
          variations.push(article.replace(abbrev, expansion));
        });
      }
    });

    return variations;
  }

  /**
   * Advanced filtering based on legal criteria for accuracy
   */
  applyAdvancedLegalFiltering(results, criteria) {
    return results.filter((result) => {
      // Filter by legal article match precision
      if (criteria.legalArticle && !this.hasAccurateLegalArticle(result, criteria.legalArticle)) {
        return false;
      }

      // Filter by party liability if specified (CRITICAL for lawyers)
      if (criteria.partyLiability && !this.matchesPartyLiability(result, criteria.partyLiability)) {
        return false;
      }

      // Filter by contract clause presence
      if (
        criteria.contractClause &&
        !this.containsContractClause(result, criteria.contractClause)
      ) {
        return false;
      }

      // Filter by decision currency (prefer recent decisions)
      if (!this.isRecentEnough(result, criteria.dateRange)) {
        return false;
      }

      // Filter by VKS authenticity
      if (!this.isAuthenticVKSDecision(result)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if result contains accurate legal article reference
   */
  hasAccurateLegalArticle(result, article) {
    const variations = this.generateArticleVariations(article);
    const text = `${result.title} ${result.content || result.summary || ''}`.toLowerCase();

    return variations.some(
      (variation) =>
        text.includes(variation.toLowerCase()) || this.fuzzyMatchLegalArticle(text, variation),
    );
  }

  /**
   * Fuzzy matching for legal articles with common Bulgarian variations
   */
  fuzzyMatchLegalArticle(text, article) {
    const cleanArticle = article.replace(/[^\w\d]/g, '').toLowerCase();
    const cleanText = text.replace(/[^\w\d]/g, '').toLowerCase();

    // Check for article number patterns
    const articleNum = article.match(/\d+/)?.[0];
    if (articleNum && text.includes(articleNum)) {
      // Also check for law reference nearby
      const lawPattern = article.match(/(ГК|ТЗ|НК|ГПК|НПК|КТ)/)?.[0];
      if (lawPattern && text.includes(lawPattern.toLowerCase())) {
        return true;
      }
    }

    return cleanText.includes(cleanArticle);
  }

  /**
   * Check party liability matching - CRITICAL for lawyer queries
   */
  matchesPartyLiability(result, liability) {
    const text = `${result.title} ${result.content || result.summary || ''}`.toLowerCase();

    const liabilityPatterns = {
      seller_liable: [
        'продавач.*отговор',
        'продавач.*виновен',
        'продавач.*задължен',
        'продавач.*възстанов',
        'продавач.*обезщет',
        'продавач.*плат',
      ],
      buyer_liable: [
        'купувач.*отговор',
        'купувач.*виновен',
        'купувач.*задължен',
        'купувач.*възстанов',
        'купувач.*обезщет',
        'купувач.*плат',
      ],
      plaintiff_wins: [
        'иск.*уважен',
        'в полза на ищеца',
        'присъди',
        'ищецът.*прав',
        'основателен.*иск',
        'възстанов.*иск',
      ],
      defendant_wins: [
        'иск.*отхвърлен',
        'ответник.*оправдан',
        'неоснователен.*иск',
        'не.*основател',
        'отхвърл.*искане',
      ],
      partial_liability: [
        'частична.*отговорност',
        'частично.*уважаване',
        'намален.*размер',
        'частично.*възстанов',
      ],
    };

    const patterns = liabilityPatterns[liability] || [liability];
    return patterns.some((pattern) => new RegExp(pattern, 'i').test(text));
  }

  /**
   * Check contract clause presence with fuzzy matching
   */
  containsContractClause(result, clause) {
    const text = `${result.title} ${result.content || result.summary || ''}`.toLowerCase();
    const cleanClause = clause.toLowerCase();

    return (
      text.includes(cleanClause) ||
      text.includes(`"${cleanClause}"`) ||
      this.fuzzyMatchClause(text, cleanClause)
    );
  }

  /**
   * Fuzzy matching for contract clauses
   */
  fuzzyMatchClause(text, clause) {
    const words = clause.split(/\s+/);
    const threshold = Math.ceil(words.length * 0.7); // 70% word match threshold

    let matches = 0;
    words.forEach((word) => {
      if (word.length > 3 && text.includes(word)) {
        matches++;
      }
    });

    return matches >= threshold;
  }

  /**
   * Check decision recency for current legal relevance
   */
  isRecentEnough(result, dateRange) {
    if (!dateRange) return true;

    const resultDate = this.parseResultDate(result);
    if (!resultDate) return true; // Include if date unclear

    if (dateRange.lastYears) {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - dateRange.lastYears);
      return resultDate >= cutoffDate;
    }

    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      if (resultDate < fromDate) return false;
    }

    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      if (resultDate > toDate) return false;
    }

    return true;
  }

  /**
   * Parse result date from various Bulgarian formats
   */
  parseResultDate(result) {
    const dateStr = result.date || result.datePublished || '';
    if (!dateStr) return null;

    // Handle Bulgarian date formats
    const bgDatePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    const isoDatePattern = /(\d{4})-(\d{1,2})-(\d{1,2})/;

    let match = dateStr.match(bgDatePattern);
    if (match) {
      return new Date(match[3], match[2] - 1, match[1]); // Bulgarian: DD.MM.YYYY
    }

    match = dateStr.match(isoDatePattern);
    if (match) {
      return new Date(match[1], match[2] - 1, match[3]); // ISO: YYYY-MM-DD
    }

    return new Date(dateStr); // Fallback to standard parsing
  }

  /**
   * Verify authentic VKS decision
   */
  isAuthenticVKSDecision(result) {
    const indicators = [
      'върховен касационен съд',
      'вкс',
      'касационно решение',
      'тълкувателно решение',
      'обединително решение',
      'гражданска колегия',
      'наказателна колегия',
      'търговска колегия',
    ];

    const text = `${result.title} ${result.source || ''} ${result.summary || ''}`.toLowerCase();

    return (
      indicators.some((indicator) => text.includes(indicator)) ||
      this.isFromOfficialVKSSource(result)
    );
  }

  /**
   * Check if result is from official VKS sources
   */
  isFromOfficialVKSSource(result) {
    const officialSources = ['vks.bg', 'lex.bg', 'apis.bg', 'dv.parliament.bg'];

    return officialSources.some(
      (source) => result.url?.includes(source) || result.source?.toLowerCase().includes(source),
    );
  }

  /**
   * Rank results by legal relevance for lawyers
   */
  rankByLegalRelevance(results, criteria) {
    return results.sort((a, b) => {
      let scoreA = this.calculateLegalRelevanceScore(a, criteria);
      let scoreB = this.calculateLegalRelevanceScore(b, criteria);

      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Calculate legal relevance score based on multiple factors
   */
  calculateLegalRelevanceScore(result, criteria) {
    let score = 0;

    // Legal article accuracy (30%)
    if (criteria.legalArticle && this.hasAccurateLegalArticle(result, criteria.legalArticle)) {
      score += 30;
    }

    // Party liability match (25%) - CRITICAL for lawyers
    if (criteria.partyLiability && this.matchesPartyLiability(result, criteria.partyLiability)) {
      score += 25;
    }

    // Court authenticity (20%)
    if (this.isAuthenticVKSDecision(result)) {
      score += 20;
    }

    // Precedent value (15%)
    if (result.precedentValue === 'binding') {
      score += 15;
    } else if (result.precedentValue === 'persuasive_high') {
      score += 10;
    } else if (result.precedentValue === 'persuasive') {
      score += 5;
    }

    // Recency bonus (10%)
    const resultDate = this.parseResultDate(result);
    if (resultDate) {
      const daysSince = (new Date() - resultDate) / (1000 * 60 * 60 * 24);
      if (daysSince < 365)
        score += 10; // Last year
      else if (daysSince < 365 * 3) score += 5; // Last 3 years
    }

    return score;
  }

  /**
   * Calculate overall search accuracy for quality assessment
   */
  calculateSearchAccuracy(results, criteria) {
    if (results.length === 0) return 0;

    let totalScore = 0;
    results.forEach((result) => {
      totalScore += this.calculateLegalRelevanceScore(result, criteria);
    });

    const averageScore = totalScore / results.length;
    return Math.round(averageScore); // Return as percentage
  }

  /**
   * Calculate legal relevance for the entire result set
   */
  calculateLegalRelevance(results) {
    if (results.length === 0) return 0;

    const highQualityResults = results.filter(
      (result) =>
        this.isAuthenticVKSDecision(result) &&
        (result.precedentValue === 'binding' || result.precedentValue === 'persuasive_high'),
    );

    return Math.round((highQualityResults.length / results.length) * 100);
  }

  /**
   * Assess query complexity for search optimization
   */
  assessQueryComplexity(criteria) {
    let complexity = 'simple';
    let factors = 0;

    if (criteria.legalArticle) factors++;
    if (criteria.partyLiability) factors++;
    if (criteria.contractClause) factors++;
    if (criteria.dateRange) factors++;
    if (criteria.chamber !== 'any') factors++;
    if (criteria.decisionType !== 'any') factors++;

    if (factors >= 4) complexity = 'complex';
    else if (factors >= 2) complexity = 'moderate';

    return complexity;
  }

  /**
   * Assess results freshness for legal currency
   */
  assessResultsFreshness(results) {
    if (results.length === 0) return 'no_data';

    const currentYear = new Date().getFullYear();
    const recentResults = results.filter((result) => {
      const resultDate = this.parseResultDate(result);
      return resultDate && resultDate.getFullYear() >= currentYear - 2;
    });

    const freshnessPct = (recentResults.length / results.length) * 100;

    if (freshnessPct >= 70) return 'very_fresh';
    if (freshnessPct >= 40) return 'fresh';
    if (freshnessPct >= 20) return 'moderate';
    return 'dated';
  }
}

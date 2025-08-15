/**
 * Enhanced Case Law Scraping Service with Firecrawl Integration
 * Provides intelligent scraping of Bulgarian court websites for case law
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { CaseLaw } from '../models/CaseLaw.js';
import { RagIntegrationService } from './RagIntegrationService.js';
import { BulgarianLegalParser } from '../utils/BulgarianLegalParser.js';

export class CaseLawFirecrawlService {
  constructor() {
    this.firecrawlApiUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    this.ragService = new RagIntegrationService();
    this.parser = new BulgarianLegalParser();
    
    // Bulgarian court websites and their patterns
    this.courtSources = {
      vks: {
        url: 'https://www.vks.bg',
        searchPath: '/search',
        patterns: {
          caseNumber: /дело\s*№?\s*([№\d\/\-А-Я]+)/gi,
          court: /съд[:\s]*([^,\n]+)/gi,
          date: /(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{4})/g
        }
      },
      vas: {
        url: 'https://www.sac.government.bg',
        searchPath: '/search',
        patterns: {
          caseNumber: /№\s*([№\d\/\-А-Я]+)/gi,
          court: /административен\s+съд[:\s]*([^,\n]+)/gi,
          date: /(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{4})/g
        }
      },
      lexbg: {
        url: 'https://lex.bg',
        searchPath: '/bg/laws',
        patterns: {
          article: /чл[\.\s]*(\d+[а-я]*)/gi,
          law: /(з[а-я]*\s*[а-я\s]+)/gi
        }
      }
    };

    // Cache for scraped content
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Main method to search and scrape case law based on criteria
   */
  async searchAndScrapeCaseLaw(criteria) {
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
        saveToRag = true,
        sources = ['vks', 'vas', 'lexbg']
      } = criteria;

      console.log('🔍 Starting enhanced case law search with Firecrawl...');
      
      const results = [];
      const searchTasks = [];

      // Search each court source
      for (const source of sources) {
        if (this.courtSources[source]) {
          searchTasks.push(this.searchCourtSource(source, criteria));
        }
      }

      // Execute searches in parallel
      const sourceResults = await Promise.allSettled(searchTasks);
      
      for (const result of sourceResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push(...result.value.cases);
        }
      }

      // Filter and rank results
      const filteredResults = this.filterAndRankResults(results, criteria);
      
      // Store results in RAG if requested
      if (saveToRag && filteredResults.length > 0) {
        await this.storeResultsInRag(filteredResults);
      }

      return {
        success: true,
        results: filteredResults.slice(0, limit),
        total: filteredResults.length,
        sources: sources,
        criteria,
        scrapingMethod: useFirecrawl ? 'Firecrawl' : 'Traditional',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Case law search failed:', error);
      return {
        success: false,
        error: error.message,
        results: [],
        total: 0
      };
    }
  }

  /**
   * Search a specific court source using Firecrawl
   */
  async searchCourtSource(source, criteria) {
    try {
      const sourceConfig = this.courtSources[source];
      const searchQuery = this.buildSearchQuery(criteria);
      
      console.log(`🏛️ Searching ${source.toUpperCase()} court with query: "${searchQuery}"`);

      // Use Firecrawl to scrape court website
      const scrapedData = await this.scrapeWithFirecrawl(
        `${sourceConfig.url}${sourceConfig.searchPath}`,
        {
          query: searchQuery,
          source,
          maxPages: 3,
          extractPatterns: sourceConfig.patterns
        }
      );

      if (!scrapedData.success) {
        return { success: false, cases: [], source };
      }

      // Parse scraped content into case law objects
      const cases = await this.parseScrapedContent(scrapedData.content, source, criteria);
      
      console.log(`✅ Found ${cases.length} cases from ${source.toUpperCase()}`);
      
      return {
        success: true,
        cases,
        source,
        raw_data: scrapedData.content
      };

    } catch (error) {
      console.error(`❌ Error searching ${source}:`, error);
      return { success: false, cases: [], source, error: error.message };
    }
  }

  /**
   * Enhanced scraping with Firecrawl
   */
  async scrapeWithFirecrawl(url, options = {}) {
    try {
      if (!this.firecrawlApiKey) {
        console.warn('⚠️ Firecrawl API key not configured, skipping Firecrawl scraping');
        return {
          success: false,
          error: 'Firecrawl API key not configured',
          results: [],
          source: options.source || 'unknown',
          fallback: true
        };
      }

      const {
        query = '',
        source = 'unknown',
        maxPages = 3,
        extractPatterns = {}
      } = options;

      // Check cache first
      const cacheKey = `${url}_${query}_${source}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('📋 Using cached result for', source);
          return cached.data;
        }
      }

      // Firecrawl crawl request for multiple pages
      const crawlResponse = await axios.post(
        `${this.firecrawlApiUrl}/v1/crawl`,
        {
          url: url,
          limit: maxPages,
          scrapeOptions: {
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            includeTags: [
              'article', 'main', 'content', 
              'div[class*="case"]', 'div[class*="decision"]', 'div[class*="ruling"]',
              'table', 'tr', 'td', 'span[class*="date"]', 'span[class*="number"]'
            ],
            excludeTags: [
              'nav', 'footer', 'header', 'aside', 'advertisement',
              'script', 'style', 'meta', 'link'
            ],
            waitFor: 3000,
            blockAds: true,
            removeBase64Images: true
          },
          crawlerOptions: {
            followLinks: true,
            maxDepth: 2,
            allowSubdomains: true,
            respectRobotsTxt: true,
            includes: [
              '**/cases/**', '**/decisions/**', '**/rulings/**', 
              '**/search/**', '**/archive/**'
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const crawlData = crawlResponse.data;
      
      if (!crawlData.success) {
        throw new Error(`Firecrawl crawl failed: ${crawlData.error}`);
      }

      // Process crawled content
      const processedContent = this.processFirecrawlContent(crawlData.data, extractPatterns);
      
      const result = {
        success: true,
        content: processedContent,
        source,
        totalPages: crawlData.data?.length || 0,
        method: 'firecrawl'
      };

      // Cache result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      console.error('🔥 Firecrawl scraping failed:', error);
      
      // Fallback to traditional scraping
      return await this.fallbackTraditionalScraping(url, options);
    }
  }

  /**
   * Process Firecrawl crawled content
   */
  processFirecrawlContent(crawlData, extractPatterns) {
    const processedPages = [];

    for (const page of crawlData || []) {
      if (!page.markdown && !page.html) continue;

      const content = page.markdown || page.html;
      const url = page.url;

      // Extract structured data using patterns
      const extractedData = this.extractStructuredData(content, extractPatterns);
      
      processedPages.push({
        url,
        content,
        extractedData,
        metadata: page.metadata || {}
      });
    }

    return processedPages;
  }

  /**
   * Extract structured legal data from content
   */
  extractStructuredData(content, patterns) {
    const extracted = {};

    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern instanceof RegExp) {
        const matches = content.match(pattern);
        extracted[key] = matches ? matches.map(m => m.trim()) : [];
      }
    }

    // Additional Bulgarian legal content extraction
    extracted.legalArticles = this.extractLegalArticles(content);
    extracted.caseNumbers = this.extractCaseNumbers(content);
    extracted.courts = this.extractCourts(content);
    extracted.dates = this.extractDates(content);
    extracted.parties = this.extractParties(content);
    extracted.outcomes = this.extractOutcomes(content);

    return extracted;
  }

  /**
   * Extract legal articles (чл. X от закон Y)
   */
  extractLegalArticles(content) {
    const articlePattern = /чл\.?\s*(\d+[а-я]*)\s*(?:от|на)?\s*([А-Я][А-Я\s]+)/gi;
    const matches = [];
    let match;

    while ((match = articlePattern.exec(content)) !== null) {
      matches.push({
        article: `чл. ${match[1]}`,
        law: match[2].trim(),
        context: content.substring(Math.max(0, match.index - 50), match.index + 100)
      });
    }

    return matches;
  }

  /**
   * Extract case numbers
   */
  extractCaseNumbers(content) {
    const patterns = [
      /дело\s*№?\s*([№\d\/\-А-Я]+)/gi,
      /решение\s*№?\s*([№\d\/\-А-Я]+)/gi,
      /определение\s*№?\s*([№\d\/\-А-Я]+)/gi
    ];

    const numbers = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        numbers.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(numbers)]; // Remove duplicates
  }

  /**
   * Extract court names
   */
  extractCourts(content) {
    const courtPatterns = [
      /([А-Я][а-я]+\s+(?:районен|областен|апелативен|административен)?\s*съд[а-я]*)/gi,
      /(Върховен\s+(?:касационен\s+)?съд)/gi,
      /(Върховен\s+административен\s+съд)/gi,
      /(Конституционен\s+съд)/gi
    ];

    const courts = [];
    for (const pattern of courtPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        courts.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(courts)];
  }

  /**
   * Extract dates
   */
  extractDates(content) {
    const datePattern = /(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{4})/g;
    const matches = content.match(datePattern);
    return matches ? matches.map(date => this.parseDate(date)) : [];
  }

  /**
   * Extract parties involved
   */
  extractParties(content) {
    const partyPatterns = [
      /(?:ищец|жалбоподател)[:\s]*([А-Я][а-я\s]+)/gi,
      /(?:ответник|ответен)[:\s]*([А-Я][а-я\s]+)/gi,
      /(?:продавач)[:\s]*([А-Я][а-я\s]+)/gi,
      /(?:купувач|покупател)[:\s]*([А-Я][а-я\s]+)/gi
    ];

    const parties = [];
    for (const pattern of partyPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        parties.push(...matches.map(m => m.trim()));
      }
    }

    return parties;
  }

  /**
   * Extract case outcomes
   */
  extractOutcomes(content) {
    const outcomePatterns = [
      /(уважава|допуска|частично\s+уважава)\s+(?:иск|жалба)/gi,
      /(отхвърля|оставя\s+в\s+сила)\s+(?:иск|жалба)/gi,
      /(осъжда|оправдава)/gi,
      /(задължава)/gi
    ];

    const outcomes = [];
    for (const pattern of outcomePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        outcomes.push(...matches.map(m => m.trim()));
      }
    }

    return outcomes;
  }

  /**
   * Parse scraped content into CaseLaw objects
   */
  async parseScrapedContent(scrapedPages, source, criteria) {
    const cases = [];

    for (const page of scrapedPages) {
      try {
        const caseData = this.extractCaseFromPage(page, source);
        if (this.isValidCase(caseData, criteria)) {
          const caseLaw = new CaseLaw(caseData);
          cases.push(caseLaw);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse case from page ${page.url}:`, error.message);
      }
    }

    return cases;
  }

  /**
   * Extract case data from a single page
   */
  extractCaseFromPage(page, source) {
    const { content, extractedData, url } = page;
    
    // Generate unique ID
    const id = this.generateCaseId(url, extractedData);
    
    // Build case data object
    const caseData = {
      id,
      source,
      documentUrl: url,
      fullText: content,
      lastUpdated: new Date(),
      
      // Basic info
      caseNumber: extractedData.caseNumbers?.[0] || '',
      court: extractedData.courts?.[0] || '',
      date: extractedData.dates?.[0] || null,
      
      // Parties
      parties: this.buildPartiesObject(extractedData.parties),
      
      // Legal basis
      legalBasis: {
        articles: extractedData.legalArticles || [],
        laws: this.extractLawsFromArticles(extractedData.legalArticles),
        regulations: []
      },
      
      // Content analysis
      summary: this.generateSummary(content),
      reasoning: this.extractReasoning(content),
      decision: this.extractDecision(content),
      outcome: this.determineOutcome(extractedData.outcomes, content),
      keyPoints: this.extractKeyPoints(content),
      
      // Classification
      precedentValue: this.assessPrecedentValue(content, source),
      tags: this.generateTags(content, extractedData),
      
      // Related
      relatedCases: []
    };

    return caseData;
  }

  /**
   * Generate unique case ID
   */
  generateCaseId(url, extractedData) {
    const caseNumber = extractedData.caseNumbers?.[0] || '';
    const hash = require('crypto')
      .createHash('md5')
      .update(`${url}_${caseNumber}_${Date.now()}`)
      .digest('hex')
      .substring(0, 8);
    
    return `case_${hash}`;
  }

  /**
   * Build parties object from extracted data
   */
  buildPartiesObject(parties) {
    const partiesObj = {
      plaintiff: '',
      defendant: '',
      type: ''
    };

    if (parties && parties.length > 0) {
      partiesObj.plaintiff = parties[0] || '';
      partiesObj.defendant = parties[1] || '';
      
      // Determine party type based on content
      const partyText = parties.join(' ').toLowerCase();
      if (partyText.includes('продавач') || partyText.includes('продажба')) {
        partiesObj.type = 'seller';
      } else if (partyText.includes('купувач') || partyText.includes('покупател')) {
        partiesObj.type = 'buyer';
      } else if (partyText.includes('ищец')) {
        partiesObj.type = 'plaintiff';
      } else if (partyText.includes('ответник')) {
        partiesObj.type = 'defendant';
      }
    }

    return partiesObj;
  }

  /**
   * Extract laws from legal articles
   */
  extractLawsFromArticles(articles) {
    if (!articles || !Array.isArray(articles)) return [];
    
    return [...new Set(articles.map(article => article.law).filter(Boolean))];
  }

  /**
   * Generate case summary
   */
  generateSummary(content) {
    // Extract first meaningful paragraph as summary
    const paragraphs = content.split('\n').filter(p => p.trim().length > 50);
    return paragraphs[0]?.substring(0, 500) + '...' || '';
  }

  /**
   * Extract reasoning from content
   */
  extractReasoning(content) {
    const reasoningPatterns = [
      /(?:мотив|основание)[:\s]*([\s\S]{100,1000})/i,
      /(?:съдът\s+намира|съдът\s+счита)[:\s]*([\s\S]{100,1000})/i
    ];

    for (const pattern of reasoningPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 1000);
      }
    }

    return '';
  }

  /**
   * Extract decision from content
   */
  extractDecision(content) {
    const decisionPatterns = [
      /(?:реши|постанови|определи)[:\s]*([\s\S]{50,500})/i,
      /(?:решение|постановление|определение)[:\s]*([\s\S]{50,500})/i
    ];

    for (const pattern of decisionPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 500);
      }
    }

    return '';
  }

  /**
   * Determine case outcome
   */
  determineOutcome(outcomes, content) {
    if (!outcomes || outcomes.length === 0) {
      // Analyze content for outcome indicators
      const contentLower = content.toLowerCase();
      
      if (contentLower.includes('уважава') || contentLower.includes('допуска')) {
        return 'upheld';
      } else if (contentLower.includes('отхвърля') || contentLower.includes('отказва')) {
        return 'rejected';
      } else if (contentLower.includes('частично')) {
        return 'partially_upheld';
      } else if (contentLower.includes('осъжда')) {
        return 'guilty';
      } else if (contentLower.includes('оправдава')) {
        return 'not_guilty';
      }
      
      return 'unknown';
    }

    // Map Bulgarian outcomes to standard terms
    const outcomeText = outcomes.join(' ').toLowerCase();
    
    if (outcomeText.includes('уважава') || outcomeText.includes('допуска')) {
      return 'upheld';
    } else if (outcomeText.includes('отхвърля')) {
      return 'rejected';
    } else if (outcomeText.includes('частично')) {
      return 'partially_upheld';
    } else if (outcomeText.includes('осъжда')) {
      return 'guilty';
    } else if (outcomeText.includes('оправдава')) {
      return 'not_guilty';
    }

    return 'unknown';
  }

  /**
   * Extract key points from content
   */
  extractKeyPoints(content) {
    const keyPoints = [];
    
    // Look for numbered points or bullet points
    const pointPatterns = [
      /(?:\d+[\.\)]\s*)([\s\S]{20,200})(?=\d+[\.\)]|$)/g,
      /(?:[-•]\s*)([\s\S]{20,200})(?=[-•]|$)/g
    ];

    for (const pattern of pointPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        keyPoints.push(...matches.map(m => m.trim().substring(0, 200)));
      }
    }

    return keyPoints.slice(0, 5); // Limit to 5 key points
  }

  /**
   * Assess precedent value of the case
   */
  assessPrecedentValue(content, source) {
    const contentLower = content.toLowerCase();
    
    // High precedent value indicators
    if (source === 'vks' || 
        contentLower.includes('върховен') ||
        contentLower.includes('конституционен') ||
        contentLower.includes('принципно значение')) {
      return 'high';
    }
    
    // Medium precedent value indicators
    if (contentLower.includes('апелативен') || 
        contentLower.includes('тълкувателно') ||
        contentLower.includes('обединено') ||
        contentLower.includes('колегия')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate tags for the case
   */
  generateTags(content, extractedData) {
    const tags = [];
    const contentLower = content.toLowerCase();

    // Legal area tags
    const legalAreas = {
      'гражданско право': ['граждански', 'договор', 'обезщетение', 'вреди'],
      'наказателно право': ['наказателно', 'престъпление', 'осъжда', 'оправдава'],
      'административно право': ['административен', 'акт', 'обжалване', 'отмяна'],
      'търговско право': ['търговски', 'дружество', 'търговец', 'несъстоятелност'],
      'трудово право': ['трудов', 'работник', 'работодател', 'уволнение'],
      'семейно право': ['семеен', 'брак', 'развод', 'издръжка', 'попечителство']
    };

    for (const [area, keywords] of Object.entries(legalAreas)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        tags.push(area);
      }
    }

    // Add laws as tags
    if (extractedData.legalArticles) {
      const laws = this.extractLawsFromArticles(extractedData.legalArticles);
      tags.push(...laws.map(law => law.toLowerCase()));
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Validate if extracted case meets criteria
   */
  isValidCase(caseData, criteria) {
    // Must have essential information
    if (!caseData.caseNumber && !caseData.court && !caseData.summary) {
      return false;
    }

    // Check against search criteria
    if (criteria.articles && criteria.articles.length > 0) {
      const hasMatchingArticle = criteria.articles.some(article => 
        caseData.legalBasis.articles.some(caseArticle => 
          caseArticle.article && caseArticle.article.toLowerCase().includes(article.toLowerCase())
        )
      );
      if (!hasMatchingArticle) return false;
    }

    if (criteria.laws && criteria.laws.length > 0) {
      const hasMatchingLaw = criteria.laws.some(law => 
        caseData.legalBasis.laws.some(caseLaw => 
          caseLaw.toLowerCase().includes(law.toLowerCase())
        )
      );
      if (!hasMatchingLaw) return false;
    }

    return true;
  }

  /**
   * Filter and rank search results
   */
  filterAndRankResults(results, criteria) {
    // Remove duplicates based on case number or URL
    const uniqueResults = this.removeDuplicates(results);
    
    // Score each result based on relevance
    const scoredResults = uniqueResults.map(caseData => ({
      case: caseData,
      score: this.calculateRelevanceScore(caseData, criteria)
    }));

    // Sort by relevance score
    scoredResults.sort((a, b) => b.score - a.score);
    
    return scoredResults.map(item => item.case);
  }

  /**
   * Remove duplicate cases
   */
  removeDuplicates(results) {
    const seen = new Set();
    return results.filter(caseData => {
      const key = `${caseData.caseNumber}_${caseData.court}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate relevance score for a case
   */
  calculateRelevanceScore(caseData, criteria) {
    let score = 0;

    // Article matches (high weight)
    if (criteria.articles) {
      for (const article of criteria.articles) {
        if (caseData.legalBasis.articles.some(a => 
          a.article && a.article.toLowerCase().includes(article.toLowerCase()))) {
          score += 10;
        }
      }
    }

    // Law matches (medium weight)
    if (criteria.laws) {
      for (const law of criteria.laws) {
        if (caseData.legalBasis.laws.some(l => 
          l.toLowerCase().includes(law.toLowerCase()))) {
          score += 7;
        }
      }
    }

    // Party type matches (medium weight)
    if (criteria.parties && criteria.parties.length > 0) {
      if (criteria.parties.includes(caseData.parties.type)) {
        score += 6;
      }
    }

    // Court matches (low weight)
    if (criteria.court && caseData.court.toLowerCase().includes(criteria.court.toLowerCase())) {
      score += 3;
    }

    // Outcome matches (medium weight)
    if (criteria.outcome && caseData.outcome === criteria.outcome) {
      score += 5;
    }

    // Keyword matches (variable weight)
    if (criteria.keywords) {
      const caseText = `${caseData.summary} ${caseData.reasoning} ${caseData.keyPoints.join(' ')}`.toLowerCase();
      for (const keyword of criteria.keywords) {
        if (caseText.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }
    }

    // Precedent value bonus
    if (caseData.precedentValue === 'high') {
      score += 5;
    } else if (caseData.precedentValue === 'medium') {
      score += 2;
    }

    // Recency bonus (newer cases get slight boost)
    if (caseData.date) {
      const daysAgo = (Date.now() - new Date(caseData.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo < 365) score += 2; // Cases from last year
      else if (daysAgo < 365 * 3) score += 1; // Cases from last 3 years
    }

    return score;
  }

  /**
   * Store scraped results in RAG system
   */
  async storeResultsInRag(results) {
    try {
      console.log(`💾 Storing ${results.length} cases in RAG system...`);
      
      for (const caseData of results) {
        const documentData = {
          title: `${caseData.caseNumber} - ${caseData.court}`,
          content: this.formatCaseForRag(caseData),
          metadata: {
            caseNumber: caseData.caseNumber,
            court: caseData.court,
            date: caseData.date,
            outcome: caseData.outcome,
            legalBasis: caseData.legalBasis,
            parties: caseData.parties,
            precedentValue: caseData.precedentValue,
            tags: caseData.tags,
            source: caseData.source
          },
          source: `${caseData.source}_court`
        };

        await this.ragService.storeLegalDocument(documentData);
      }

      console.log('✅ Successfully stored cases in RAG system');
    } catch (error) {
      console.error('❌ Failed to store cases in RAG:', error);
    }
  }

  /**
   * Format case data for RAG storage
   */
  formatCaseForRag(caseData) {
    return `ДЕЛО: ${caseData.caseNumber}
СЪД: ${caseData.court}
ДАТА: ${caseData.date}
СТРАНИ: ${caseData.parties.plaintiff} срещу ${caseData.parties.defendant}
ПРАВНО ОСНОВАНИЕ: ${caseData.legalBasis.articles.map(a => `${a.article} от ${a.law}`).join(', ')}
РЕЗУЛТАТ: ${caseData.outcome}

РЕЗЮМЕ:
${caseData.summary}

МОТИВИ:
${caseData.reasoning}

РЕШЕНИЕ:
${caseData.decision}

КЛЮЧОВИ ТОЧКИ:
${caseData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

ПЪЛЕН ТЕКСТ:
${caseData.fullText}`;
  }

  /**
   * Build search query from criteria
   */
  buildSearchQuery(criteria) {
    const queryParts = [];

    if (criteria.articles && criteria.articles.length > 0) {
      queryParts.push(criteria.articles.join(' '));
    }

    if (criteria.laws && criteria.laws.length > 0) {
      queryParts.push(criteria.laws.join(' '));
    }

    if (criteria.keywords && criteria.keywords.length > 0) {
      queryParts.push(criteria.keywords.join(' '));
    }

    if (criteria.parties && criteria.parties.length > 0) {
      queryParts.push(criteria.parties.join(' '));
    }

    return queryParts.join(' ');
  }

  /**
   * Fallback traditional scraping if Firecrawl fails
   */
  async fallbackTraditionalScraping(url, options) {
    try {
      console.log('🔄 Falling back to traditional scraping...');
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      // Extract main content
      const content = $('main, article, .content, .case, .decision, .ruling').text() || 
                     $('body').text();

      return {
        success: true,
        content: [{
          url: url,
          content: content,
          extractedData: {},
          metadata: {}
        }],
        source: options.source || 'unknown',
        method: 'traditional'
      };

    } catch (error) {
      console.error('❌ Traditional scraping also failed:', error);
      return {
        success: false,
        content: [],
        error: error.message
      };
    }
  }

  /**
   * Parse Bulgarian date formats
   */
  parseDate(dateString) {
    try {
      // Try different Bulgarian date formats
      const formats = [
        /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{1,2})-(\d{1,2})-(\d{4})/
      ];

      for (const format of formats) {
        const match = dateString.match(format);
        if (match) {
          const [, day, month, year] = match;
          return new Date(year, month - 1, day);
        }
      }

      return new Date(dateString);
    } catch (error) {
      return null;
    }
  }
}

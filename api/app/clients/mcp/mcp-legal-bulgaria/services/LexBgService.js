/**
 * Lex.bg Integration Service
 * Provides real-time access to Bulgarian legal database from lex.bg
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { LexBgTreeScraperService } from './LexBgTreeScraperService.js';
import { RagIntegrationService } from './RagIntegrationService.js';

export class LexBgService {
  constructor() {
    this.baseUrl = 'https://lex.bg';
    this.cache = new Map(); // Cache for scraped content
    this.apiUrl = 'https://lex.bg/api';
    this.searchEndpoint = '/search';
    this.documentsEndpoint = '/documents';
    this.newsEndpoint = '/news';

    // Initialize RAG integration
    this.ragService = new RagIntegrationService();

    // Initialize enhanced tree scraper
    this.treeScraperService = new LexBgTreeScraperService();

    // Request headers to mimic browser behavior
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  /**
   * Search for legal documents on lex.bg with RAG integration
   */
  async searchLegalDocuments(searchCriteria) {
    const { useRag = true, storeResults = true, useTreeSearch = true } = searchCriteria;

    // If tree search is enabled and criteria indicate law research, use enhanced tree search
    if (useTreeSearch && this.shouldUseTreeSearch(searchCriteria)) {
      console.log('🌳 Using enhanced law tree search...');

      const treeResults = await this.treeScraperService.searchLawTree({
        ...searchCriteria,
        maxResults: searchCriteria.limit || 20,
        relevanceThreshold: searchCriteria.relevanceThreshold || 60,
      });

      if (treeResults.success && treeResults.results.length > 0) {
        console.log(`🌳 Tree search found ${treeResults.results.length} laws`);

        // Combine tree results with regular search for comprehensive coverage
        const regularResults = await this.performLiveSearch({
          ...searchCriteria,
          limit: Math.max(5, (searchCriteria.limit || 20) - treeResults.results.length),
        });

        const combinedResults = this.combineTreeAndRegularResults(treeResults, regularResults);

        return {
          ...combinedResults,
          treeSearchUsed: true,
          treeResultsCount: treeResults.results.length,
          regularResultsCount: regularResults.success ? regularResults.results.length : 0,
        };
      }
    }

    if (useRag && process.env.RAG_API_URL) {
      return await this.ragService.enhancedLegalSearch(
        searchCriteria.query || '',
        (query) => this.performLiveSearch({ ...searchCriteria, query }),
        { storeResults, useRagFirst: true },
      );
    }

    // Fallback to regular search if RAG is disabled
    return await this.performLiveSearch(searchCriteria);
  }

  /**
   * Determine if tree search should be used based on search criteria
   */
  shouldUseTreeSearch(criteria) {
    const { query = '', documentType = '', institution = '' } = criteria;
    const queryLower = query.toLowerCase();

    // Use tree search for law-specific queries
    const lawKeywords = [
      'закон',
      'кодекс',
      'наредба',
      'правилник',
      'конституция',
      'чл.',
      'член',
      'параграф',
      'алинея',
      'текст',
      'закона',
    ];

    const hasLawKeywords = lawKeywords.some((keyword) => queryLower.includes(keyword));

    // Use tree search for specific legal areas
    const legalAreas = [
      'гражданско право',
      'наказателно право',
      'търговско право',
      'трудово право',
      'административно право',
      'данъчно право',
    ];

    const hasLegalArea = legalAreas.some((area) => queryLower.includes(area));

    // Use tree search for document type requests
    const isDocumentTypeRequest =
      documentType &&
      ['закон', 'кодекс', 'наредба', 'правилник'].includes(documentType.toLowerCase());

    return (
      hasLawKeywords ||
      hasLegalArea ||
      isDocumentTypeRequest ||
      queryLower.includes('право') ||
      queryLower.includes('правен')
    );
  }

  /**
   * Combine tree search results with regular search results
   */
  combineTreeAndRegularResults(treeResults, regularResults) {
    const combinedResults = [...(treeResults.results || [])];
    const seenTitles = new Set(combinedResults.map((r) => r.title.toLowerCase().trim()));

    // Add regular results that aren't duplicates
    if (regularResults.success && regularResults.results) {
      for (const result of regularResults.results) {
        const titleKey = result.title.toLowerCase().trim();
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          combinedResults.push({
            ...result,
            sourceMethod: 'regular_search',
          });
        }
      }
    }

    // Mark tree results for identification
    combinedResults.forEach((result, index) => {
      if (index < (treeResults.results || []).length) {
        result.sourceMethod = 'tree_search';
        result.isLawDocument = true;
      }
    });

    return {
      success: true,
      results: combinedResults,
      total: combinedResults.length,
      source: 'lex.bg',
      searchMethod: 'enhanced_tree_and_regular',
      metadata: {
        treeResults: treeResults.results?.length || 0,
        regularResults: regularResults.success ? regularResults.results?.length || 0 : 0,
        duplicatesRemoved:
          (treeResults.results?.length || 0) +
          (regularResults.success ? regularResults.results?.length || 0 : 0) -
          combinedResults.length,
        searchDate: new Date().toISOString(),
      },
    };
  }

  /**
   * Perform live search (original implementation)
   */
  async performLiveSearch(searchCriteria) {
    try {
      const {
        query = '',
        documentType = '',
        dateFrom = '',
        dateTo = '',
        institution = '',
        limit = 20,
      } = searchCriteria;

      // Preprocess query for better results
      const processedQueries = this.preprocessSearchQuery(query);

      // Try multiple search strategies for better results
      const searchStrategies = [];

      // Try each processed query with different strategies
      for (const processedQuery of processedQueries) {
        searchStrategies.push(
          // Strategy 1: Main search page
          this.searchMainPage(processedQuery, documentType, institution, limit),
          // Strategy 2: News/articles search
          this.searchNewsAndArticles(processedQuery, limit),
          // Strategy 3: Forum search for discussions
          this.searchForum(processedQuery, limit),
        );
      }

      // Add Google search for original query
      searchStrategies.push(this.searchViaGoogle(query, limit));

      // Execute searches in parallel
      const results = await Promise.allSettled(searchStrategies);

      // Combine and deduplicate results
      const combinedResults = this.combineSearchResults(
        results.filter((r) => r.status === 'fulfilled').map((r) => r.value),
      );

      // Perform deep content analysis if requested
      let finalResults = combinedResults.slice(0, limit);
      if (searchCriteria.deepAnalysis !== false && searchCriteria.legalArticle) {
        console.log(
          `🔍 Performing deep content analysis on ${finalResults.length} lex.bg results...`,
        );
        const enhancedResults = await this.performDeepContentAnalysis(finalResults, searchCriteria);
        console.log(`✅ Deep analysis completed: ${enhancedResults.length} relevant results found`);
        finalResults = enhancedResults;
      }

      return {
        success: true,
        results: finalResults,
        total: finalResults.length,
        originalTotal: combinedResults.length,
        source: 'lex.bg',
        deepAnalysisPerformed: searchCriteria.deepAnalysis !== false && searchCriteria.legalArticle,
        contentAnalyzed: finalResults.filter((r) => r.legalAnalysis).length,
        searchStrategies: results.map((r, i) => ({
          strategy: Math.floor(i / Math.max(processedQueries.length, 1)) + 1,
          query: processedQueries[i % processedQueries.length] || query,
          success: r.status === 'fulfilled' && r.value.success,
          resultCount: r.status === 'fulfilled' ? r.value.results?.length || 0 : 0,
        })),
      };
    } catch (error) {
      console.error('Error searching lex.bg:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Preprocess search query to generate variations for better matching
   */
  preprocessSearchQuery(query) {
    if (!query) return [''];

    const queries = [query]; // Start with original query

    // Legal abbreviation expansions
    const legalAbbreviations = {
      ЗЗД: ['Закон за задълженията и договорите', 'ЗЗД'],
      ТЗ: ['Търговски закон', 'ТЗ'],
      ГПК: ['Граждански процесуален кодекс', 'ГПК'],
      НПК: ['Наказателно-процесуален кодекс', 'НПК'],
      НК: ['Наказателен кодекс', 'НК'],
      КТ: ['Кодекс на труда', 'КТ'],
      АПК: ['Административнопроцесуален кодекс', 'АПК'],
    };

    // Expand abbreviations
    for (const [abbr, expansions] of Object.entries(legalAbbreviations)) {
      if (query.includes(abbr)) {
        for (const expansion of expansions) {
          if (expansion !== abbr) {
            queries.push(query.replace(abbr, expansion));
          }
        }
      }
    }

    // Article number variations
    const articleMatch = query.match(/чл\.?\s*(\d+)/i);
    if (articleMatch) {
      const articleNum = articleMatch[1];
      queries.push(
        query.replace(/чл\.?\s*\d+/i, `член ${articleNum}`),
        query.replace(/чл\.?\s*\d+/i, `чл ${articleNum}`),
        query.replace(/чл\.?\s*\d+/i, `чл. ${articleNum}`),
        query.replace(/чл\.?\s*\d+/i, `${articleNum}`),
      );
    }

    // Legal term synonyms for better coverage
    const legalSynonyms = {
      договор: ['споразумение', 'сделка', 'контракт'],
      отговорност: ['задължение', 'вина', 'деликт'],
      продавач: ['продавещ', 'доставчик', 'vendor'],
      купувач: ['купувающ', 'получател', 'клиент', 'buyer'],
      неустойка: ['обезщетение', 'възмездие', 'санкция', 'penalty'],
      гаранция: ['поръчителство', 'обезпечение', 'warranty'],
    };

    // Add synonym variations
    for (const [term, synonyms] of Object.entries(legalSynonyms)) {
      if (query.toLowerCase().includes(term)) {
        for (const synonym of synonyms) {
          queries.push(query.toLowerCase().replace(term, synonym));
        }
      }
    }

    // Add simplified versions (remove complex legal jargon)
    const simplifiedQuery = query
      .replace(/чл\.?\s*\d+/i, '') // Remove article references
      .replace(/от\s+\d{4}\s*г\.?/i, '') // Remove years
      .trim();

    if (simplifiedQuery && simplifiedQuery !== query) {
      queries.push(simplifiedQuery);
    }

    // Remove duplicates and empty queries
    const uniqueQueries = [...new Set(queries)].filter((q) => q.trim().length > 2);

    // Limit to avoid too many requests and return most promising variations
    return uniqueQueries.slice(0, 4);
  }

  /**
   * Search main lex.bg pages
   */
  async searchMainPage(query, documentType, institution, limit) {
    try {
      // Multiple URL patterns to try
      const searchUrls = [
        `${this.baseUrl}/bg/search/?q=${encodeURIComponent(query)}`,
        `${this.baseUrl}/search/?q=${encodeURIComponent(query)}`,
        `${this.baseUrl}/?s=${encodeURIComponent(query)}`,
        `${this.baseUrl}/bg/?s=${encodeURIComponent(query)}`,
      ];

      for (const searchUrl of searchUrls) {
        try {
          const response = await fetch(searchUrl, {
            method: 'GET',
            headers: this.headers,
            timeout: 8000,
          });

          if (response.ok) {
            const html = await response.text();
            const results = this.parseSearchResults(html);
            if (results.results.length > 0) {
              return { success: true, results: results.results };
            }
          }
        } catch (urlError) {
          console.warn(`Failed to search URL ${searchUrl}:`, urlError.message);
          continue;
        }
      }

      return { success: false, results: [] };
    } catch (error) {
      console.warn('Main page search failed:', error.message);
      return { success: false, results: [] };
    }
  }

  /**
   * Search lex.bg news and articles
   */
  async searchNewsAndArticles(query, limit) {
    try {
      const newsUrls = [
        `${this.baseUrl}/bg/news/?s=${encodeURIComponent(query)}`,
        `${this.baseUrl}/news/?search=${encodeURIComponent(query)}`,
        `${this.baseUrl}/articles/?q=${encodeURIComponent(query)}`,
      ];

      for (const newsUrl of newsUrls) {
        try {
          const response = await fetch(newsUrl, {
            method: 'GET',
            headers: this.headers,
            timeout: 8000,
          });

          if (response.ok) {
            const html = await response.text();
            const results = this.parseNewsResults(html, limit);
            if (results.news.length > 0) {
              return {
                success: true,
                results: results.news.map((item) => ({
                  ...item,
                  type: 'News Article',
                })),
              };
            }
          }
        } catch (urlError) {
          console.warn(`Failed to search news URL ${newsUrl}:`, urlError.message);
          continue;
        }
      }

      return { success: false, results: [] };
    } catch (error) {
      console.warn('News search failed:', error.message);
      return { success: false, results: [] };
    }
  }

  /**
   * Search lex.bg forum for discussions
   */
  async searchForum(query, limit) {
    try {
      const forumUrls = [
        `${this.baseUrl}/forum/search/?q=${encodeURIComponent(query)}`,
        `${this.baseUrl}/bg/forum/search/?q=${encodeURIComponent(query)}`,
      ];

      for (const forumUrl of forumUrls) {
        try {
          const response = await fetch(forumUrl, {
            method: 'GET',
            headers: this.headers,
            timeout: 8000,
          });

          if (response.ok) {
            const html = await response.text();
            const results = this.parseForumResults(html, limit);
            if (results.length > 0) {
              return { success: true, results };
            }
          }
        } catch (urlError) {
          console.warn(`Failed to search forum URL ${forumUrl}:`, urlError.message);
          continue;
        }
      }

      return { success: false, results: [] };
    } catch (error) {
      console.warn('Forum search failed:', error.message);
      return { success: false, results: [] };
    }
  }

  /**
   * Search via Google limited to lex.bg site
   */
  async searchViaGoogle(query, limit) {
    try {
      // Use Google site search as fallback
      const googleQuery = `site:lex.bg ${query}`;
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&num=${Math.min(limit, 10)}`;

      const response = await fetch(googleUrl, {
        method: 'GET',
        headers: {
          ...this.headers,
          'User-Agent': 'Mozilla/5.0 (compatible; LexBG-Research/1.0)',
        },
        timeout: 10000,
      });

      if (response.ok) {
        const html = await response.text();
        const results = this.parseGoogleResults(html);
        return { success: true, results };
      }

      return { success: false, results: [] };
    } catch (error) {
      console.warn('Google search failed:', error.message);
      return { success: false, results: [] };
    }
  }

  /**
   * Parse search results from HTML response
   */
  parseSearchResults(html) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      // Extended selectors for better result detection
      const selectors = [
        '.search-result',
        '.document-item',
        '.result-item',
        'article',
        '.post',
        '.entry',
        '.content-item',
        '.news-item',
        '.blog-post',
        '.wp-block-post',
        '.hentry',
        '.post-content',
        '.archive-item',
      ];

      // Try each selector
      for (const selector of selectors) {
        $(selector).each((index, element) => {
          const $el = $(element);

          // Multiple title selectors
          const titleSelectors = [
            'h1',
            'h2',
            'h3',
            'h4',
            '.title',
            '.document-title',
            '.entry-title',
            '.post-title',
            'a[href]',
          ];
          let title = '';
          for (const titleSel of titleSelectors) {
            title = $el.find(titleSel).first().text().trim();
            if (title) break;
          }

          // Multiple summary selectors
          const summarySelectors = [
            '.summary',
            '.excerpt',
            '.description',
            '.content',
            '.entry-content',
            'p',
          ];
          let summary = '';
          for (const sumSel of summarySelectors) {
            summary = $el.find(sumSel).first().text().trim();
            if (summary && summary.length > 20) break;
          }

          // Link extraction
          let link = $el.find('a').first().attr('href') || $el.attr('href') || '';
          if (link && !link.startsWith('http')) {
            link = link.startsWith('/') ? `${this.baseUrl}${link}` : `${this.baseUrl}/${link}`;
          }

          // Date extraction
          const dateSelectors = [
            '.date',
            '.publish-date',
            '.entry-date',
            '.post-date',
            'time',
            '.timestamp',
          ];
          let date = '';
          for (const dateSel of dateSelectors) {
            date = $el.find(dateSel).first().text().trim();
            if (date) break;
          }

          // Type detection
          let type = $el.find('.type, .category, .document-type').first().text().trim();
          if (!type) {
            // Infer type from content
            if (
              title.toLowerCase().includes('решение') ||
              title.toLowerCase().includes('постановление')
            ) {
              type = 'Съдебно решение';
            } else if (
              title.toLowerCase().includes('закон') ||
              title.toLowerCase().includes('наредба')
            ) {
              type = 'Нормативен акт';
            } else if (title.toLowerCase().includes('новина') || date) {
              type = 'Новина';
            } else {
              type = 'Правен документ';
            }
          }

          if (title && title.length > 3) {
            // Avoid duplicates
            const isDuplicate = results.some(
              (r) =>
                r.title.toLowerCase() === title.toLowerCase() || (r.url && link && r.url === link),
            );

            if (!isDuplicate) {
              results.push({
                title: title || 'Без заглавие',
                summary: this.cleanText(summary) || '',
                url: link || '',
                date: this.normalizeDate(date) || '',
                type: type || 'Неизвестен',
                source: 'lex.bg',
              });
            }
          }
        });

        // If we found results with this selector, break
        if (results.length > 0) break;
      }

      return {
        success: true,
        results: results.slice(0, 20),
        total: results.length,
        source: 'lex.bg',
      };
    } catch (error) {
      console.error('Error parsing lex.bg results:', error);
      return {
        success: false,
        error: 'Failed to parse search results',
        results: [],
      };
    }
  }

  /**
   * Parse forum results
   */
  parseForumResults(html, limit) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      $('.forum-post, .topic, .discussion, .thread').each((index, element) => {
        if (index >= limit) return false;

        const $el = $(element);
        const title = $el.find('h2, h3, h4, .topic-title, .thread-title').first().text().trim();
        const summary = $el.find('.post-content, .topic-content, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const author = $el.find('.author, .user, .poster').first().text().trim();
        const date = $el.find('.date, .post-date, time').first().text().trim();

        if (title) {
          results.push({
            title,
            summary: this.cleanText(summary),
            url: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : '',
            date: this.normalizeDate(date),
            author: author || '',
            type: 'Forum Discussion',
            source: 'lex.bg Forum',
          });
        }
      });

      return results;
    } catch (error) {
      console.warn('Error parsing forum results:', error.message);
      return [];
    }
  }

  /**
   * Parse Google search results for lex.bg content
   */
  parseGoogleResults(html) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      $('.g, .rc').each((index, element) => {
        const $el = $(element);

        const titleLink = $el.find('h3').parent('a');
        const title = $el.find('h3').text().trim();
        const link = titleLink.attr('href');
        const summary = $el.find('.VwiC3b, .s').text().trim();

        if (title && link && link.includes('lex.bg')) {
          results.push({
            title,
            summary: this.cleanText(summary),
            url: link,
            date: '',
            type: 'Web Search Result',
            source: 'lex.bg (via Google)',
          });
        }
      });

      return results.slice(0, 10);
    } catch (error) {
      console.warn('Error parsing Google results:', error.message);
      return [];
    }
  }

  /**
   * Combine results from multiple search strategies
   */
  combineSearchResults(searchResults) {
    const allResults = [];
    const seenTitles = new Set();

    for (const result of searchResults) {
      if (result.success && result.results) {
        for (const item of result.results) {
          const titleKey = item.title.toLowerCase().trim();
          if (!seenTitles.has(titleKey) && titleKey.length > 3) {
            seenTitles.add(titleKey);
            allResults.push(item);
          }
        }
      }
    }

    // Sort by relevance (prioritize items with dates, longer summaries)
    return allResults.sort((a, b) => {
      // Prioritize items with dates
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;

      // Then by summary length
      const aScore = (a.summary?.length || 0) + (a.title?.length || 0);
      const bScore = (b.summary?.length || 0) + (b.title?.length || 0);
      return bScore - aScore;
    });
  }

  /**
   * Clean text content
   */
  cleanText(text) {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, ' ') // Newlines to spaces
      .replace(/[^\w\s\u0400-\u04FF.,!?;:()\-]/g, '') // Keep only words, Cyrillic, and basic punctuation
      .trim()
      .substring(0, 500); // Limit length
  }

  /**
   * Normalize date format
   */
  normalizeDate(dateStr) {
    if (!dateStr) return '';

    // Try to extract date patterns
    const datePatterns = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // DD.MM.YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        return match[0]; // Return the matched date
      }
    }

    return dateStr.trim().substring(0, 20); // Return cleaned version
  }

  /**
   * Get legal news and updates from lex.bg with RAG storage
   */
  async getLegalNews(options = {}) {
    const { storeInRag = true } = options;
    const result = await this.performLiveNewsSearch(options);

    // Store news articles in RAG for future reference
    if (storeInRag && result.success && result.news.length > 0 && process.env.RAG_API_URL) {
      try {
        await this.ragService.storeLegalSearchResults(
          result.news.slice(0, 5), // Store top 5 news items
          options.category || 'legal_news',
          'lex.bg_news',
        );
      } catch (error) {
        console.warn('Failed to store news in RAG:', error.message);
      }
    }

    return result;
  }

  /**
   * Perform live news search (original implementation)
   */
  async performLiveNewsSearch(options = {}) {
    try {
      const { category = '', limit = 10 } = options;

      const newsUrl = category ? `${this.baseUrl}/news/${category}` : `${this.baseUrl}/news`;

      const response = await fetch(newsUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      return this.parseNewsResults(html, limit);
    } catch (error) {
      console.error('Error fetching lex.bg news:', error);
      return {
        success: false,
        error: error.message,
        news: [],
      };
    }
  }

  /**
   * Parse news results from HTML
   */
  parseNewsResults(html, limit = 10) {
    try {
      const $ = cheerio.load(html);
      const news = [];

      $('.news-item, .article, .post, article').each((index, element) => {
        if (index >= limit) return false; // Stop when limit is reached

        const $el = $(element);

        const title = $el.find('h1, h2, h3, .title, .news-title').first().text().trim();
        const summary = $el.find('.summary, .excerpt, .description, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const date = $el.find('.date, .publish-date, time').first().text().trim();
        const author = $el.find('.author, .by').first().text().trim();

        if (title) {
          news.push({
            title,
            summary: summary || '',
            url: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : '',
            date: date || '',
            author: author || '',
            source: 'lex.bg',
          });
        }
      });

      return {
        success: true,
        news,
        total: news.length,
        source: 'lex.bg',
      };
    } catch (error) {
      console.error('Error parsing lex.bg news:', error);
      return {
        success: false,
        error: 'Failed to parse news results',
        news: [],
      };
    }
  }

  /**
   * Get specific document content from lex.bg
   */
  async getDocumentContent(documentUrl) {
    try {
      const response = await fetch(documentUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 15000,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      return this.parseDocumentContent(html);
    } catch (error) {
      console.error('Error fetching document content:', error);
      return {
        success: false,
        error: error.message,
        content: null,
      };
    }
  }

  /**
   * Parse document content from HTML
   */
  parseDocumentContent(html) {
    try {
      const $ = cheerio.load(html);

      const title = $('h1, .document-title, .title').first().text().trim();
      const content = $('.document-content, .content, .text, .body, main').first().text().trim();
      const metadata = {};

      // Extract metadata
      $('.metadata, .document-meta, .info')
        .find('dt, .label')
        .each((index, element) => {
          const $label = $(element);
          const $value = $label.next('dd, .value');
          if ($value.length) {
            metadata[$label.text().trim()] = $value.text().trim();
          }
        });

      return {
        success: true,
        content: {
          title,
          content,
          metadata,
          url: '',
        },
      };
    } catch (error) {
      console.error('Error parsing document content:', error);
      return {
        success: false,
        error: 'Failed to parse document content',
        content: null,
      };
    }
  }

  /**
   * Search for specific legal articles or laws
   */
  async searchLegalArticles(law, articleNumber) {
    try {
      const query = `${law} чл. ${articleNumber}`;
      return await this.searchLegalDocuments({ query, limit: 10 });
    } catch (error) {
      console.error('Error searching legal articles:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Get trending legal topics from lex.bg
   */
  async getTrendingTopics() {
    try {
      const response = await fetch(`${this.baseUrl}/trending`, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        // Fallback to main page if trending endpoint doesn't exist
        return this.getLegalNews({ limit: 5 });
      }

      const html = await response.text();
      return this.parseTrendingTopics(html);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
      // Fallback to recent news
      return this.getLegalNews({ limit: 5 });
    }
  }

  /**
   * Parse trending topics from HTML
   */
  parseTrendingTopics(html) {
    try {
      const $ = cheerio.load(html);
      const topics = [];

      $('.trending-item, .popular-item, .hot-topic').each((index, element) => {
        const $el = $(element);

        const title = $el.find('h3, h4, .title').first().text().trim();
        const count = $el.find('.count, .views, .popularity').first().text().trim();
        const link = $el.find('a').first().attr('href');

        if (title) {
          topics.push({
            title,
            count: count || '',
            url: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : '',
            source: 'lex.bg',
          });
        }
      });

      return {
        success: true,
        topics,
        source: 'lex.bg',
      };
    } catch (error) {
      console.error('Error parsing trending topics:', error);
      return {
        success: false,
        error: 'Failed to parse trending topics',
        topics: [],
      };
    }
  }

  /**
   * Test connection to lex.bg
   */
  async testConnection() {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        headers: this.headers,
        timeout: 5000,
      });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        message: error.message,
      };
    }
  }

  /**
   * Deep content analysis - scrape full content from lex.bg URLs
   */
  async performDeepContentAnalysis(results, searchCriteria) {
    const enhancedResults = [];

    for (const result of results) {
      try {
        // Check if it's a relevant legal document URL
        if (this.isLegalDocumentUrl(result.url)) {
          const fullContent = await this.scrapeFullContent(result.url);

          if (fullContent) {
            const analyzedContent = this.analyzeLegalContent(fullContent, searchCriteria);

            // Only include if it meets our legal criteria
            if (analyzedContent.relevanceScore > 70) {
              enhancedResults.push({
                ...result,
                fullContent: fullContent.text,
                legalAnalysis: analyzedContent,
                contentType: fullContent.contentType,
                extractedCitations: fullContent.citations,
                partyAnalysis: fullContent.partyAnalysis,
              });
            }
          }
        }
      } catch (error) {
        console.log(`Failed to analyze content for ${result.url}: ${error.message}`);
        // Include original result if scraping fails
        enhancedResults.push(result);
      }
    }

    return enhancedResults;
  }

  /**
   * Check if URL points to actual legal document vs news article
   */
  isLegalDocumentUrl(url) {
    const legalIndicators = [
      '/document/',
      '/decision/',
      '/ruling/',
      '/case/',
      '/judgment/',
      'съдебно-решение',
      'решение',
      'постановление',
      'определение',
    ];

    return legalIndicators.some((indicator) => url.toLowerCase().includes(indicator));
  }

  /**
   * Scrape full content from lex.bg page
   */
  async scrapeFullContent(url) {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'bg,en;q=0.9',
        },
        timeout: 15000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const scrapedContent = this.extractLegalContent($);

      // Cache the result
      this.cache.set(url, scrapedContent);

      return scrapedContent;
    } catch (error) {
      console.log(`Error scraping ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract legal content from lex.bg page HTML
   */
  extractLegalContent($) {
    const content = {
      text: '',
      contentType: 'unknown',
      citations: [],
      partyAnalysis: {},
      caseDetails: {},
    };

    // Try different selectors for content extraction
    const contentSelectors = [
      '.document-content',
      '.article-content',
      '.decision-text',
      '.legal-text',
      '.main-content',
      '#content',
      '.content',
      'article',
      '.post-content',
    ];

    let mainText = '';
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        mainText = element.text().trim();
        break;
      }
    }

    if (!mainText) {
      // Fallback - get all paragraph text
      mainText = $('p')
        .map((i, el) => $(el).text())
        .get()
        .join('\n')
        .trim();
    }

    content.text = mainText;

    // Determine content type
    content.contentType = this.determineContentType(mainText, $);

    // Extract legal citations
    content.citations = this.extractCitations(mainText);

    // Analyze parties involved
    content.partyAnalysis = this.analyzeParties(mainText);

    // Extract case details
    content.caseDetails = this.extractCaseDetails(mainText, $);

    return content;
  }

  /**
   * Determine if content is a court decision, law, regulation, etc.
   */
  determineContentType(text, $) {
    const textLower = text.toLowerCase();

    // Check for court decision indicators
    const courtIndicators = [
      'съдебно решение',
      'решение',
      'постановление',
      'определение',
      'касационно решение',
      'тълкувателно решение',
      'обединително решение',
      'върховен касационен съд',
      'вкс',
      'апелативен съд',
      'районен съд',
      'административен съд',
      'специализиран наказателен съд',
    ];

    const lawIndicators = ['закон', 'кодекс', 'наредба', 'правилник', 'устав'];

    const regulationIndicators = [
      'постановление на министерския съвет',
      'пмс',
      'наредба',
      'правила',
    ];

    if (courtIndicators.some((indicator) => textLower.includes(indicator))) {
      return 'court_decision';
    } else if (lawIndicators.some((indicator) => textLower.includes(indicator))) {
      return 'legislation';
    } else if (regulationIndicators.some((indicator) => textLower.includes(indicator))) {
      return 'regulation';
    }

    return 'other';
  }

  /**
   * Extract legal citations from text
   */
  extractCitations(text) {
    const citations = [];

    // Bulgarian legal citation patterns
    const patterns = [
      /чл\.\s*\d+[а-я]?\s*(?:,\s*ал\.\s*\d+)?\s*(?:от|на)\s*([А-Я][а-я\s]+(?:кодекс|закон))/gi,
      /член\s*\d+[а-я]?\s*(?:,\s*алинея\s*\d+)?\s*(?:от|на)\s*([А-Я][а-я\s]+(?:кодекс|закон))/gi,
      /§\s*\d+\s*(?:от|на)\s*([А-Я][а-я\s]+)/gi,
      /(ГК|ТЗ|НК|ГПК|НПК|КТ|ЗЗД)\s*-?\s*чл\.\s*\d+/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        citations.push(match[0].trim());
      }
    });

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Analyze parties involved and liability
   */
  analyzeParties(text) {
    const analysis = {
      parties: [],
      liability: 'unknown',
      outcome: 'unknown',
    };

    const textLower = text.toLowerCase();

    // Extract party types
    const partyPatterns = [
      { type: 'seller', patterns: ['продавач', 'продавача'] },
      { type: 'buyer', patterns: ['купувач', 'купувача', 'покупател'] },
      { type: 'plaintiff', patterns: ['ищец', 'ищеца'] },
      { type: 'defendant', patterns: ['ответник', 'ответника'] },
      { type: 'contractor', patterns: ['изпълнител', 'подизпълнител'] },
      { type: 'client', patterns: ['възложител', 'клиент'] },
    ];

    partyPatterns.forEach(({ type, patterns }) => {
      if (patterns.some((pattern) => textLower.includes(pattern))) {
        analysis.parties.push(type);
      }
    });

    // Determine liability
    const liabilityPatterns = {
      seller_liable: [
        'продавач.*отговор',
        'продавач.*виновен',
        'продавач.*задължен',
        'продавач.*възстанов',
        'продавач.*обезщет',
      ],
      buyer_liable: ['купувач.*отговор', 'купувач.*виновен', 'купувач.*задължен'],
      plaintiff_wins: ['иск.*уважен', 'в полза на ищеца', 'присъди.*иск'],
      defendant_wins: ['иск.*отхвърлен', 'ответник.*оправдан', 'неоснователен.*иск'],
    };

    Object.entries(liabilityPatterns).forEach(([liability, patterns]) => {
      if (patterns.some((pattern) => new RegExp(pattern, 'i').test(textLower))) {
        analysis.liability = liability;
      }
    });

    return analysis;
  }

  /**
   * Extract case details like court, date, case number
   */
  extractCaseDetails(text, $) {
    const details = {};

    // Extract case number
    const caseNumberPatterns = [
      /№\s*\d+\/\d{4}/g,
      /дело\s*№\s*\d+\/\d{4}/gi,
      /дд\s*№\s*\d+\/\d{4}/gi,
    ];

    caseNumberPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        details.caseNumber = matches[0];
      }
    });

    // Extract court name
    const courtPatterns = [
      /върховен\s+касационен\s+съд/gi,
      /апелативен\s+съд\s+[а-я\s]+/gi,
      /районен\s+съд\s+[а-я\s]+/gi,
      /административен\s+съд\s+[а-я\s]+/gi,
    ];

    courtPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        details.court = matches[0];
      }
    });

    // Extract date
    const datePatterns = [/\d{1,2}\.\d{1,2}\.\d{4}/g, /\d{4}-\d{1,2}-\d{1,2}/g];

    datePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        details.date = matches[0];
      }
    });

    return details;
  }

  /**
   * Analyze legal content for relevance to search criteria
   */
  analyzeLegalContent(content, searchCriteria) {
    const analysis = {
      relevanceScore: 0,
      matchedCriteria: [],
      extractedInfo: {},
    };

    const text = content.text.toLowerCase();

    // Check legal article match
    if (searchCriteria.legalArticle) {
      const variations = this.generateArticleVariations(searchCriteria.legalArticle);
      if (variations.some((variant) => text.includes(variant.toLowerCase()))) {
        analysis.relevanceScore += 30;
        analysis.matchedCriteria.push('legal_article');
      }
    }

    // Check party liability
    if (
      searchCriteria.partyLiability &&
      content.partyAnalysis.liability === searchCriteria.partyLiability
    ) {
      analysis.relevanceScore += 25;
      analysis.matchedCriteria.push('party_liability');
    }

    // Check contract clause
    if (
      searchCriteria.contractClause &&
      text.includes(searchCriteria.contractClause.toLowerCase())
    ) {
      analysis.relevanceScore += 20;
      analysis.matchedCriteria.push('contract_clause');
    }

    // Check for VKS decisions
    if (text.includes('върховен касационен съд') || text.includes('вкс')) {
      analysis.relevanceScore += 15;
      analysis.matchedCriteria.push('vks_decision');
    }

    // Check content type
    if (content.contentType === 'court_decision') {
      analysis.relevanceScore += 10;
      analysis.matchedCriteria.push('court_decision');
    }

    analysis.extractedInfo = {
      contentType: content.contentType,
      parties: content.partyAnalysis.parties,
      liability: content.partyAnalysis.liability,
      citations: content.citations,
      caseDetails: content.caseDetails,
    };

    return analysis;
  }

  /**
   * Generate article variations for matching
   */
  generateArticleVariations(article) {
    const variations = [article];

    if (article.includes('чл.')) {
      variations.push(article.replace('чл.', 'член'));
      variations.push(article.replace('чл.', 'чл'));
    }

    // Add law expansions
    const lawExpansions = {
      ГК: ['Гражданския кодекс', 'граждански кодекс'],
      ТЗ: ['Търговския закон', 'търговски закон'],
      НК: ['Наказателния кодекс', 'наказателен кодекс'],
      ЗЗД: ['Закона за защита на данните'],
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
   * Enhanced search specifically for laws and legal documents
   */
  async searchLaws(searchCriteria) {
    console.log('📚 Performing enhanced law search...');

    // Force tree search for law-specific searches
    return await this.searchLegalDocuments({
      ...searchCriteria,
      useTreeSearch: true,
      relevanceThreshold: searchCriteria.relevanceThreshold || 70,
      includeFullContent: true,
    });
  }

  /**
   * Search for specific law by name or article
   */
  async findSpecificLaw(lawName, articleNumber = null) {
    console.log(
      `📖 Finding specific law: ${lawName}${articleNumber ? ` article ${articleNumber}` : ''}`,
    );

    const searchQuery = articleNumber ? `${lawName} чл. ${articleNumber}` : lawName;

    return await this.treeScraperService.searchLawTree({
      query: searchQuery,
      maxResults: 10,
      includeFullContent: true,
      relevanceThreshold: 80,
    });
  }

  /**
   * Get laws by category
   */
  async getLawsByCategory(category, maxResults = 15) {
    console.log(`🏛️ Getting laws by category: ${category}`);

    return await this.treeScraperService.searchLawTree({
      query: '',
      legalArea: category,
      maxResults,
      includeFullContent: false,
      relevanceThreshold: 50,
    });
  }

  /**
   * Cleanup method to properly close browser resources
   */
  async cleanup() {
    try {
      if (this.treeScraperService) {
        await this.treeScraperService.cleanup();
      }
      console.log('✅ LexBgService cleanup completed');
    } catch (error) {
      console.error('❌ Error during LexBgService cleanup:', error);
    }
  }

  /**
   * Get service status for monitoring
   */
  getStatus() {
    return {
      service: 'LexBgService',
      baseUrl: this.baseUrl,
      cacheSize: this.cache.size,
      treeScraperStatus: this.treeScraperService?.getStatus() || 'not_initialized',
      features: {
        ragIntegration: !!this.ragService,
        treeSearch: !!this.treeScraperService,
        deepAnalysis: true,
        multiStrategy: true,
      },
    };
  }
}

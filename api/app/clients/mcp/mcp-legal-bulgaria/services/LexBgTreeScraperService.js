/**
 * LexBg Law Tree Scraper Service
 * Enhanced Puppeteer-based scraper for navigating and searching the https://lex.bg/laws/tree/laws law tree
 * Provides intelligent law discovery and relevant legal document extraction
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

export class LexBgTreeScraperService {
  constructor() {
    this.baseUrl = 'https://lex.bg';
    this.lawTreeUrl = 'https://lex.bg/laws/tree/laws';
    this.cache = new Map();
    this.lawTreeCache = new Map(); // Cache for law tree structure
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minDelayMs = 1500; // 1.5 seconds between requests

    // Browser instance for reuse
    this.browser = null;
    this.browserRetries = 0;
    this.maxBrowserRetries = 3;

    // Anti-detection settings
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    // Bulgarian legal categories and keywords
    this.legalCategories = {
      'гражданско право': ['договор', 'задължение', 'собственост', 'наследство', 'семейно'],
      'наказателно право': ['престъпление', 'наказание', 'съд', 'разследване', 'обвинение'],
      'търговско право': ['търговец', 'дружество', 'концесия', 'регистрация', 'лицензиране'],
      'трудово право': ['труд', 'заплата', 'отпуск', 'работно време', 'осигуряване'],
      'административно право': ['администрация', 'актове', 'процедура', 'жалба', 'орган'],
      'данъчно право': ['данък', 'такса', 'декларация', 'облагане', 'освобождаване'],
      'европейско право': ['европейски', 'директива', 'регламент', 'съд на ес', 'хармонизация'],
    };

    // Law priority mapping for relevance scoring
    this.lawPriority = {
      конституция: 100,
      кодекс: 90,
      закон: 80,
      наредба: 70,
      правилник: 60,
      инструкция: 50,
      решение: 40,
    };
  }

  /**
   * Initialize browser instance with anti-detection measures
   */
  async initBrowser() {
    if (this.browser && !this.browser.disconnected) {
      return this.browser;
    }

    try {
      console.log('🚀 Initializing LexBg Tree browser...');

      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
          '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        slowMo: 150,
      });

      // Set up stealth measures
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        await this.setupStealthPage(pages[0]);
      }

      console.log('✅ LexBg Tree browser initialized successfully');
      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize LexBg Tree browser:', error);
      throw error;
    }
  }

  /**
   * Set up stealth measures for a page
   */
  async setupStealthPage(page) {
    // Remove automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Set random user agent
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    await page.setUserAgent(userAgent);

    // Set viewport
    await page.setViewport({
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 100),
    });

    // Set headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  /**
   * Main search function for law tree navigation and relevant law discovery
   */
  async searchLawTree(searchCriteria) {
    try {
      console.log('🌳 Starting LexBg law tree search with criteria:', searchCriteria);

      const {
        query = '',
        _legalArea = '',
        _lawType = '', // 'кодекс', 'закон', 'наредба', etc.
        maxResults = 20,
        includeFullContent = true,
        relevanceThreshold = 60,
      } = searchCriteria;

      // Rate limiting
      await this.enforceRateLimit();

      // Initialize browser
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      await this.setupStealthPage(page);

      let results = [];

      try {
        console.log('🌳 Loading law tree structure...');

        // Load and analyze law tree structure
        const treeStructure = await this.loadLawTreeStructure(page);

        console.log('🔍 Searching for relevant laws in tree...');

        // Find relevant laws based on search criteria
        const relevantLaws = this.findRelevantLaws(treeStructure, searchCriteria);

        console.log(`📚 Found ${relevantLaws.length} potentially relevant laws`);

        // Extract detailed content for each relevant law
        for (const law of relevantLaws.slice(0, maxResults)) {
          console.log(`📖 Extracting content for: ${law.title}`);

          const lawContent = await this.extractLawContent(page, law, includeFullContent);

          if (
            lawContent &&
            this.calculateRelevance(lawContent, searchCriteria) >= relevanceThreshold
          ) {
            results.push(lawContent);
          }

          // Small delay between law extractions
          await page.waitForTimeout(1000);
        }

        console.log('🔍 Performing supplementary searches...');

        // Perform supplementary searches for missed content
        const supplementaryResults = await this.performSupplementarySearches(page, searchCriteria);
        results = results.concat(supplementaryResults);
      } catch (searchError) {
        console.warn('⚠️ Tree search error, attempting fallback:', searchError.message);

        // Fallback to direct HTTP scraping
        const fallbackResults = await this.fallbackTreeSearch(query, maxResults);
        results = results.concat(fallbackResults);
      }

      await page.close();

      // Deduplicate and enhance results
      const uniqueResults = this.deduplicateResults(results);
      const enhancedResults = await this.enhanceResults(uniqueResults, searchCriteria);

      console.log(`✅ LexBg tree search completed: ${enhancedResults.length} relevant laws found`);

      return {
        success: true,
        results: enhancedResults.slice(0, maxResults),
        total: enhancedResults.length,
        source: 'lex.bg',
        searchMethod: 'law_tree_enhanced',
        metadata: {
          searchDate: new Date().toISOString(),
          searchCriteria,
          methodsUsed: ['tree_navigation', 'content_extraction', 'supplementary_search'],
          duplicatesRemoved: results.length - uniqueResults.length,
          relevanceThreshold,
        },
      };
    } catch (error) {
      console.error('❌ LexBg tree search failed:', error);

      return {
        success: false,
        error: error.message,
        results: [],
        source: 'lex.bg',
        searchMethod: 'law_tree_enhanced',
      };
    }
  }

  /**
   * Load and parse the law tree structure
   */
  async loadLawTreeStructure(page) {
    try {
      // Check cache first
      if (this.lawTreeCache.has('structure')) {
        const cached = this.lawTreeCache.get('structure');
        if (Date.now() - cached.timestamp < 3600000) {
          // 1 hour cache
          console.log('📋 Using cached law tree structure');
          return cached.data;
        }
      }

      console.log('🌳 Loading fresh law tree structure...');

      // Navigate to law tree page
      await page.goto(this.lawTreeUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for tree to load
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract tree structure
      const treeStructure = await page.evaluate(() => {
        const laws = [];

        // Look for various tree node selectors
        const selectors = [
          '.tree-node',
          '.law-item',
          '.legal-document',
          'a[href*="/laws/"]',
          'li',
          '.item',
          '[data-law]',
          '[data-document]',
        ];

        let foundElements = [];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            foundElements = Array.from(elements);
            break;
          }
        }

        // If no specific selectors found, look for links containing law keywords
        if (foundElements.length === 0) {
          foundElements = Array.from(document.querySelectorAll('a')).filter((link) => {
            const text = link.textContent || '';
            const href = link.href || '';
            return (
              href.includes('/laws/') ||
              text.includes('закон') ||
              text.includes('кодекс') ||
              text.includes('наредба') ||
              text.includes('правилник')
            );
          });
        }

        foundElements.forEach((element, index) => {
          try {
            const link = element.tagName === 'A' ? element : element.querySelector('a');
            const text = element.textContent || element.innerText || '';

            if (text.length > 5 && text.length < 500) {
              const law = {
                id: `law_${index}`,
                title: text.trim(),
                url: link ? new URL(link.href, window.location.origin).href : null,
                category: this.extractCategory(text),
                type: this.extractLawType(text),
                priority: this.calculatePriority(text),
                element: {
                  tagName: element.tagName,
                  className: element.className,
                  id: element.id,
                },
              };

              laws.push(law);
            }
          } catch (e) {
            console.warn('Error parsing law element:', e);
          }
        });

        return laws;
      });

      // Cache the structure
      this.lawTreeCache.set('structure', {
        data: treeStructure,
        timestamp: Date.now(),
      });

      console.log(`🌳 Law tree structure loaded: ${treeStructure.length} laws found`);
      return treeStructure;
    } catch (error) {
      console.warn('⚠️ Error loading law tree structure:', error.message);
      return [];
    }
  }

  /**
   * Find relevant laws based on search criteria
   */
  findRelevantLaws(treeStructure, criteria) {
    const { query, legalArea, lawType } = criteria;
    const queryLower = (query || '').toLowerCase();
    const legalAreaLower = (legalArea || '').toLowerCase();
    const lawTypeLower = (lawType || '').toLowerCase();

    return treeStructure
      .filter((law) => {
        let score = 0;

        // Query matching
        if (queryLower) {
          const titleLower = law.title.toLowerCase();
          const queryTerms = queryLower.split(/\s+/);

          for (const term of queryTerms) {
            if (titleLower.includes(term)) {
              score += 10;
            }
          }

          // Bonus for exact phrase matches
          if (titleLower.includes(queryLower)) {
            score += 20;
          }
        }

        // Legal area matching
        if (legalAreaLower && law.category.toLowerCase().includes(legalAreaLower)) {
          score += 25;
        }

        // Law type matching
        if (lawTypeLower && law.type.toLowerCase().includes(lawTypeLower)) {
          score += 15;
        }

        // Category keyword matching
        if (queryLower && this.legalCategories[law.category]) {
          for (const keyword of this.legalCategories[law.category]) {
            if (queryLower.includes(keyword)) {
              score += 5;
            }
          }
        }

        // Priority bonus
        score += law.priority * 0.1;

        law.relevanceScore = score;
        return score > 0;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract detailed content for a specific law
   */
  async extractLawContent(page, law, includeFullContent = true) {
    try {
      if (!law.url) {
        console.warn(`⚠️ No URL for law: ${law.title}`);
        return null;
      }

      console.log(`📖 Extracting content for: ${law.title}`);

      // Navigate to law page
      await page.goto(law.url, {
        waitUntil: 'networkidle2',
        timeout: 20000,
      });

      await page.waitForTimeout(2000);

      // Extract law content
      const content = await page.evaluate((includeFullContent) => {
        const result = {
          title: '',
          content: '',
          articles: [],
          metadata: {},
          fullText: '',
        };

        // Extract title
        const titleSelectors = [
          'h1',
          '.law-title',
          '.document-title',
          '.title',
          '[class*="title"]',
        ];

        for (const selector of titleSelectors) {
          const titleEl = document.querySelector(selector);
          if (titleEl && titleEl.textContent.trim()) {
            result.title = titleEl.textContent.trim();
            break;
          }
        }

        // Extract main content
        const contentSelectors = [
          '.law-content',
          '.document-content',
          '.legal-text',
          '.content',
          'main',
          '.main-content',
          '#content',
        ];

        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = document.querySelector(selector);
          if (contentElement) break;
        }

        if (!contentElement) {
          // Fallback to body content
          contentElement = document.body;
        }

        if (contentElement) {
          result.content = contentElement.textContent || contentElement.innerText || '';
          result.fullText = result.content;

          // Extract articles if available
          const articleSelectors = [
            '[class*="article"]',
            '[id*="article"]',
            '.чл',
            '[class*="член"]',
          ];

          for (const selector of articleSelectors) {
            const articles = contentElement.querySelectorAll(selector);
            if (articles.length > 0) {
              result.articles = Array.from(articles).map((article, index) => ({
                number: index + 1,
                text: article.textContent || article.innerText || '',
                id: article.id || `article_${index + 1}`,
              }));
              break;
            }
          }

          // Extract metadata
          const metaSelectors = {
            effectiveDate: ['.effective-date', '.date-effective', '[class*="дата"]'],
            publisher: ['.publisher', '.издател', '[class*="издател"]'],
            number: ['.number', '.номер', '[class*="номер"]'],
            year: ['.year', '.година', '[class*="година"]'],
          };

          for (const [key, selectors] of Object.entries(metaSelectors)) {
            for (const selector of selectors) {
              const element = contentElement.querySelector(selector);
              if (element && element.textContent.trim()) {
                result.metadata[key] = element.textContent.trim();
                break;
              }
            }
          }
        }

        // Truncate content if not including full content
        if (!includeFullContent && result.content.length > 1000) {
          result.content = result.content.substring(0, 1000) + '...';
        }

        return result;
      }, includeFullContent);

      // Enhance with additional metadata
      const enhancedContent = {
        ...content,
        ...law,
        url: law.url,
        source: 'lex.bg',
        extractedAt: new Date().toISOString(),
        wordCount: content.fullText.split(/\s+/).length,
        hasArticles: content.articles.length > 0,
        contentType: 'legal_document',
      };

      return enhancedContent;
    } catch (error) {
      console.warn(`⚠️ Error extracting content for ${law.title}:`, error.message);
      return null;
    }
  }

  /**
   * Perform supplementary searches for potentially missed content
   */
  async performSupplementarySearches(page, criteria) {
    const results = [];
    const { query } = criteria;

    if (!query) return results;

    try {
      console.log('🔍 Performing supplementary search...');

      // Search in main lex.bg search
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 20000,
      });

      await page.waitForTimeout(2000);

      const searchResults = await page.evaluate(() => {
        const results = [];
        const resultSelectors = [
          '.search-result',
          '.result-item',
          '.law-result',
          'a[href*="/laws/"]',
        ];

        let foundElements = [];
        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            foundElements = Array.from(elements);
            break;
          }
        }

        foundElements.slice(0, 5).forEach((element, _index) => {
          try {
            const link = element.tagName === 'A' ? element : element.querySelector('a');
            const title = element.textContent || element.innerText || '';

            if (title.length > 10 && link && link.href) {
              results.push({
                title: title.trim().substring(0, 200),
                url: new URL(link.href, window.location.origin).href,
                content: title.trim(),
                source: 'lex.bg',
                type: 'supplementary_search',
              });
            }
          } catch (e) {
            console.warn('Error parsing search result:', e);
          }
        });

        return results;
      });

      console.log(`🔍 Supplementary search found ${searchResults.length} additional results`);
      results.push(...searchResults);
    } catch (error) {
      console.warn('⚠️ Supplementary search failed:', error.message);
    }

    return results;
  }

  /**
   * Fallback HTTP-based tree search
   */
  async fallbackTreeSearch(query, maxResults = 10) {
    if (!query) return [];

    try {
      console.log('🔄 Attempting HTTP fallback tree search...');

      const response = await fetch(this.lawTreeUrl, {
        headers: {
          'User-Agent': this.userAgents[0],
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      // Extract law links and content
      $('a').each((_index, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const text = $el.text().trim();

        if (
          href &&
          href.includes('/laws/') &&
          text.length > 10 &&
          text.toLowerCase().includes(query.toLowerCase())
        ) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, this.baseUrl).href;

          results.push({
            title: text.substring(0, 200),
            content: text,
            url: fullUrl,
            source: 'lex.bg',
            type: 'fallback_tree_search',
          });
        }
      });

      console.log(`🔄 HTTP fallback found ${results.length} results`);
      return results.slice(0, maxResults);
    } catch (error) {
      console.warn('🔄 HTTP fallback tree search failed:', error.message);
      return [];
    }
  }

  /**
   * Calculate relevance score for a law document
   */
  calculateRelevance(lawContent, criteria) {
    let score = 0;
    const { query, legalArea, lawType } = criteria;

    const text = `${lawContent.title} ${lawContent.content}`.toLowerCase();
    const queryLower = (query || '').toLowerCase();

    // Query term matching
    if (queryLower) {
      const queryTerms = queryLower.split(/\s+/);
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 10;
        }
      }

      // Exact phrase bonus
      if (text.includes(queryLower)) {
        score += 20;
      }
    }

    // Legal area matching
    if (
      legalArea &&
      lawContent.category &&
      lawContent.category.toLowerCase().includes(legalArea.toLowerCase())
    ) {
      score += 25;
    }

    // Law type matching
    if (
      lawType &&
      lawContent.type &&
      lawContent.type.toLowerCase().includes(lawType.toLowerCase())
    ) {
      score += 15;
    }

    // Content quality bonus
    if (lawContent.articles && lawContent.articles.length > 0) {
      score += 10;
    }

    if (lawContent.wordCount > 100) {
      score += 5;
    }

    // Priority from tree structure
    if (lawContent.priority) {
      score += lawContent.priority * 0.1;
    }

    return score;
  }

  /**
   * Enhance results with additional metadata and analysis
   */
  async enhanceResults(results, criteria) {
    const enhanced = [];

    for (const result of results) {
      try {
        const enhancedResult = { ...result };

        // Add relevance scoring
        enhancedResult.relevanceScore = this.calculateRelevance(result, criteria);

        // Add legal classification
        enhancedResult.legalClassification = this.classifyLegalContent(result);

        // Add importance rating
        enhancedResult.importanceRating = this.assessImportance(result);

        // Add jurisdiction
        enhancedResult.jurisdiction = 'Bulgaria';

        // Add searchability metadata
        enhancedResult.searchMetadata = {
          hasArticles: result.articles && result.articles.length > 0,
          contentLength: result.content ? result.content.length : 0,
          wordCount: result.wordCount || 0,
          extractionMethod: result.type || 'tree_navigation',
        };

        enhanced.push(enhancedResult);
      } catch (error) {
        console.warn('⚠️ Error enhancing result:', error.message);
        enhanced.push(result);
      }
    }

    // Sort by relevance score
    return enhanced.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Classify legal content type
   */
  classifyLegalContent(result) {
    const text = `${result.title} ${result.content}`.toLowerCase();

    if (text.includes('конституци')) return 'constitution';
    if (text.includes('кодекс')) return 'code';
    if (text.includes('закон')) return 'law';
    if (text.includes('наредба')) return 'regulation';
    if (text.includes('правилник')) return 'rules';
    if (text.includes('инструкци')) return 'instruction';
    if (text.includes('решение')) return 'decision';

    return 'legal_document';
  }

  /**
   * Assess importance of a legal document
   */
  assessImportance(result) {
    let importance = 'medium';

    if (result.priority >= 90) importance = 'critical';
    else if (result.priority >= 80) importance = 'high';
    else if (result.priority >= 60) importance = 'medium';
    else importance = 'low';

    // Boost importance for documents with many articles
    if (result.articles && result.articles.length > 50) {
      if (importance === 'medium') importance = 'high';
      if (importance === 'low') importance = 'medium';
    }

    return importance;
  }

  /**
   * Remove duplicate results
   */
  deduplicateResults(results) {
    const seen = new Set();
    const unique = [];

    for (const result of results) {
      const key = result.title.toLowerCase().trim().substring(0, 100);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Rate limiting to be respectful to lex.bg servers
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelayMs) {
      const delay = this.minDelayMs - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Clean up browser resources
   */
  async cleanup() {
    if (this.browser && !this.browser.disconnected) {
      console.log('🧹 Cleaning up LexBg Tree browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      service: 'LexBgTreeScraperService',
      status: this.browser && !this.browser.disconnected ? 'active' : 'inactive',
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      lawTreeCacheSize: this.lawTreeCache.size,
      lastRequestTime: this.lastRequestTime,
      browserRetries: this.browserRetries,
    };
  }
}

/**
 * VKS (Supreme Court of Cassation) Scraper Service
 * Advanced web scraping service for https://vks.bg/ using Puppeteer
 * Handles complex search forms, dynamic content, and anti-detection measures
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

export class VKSScraperService {
  constructor() {
    this.baseUrl = 'https://www.vks.bg';
    this.searchUrl = 'https://www.vks.bg/справки-за-дела';
    this.cache = new Map();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minDelayMs = 2000; // 2 seconds between requests

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
  }

  /**
   * Initialize browser instance with anti-detection measures
   */
  async initBrowser() {
    if (this.browser && !this.browser.disconnected) {
      return this.browser;
    }

    try {
      console.log('🚀 Initializing VKS browser...');

      this.browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode
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
        slowMo: 100, // Add slight delay between actions
      });

      // Set up stealth measures
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        await this.setupStealthPage(pages[0]);
      }

      console.log('✅ VKS browser initialized successfully');
      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize VKS browser:', error);
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
   * Main search function for VKS decisions
   */
  async searchVKSDecisions(searchCriteria) {
    try {
      console.log('🔍 Starting VKS search with criteria:', searchCriteria);

      const {
        query = '',
        chamber = 'any', // 'civil', 'criminal', 'commercial', 'any'
        decisionType = 'any', // 'решение', 'определение', 'постановление', 'any'
        dateFrom = '',
        dateTo = '',
        caseNumber = '',
        maxResults = 20,
      } = searchCriteria;

      // Rate limiting
      await this.enforceRateLimit();

      // Initialize browser
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      await this.setupStealthPage(page);

      let results = [];

      try {
        // Try multiple search approaches
        console.log('📋 Attempting search form approach...');
        const formResults = await this.searchViaForm(page, searchCriteria);
        results = results.concat(formResults);

        console.log('🔍 Attempting general search approach...');
        const generalResults = await this.searchViaGeneralSearch(page, query, maxResults);
        results = results.concat(generalResults);

        console.log('📰 Attempting news search approach...');
        const newsResults = await this.searchViaNews(page, query, maxResults);
        results = results.concat(newsResults);
      } catch (searchError) {
        console.warn('⚠️ Search error, attempting fallback:', searchError.message);

        // Fallback to HTTP scraping
        const fallbackResults = await this.fallbackHttpSearch(query, maxResults);
        results = results.concat(fallbackResults);
      }

      await page.close();

      // Deduplicate and enhance results
      const uniqueResults = this.deduplicateResults(results);
      const enhancedResults = await this.enhanceResults(uniqueResults, searchCriteria);

      console.log(`✅ VKS search completed: ${enhancedResults.length} results found`);

      return {
        success: true,
        results: enhancedResults.slice(0, maxResults),
        total: enhancedResults.length,
        source: 'vks.bg',
        searchMethod: 'puppeteer_enhanced',
        metadata: {
          searchDate: new Date().toISOString(),
          searchCriteria,
          methodsUsed: ['form_search', 'general_search', 'news_search'],
          duplicatesRemoved: results.length - uniqueResults.length,
        },
      };
    } catch (error) {
      console.error('❌ VKS search failed:', error);

      return {
        success: false,
        error: error.message,
        results: [],
        source: 'vks.bg',
        searchMethod: 'puppeteer_enhanced',
      };
    }
  }

  /**
   * Search via VKS search form (primary method)
   */
  async searchViaForm(page, criteria) {
    try {
      console.log('📋 Navigating to VKS search form...');

      // Navigate to search page
      await page.goto(this.searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for page to load and look for search elements
      await page.waitForTimeout(2000);

      // Check if search form exists
      const hasSearchForm =
        (await page.$('form')) ||
        (await page.$('input[type="search"]')) ||
        (await page.$('input[type="text"]'));

      if (!hasSearchForm) {
        console.log('ℹ️ No search form found, trying alternative selectors...');

        // Try to find any input field
        const inputs = await page.$$('input');
        if (inputs.length === 0) {
          throw new Error('No input fields found on page');
        }
      }

      // Fill search form
      await this.fillSearchForm(page, criteria);

      // Submit and wait for results
      const results = await this.extractSearchResults(page);

      console.log(`📋 Form search found ${results.length} results`);
      return results;
    } catch (error) {
      console.warn('📋 Form search failed:', error.message);
      return [];
    }
  }

  /**
   * Fill the VKS search form
   */
  async fillSearchForm(page, criteria) {
    const { query, chamber, decisionType, dateFrom, dateTo, caseNumber } = criteria;

    try {
      // Look for various possible search input selectors
      const searchSelectors = [
        'input[name*="search"]',
        'input[name*="query"]',
        'input[name*="текст"]',
        'input[type="search"]',
        'input[placeholder*="търс"]',
        'input[placeholder*="search"]',
        '#search',
        '.search-input',
        'input[type="text"]',
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        searchInput = await page.$(selector);
        if (searchInput) {
          console.log(`📝 Found search input: ${selector}`);
          break;
        }
      }

      if (searchInput && query) {
        await searchInput.click();
        await searchInput.clear();
        await searchInput.type(query, { delay: 100 });
        console.log(`✏️ Entered search query: ${query}`);
      }

      // Look for case number field
      if (caseNumber) {
        const caseSelectors = [
          'input[name*="case"]',
          'input[name*="номер"]',
          'input[name*="дело"]',
          'input[placeholder*="номер"]',
        ];

        for (const selector of caseSelectors) {
          const caseInput = await page.$(selector);
          if (caseInput) {
            await caseInput.type(caseNumber, { delay: 100 });
            console.log(`📋 Entered case number: ${caseNumber}`);
            break;
          }
        }
      }

      // Look for chamber/court type selector
      if (chamber && chamber !== 'any') {
        const chamberSelectors = [
          'select[name*="chamber"]',
          'select[name*="колегия"]',
          'select[name*="court"]',
          'select[name*="съд"]',
        ];

        for (const selector of chamberSelectors) {
          const chamberSelect = await page.$(selector);
          if (chamberSelect) {
            const chamberValue = this.getChamberValue(chamber);
            await chamberSelect.selectOption({ label: chamberValue });
            console.log(`🏛️ Selected chamber: ${chamberValue}`);
            break;
          }
        }
      }

      // Look for date fields
      if (dateFrom) {
        const dateFromSelectors = [
          'input[name*="from"]',
          'input[name*="start"]',
          'input[name*="от"]',
          'input[type="date"]:first-of-type',
        ];

        for (const selector of dateFromSelectors) {
          const dateInput = await page.$(selector);
          if (dateInput) {
            await dateInput.type(dateFrom, { delay: 100 });
            console.log(`📅 Set date from: ${dateFrom}`);
            break;
          }
        }
      }

      if (dateTo) {
        const dateToSelectors = [
          'input[name*="to"]',
          'input[name*="end"]',
          'input[name*="до"]',
          'input[type="date"]:last-of-type',
        ];

        for (const selector of dateToSelectors) {
          const dateInput = await page.$(selector);
          if (dateInput) {
            await dateInput.type(dateTo, { delay: 100 });
            console.log(`📅 Set date to: ${dateTo}`);
            break;
          }
        }
      }

      // Submit the form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Търсене")',
        'button:contains("Search")',
        '.search-button',
        '#search-button',
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        const submitButton = await page.$(selector);
        if (submitButton) {
          console.log('🔍 Submitting search form...');
          await submitButton.click();
          submitted = true;
          break;
        }
      }

      if (!submitted) {
        // Try pressing Enter on search input
        if (searchInput) {
          await searchInput.press('Enter');
          console.log('⌨️ Submitted via Enter key');
        }
      }

      // Wait for results to load
      await page.waitForTimeout(3000);
    } catch (error) {
      console.warn('⚠️ Error filling search form:', error.message);
      throw error;
    }
  }

  /**
   * Extract search results from the page
   */
  async extractSearchResults(page) {
    try {
      await page.waitForTimeout(2000);

      const results = await page.evaluate(() => {
        const results = [];

        // Common result selectors for Bulgarian legal sites
        const resultSelectors = [
          '.result',
          '.search-result',
          '.result-item',
          '.decision',
          '.case',
          '.doc-item',
          'article',
          '.content-item',
          '.news-item',
          '[class*="result"]',
          '[class*="decision"]',
        ];

        let foundResults = [];

        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            foundResults = Array.from(elements);
            break;
          }
        }

        // If no structured results, look for any content blocks
        if (foundResults.length === 0) {
          foundResults = Array.from(document.querySelectorAll('div, article, section')).filter(
            (el) => {
              const text = el.innerText || '';
              return (
                text.length > 100 &&
                text.length < 2000 &&
                (text.includes('решение') ||
                  text.includes('дело') ||
                  text.includes('съд') ||
                  text.includes('касация'))
              );
            },
          );
        }

        foundResults.forEach((element, index) => {
          try {
            const titleEl =
              element.querySelector('h1, h2, h3, h4, .title, .heading, a[href]') ||
              element.querySelector('strong, b') ||
              element;

            const title = titleEl ? titleEl.innerText.trim() : `Решение ${index + 1}`;

            const linkEl =
              element.querySelector('a[href]') || element.closest('a') || titleEl?.closest('a');

            const url = linkEl ? new URL(linkEl.href, window.location.origin).href : null;

            const contentEl = element.querySelector('.content, .summary, .excerpt, p') || element;

            const content = contentEl ? contentEl.innerText.trim() : '';

            // Extract date if possible
            const dateRegex = /(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/;
            const dateMatch = content.match(dateRegex) || element.innerHTML.match(dateRegex);
            const date = dateMatch ? dateMatch[1] : null;

            // Extract case number if possible
            const caseRegex = /(?:дело|case|№)\s*[:\-]?\s*(\d+\/\d{4}|\d+\/\d{2})/i;
            const caseMatch = content.match(caseRegex) || element.innerHTML.match(caseRegex);
            const caseNumber = caseMatch ? caseMatch[1] : null;

            if (title && title.length > 10 && content.length > 50) {
              results.push({
                title: title.substring(0, 200),
                content: content.substring(0, 500),
                url,
                date,
                caseNumber,
                source: 'vks.bg',
              });
            }
          } catch (e) {
            console.warn('Error parsing result element:', e);
          }
        });

        return results;
      });

      console.log(`📄 Extracted ${results.length} results from page`);
      return results;
    } catch (error) {
      console.warn('⚠️ Error extracting results:', error.message);
      return [];
    }
  }

  /**
   * Search via general site search
   */
  async searchViaGeneralSearch(page, query, maxResults = 10) {
    if (!query) return [];

    try {
      console.log('🌐 Performing general site search...');

      // Go to main page first
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // Try to find site search
      const searchInput =
        (await page.$('input[type="search"]')) ||
        (await page.$('#search')) ||
        (await page.$('.search-input')) ||
        (await page.$('input[placeholder*="търс"]'));

      if (searchInput) {
        await searchInput.type(query, { delay: 100 });
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);

        return await this.extractSearchResults(page);
      }

      return [];
    } catch (error) {
      console.warn('🌐 General search failed:', error.message);
      return [];
    }
  }

  /**
   * Search via news/recent decisions section
   */
  async searchViaNews(page, query, maxResults = 10) {
    if (!query) return [];

    try {
      console.log('📰 Searching recent news/decisions...');

      // Navigate to news/recent decisions page
      const newsUrls = [
        `${this.baseUrl}/новини`,
        `${this.baseUrl}/news`,
        `${this.baseUrl}/press`,
        `${this.baseUrl}/пресофис`,
        `${this.baseUrl}`,
      ];

      for (const url of newsUrls) {
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

          // Look for recent decisions or news
          const newsItems = await page.evaluate((searchQuery) => {
            const items = [];
            const queryLower = searchQuery.toLowerCase();

            // Find news/decision elements
            const elements = document.querySelectorAll(
              'article, .news-item, .decision, .content-item, div',
            );

            for (const element of elements) {
              const text = element.innerText || '';

              if (text.length > 100 && text.toLowerCase().includes(queryLower)) {
                const titleEl = element.querySelector('h1, h2, h3, h4, .title, a') || element;
                const title = titleEl.innerText.trim().substring(0, 200);

                const linkEl = element.querySelector('a[href]') || element.closest('a');
                const url = linkEl ? new URL(linkEl.href, window.location.origin).href : null;

                const content = text.trim().substring(0, 500);

                if (title && content.length > 50) {
                  items.push({
                    title,
                    content,
                    url,
                    source: 'vks.bg',
                    type: 'news',
                  });
                }
              }
            }

            return items.slice(0, 10);
          }, query);

          if (newsItems.length > 0) {
            console.log(`📰 Found ${newsItems.length} news items`);
            return newsItems;
          }
        } catch (urlError) {
          console.warn(`📰 Failed to load ${url}:`, urlError.message);
          continue;
        }
      }

      return [];
    } catch (error) {
      console.warn('📰 News search failed:', error.message);
      return [];
    }
  }

  /**
   * Fallback HTTP-based search when Puppeteer fails
   */
  async fallbackHttpSearch(query, maxResults = 10) {
    if (!query) return [];

    try {
      console.log('🔄 Attempting HTTP fallback search...');

      const searchUrl = `${this.baseUrl}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgents[0],
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      // Extract any relevant content mentioning the query
      $('div, article, section, p').each((index, element) => {
        const text = $(element).text();
        if (text.length > 100 && text.toLowerCase().includes(query.toLowerCase())) {
          const title =
            $(element).find('h1, h2, h3, h4, .title').first().text() ||
            text.substring(0, 100) + '...';

          const url = $(element).find('a').first().attr('href');
          const fullUrl = url ? new URL(url, this.baseUrl).href : null;

          results.push({
            title: title.trim(),
            content: text.trim().substring(0, 500),
            url: fullUrl,
            source: 'vks.bg',
            type: 'fallback',
          });
        }
      });

      console.log(`🔄 HTTP fallback found ${results.length} results`);
      return results.slice(0, maxResults);
    } catch (error) {
      console.warn('🔄 HTTP fallback failed:', error.message);
      return [];
    }
  }

  /**
   * Enhanced result processing and content extraction
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

        // Add court information
        enhancedResult.court = 'Върховен касационен съд';
        enhancedResult.jurisdiction = 'Bulgaria';

        // Extract and normalize date
        if (result.date) {
          enhancedResult.date = this.normalizeDate(result.date);
        }

        // Add precedent value assessment
        enhancedResult.precedentValue = this.assessPrecedentValue(result);

        enhanced.push(enhancedResult);
      } catch (error) {
        console.warn('⚠️ Error enhancing result:', error.message);
        enhanced.push(result); // Add original if enhancement fails
      }
    }

    // Sort by relevance score
    return enhanced.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Calculate relevance score for search results
   */
  calculateRelevance(result, criteria) {
    let score = 0;
    const text = `${result.title} ${result.content}`.toLowerCase();
    const query = (criteria.query || '').toLowerCase();

    // Query term matching
    if (query) {
      const queryTerms = query.split(/\s+/);
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 10;
        }
      }
    }

    // Case number matching
    if (criteria.caseNumber && result.caseNumber) {
      if (result.caseNumber.includes(criteria.caseNumber)) {
        score += 50;
      }
    }

    // Chamber matching
    if (criteria.chamber && criteria.chamber !== 'any') {
      const chamberTerms = this.getChamberTerms(criteria.chamber);
      for (const term of chamberTerms) {
        if (text.includes(term)) {
          score += 20;
          break;
        }
      }
    }

    // Decision type matching
    if (criteria.decisionType && criteria.decisionType !== 'any') {
      if (text.includes(criteria.decisionType)) {
        score += 15;
      }
    }

    // VKS-specific terms boost
    const vksTerms = ['касационен', 'тълкувателен', 'обединителен', 'врховен'];
    for (const term of vksTerms) {
      if (text.includes(term)) {
        score += 5;
      }
    }

    return score;
  }

  /**
   * Classify legal content type
   */
  classifyLegalContent(result) {
    const text = `${result.title} ${result.content}`.toLowerCase();

    if (text.includes('тълкувателно') || text.includes('тълкуване')) {
      return 'interpretative_decision';
    }
    if (text.includes('обединително') || text.includes('обединяване')) {
      return 'unification_decision';
    }
    if (text.includes('касационно') || text.includes('касация')) {
      return 'cassation_decision';
    }
    if (text.includes('определение')) {
      return 'court_order';
    }
    if (text.includes('постановление')) {
      return 'ruling';
    }
    if (text.includes('решение')) {
      return 'decision';
    }

    return 'legal_document';
  }

  /**
   * Assess precedent value of VKS decisions
   */
  assessPrecedentValue(result) {
    const text = `${result.title} ${result.content}`.toLowerCase();

    if (text.includes('тълкувателно') || text.includes('тълкуване')) {
      return 'binding'; // Interpretative decisions are binding
    }
    if (text.includes('обединително') || text.includes('обединяване')) {
      return 'binding'; // Unification decisions are binding
    }
    if (text.includes('касационно') || text.includes('касация')) {
      return 'persuasive_high'; // Cassation decisions have high persuasive value
    }

    return 'persuasive';
  }

  /**
   * Helper methods
   */
  getChamberValue(chamber) {
    const chambers = {
      civil: 'Гражданска колегия',
      criminal: 'Наказателна колегия',
      commercial: 'Търговска колегия',
    };
    return chambers[chamber] || chamber;
  }

  getChamberTerms(chamber) {
    const terms = {
      civil: ['гражданска', 'граждански'],
      criminal: ['наказателна', 'наказателен'],
      commercial: ['търговска', 'търговски'],
    };
    return terms[chamber] || [chamber];
  }

  normalizeDate(dateStr) {
    if (!dateStr) return null;

    // Handle Bulgarian date format (DD.MM.YYYY)
    const bgDateMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (bgDateMatch) {
      return `${bgDateMatch[3]}-${bgDateMatch[2].padStart(2, '0')}-${bgDateMatch[1].padStart(2, '0')}`;
    }

    // Handle ISO format
    const isoDateMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDateMatch) {
      return dateStr;
    }

    return dateStr;
  }

  /**
   * Remove duplicate results
   */
  deduplicateResults(results) {
    const seen = new Set();
    const unique = [];

    for (const result of results) {
      // Create a key based on title and content similarity
      const key = result.title.toLowerCase().trim().substring(0, 100);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Rate limiting to be respectful to VKS servers
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
      console.log('🧹 Cleaning up VKS browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      service: 'VKSScraperService',
      status: this.browser && !this.browser.disconnected ? 'active' : 'inactive',
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      lastRequestTime: this.lastRequestTime,
      browserRetries: this.browserRetries,
    };
  }
}

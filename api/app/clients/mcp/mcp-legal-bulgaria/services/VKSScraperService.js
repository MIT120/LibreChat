/**
 * VKS (Supreme Court of Cassation) Scraper Service
 * Advanced web scraping service for https://vks.bg/ using Puppeteer
 * Handles complex search forms, dynamic content, and anti-detection measures
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import axios from 'axios';
import puppeteer from 'puppeteer';

export class VKSScraperService {
  constructor() {
    this.baseUrl = 'https://www.vks.bg';
    this.searchUrl = 'https://www.vks.bg/справки-за-дела';
    this.cache = new Map();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minDelayMs = 2000; // 2 seconds between requests

    // Initialize Firecrawl integration
    this.firecrawlApiUrl = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    this.useFirecrawl = !!this.firecrawlApiKey;

    // Browser instance for reuse (fallback)
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
        useFirecrawl = this.useFirecrawl,
      } = searchCriteria;

      // Rate limiting
      await this.enforceRateLimit();

      let results = [];
      let searchMethod = 'puppeteer_enhanced';

      // Try Firecrawl first if available
      if (useFirecrawl && this.firecrawlApiKey) {
        console.log('🔥 Attempting VKS search with Firecrawl...');
        try {
          const firecrawlResults = await this.searchVKSWithFirecrawl(searchCriteria);
          if (firecrawlResults.success && firecrawlResults.results.length > 0) {
            console.log(`✅ Firecrawl found ${firecrawlResults.results.length} VKS results`);
            results = firecrawlResults.results;
            searchMethod = 'firecrawl_enhanced';
          }
        } catch (firecrawlError) {
          console.warn('⚠️ Firecrawl failed, falling back to Puppeteer:', firecrawlError.message);
        }
      }

      // Fallback to Puppeteer if Firecrawl didn't work or not available
      if (results.length === 0) {
        console.log('🤖 Falling back to Puppeteer search...');

        // Initialize browser
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        await this.setupStealthPage(page);

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
      }

      // Deduplicate and enhance results
      const uniqueResults = this.deduplicateResults(results);
      const enhancedResults = await this.enhanceResults(uniqueResults, searchCriteria);

      console.log(
        `✅ VKS search completed: ${enhancedResults.length} results found using ${searchMethod}`,
      );

      return {
        success: true,
        results: enhancedResults.slice(0, maxResults),
        total: enhancedResults.length,
        source: 'vks.bg',
        searchMethod,
        metadata: {
          searchDate: new Date().toISOString(),
          searchCriteria,
          methodsUsed:
            searchMethod === 'firecrawl_enhanced'
              ? ['firecrawl']
              : ['form_search', 'general_search', 'news_search'],
          duplicatesRemoved: results.length - uniqueResults.length,
          usingFirecrawl: searchMethod === 'firecrawl_enhanced',
        },
      };
    } catch (error) {
      console.error('❌ VKS search failed:', error);

      return {
        success: false,
        error: error.message,
        results: [],
        source: 'vks.bg',
        searchMethod: 'error',
      };
    }
  }

  /**
   * Search VKS using Firecrawl with vector database integration
   */
  async searchVKSWithFirecrawl(searchCriteria) {
    try {
      const {
        query = '',
        chamber = 'any',
        decisionType = 'any',
        dateFrom = '',
        dateTo = '',
        caseNumber = '',
        maxResults = 20,
        storeResults = true,
      } = searchCriteria;

      console.log(`🔥 Firecrawl VKS search for: "${query}" with vector DB integration`);

      // Initialize RAG service if not available
      if (!this.ragService) {
        const { RagIntegrationService } = await import('./RagIntegrationService.js');
        this.ragService = new RagIntegrationService();
      }

      // First check vector database for existing VKS content
      let vectorResults = [];
      if (process.env.RAG_API_URL) {
        try {
          console.log('📚 Checking vector database for existing VKS content...');
          const ragQuery =
            `VKS ВКС Върховен касационен съд ${query} ${chamber} ${decisionType}`.trim();
          const ragResponse = await this.ragService.queryLegalDocuments(ragQuery, maxResults, 0.75);

          if (ragResponse.success && ragResponse.results.length > 0) {
            console.log(`✅ Found ${ragResponse.results.length} VKS results in vector database`);
            vectorResults = ragResponse.results.map((result) => ({
              title: result.metadata?.title || 'ВКС решение',
              summary: result.content?.substring(0, 400) || '',
              url: result.metadata?.url || result.metadata?.source_url || '',
              date: result.metadata?.date || '',
              caseNumber: result.metadata?.case_number || '',
              court: 'Върховен касационен съд',
              chamber: result.metadata?.chamber || chamber,
              decisionType: result.metadata?.decision_type || decisionType,
              source: 'vks.bg',
              extractedBy: 'vector_db',
              precedentValue: 'high',
              legalSignificance: result.metadata?.legal_significance || 9,
              vectorScore: result.similarity_score || 0,
              metadata: result.metadata,
            }));
          }
        } catch (ragError) {
          console.warn('⚠️ Vector DB query failed:', ragError.message);
        }
      }

      // If we have good results from vector DB, return them
      if (vectorResults.length >= Math.min(maxResults, 5)) {
        console.log(`📚 Using ${vectorResults.length} VKS results from vector database`);
        return {
          success: true,
          results: vectorResults.slice(0, maxResults),
          total: vectorResults.length,
          source: 'vks.bg',
          method: 'vector_db',
          vectorDbUsed: true,
        };
      }

      // Otherwise, proceed with Firecrawl scraping
      console.log('🔥 Proceeding with VKS Firecrawl scraping...');

      // Build VKS search URLs
      const searchUrls = [
        `${this.baseUrl}/справки-за-дела`,
        `${this.baseUrl}/решения-и-постановления`,
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`,
        `${this.baseUrl}/?s=${encodeURIComponent(query)}`,
      ];

      // Check local cache first
      const cacheKey = `firecrawl_vks_${query}_${chamber}_${decisionType}_${caseNumber}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
        if (ageHours < 8) {
          // Reduced cache time since we have vector DB
          console.log('📋 Using cached Firecrawl VKS result');
          return cached.data;
        }
      }

      let bestResult = { success: false, results: [] };

      // Try each search URL
      for (const searchUrl of searchUrls) {
        try {
          console.log(`🔥 Attempting VKS Firecrawl for: ${searchUrl}`);

          // Check if Firecrawl is properly configured
          if (!this.firecrawlApiKey) {
            console.log(
              '⚠️ Firecrawl API key not configured for VKS, falling back to traditional scraping',
            );
            throw new Error('Firecrawl API key not configured');
          }

          const crawlResponse = await axios.post(
            `${this.firecrawlApiUrl}/v1/crawl`,
            {
              url: searchUrl,
              limit: 5,
              scrapeOptions: {
                formats: ['markdown', 'html'],
                onlyMainContent: true,
                includeTags: [
                  'article',
                  'main',
                  'content',
                  'div[class*="decision"]',
                  'div[class*="case"]',
                  'div[class*="ruling"]',
                  'div[class*="result"]',
                  'h1',
                  'h2',
                  'h3',
                  'h4',
                  'p',
                  'a',
                  'span[class*="date"]',
                  'span[class*="number"]',
                  'div[class*="summary"]',
                ],
                excludeTags: [
                  'nav',
                  'footer',
                  'header',
                  'aside',
                  'advertisement',
                  'script',
                  'style',
                  'meta',
                  'link',
                  'form',
                  'input',
                ],
                waitFor: 3000,
                blockAds: true,
                removeBase64Images: true,
              },
              crawlerOptions: {
                followLinks: true,
                maxDepth: 2,
                allowSubdomains: false,
                respectRobotsTxt: true,
                includes: [
                  '**/decision/**',
                  '**/ruling/**',
                  '**/case/**',
                  '**/postanovlenie/**',
                  '**/reshenie/**',
                  '**/spravedlivost/**',
                ],
              },
            },
            {
              headers: {
                Authorization: `Bearer ${this.firecrawlApiKey}`,
                'Content-Type': 'application/json',
              },
              timeout: 60000,
            },
          );

          if (crawlResponse.data.success && crawlResponse.data.data) {
            const extractedResults = this.processVKSFirecrawlResults(
              crawlResponse.data.data,
              searchCriteria,
            );

            if (extractedResults.results.length > 0) {
              bestResult = extractedResults;
              break;
            }
          }
        } catch (urlError) {
          console.warn(`Firecrawl failed for VKS URL ${searchUrl}:`, urlError.message);

          // If this is a configuration error, fall back immediately to traditional scraping
          if (urlError.message.includes('API key') || urlError.message.includes('configuration')) {
            console.log(
              '🔄 Falling back to traditional VKS scraping due to configuration issue...',
            );
            return await this.searchVKSDecisions(searchCriteria);
          }
          continue;
        }
      }

      // Store new results in vector database
      if (
        bestResult.success &&
        bestResult.results.length > 0 &&
        storeResults &&
        process.env.RAG_API_URL
      ) {
        try {
          console.log(
            `💾 Storing ${bestResult.results.length} new VKS results in vector database...`,
          );
          await this.storeVKSResultsInVectorDB(bestResult.results, searchCriteria);
        } catch (storeError) {
          console.warn('⚠️ Failed to store VKS results in vector DB:', storeError.message);
        }
      }

      // Combine vector results with new results if any
      const combinedResults = [...vectorResults, ...bestResult.results];
      const uniqueResults = this.deduplicateVKSResults(combinedResults);

      // Cache successful result
      if (bestResult.success) {
        this.cache.set(cacheKey, {
          data: bestResult,
          timestamp: Date.now(),
        });
      }

      const finalResult = {
        success: uniqueResults.length > 0,
        results: uniqueResults.slice(0, maxResults),
        total: uniqueResults.length,
        source: 'vks.bg',
        method: vectorResults.length > 0 ? 'hybrid_vector_firecrawl' : 'firecrawl',
        vectorDbUsed: vectorResults.length > 0,
        newResultsStored: bestResult.results.length,
      };

      return finalResult;
    } catch (error) {
      console.error('🔥 Firecrawl VKS search failed:', error);

      // Fallback to traditional VKS scraping
      console.log('🔄 Falling back to traditional VKS scraping...');
      try {
        return await this.searchVKSDecisions(searchCriteria);
      } catch (fallbackError) {
        console.error('❌ Traditional VKS scraping also failed:', fallbackError);
        return {
          success: false,
          results: [],
          error: `Both Firecrawl and traditional scraping failed: ${error.message}`,
        };
      }
    }
  }

  /**
   * Process VKS Firecrawl results and extract court decisions
   */
  processVKSFirecrawlResults(crawlData, searchCriteria) {
    const { query = '', chamber = 'any', decisionType = 'any', maxResults = 20 } = searchCriteria;
    const results = [];
    const processedUrls = new Set();

    console.log(`🔍 Processing ${crawlData.length} VKS Firecrawl pages...`);

    for (const page of crawlData) {
      if (!page.markdown && !page.html) continue;
      if (processedUrls.has(page.url)) continue;

      processedUrls.add(page.url);

      try {
        // Use markdown content if available, otherwise HTML
        const content = page.markdown || page.html;
        const extractedDecisions = this.extractVKSDecisionsFromContent(
          content,
          page.url,
          searchCriteria,
        );

        results.push(...extractedDecisions);

        if (results.length >= maxResults) break;
      } catch (error) {
        console.warn(`Failed to process VKS page ${page.url}:`, error.message);
      }
    }

    // Remove duplicates and sort by VKS relevance
    const uniqueResults = this.deduplicateVKSResults(results);
    const sortedResults = this.sortVKSResultsByRelevance(uniqueResults, searchCriteria);

    console.log(`✅ Firecrawl extracted ${sortedResults.length} unique VKS decisions`);

    return {
      success: true,
      results: sortedResults.slice(0, maxResults),
      total: sortedResults.length,
      source: 'vks.bg',
      method: 'firecrawl',
      processedPages: crawlData.length,
    };
  }

  /**
   * Extract VKS decisions from Firecrawl content
   */
  extractVKSDecisionsFromContent(content, url, searchCriteria) {
    const decisions = [];

    // Split content into potential decision blocks
    const sections = this.splitVKSContentIntoDecisions(content);

    for (const section of sections) {
      const decision = this.parseVKSDecisionSection(section, url, searchCriteria);
      if (decision && this.isValidVKSDecision(decision, searchCriteria)) {
        decisions.push(decision);
      }
    }

    return decisions;
  }

  /**
   * Split VKS content into logical decision sections
   */
  splitVKSContentIntoDecisions(content) {
    // VKS-specific separators for court decisions
    const separators = [
      /\n#{1,3}\s*(?:решение|постановление|определение)/gi, // Decision headers
      /\n(?:решение|постановление|определение)\s*№?\s*\d+/gi, // Decision numbers
      /\nдело\s*№?\s*\d+/gi, // Case numbers
      /\n\d{1,2}\.\d{1,2}\.\d{4}/g, // Dates
      /\n[А-Я]{2,}\s+[А-Я]{2,}/g, // Court names in caps
    ];

    let sections = [content];

    for (const separator of separators) {
      const newSections = [];
      for (const section of sections) {
        newSections.push(...section.split(separator));
      }
      sections = newSections;
    }

    // Filter sections that might contain court decisions
    return sections.filter((section) => {
      const sectionLower = section.toLowerCase();
      return (
        section.trim().length > 100 &&
        (sectionLower.includes('решение') ||
          sectionLower.includes('постановление') ||
          sectionLower.includes('определение') ||
          sectionLower.includes('съд') ||
          sectionLower.includes('дело'))
      );
    });
  }

  /**
   * Parse a VKS decision section
   */
  parseVKSDecisionSection(section, url, searchCriteria) {
    try {
      let title = '';
      let summary = '';
      let decisionUrl = url;
      let date = '';
      let caseNumber = '';
      let court = 'Върховен касационен съд';
      let chamber = '';
      let decisionType = '';

      // Extract decision title
      const titleMatch = section.match(
        /(?:^|\n)(?:решение|постановление|определение)\s*(?:№?\s*\d+[\/\-\d]*)?[:\-\s]*([^\n]{20,120})/i,
      );
      if (titleMatch) {
        title = titleMatch[0].trim();
      } else {
        // Fallback title extraction
        const lines = section.split('\n').filter((line) => line.trim().length > 10);
        if (lines.length > 0) {
          title = lines[0].trim().substring(0, 100);
        }
      }

      // Extract case number
      const caseNumberMatch = section.match(/дело\s*№?\s*([№\d\/\-А-Я]+)/i);
      if (caseNumberMatch) {
        caseNumber = caseNumberMatch[1];
      }

      // Extract date
      const dateMatch = section.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (dateMatch) {
        date = dateMatch[1];
      }

      // Extract URL if different
      const urlMatch = section.match(/\]\(([^)]+)\)/) || section.match(/https?:\/\/[^\s\)]+/);
      if (urlMatch && urlMatch[1] && urlMatch[1].startsWith('http')) {
        decisionUrl = urlMatch[1];
      }

      // Determine chamber
      const sectionLower = section.toLowerCase();
      if (sectionLower.includes('гражданск') || sectionLower.includes('граждан')) {
        chamber = 'civil';
      } else if (sectionLower.includes('наказателн') || sectionLower.includes('криминал')) {
        chamber = 'criminal';
      } else if (sectionLower.includes('търговск') || sectionLower.includes('комерсиалн')) {
        chamber = 'commercial';
      }

      // Determine decision type
      if (sectionLower.includes('решение')) {
        decisionType = 'решение';
      } else if (sectionLower.includes('постановление')) {
        decisionType = 'постановление';
      } else if (sectionLower.includes('определение')) {
        decisionType = 'определение';
      }

      // Create summary (clean content)
      summary = section
        .replace(/#+\s*[^\n]*\n?/g, '') // Remove headlines
        .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove markdown links
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .trim()
        .substring(0, 400);

      return {
        title: title || 'ВКС решение',
        summary: this.cleanText(summary),
        url: decisionUrl,
        date: date,
        caseNumber: caseNumber,
        court: court,
        chamber: chamber,
        decisionType: decisionType,
        source: 'vks.bg',
        extractedBy: 'firecrawl',
        precedentValue: 'high', // VKS decisions have high precedent value
        legalSignificance: this.assessVKSLegalSignificance(section),
      };
    } catch (error) {
      console.warn('Error parsing VKS decision section:', error.message);
      return null;
    }
  }

  /**
   * Assess legal significance of VKS decision
   */
  assessVKSLegalSignificance(content) {
    const contentLower = content.toLowerCase();
    let score = 7; // Base score for VKS decisions

    // Increase score for important decision types
    if (contentLower.includes('тълкувателно') || contentLower.includes('обединително')) {
      score += 3;
    }
    if (contentLower.includes('принципно значение')) {
      score += 2;
    }
    if (contentLower.includes('колегия')) {
      score += 1;
    }

    return Math.min(10, score);
  }

  /**
   * Check if VKS decision is valid and relevant
   */
  isValidVKSDecision(decision, searchCriteria) {
    if (!decision.title || decision.title.length < 5) return false;
    if (!decision.summary || decision.summary.length < 30) return false;

    const { query = '', chamber = 'any', decisionType = 'any' } = searchCriteria;

    // Check chamber filter
    if (chamber !== 'any' && decision.chamber && decision.chamber !== chamber) {
      return false;
    }

    // Check decision type filter
    if (
      decisionType !== 'any' &&
      decision.decisionType &&
      !decision.decisionType.toLowerCase().includes(decisionType.toLowerCase())
    ) {
      return false;
    }

    // Check query relevance
    if (query) {
      const queryTerms = query.toLowerCase().split(/\s+/);
      const decisionText = `${decision.title} ${decision.summary}`.toLowerCase();

      const matchedTerms = queryTerms.filter(
        (term) => term.length > 2 && decisionText.includes(term),
      );

      // At least 40% of meaningful query terms should match for VKS
      return matchedTerms.length >= Math.max(1, Math.floor(queryTerms.length * 0.4));
    }

    return true;
  }

  /**
   * Remove duplicate VKS results
   */
  deduplicateVKSResults(results) {
    const seen = new Map();
    const unique = [];

    for (const result of results) {
      const key = `${result.caseNumber}_${result.title.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Sort VKS results by legal relevance and precedent value
   */
  sortVKSResultsByRelevance(results, searchCriteria) {
    const { query = '' } = searchCriteria;
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2);

    return results
      .map((result) => {
        const resultText = `${result.title} ${result.summary}`.toLowerCase();
        let score = 0;

        // Base score for legal significance
        score += (result.legalSignificance || 7) * 5;

        // Count term matches
        for (const term of queryTerms) {
          if (resultText.includes(term)) {
            score += term.length * 2; // VKS terms are more valuable
          }
        }

        // Bonus for exact phrase matches
        if (query && resultText.includes(query.toLowerCase())) {
          score += 30;
        }

        // Bonus for decision types (interpretative decisions are most important)
        if (result.decisionType) {
          if (result.decisionType.includes('тълкувателно')) {
            score += 25;
          } else if (result.decisionType.includes('обединително')) {
            score += 20;
          } else if (result.decisionType.includes('решение')) {
            score += 15;
          }
        }

        // Bonus for recent dates
        if (result.date) {
          const year = parseInt(result.date.match(/\d{4}/)?.[0]);
          if (year && year >= new Date().getFullYear() - 3) {
            score += 10;
          }
        }

        // Bonus for case numbers (more specific)
        if (result.caseNumber) {
          score += 8;
        }

        return { ...result, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
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
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

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
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
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
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

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
   * Store VKS results in vector database for future retrieval
   */
  async storeVKSResultsInVectorDB(results, searchCriteria) {
    try {
      const { query = '', chamber = 'any', decisionType = 'any' } = searchCriteria;

      console.log(`💾 Storing ${results.length} VKS decisions in vector database...`);

      for (const result of results) {
        try {
          const documentData = {
            title: `VKS: ${result.title}`,
            content: this.formatVKSResultForVectorDB(result, searchCriteria),
            metadata: {
              title: result.title,
              url: result.url,
              source_url: result.url,
              date: result.date,
              case_number: result.caseNumber,
              court: result.court,
              chamber: result.chamber,
              decision_type: result.decisionType,
              search_query: query,
              search_chamber: chamber,
              search_decision_type: decisionType,
              source: 'vks.bg',
              extraction_method: result.extractedBy || 'firecrawl',
              precedent_value: result.precedentValue || 'high',
              legal_significance: result.legalSignificance || 9,
              relevance_score: result.relevanceScore || 0,
              timestamp: new Date().toISOString(),
            },
            source: 'vks_firecrawl',
          };

          await this.ragService.storeLegalDocument(documentData);
          console.log(`✅ Stored VKS: ${result.title.substring(0, 50)}...`);
        } catch (docError) {
          console.warn(`⚠️ Failed to store VKS decision "${result.title}":`, docError.message);
        }
      }

      console.log(`✅ Successfully stored ${results.length} VKS decisions in vector database`);
    } catch (error) {
      console.error('❌ Failed to store VKS results in vector DB:', error);
      throw error;
    }
  }

  /**
   * Format VKS result for optimal vector database storage
   */
  formatVKSResultForVectorDB(result, searchCriteria) {
    const sections = [];

    // Add structured information
    sections.push(`ИЗТОЧНИК: Върховен касационен съд (${result.url})`);
    sections.push(`ЗАГЛАВИЕ: ${result.title}`);
    sections.push(`СЪД: ${result.court}`);

    if (result.caseNumber) {
      sections.push(`ДЕЛО №: ${result.caseNumber}`);
    }

    if (result.date) {
      sections.push(`ДАТА: ${result.date}`);
    }

    if (result.chamber && result.chamber !== 'any') {
      sections.push(`КОЛЕГИЯ: ${result.chamber}`);
    }

    if (result.decisionType && result.decisionType !== 'any') {
      sections.push(`ТИП РЕШЕНИЕ: ${result.decisionType}`);
    }

    sections.push(`ПРЕЦЕДЕНТНА СТОЙНОСТ: ${result.precedentValue || 'high'}`);
    sections.push(`ПРАВНА ЗНАЧИМОСТ: ${result.legalSignificance || 9}/10`);
    sections.push(`ТЪРСЕН ТЕРМИН: ${searchCriteria.query || ''}`);
    sections.push('');
    sections.push('СЪДЪРЖАНИЕ:');
    sections.push(result.summary || '');

    // Add additional metadata if available
    if (result.metadata) {
      sections.push('');
      sections.push('ДОПЪЛНИТЕЛНА ИНФОРМАЦИЯ:');
      Object.entries(result.metadata).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          sections.push(`${key.toUpperCase()}: ${value}`);
        }
      });
    }

    return sections.join('\n');
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
      firecrawlEnabled: this.useFirecrawl,
      vectorDbEnabled: !!process.env.RAG_API_URL,
    };
  }
}

/**
 * АПИС (APIS) Integration Service
 * Provides real-time access to Bulgarian legal information from apis.bg
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { RagIntegrationService } from './RagIntegrationService.js';

export class ApisService {
  constructor() {
    this.baseUrl = 'https://apis.bg';
    this.webUrl = 'https://web.apis.bg';
    this.searchEndpoint = '/search';

    // Initialize RAG integration
    this.ragService = new RagIntegrationService();

    // Request headers to mimic browser behavior
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      Referer: 'https://apis.bg/',
    };

    // АПИС database types
    this.databases = {
      law: 'Българско право',
      eu_law: 'Право на ЕС',
      finance: 'Финансова информация',
      company: 'Фирмена информация',
      gdpr: 'GDPR съответствие',
      construction: 'Строителство',
    };
  }

  /**
   * Search Bulgarian legislation and case law in АПИС with RAG integration
   */
  async searchLegislation(searchCriteria) {
    const { useRag = true, storeResults = true } = searchCriteria;

    if (useRag && process.env.RAG_API_URL) {
      return await this.ragService.enhancedLegalSearch(
        searchCriteria.query || '',
        (query) => this.performLiveLegislationSearch({ ...searchCriteria, query }),
        { storeResults, useRagFirst: true },
      );
    }

    return await this.performLiveLegislationSearch(searchCriteria);
  }

  /**
   * Perform live legislation search (original implementation)
   */
  async performLiveLegislationSearch(searchCriteria) {
    try {
      const {
        query = '',
        database = 'law',
        dateFrom = '',
        dateTo = '',
        documentType = '',
        limit = 20,
      } = searchCriteria;

      // Try different search approaches
      const results = await Promise.all([
        this.searchMainSite(query, database, limit),
        this.searchBlog(query, limit),
        this.searchNews(query, limit),
      ]);

      // Combine and deduplicate results
      const combinedResults = this.combineSearchResults(results);

      return {
        success: true,
        results: combinedResults.slice(0, limit),
        total: combinedResults.length,
        source: 'АПИС',
        databases_searched: [database, 'blog', 'news'],
      };
    } catch (error) {
      console.error('Error searching АПИС:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Search main АПИС site
   */
  async searchMainSite(query, database, limit) {
    try {
      const searchUrl = `${this.baseUrl}/bg/search?q=${encodeURIComponent(query)}&db=${database}`;

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        console.warn(`АПИС main site search failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseMainSiteResults(html);
    } catch (error) {
      console.warn('Error searching АПИС main site:', error.message);
      return [];
    }
  }

  /**
   * Search АПИС blog for legal updates
   */
  async searchBlog(query, limit = 10) {
    try {
      const blogUrl = `https://blog.apis.bg/?s=${encodeURIComponent(query)}`;

      const response = await fetch(blogUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        console.warn(`АПИС blog search failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseBlogResults(html, limit);
    } catch (error) {
      console.warn('Error searching АПИС blog:', error.message);
      return [];
    }
  }

  /**
   * Search АПИС news and updates
   */
  async searchNews(query, limit = 10) {
    try {
      const newsUrl = `${this.baseUrl}/bg/news?search=${encodeURIComponent(query)}`;

      const response = await fetch(newsUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        console.warn(`АПИС news search failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseNewsResults(html, limit);
    } catch (error) {
      console.warn('Error searching АПИС news:', error.message);
      return [];
    }
  }

  /**
   * Parse main site search results
   */
  parseMainSiteResults(html) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      // Look for search results in various possible containers
      $('.search-result, .result-item, .document-item, article, .content-item').each(
        (index, element) => {
          const $el = $(element);

          const title = $el
            .find('h1, h2, h3, h4, .title, .document-title, a')
            .first()
            .text()
            .trim();
          const summary = $el.find('.summary, .excerpt, .description, p').first().text().trim();
          const link = $el.find('a').first().attr('href');
          const date = $el.find('.date, .publish-date, time, .timestamp').first().text().trim();
          const type = $el.find('.type, .category, .document-type').first().text().trim();

          if (title && title.length > 3) {
            results.push({
              title,
              summary: summary || '',
              url: link ? this.normalizeUrl(link) : '',
              date: date || '',
              type: type || 'Документ',
              source: 'АПИС - Основен сайт',
            });
          }
        },
      );

      return results;
    } catch (error) {
      console.error('Error parsing АПИС main site results:', error);
      return [];
    }
  }

  /**
   * Parse blog search results
   */
  parseBlogResults(html, limit) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      $('.post, article, .blog-post, .entry').each((index, element) => {
        if (index >= limit) return false;

        const $el = $(element);

        const title = $el.find('h1, h2, h3, .entry-title, .post-title').first().text().trim();
        const summary = $el
          .find('.entry-content, .post-content, .excerpt, p')
          .first()
          .text()
          .trim();
        const link = $el
          .find('h1 a, h2 a, h3 a, .entry-title a, .post-title a')
          .first()
          .attr('href');
        const date = $el.find('.entry-date, .post-date, .date, time').first().text().trim();

        if (title) {
          results.push({
            title,
            summary: this.truncateText(summary, 200),
            url: link || '',
            date: date || '',
            type: 'Блог статия',
            source: 'АПИС - Блог',
          });
        }
      });

      return results;
    } catch (error) {
      console.error('Error parsing АПИС blog results:', error);
      return [];
    }
  }

  /**
   * Parse news results
   */
  parseNewsResults(html, limit) {
    try {
      const $ = cheerio.load(html);
      const results = [];

      $('.news-item, .news-post, article, .post').each((index, element) => {
        if (index >= limit) return false;

        const $el = $(element);

        const title = $el.find('h1, h2, h3, .news-title, .title').first().text().trim();
        const summary = $el.find('.news-content, .content, .excerpt, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        const date = $el.find('.news-date, .date, time').first().text().trim();

        if (title) {
          results.push({
            title,
            summary: this.truncateText(summary, 200),
            url: link ? this.normalizeUrl(link) : '',
            date: date || '',
            type: 'Новина',
            source: 'АПИС - Новини',
          });
        }
      });

      return results;
    } catch (error) {
      console.error('Error parsing АПИС news results:', error);
      return [];
    }
  }

  /**
   * Get latest legal updates from АПИС
   */
  async getLatestUpdates(database = 'law', limit = 10) {
    try {
      const updatesUrl = `${this.baseUrl}/bg/updates?db=${database}`;

      const response = await fetch(updatesUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        // Fallback to blog updates
        return this.getBlogUpdates(limit);
      }

      const html = await response.text();
      return this.parseUpdates(html, limit);
    } catch (error) {
      console.error('Error fetching АПИС updates:', error);
      // Fallback to blog updates
      return this.getBlogUpdates(limit);
    }
  }

  /**
   * Get blog updates as fallback
   */
  async getBlogUpdates(limit = 10) {
    try {
      const blogUrl = 'https://blog.apis.bg/';

      const response = await fetch(blogUrl, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      return this.parseBlogUpdates(html, limit);
    } catch (error) {
      console.error('Error fetching АПИС blog updates:', error);
      return {
        success: false,
        error: error.message,
        updates: [],
      };
    }
  }

  /**
   * Parse blog updates
   */
  parseBlogUpdates(html, limit) {
    try {
      const $ = cheerio.load(html);
      const updates = [];

      $('.post, article, .blog-post').each((index, element) => {
        if (index >= limit) return false;

        const $el = $(element);

        const title = $el.find('h1, h2, h3, .entry-title, .post-title').first().text().trim();
        const summary = $el
          .find('.entry-content, .post-content, .excerpt, p')
          .first()
          .text()
          .trim();
        const link = $el.find('h1 a, h2 a, h3 a, .entry-title a').first().attr('href');
        const date = $el.find('.entry-date, .post-date, .date, time').first().text().trim();

        if (title) {
          updates.push({
            title,
            summary: this.truncateText(summary, 300),
            url: link || '',
            date: date || '',
            source: 'АПИС',
          });
        }
      });

      return {
        success: true,
        updates,
        total: updates.length,
        source: 'АПИС',
      };
    } catch (error) {
      console.error('Error parsing АПИС blog updates:', error);
      return {
        success: false,
        error: 'Failed to parse updates',
        updates: [],
      };
    }
  }

  /**
   * Search for specific Bulgarian laws and regulations
   */
  async searchBulgarianLaw(lawName, articleNumber = '') {
    try {
      const query = articleNumber ? `${lawName} чл. ${articleNumber}` : lawName;

      return await this.searchLegislation({
        query,
        database: 'law',
        limit: 15,
      });
    } catch (error) {
      console.error('Error searching Bulgarian law:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Search EU legislation in АПИС
   */
  async searchEULaw(query, limit = 10) {
    try {
      return await this.searchLegislation({
        query,
        database: 'eu_law',
        limit,
      });
    } catch (error) {
      console.error('Error searching EU law:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Helper: Combine search results from multiple sources
   */
  combineSearchResults(resultArrays) {
    const combined = [];
    const seen = new Set();

    for (const results of resultArrays) {
      for (const result of results) {
        // Simple deduplication based on title
        const key = result.title.toLowerCase().trim();
        if (!seen.has(key) && result.title.length > 3) {
          seen.add(key);
          combined.push(result);
        }
      }
    }

    // Sort by relevance (articles with dates first, then by title length)
    return combined.sort((a, b) => {
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return b.title.length - a.title.length;
    });
  }

  /**
   * Helper: Normalize URLs
   */
  normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  /**
   * Helper: Truncate text
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Test connection to АПИС
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
   * Get available databases info
   */
  getAvailableDatabases() {
    return {
      success: true,
      databases: this.databases,
    };
  }
}

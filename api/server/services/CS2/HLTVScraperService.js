/**
 * HLTV Scraper Service
 *
 * This service handles web scraping of HLTV match data using Puppeteer
 * for browser automation. It provides methods for scraping match lists,
 * match details, team information, and player statistics.
 *
 * @class HLTVScraperService
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const {
  HLTVParsingError,
  HLTVNetworkError,
  HLTVRateLimitError,
  CS2ScraperError,
} = require('./errors');
const {
  sanitizeTeamName,
  parseMatchId,
  standardizeMapName,
  validateMatchData,
} = require('./utils');
const RateLimiter = require('./RateLimiter');
const CircuitBreaker = require('./CircuitBreaker');
const RetryHandler = require('./RetryHandler');
const MatchParser = require('./parsers/MatchParser');
const TeamParser = require('./parsers/TeamParser');
const PlayerParser = require('./parsers/PlayerParser');
const DataValidator = require('./validators/DataValidator');

class HLTVScraperService {
  constructor(options = {}) {
    this.config = { ...config.scraper, ...options };
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.requestCount = 0;
    this.lastRequestTime = 0;

    // Initialize rate limiting and retry components
    this.rateLimiter = new RateLimiter(options.rateLimiter);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retryHandler = new RetryHandler(options.retryHandler);

    // Initialize parsers and validators
    this.matchParser = new MatchParser();
    this.teamParser = new TeamParser();
    this.playerParser = new PlayerParser();
    this.dataValidator = new DataValidator();
  }

  /**
   * Initialize the browser and page for scraping
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      this.page = await this.browser.newPage();

      // Set user agent to avoid detection
      await this.page.setUserAgent(this.config.userAgent);

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set request headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      this.isInitialized = true;
    } catch (error) {
      throw new CS2ScraperError(
        `Failed to initialize browser: ${error.message}`,
        'BROWSER_INIT_ERROR',
        { originalError: error.message },
      );
    }
  }

  /**
   * Clean up browser resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.warn('Error during cleanup:', error.message);
    }
  }

  /**
   * Apply rate limiting between requests
   * @returns {Promise<void>}
   */
  async applyRateLimit() {
    await this.rateLimiter.waitForRequest();
    this.rateLimiter.recordRequest();
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Navigate to a URL with error handling and rate limiting
   * @param {string} url - The URL to navigate to
   * @returns {Promise<void>}
   */
  async navigateToUrl(url) {
    await this.initialize();
    await this.applyRateLimit();

    return this.circuitBreaker.execute(async () => {
      return this.retryHandler.executeWithRetry(
        async () => {
          const response = await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout,
          });

          if (!response.ok()) {
            const status = response.status();
            if (status === 429) {
              const rateLimitError = new HLTVRateLimitError(
                'Rate limit exceeded',
                response.headers()['retry-after'],
              );
              this.rateLimiter.recordFailure(rateLimitError);
              throw rateLimitError;
            }
            throw new HLTVNetworkError(`HTTP ${status}: ${response.statusText()}`, status, { url });
          }

          return response;
        },
        { context: `Navigation to ${url}` },
      );
    });
  }

  /**
   * Scrape match list from HLTV matches page
   * @param {Object} options - Scraping options
   * @param {string} options.status - Match status ('upcoming', 'live', 'results')
   * @param {number} options.limit - Maximum number of matches to scrape
   * @returns {Promise<Array>} Array of match objects
   */
  async scrapeMatches(options = {}) {
    const { status = 'upcoming', limit = 50 } = options;

    let url;
    switch (status) {
      case 'live':
        url = `${config.urls.matches}?live=true`;
        break;
      case 'results':
        url = config.urls.results;
        break;
      default:
        url = config.urls.matches;
    }

    await this.navigateToUrl(url);

    return this.retryHandler
      .executeWithRetry(
        async () => {
          const matches = await this.page.evaluate(
            (limit, MatchParser) => {
              // Create parser instance in browser context
              const parser = new MatchParser();
              return parser.parseMatchList(document, limit);
            },
            limit,
            MatchParser.toString(),
          );

          // Validate and normalize matches
          return matches.map((match) => {
            const normalizedMatch = this.normalizeMatchData(match);
            return this.dataValidator.validateAndThrow(normalizedMatch, 'match');
          });
        },
        { context: `Scraping matches from ${url}` },
      )
      .catch((error) => {
        throw new HLTVParsingError(`Failed to parse matches from ${url}: ${error.message}`, url, {
          status,
          originalError: error.message,
        });
      });
  }

  /**
   * Scrape detailed match information
   * @param {string} matchId - HLTV match ID
   * @returns {Promise<Object>} Detailed match object
   */
  async scrapeMatchDetails(matchId) {
    const url = `${config.urls.base}/matches/${matchId}`;
    await this.navigateToUrl(url);

    try {
      const matchDetails = await this.page.evaluate(() => {
        const result = {
          teams: [],
          maps: [],
          tournament: {},
          status: 'upcoming',
        };

        // Extract team information
        const teamElements = document.querySelectorAll('.team');
        result.teams = Array.from(teamElements).map((team) => {
          const nameElement = team.querySelector('.teamName');
          const logoElement = team.querySelector('.logo');

          return {
            name: nameElement ? nameElement.textContent.trim() : '',
            logo: logoElement ? logoElement.src : '',
            players: [],
          };
        });

        // Extract tournament information
        const eventElement = document.querySelector('.event');
        if (eventElement) {
          result.tournament.name = eventElement.textContent.trim();
        }

        // Extract maps information if available
        const mapElements = document.querySelectorAll('.mapholder');
        result.maps = Array.from(mapElements).map((mapEl) => {
          const mapNameElement = mapEl.querySelector('.mapname');
          const scoreElements = mapEl.querySelectorAll('.results-team-score');

          return {
            name: mapNameElement ? mapNameElement.textContent.trim() : '',
            scores: Array.from(scoreElements).map(
              (score) => parseInt(score.textContent.trim()) || 0,
            ),
          };
        });

        // Determine match status
        if (document.querySelector('.live')) {
          result.status = 'live';
        } else if (document.querySelector('.results')) {
          result.status = 'finished';
        }

        return result;
      });

      return this.normalizeMatchDetails(matchId, matchDetails);
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse match details for ${matchId}: ${error.message}`,
        url,
        { matchId, originalError: error.message },
      );
    }
  }

  /**
   * Scrape team statistics and information
   * @param {string} teamId - HLTV team ID
   * @returns {Promise<Object>} Team statistics object
   */
  async scrapeTeamStats(teamId) {
    const url = `${config.urls.teams}/${teamId}`;
    await this.navigateToUrl(url);

    try {
      const teamStats = await this.page.evaluate(() => {
        const result = {
          name: '',
          ranking: null,
          players: [],
          recentMatches: [],
        };

        // Extract team name
        const nameElement = document.querySelector('.profile-team-name');
        if (nameElement) {
          result.name = nameElement.textContent.trim();
        }

        // Extract ranking
        const rankingElement = document.querySelector('.profile-team-stat .right');
        if (rankingElement) {
          const rankText = rankingElement.textContent.trim();
          const rankMatch = rankText.match(/#(\d+)/);
          result.ranking = rankMatch ? parseInt(rankMatch[1]) : null;
        }

        // Extract player roster
        const playerElements = document.querySelectorAll('.bodyshot-team .player');
        result.players = Array.from(playerElements).map((player) => {
          const nameElement = player.querySelector('.player-nick');
          const flagElement = player.querySelector('.flag');

          return {
            name: nameElement ? nameElement.textContent.trim() : '',
            country: flagElement ? flagElement.title : '',
          };
        });

        return result;
      });

      return this.normalizeTeamStats(teamId, teamStats);
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse team stats for ${teamId}: ${error.message}`,
        url,
        { teamId, originalError: error.message },
      );
    }
  }

  /**
   * Scrape player statistics and information
   * @param {string} playerId - HLTV player ID
   * @returns {Promise<Object>} Player statistics object
   */
  async scrapePlayerStats(playerId) {
    const url = `${config.urls.players}/${playerId}`;
    await this.navigateToUrl(url);

    try {
      const playerStats = await this.page.evaluate(() => {
        const result = {
          name: '',
          realName: '',
          age: null,
          country: '',
          team: '',
          stats: {},
        };

        // Extract player name
        const nameElement = document.querySelector('.playerNickname');
        if (nameElement) {
          result.name = nameElement.textContent.trim();
        }

        // Extract real name
        const realNameElement = document.querySelector('.playerRealname');
        if (realNameElement) {
          result.realName = realNameElement.textContent.trim();
        }

        // Extract team
        const teamElement = document.querySelector('.team-info .team-name');
        if (teamElement) {
          result.team = teamElement.textContent.trim();
        }

        // Extract basic stats
        const statElements = document.querySelectorAll('.stats-row');
        statElements.forEach((row) => {
          const labelElement = row.querySelector('.stats-row-label');
          const valueElement = row.querySelector('.stats-row-value');

          if (labelElement && valueElement) {
            const label = labelElement.textContent.trim().toLowerCase();
            const value = valueElement.textContent.trim();
            result.stats[label] = value;
          }
        });

        return result;
      });

      return this.normalizePlayerStats(playerId, playerStats);
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse player stats for ${playerId}: ${error.message}`,
        url,
        { playerId, originalError: error.message },
      );
    }
  }

  /**
   * Normalize raw match data from scraping
   * @param {Object} rawMatch - Raw match data from page evaluation
   * @returns {Object} Normalized match object
   */
  normalizeMatchData(rawMatch) {
    return {
      hltvId: rawMatch.hltvId,
      teams: rawMatch.teams.map((team) => sanitizeTeamName(team)),
      date: this.parseMatchDate(rawMatch.dateStr),
      tournament: rawMatch.tournament,
      status: rawMatch.status,
      scores: rawMatch.scores,
    };
  }

  /**
   * Normalize detailed match data
   * @param {string} matchId - Match ID
   * @param {Object} rawDetails - Raw match details from page evaluation
   * @returns {Object} Normalized match details object
   */
  normalizeMatchDetails(matchId, rawDetails) {
    return {
      hltvId: matchId,
      teams: rawDetails.teams.map((team) => ({
        name: sanitizeTeamName(team.name),
        logo: team.logo,
        players: team.players,
      })),
      maps: rawDetails.maps.map((map) => ({
        name: standardizeMapName(map.name),
        scores: map.scores,
      })),
      tournament: rawDetails.tournament,
      status: rawDetails.status,
    };
  }

  /**
   * Normalize team statistics data
   * @param {string} teamId - Team ID
   * @param {Object} rawStats - Raw team stats from page evaluation
   * @returns {Object} Normalized team stats object
   */
  normalizeTeamStats(teamId, rawStats) {
    return {
      hltvId: teamId,
      name: sanitizeTeamName(rawStats.name),
      ranking: rawStats.ranking,
      players: rawStats.players.map((player) => ({
        name: player.name,
        country: player.country,
      })),
      recentMatches: rawStats.recentMatches,
    };
  }

  /**
   * Normalize player statistics data
   * @param {string} playerId - Player ID
   * @param {Object} rawStats - Raw player stats from page evaluation
   * @returns {Object} Normalized player stats object
   */
  normalizePlayerStats(playerId, rawStats) {
    return {
      hltvId: playerId,
      name: rawStats.name,
      realName: rawStats.realName,
      age: rawStats.age,
      country: rawStats.country,
      team: sanitizeTeamName(rawStats.team),
      stats: rawStats.stats,
    };
  }

  /**
   * Parse match date string to Date object
   * @param {string} dateStr - Date string from HLTV
   * @returns {Date|null} Parsed date or null if invalid
   */
  parseMatchDate(dateStr) {
    if (!dateStr) return null;

    try {
      // Handle various HLTV date formats
      const now = new Date();

      // Handle "Today", "Tomorrow", etc.
      if (dateStr.toLowerCase().includes('today')) {
        return now;
      }

      if (dateStr.toLowerCase().includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }

      // Try to parse as regular date
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get scraper statistics
   * @returns {Object} Scraper statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      isInitialized: this.isInitialized,
      lastRequestTime: this.lastRequestTime,
      config: this.config,
      rateLimiter: this.rateLimiter.getStats(),
      circuitBreaker: this.circuitBreaker.getStats(),
      retryHandler: this.retryHandler.getStats(),
    };
  }
}

module.exports = HLTVScraperService;

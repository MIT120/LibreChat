/**
 * Unit tests for HLTVScraperService
 */

const HLTVScraperService = require('./HLTVScraperService');
const {
  HLTVParsingError,
  HLTVNetworkError,
  HLTVRateLimitError,
  CS2ScraperError,
} = require('./errors');

// Mock puppeteer
jest.mock('puppeteer');
const puppeteer = require('puppeteer');

describe('HLTVScraperService', () => {
  let scraperService;
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock page
    mockPage = {
      setUserAgent: jest.fn().mockResolvedValue(),
      setViewport: jest.fn().mockResolvedValue(),
      setExtraHTTPHeaders: jest.fn().mockResolvedValue(),
      goto: jest.fn().mockResolvedValue({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK',
        headers: () => ({}),
      }),
      evaluate: jest.fn(),
      close: jest.fn().mockResolvedValue(),
    };

    // Create mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(),
    };

    // Mock puppeteer.launch
    puppeteer.launch.mockResolvedValue(mockBrowser);

    // Create service instance
    scraperService = new HLTVScraperService({
      headless: true,
      requestDelay: 100, // Shorter delay for tests
    });
  });

  afterEach(async () => {
    if (scraperService) {
      await scraperService.cleanup();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should create instance with default config', () => {
      const service = new HLTVScraperService();
      expect(service.config).toBeDefined();
      expect(service.isInitialized).toBe(false);
      expect(service.requestCount).toBe(0);
    });

    test('should merge custom options with default config', () => {
      const customOptions = { headless: false, requestDelay: 5000 };
      const service = new HLTVScraperService(customOptions);
      expect(service.config.headless).toBe(false);
      expect(service.config.requestDelay).toBe(5000);
    });

    test('should initialize browser and page correctly', async () => {
      await scraperService.initialize();

      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]),
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setUserAgent).toHaveBeenCalled();
      expect(mockPage.setViewport).toHaveBeenCalled();
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalled();
      expect(scraperService.isInitialized).toBe(true);
    });

    test('should handle browser initialization failure', async () => {
      puppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      await expect(scraperService.initialize()).rejects.toThrow(CS2ScraperError);
      await expect(scraperService.initialize()).rejects.toThrow('Failed to initialize browser');
    });

    test('should not reinitialize if already initialized', async () => {
      await scraperService.initialize();
      const firstCallCount = puppeteer.launch.mock.calls.length;

      await scraperService.initialize();
      expect(puppeteer.launch.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup browser resources', async () => {
      await scraperService.initialize();
      await scraperService.cleanup();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(scraperService.isInitialized).toBe(false);
      expect(scraperService.page).toBeNull();
      expect(scraperService.browser).toBeNull();
    });

    test('should handle cleanup errors gracefully', async () => {
      await scraperService.initialize();
      mockPage.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(scraperService.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting between requests', async () => {
      const startTime = Date.now();

      await scraperService.applyRateLimit();
      await scraperService.applyRateLimit();

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should have waited at least the request delay
      expect(elapsed).toBeGreaterThanOrEqual(scraperService.config.requestDelay - 50); // 50ms tolerance
      expect(scraperService.requestCount).toBe(2);
    });

    test('should update last request time', async () => {
      const beforeTime = Date.now();
      await scraperService.applyRateLimit();
      const afterTime = Date.now();

      expect(scraperService.lastRequestTime).toBeGreaterThanOrEqual(beforeTime);
      expect(scraperService.lastRequestTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Navigation', () => {
    test('should navigate to URL successfully', async () => {
      const testUrl = 'https://www.hltv.org/matches';

      await scraperService.navigateToUrl(testUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(testUrl, {
        waitUntil: 'networkidle2',
        timeout: scraperService.config.timeout,
      });
    });

    test('should handle HTTP errors', async () => {
      mockPage.goto.mockResolvedValue({
        ok: () => false,
        status: () => 404,
        statusText: () => 'Not Found',
        headers: () => ({}),
      });

      await expect(scraperService.navigateToUrl('https://test.com')).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });

    test('should handle rate limit responses', async () => {
      mockPage.goto.mockResolvedValue({
        ok: () => false,
        status: () => 429,
        statusText: () => 'Too Many Requests',
        headers: () => ({ 'retry-after': '60' }),
      });

      await expect(scraperService.navigateToUrl('https://test.com')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    test('should handle navigation timeout', async () => {
      // Create a service with no retries to avoid long test times
      const fastService = new HLTVScraperService({
        retryHandler: { maxRetries: 0 }
      });
      
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

      await expect(fastService.navigateToUrl('https://test.com')).rejects.toThrow(
        'Navigation timeout',
      );
      
      await fastService.cleanup();
    });
  });

  describe('Match Scraping', () => {
    test('should scrape upcoming matches', async () => {
      const mockMatches = [
        {
          hltvId: '123',
          teams: ['Team A', 'Team B'],
          dateStr: 'Today 15:00',
          tournament: 'Test Tournament',
          scores: [],
          status: 'upcoming',
        },
      ];

      mockPage.evaluate.mockResolvedValue(mockMatches);

      const result = await scraperService.scrapeMatches({ status: 'upcoming' });

      expect(result).toHaveLength(1);
      expect(result[0].hltvId).toBe('123');
      expect(result[0].teams).toEqual(['Team A', 'Team B']);
      expect(result[0].status).toBe('upcoming');
    });

    test('should scrape live matches', async () => {
      const mockMatches = [
        {
          hltvId: '456',
          teams: ['Team C', 'Team D'],
          dateStr: 'LIVE',
          tournament: 'Live Tournament',
          scores: ['16', '12'],
          status: 'live',
        },
      ];

      mockPage.evaluate.mockResolvedValue(mockMatches);

      const result = await scraperService.scrapeMatches({ status: 'live' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('live');
      expect(mockPage.goto).toHaveBeenCalledWith(
        expect.stringContaining('live=true'),
        expect.any(Object),
      );
    });

    test('should scrape finished matches', async () => {
      const mockMatches = [
        {
          hltvId: '789',
          teams: ['Team E', 'Team F'],
          dateStr: '2024-01-15',
          tournament: 'Past Tournament',
          scores: ['2', '1'],
          status: 'finished',
        },
      ];

      mockPage.evaluate.mockResolvedValue(mockMatches);

      const result = await scraperService.scrapeMatches({ status: 'results' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('finished');
    });

    test('should limit number of matches scraped', async () => {
      const mockMatches = Array.from({ length: 100 }, (_, i) => ({
        hltvId: `${i}`,
        teams: [`Team ${i}A`, `Team ${i}B`],
        dateStr: 'Today',
        tournament: 'Tournament',
        scores: [],
        status: 'upcoming',
      }));

      mockPage.evaluate.mockResolvedValue(mockMatches);

      const result = await scraperService.scrapeMatches({ limit: 10 });

      expect(result).toHaveLength(100); // Mock returns all, but evaluate should limit
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 10);
    });

    test('should handle parsing errors in match scraping', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      await expect(scraperService.scrapeMatches()).rejects.toThrow(HLTVParsingError);
    });
  });

  describe('Match Details Scraping', () => {
    test('should scrape match details successfully', async () => {
      const mockDetails = {
        teams: [
          { name: 'Team A', logo: 'logo1.png', players: [] },
          { name: 'Team B', logo: 'logo2.png', players: [] },
        ],
        maps: [{ name: 'de_dust2', scores: [16, 12] }],
        tournament: { name: 'Test Tournament' },
        status: 'finished',
      };

      mockPage.evaluate.mockResolvedValue(mockDetails);

      const result = await scraperService.scrapeMatchDetails('123');

      expect(result.hltvId).toBe('123');
      expect(result.teams).toHaveLength(2);
      expect(result.maps).toHaveLength(1);
      expect(result.maps[0].name).toBe('Dust2'); // Should be standardized
      expect(result.status).toBe('finished');
    });

    test('should handle match details parsing errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Parse error'));

      await expect(scraperService.scrapeMatchDetails('123')).rejects.toThrow(HLTVParsingError);
    });
  });

  describe('Team Stats Scraping', () => {
    test('should scrape team statistics successfully', async () => {
      const mockStats = {
        name: 'Test Team',
        ranking: 5,
        players: [
          { name: 'player1', country: 'US' },
          { name: 'player2', country: 'CA' },
        ],
        recentMatches: [],
      };

      mockPage.evaluate.mockResolvedValue(mockStats);

      const result = await scraperService.scrapeTeamStats('456');

      expect(result.hltvId).toBe('456');
      expect(result.name).toBe('Test Team');
      expect(result.ranking).toBe(5);
      expect(result.players).toHaveLength(2);
    });

    test('should handle team stats parsing errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Parse error'));

      await expect(scraperService.scrapeTeamStats('456')).rejects.toThrow(HLTVParsingError);
    });
  });

  describe('Player Stats Scraping', () => {
    test('should scrape player statistics successfully', async () => {
      const mockStats = {
        name: 'TestPlayer',
        realName: 'Test Player',
        age: 25,
        country: 'US',
        team: 'Test Team',
        stats: {
          'k/d ratio': '1.25',
          adr: '85.5',
        },
      };

      mockPage.evaluate.mockResolvedValue(mockStats);

      const result = await scraperService.scrapePlayerStats('789');

      expect(result.hltvId).toBe('789');
      expect(result.name).toBe('TestPlayer');
      expect(result.team).toBe('Test Team');
      expect(result.stats).toHaveProperty('k/d ratio');
    });

    test('should handle player stats parsing errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Parse error'));

      await expect(scraperService.scrapePlayerStats('789')).rejects.toThrow(HLTVParsingError);
    });
  });

  describe('Data Normalization', () => {
    test('should normalize match data correctly', () => {
      const rawMatch = {
        hltvId: '123',
        teams: ['  Team A  ', 'Team\tB'],
        dateStr: 'Today 15:00',
        tournament: 'Test Tournament',
        scores: ['16', '12'],
        status: 'live',
      };

      const normalized = scraperService.normalizeMatchData(rawMatch);

      expect(normalized.teams).toEqual(['Team A', 'Team B']);
      expect(normalized.hltvId).toBe('123');
      expect(normalized.status).toBe('live');
    });

    test('should normalize match details correctly', () => {
      const rawDetails = {
        teams: [{ name: '  Team A  ', logo: 'logo.png', players: [] }],
        maps: [{ name: 'de_dust2', scores: [16, 12] }],
        tournament: { name: 'Tournament' },
        status: 'finished',
      };

      const normalized = scraperService.normalizeMatchDetails('123', rawDetails);

      expect(normalized.teams[0].name).toBe('Team A');
      expect(normalized.maps[0].name).toBe('Dust2');
    });

    test('should normalize team stats correctly', () => {
      const rawStats = {
        name: '  Test Team  ',
        ranking: 5,
        players: [{ name: 'player1', country: 'US' }],
        recentMatches: [],
      };

      const normalized = scraperService.normalizeTeamStats('456', rawStats);

      expect(normalized.name).toBe('Test Team');
      expect(normalized.hltvId).toBe('456');
    });

    test('should normalize player stats correctly', () => {
      const rawStats = {
        name: 'TestPlayer',
        team: '  Test Team  ',
        stats: { 'k/d': '1.25' },
      };

      const normalized = scraperService.normalizePlayerStats('789', rawStats);

      expect(normalized.team).toBe('Test Team');
      expect(normalized.hltvId).toBe('789');
    });
  });

  describe('Date Parsing', () => {
    test('should parse "Today" correctly', () => {
      const result = scraperService.parseMatchDate('Today 15:00');
      const today = new Date();

      expect(result).toBeInstanceOf(Date);
      expect(result.toDateString()).toBe(today.toDateString());
    });

    test('should parse "Tomorrow" correctly', () => {
      const result = scraperService.parseMatchDate('Tomorrow 15:00');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(result).toBeInstanceOf(Date);
      expect(result.toDateString()).toBe(tomorrow.toDateString());
    });

    test('should return null for invalid dates', () => {
      expect(scraperService.parseMatchDate('invalid date')).toBeNull();
      expect(scraperService.parseMatchDate('')).toBeNull();
      expect(scraperService.parseMatchDate(null)).toBeNull();
    });

    test('should parse regular date strings', () => {
      const result = scraperService.parseMatchDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('Statistics', () => {
    test('should return correct scraper statistics', async () => {
      await scraperService.applyRateLimit();
      await scraperService.applyRateLimit();

      const stats = scraperService.getStats();

      expect(stats.requestCount).toBe(2);
      expect(stats.isInitialized).toBe(false); // Not initialized yet
      expect(stats.lastRequestTime).toBeGreaterThan(0);
      expect(stats.config).toBeDefined();
    });

    test('should show initialized status after initialization', async () => {
      await scraperService.initialize();
      const stats = scraperService.getStats();

      expect(stats.isInitialized).toBe(true);
    });
  });
});

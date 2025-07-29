const ScrapingScheduler = require('./ScrapingScheduler');
const { CS2Match, CS2Team, CS2Player } = require('~/models/CS2');

// Mock dependencies
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  validate: jest.fn(),
}));
jest.mock('~/config/winston', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('~/models/CS2', () => {
  const mockCS2Match = jest.fn().mockImplementation(function (data) {
    this.save = jest.fn().mockResolvedValue();
    Object.assign(this, data);
  });
  mockCS2Match.findOne = jest.fn();

  const mockCS2Team = jest.fn().mockImplementation(function (data) {
    this.save = jest.fn().mockResolvedValue();
    Object.assign(this, data);
  });
  mockCS2Team.findOne = jest.fn();

  const mockCS2Player = jest.fn().mockImplementation(function (data) {
    this.save = jest.fn().mockResolvedValue();
    Object.assign(this, data);
  });
  mockCS2Player.findOne = jest.fn();

  return {
    CS2Match: mockCS2Match,
    CS2Team: mockCS2Team,
    CS2Player: mockCS2Player,
  };
});

// Mock HLTVScraperService
const mockScraperService = {
  scrapeLiveMatches: jest.fn(),
  scrapeUpcomingMatches: jest.fn(),
  scrapeRecentMatches: jest.fn(),
  scrapeTeamRankings: jest.fn(),
  scrapeHistoricalMatches: jest.fn(),
  scrapePlayerStats: jest.fn(),
};

describe('ScrapingScheduler', () => {
  let scheduler;
  let mockJob;
  let cron;

  beforeEach(() => {
    // Get the mocked cron module
    cron = require('node-cron');

    // Mock cron job
    mockJob = {
      start: jest.fn(),
      destroy: jest.fn(),
    };

    cron.schedule.mockReturnValue(mockJob);
    cron.validate.mockReturnValue(true);

    scheduler = new ScrapingScheduler({
      scraperService: mockScraperService,
      maxConcurrentJobs: 1,
      retryAttempts: 2,
      retryDelay: 100,
    });

    // Mock database operations
    const { CS2Match, CS2Team, CS2Player } = require('~/models/CS2');
    CS2Match.findOne.mockResolvedValue(null);
    CS2Team.findOne.mockResolvedValue(null);
    CS2Player.findOne.mockResolvedValue(null);

    jest.clearAllMocks();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('constructor', () => {
    it('should initialize with default schedules', () => {
      const defaultScheduler = new ScrapingScheduler();

      expect(defaultScheduler.schedules.liveMatches).toBe('*/15 * * * *');
      expect(defaultScheduler.schedules.upcomingMatches).toBe('0 * * * *');
      expect(defaultScheduler.schedules.recentMatches).toBe('0 */6 * * *');
      expect(defaultScheduler.schedules.teamStats).toBe('0 2 * * *');
      expect(defaultScheduler.schedules.historicalData).toBe('0 3 * * 0');
    });

    it('should accept custom schedules', () => {
      const customScheduler = new ScrapingScheduler({
        liveMatchesSchedule: '*/5 * * * *',
        maxConcurrentJobs: 3,
      });

      expect(customScheduler.schedules.liveMatches).toBe('*/5 * * * *');
      expect(customScheduler.maxConcurrentJobs).toBe(3);
    });
  });

  describe('start and stop', () => {
    it('should start all scheduled jobs', () => {
      scheduler.start();

      expect(scheduler.isRunning).toBe(true);
      expect(cron.schedule).toHaveBeenCalledTimes(5);
      expect(mockJob.start).toHaveBeenCalledTimes(5);
    });

    it('should not start if already running', () => {
      scheduler.start();
      const firstCallCount = cron.schedule.mock.calls.length;

      scheduler.start();

      expect(cron.schedule).toHaveBeenCalledTimes(firstCallCount);
    });

    it('should stop all jobs', () => {
      scheduler.start();

      scheduler.stop();

      expect(scheduler.isRunning).toBe(false);
      expect(mockJob.destroy).toHaveBeenCalledTimes(5);
    });

    it('should validate cron schedules', () => {
      cron.validate.mockReturnValue(false);

      expect(() => {
        new ScrapingScheduler({
          liveMatchesSchedule: 'invalid-schedule',
        }).start();
      }).toThrow('Invalid cron schedule');
    });
  });

  describe('job queue management', () => {
    it('should queue and process jobs', async () => {
      const mockJobFunction = jest.fn().mockResolvedValue();

      await scheduler.queueJob('test', mockJobFunction);

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockJobFunction).toHaveBeenCalled();
    });

    it('should respect concurrency limits', async () => {
      const slowJob = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const fastJob = jest.fn().mockResolvedValue();

      // Queue two jobs when max concurrent is 1
      scheduler.queueJob('slow', slowJob);
      scheduler.queueJob('fast', fastJob);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(slowJob).toHaveBeenCalled();
      expect(fastJob).not.toHaveBeenCalled(); // Should be queued

      // Wait for slow job to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(fastJob).toHaveBeenCalled();
    });

    it('should retry failed jobs', async () => {
      const failingJob = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce();

      await scheduler.queueJob('failing', failingJob);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(failingJob).toHaveBeenCalledTimes(2);
    });

    it('should emit jobFailed after max retries', async () => {
      const alwaysFailingJob = jest.fn().mockRejectedValue(new Error('Always fails'));

      const failedPromise = new Promise((resolve) => {
        scheduler.once('jobFailed', resolve);
      });

      await scheduler.queueJob('alwaysFailing', alwaysFailingJob);

      const failedEvent = await failedPromise;

      expect(failedEvent.name).toBe('alwaysFailing');
      expect(failedEvent.attempts).toBe(2);
      expect(alwaysFailingJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('scraping methods', () => {
    beforeEach(() => {
      mockScraperService.scrapeLiveMatches.mockResolvedValue([
        { hltvId: 1, team1: 'Team A', team2: 'Team B' },
      ]);
      mockScraperService.scrapeUpcomingMatches.mockResolvedValue([
        { hltvId: 2, team1: 'Team C', team2: 'Team D' },
      ]);
      mockScraperService.scrapeRecentMatches.mockResolvedValue([
        { hltvId: 3, team1: 'Team E', team2: 'Team F' },
      ]);
      mockScraperService.scrapeTeamRankings.mockResolvedValue([
        { hltvId: 101, name: 'Team A', ranking: 1 },
      ]);
      mockScraperService.scrapeHistoricalMatches.mockResolvedValue([
        { hltvId: 4, team1: 'Team G', team2: 'Team H' },
      ]);
      mockScraperService.scrapePlayerStats.mockResolvedValue([
        { hltvId: 201, name: 'Player 1', rating: 1.25 },
      ]);
    });

    it('should scrape live matches', async () => {
      await scheduler.scrapeLiveMatches();

      expect(mockScraperService.scrapeLiveMatches).toHaveBeenCalled();
      expect(CS2Match.findOne).toHaveBeenCalledWith({ hltvId: 1 });
    });

    it('should scrape upcoming matches', async () => {
      await scheduler.scrapeUpcomingMatches();

      expect(mockScraperService.scrapeUpcomingMatches).toHaveBeenCalled();
      expect(CS2Match.findOne).toHaveBeenCalledWith({ hltvId: 2 });
    });

    it('should scrape recent matches', async () => {
      await scheduler.scrapeRecentMatches();

      expect(mockScraperService.scrapeRecentMatches).toHaveBeenCalled();
      expect(CS2Match.findOne).toHaveBeenCalledWith({ hltvId: 3 });
    });

    it('should scrape team stats', async () => {
      await scheduler.scrapeTeamStats();

      expect(mockScraperService.scrapeTeamRankings).toHaveBeenCalled();
      expect(CS2Team.findOne).toHaveBeenCalledWith({ hltvId: 101 });
    });

    it('should scrape historical data', async () => {
      await scheduler.scrapeHistoricalData();

      expect(mockScraperService.scrapeHistoricalMatches).toHaveBeenCalledWith(7);
      expect(mockScraperService.scrapePlayerStats).toHaveBeenCalled();
      expect(CS2Match.findOne).toHaveBeenCalledWith({ hltvId: 4 });
      expect(CS2Player.findOne).toHaveBeenCalledWith({ hltvId: 201 });
    });
  });

  describe('database operations', () => {
    it('should create new match when not exists', async () => {
      const matchData = { hltvId: 1, team1: 'Team A', team2: 'Team B' };
      CS2Match.findOne.mockResolvedValue(null);

      await scheduler.updateOrCreateMatch(matchData, 'live');

      expect(CS2Match).toHaveBeenCalledWith(
        expect.objectContaining({
          hltvId: 1,
          team1: 'Team A',
          team2: 'Team B',
          status: 'live',
        }),
      );
    });

    it('should update existing match', async () => {
      const matchData = { hltvId: 1, team1: 'Team A', team2: 'Team B' };
      const existingMatch = {
        hltvId: 1,
        team1: 'Old Team A',
        save: jest.fn().mockResolvedValue(),
      };

      CS2Match.findOne.mockResolvedValue(existingMatch);

      await scheduler.updateOrCreateMatch(matchData, 'live');

      expect(existingMatch.team1).toBe('Team A');
      expect(existingMatch.status).toBe('live');
      expect(existingMatch.save).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const matchData = { hltvId: 1, team1: 'Team A', team2: 'Team B' };
      CS2Match.findOne.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(scheduler.updateOrCreateMatch(matchData, 'live')).resolves.toBeUndefined();
    });
  });

  describe('manual job triggering', () => {
    it('should trigger specific job types', async () => {
      mockScraperService.scrapeLiveMatches.mockResolvedValue([]);

      await scheduler.triggerJob('liveMatches');

      // Wait for job to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockScraperService.scrapeLiveMatches).toHaveBeenCalled();
    });

    it('should throw error for unknown job type', async () => {
      await expect(scheduler.triggerJob('unknownJob')).rejects.toThrow(
        'Unknown job type: unknownJob',
      );
    });
  });

  describe('status and monitoring', () => {
    it('should return current status', () => {
      scheduler.start();

      const status = scheduler.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.activeJobs).toHaveLength(5);
      expect(status.maxConcurrentJobs).toBe(1);
      expect(status.schedules).toBeDefined();
    });

    it('should emit events for job completion', async () => {
      const completedPromise = new Promise((resolve) => {
        scheduler.once('jobCompleted', resolve);
      });

      const mockJobFunction = jest.fn().mockResolvedValue();
      await scheduler.queueJob('test', mockJobFunction);

      const completedEvent = await completedPromise;

      expect(completedEvent.name).toBe('test');
      expect(completedEvent.duration).toBeDefined();
    });

    it('should emit events for scraping updates', async () => {
      mockScraperService.scrapeLiveMatches.mockResolvedValue([
        { hltvId: 1, team1: 'Team A', team2: 'Team B' },
      ]);

      const updatePromise = new Promise((resolve) => {
        scheduler.once('liveMatchesUpdated', resolve);
      });

      await scheduler.scrapeLiveMatches();

      const updateEvent = await updatePromise;

      expect(updateEvent.count).toBe(1);
      expect(updateEvent.timestamp).toBeInstanceOf(Date);
    });
  });
});

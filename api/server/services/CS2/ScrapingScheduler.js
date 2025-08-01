const cron = require('node-cron');
const logger = require('~/config/winston');
const HLTVScraperService = require('./HLTVScraperService');
const { CS2Match, CS2Team, CS2Player } = require('~/models/CS2');
const { EventEmitter } = require('events');

/**
 * ScrapingScheduler - Manages automated HLTV data collection with configurable schedules
 */
class ScrapingScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.scraperService = options.scraperService || new HLTVScraperService();
    this.isRunning = false;
    this.jobs = new Map();

    // Default schedules (can be overridden in options)
    this.schedules = {
      // Every 15 minutes - check for live match updates
      liveMatches: options.liveMatchesSchedule || '*/15 * * * *',

      // Every hour - scrape upcoming matches
      upcomingMatches: options.upcomingMatchesSchedule || '0 * * * *',

      // Every 6 hours - scrape recent completed matches
      recentMatches: options.recentMatchesSchedule || '0 */6 * * *',

      // Daily at 2 AM - scrape team rankings and player stats
      teamStats: options.teamStatsSchedule || '0 2 * * *',

      // Weekly on Sunday at 3 AM - comprehensive historical data update
      historicalData: options.historicalDataSchedule || '0 3 * * 0',

      ...options.schedules,
    };

    this.jobQueue = [];
    this.maxConcurrentJobs = options.maxConcurrentJobs || 2;
    this.currentJobs = 0;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 60000; // 1 minute
  }

  /**
   * Start all scheduled scraping jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('ScrapingScheduler: Already running');
      return;
    }

    this.isRunning = true;

    // Schedule live match updates
    this.scheduleJob('liveMatches', this.schedules.liveMatches, () => {
      this.queueJob('liveMatches', () => this.scrapeLiveMatches());
    });

    // Schedule upcoming matches
    this.scheduleJob('upcomingMatches', this.schedules.upcomingMatches, () => {
      this.queueJob('upcomingMatches', () => this.scrapeUpcomingMatches());
    });

    // Schedule recent matches
    this.scheduleJob('recentMatches', this.schedules.recentMatches, () => {
      this.queueJob('recentMatches', () => this.scrapeRecentMatches());
    });

    // Schedule team stats
    this.scheduleJob('teamStats', this.schedules.teamStats, () => {
      this.queueJob('teamStats', () => this.scrapeTeamStats());
    });

    // Schedule historical data
    this.scheduleJob('historicalData', this.schedules.historicalData, () => {
      this.queueJob('historicalData', () => this.scrapeHistoricalData());
    });

    logger.info('ScrapingScheduler: Started all scheduled jobs', {
      schedules: this.schedules,
    });

    this.emit('started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Destroy all cron jobs
    for (const [jobName, job] of this.jobs) {
      job.destroy();
      logger.info(`ScrapingScheduler: Stopped job ${jobName}`);
    }

    this.jobs.clear();
    this.jobQueue = [];

    logger.info('ScrapingScheduler: Stopped all scheduled jobs');
    this.emit('stopped');
  }

  /**
   * Schedule a cron job
   */
  scheduleJob(name, schedule, task) {
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule for ${name}: ${schedule}`);
    }

    const job = cron.schedule(schedule, task, {
      scheduled: false,
      timezone: 'UTC',
    });

    this.jobs.set(name, job);
    job.start();

    logger.info(`ScrapingScheduler: Scheduled job ${name}`, { schedule });
  }

  /**
   * Queue a job for execution with concurrency control
   */
  async queueJob(jobName, jobFunction) {
    const jobData = {
      name: jobName,
      function: jobFunction,
      attempts: 0,
      queuedAt: new Date(),
    };

    this.jobQueue.push(jobData);
    this.processQueue();
  }

  /**
   * Process the job queue with concurrency control
   */
  async processQueue() {
    if (this.currentJobs >= this.maxConcurrentJobs || this.jobQueue.length === 0) {
      return;
    }

    const job = this.jobQueue.shift();
    this.currentJobs++;

    try {
      logger.info(`ScrapingScheduler: Starting job ${job.name}`, {
        attempt: job.attempts + 1,
        queuedAt: job.queuedAt,
      });

      const startTime = Date.now();
      await job.function();
      const duration = Date.now() - startTime;

      logger.info(`ScrapingScheduler: Completed job ${job.name}`, {
        duration: `${duration}ms`,
        attempt: job.attempts + 1,
      });

      this.emit('jobCompleted', {
        name: job.name,
        duration,
        attempt: job.attempts + 1,
      });
    } catch (error) {
      job.attempts++;

      logger.error(`ScrapingScheduler: Job ${job.name} failed`, {
        error: error.message,
        attempt: job.attempts,
        maxAttempts: this.retryAttempts,
      });

      if (job.attempts < this.retryAttempts) {
        // Retry after delay
        setTimeout(() => {
          this.jobQueue.unshift(job); // Add back to front of queue
          this.processQueue();
        }, this.retryDelay);
      } else {
        logger.error(
          `ScrapingScheduler: Job ${job.name} failed permanently after ${job.attempts} attempts`,
        );

        this.emit('jobFailed', {
          name: job.name,
          error: error.message,
          attempts: job.attempts,
        });
      }
    } finally {
      this.currentJobs--;
      // Process next job in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Scrape live match updates
   */
  async scrapeLiveMatches() {
    try {
      const liveMatches = await this.scraperService.scrapeMatches({
        status: 'live',
        limit: 20,
      });

      for (const matchData of liveMatches) {
        await this.updateOrCreateMatch(matchData, 'live');
      }

      logger.info(`ScrapingScheduler: Updated ${liveMatches.length} live matches`);

      this.emit('liveMatchesUpdated', {
        count: liveMatches.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('ScrapingScheduler: Error scraping live matches', { error });
      throw error;
    }
  }

  /**
   * Scrape upcoming matches
   */
  async scrapeUpcomingMatches() {
    try {
      const upcomingMatches = await this.scraperService.scrapeMatches({
        status: 'upcoming',
        limit: 100,
      });

      for (const matchData of upcomingMatches) {
        await this.updateOrCreateMatch(matchData, 'upcoming');
      }

      logger.info(`ScrapingScheduler: Updated ${upcomingMatches.length} upcoming matches`);

      this.emit('upcomingMatchesUpdated', {
        count: upcomingMatches.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('ScrapingScheduler: Error scraping upcoming matches', { error });
      throw error;
    }
  }

  /**
   * Scrape recent completed matches
   */
  async scrapeRecentMatches() {
    try {
      const recentMatches = await this.scraperService.scrapeMatches({
        status: 'results',
        limit: 50,
      });

      for (const matchData of recentMatches) {
        await this.updateOrCreateMatch(matchData, 'completed');
      }

      logger.info(`ScrapingScheduler: Updated ${recentMatches.length} recent matches`);

      this.emit('recentMatchesUpdated', {
        count: recentMatches.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('ScrapingScheduler: Error scraping recent matches', { error });
      throw error;
    }
  }

  /**
   * Scrape team statistics and rankings
   */
  async scrapeTeamStats() {
    try {
      const teamStats = await this.scraperService.scrapeTeamRankings();

      for (const teamData of teamStats) {
        await this.updateOrCreateTeam(teamData);
      }

      logger.info(`ScrapingScheduler: Updated ${teamStats.length} team stats`);

      this.emit('teamStatsUpdated', {
        count: teamStats.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('ScrapingScheduler: Error scraping team stats', { error });
      throw error;
    }
  }

  /**
   * Scrape comprehensive historical data
   */
  async scrapeHistoricalData() {
    try {
      // Scrape historical matches from the past week
      const historicalMatches = await this.scraperService.scrapeHistoricalMatches(7);

      for (const matchData of historicalMatches) {
        await this.updateOrCreateMatch(matchData, 'completed');
      }

      // Update player statistics
      const playerStats = await this.scraperService.scrapePlayerStats();

      for (const playerData of playerStats) {
        await this.updateOrCreatePlayer(playerData);
      }

      logger.info(`ScrapingScheduler: Updated historical data`, {
        matches: historicalMatches.length,
        players: playerStats.length,
      });

      this.emit('historicalDataUpdated', {
        matches: historicalMatches.length,
        players: playerStats.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('ScrapingScheduler: Error scraping historical data', { error });
      throw error;
    }
  }

  /**
   * Update or create match in database
   */
  async updateOrCreateMatch(matchData, status) {
    try {
      const existingMatch = await CS2Match.findOne({ hltvId: matchData.hltvId });

      if (existingMatch) {
        // Update existing match
        Object.assign(existingMatch, {
          ...matchData,
          status,
          lastUpdated: new Date(),
        });
        await existingMatch.save();
      } else {
        // Create new match
        const newMatch = new CS2Match({
          ...matchData,
          status,
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
        await newMatch.save();
      }
    } catch (error) {
      logger.error('ScrapingScheduler: Error updating match', {
        hltvId: matchData.hltvId,
        error: error.message,
      });
    }
  }

  /**
   * Update or create team in database
   */
  async updateOrCreateTeam(teamData) {
    try {
      const existingTeam = await CS2Team.findOne({ hltvId: teamData.hltvId });

      if (existingTeam) {
        Object.assign(existingTeam, {
          ...teamData,
          lastUpdated: new Date(),
        });
        await existingTeam.save();
      } else {
        const newTeam = new CS2Team({
          ...teamData,
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
        await newTeam.save();
      }
    } catch (error) {
      logger.error('ScrapingScheduler: Error updating team', {
        hltvId: teamData.hltvId,
        error: error.message,
      });
    }
  }

  /**
   * Update or create player in database
   */
  async updateOrCreatePlayer(playerData) {
    try {
      const existingPlayer = await CS2Player.findOne({ hltvId: playerData.hltvId });

      if (existingPlayer) {
        Object.assign(existingPlayer, {
          ...playerData,
          lastUpdated: new Date(),
        });
        await existingPlayer.save();
      } else {
        const newPlayer = new CS2Player({
          ...playerData,
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
        await newPlayer.save();
      }
    } catch (error) {
      logger.error('ScrapingScheduler: Error updating player', {
        hltvId: playerData.hltvId,
        error: error.message,
      });
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      queueLength: this.jobQueue.length,
      currentJobs: this.currentJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
      schedules: this.schedules,
    };
  }

  /**
   * Manually trigger a specific job type
   */
  async triggerJob(jobType) {
    const jobFunctions = {
      liveMatches: () => this.scrapeLiveMatches(),
      upcomingMatches: () => this.scrapeUpcomingMatches(),
      recentMatches: () => this.scrapeRecentMatches(),
      teamStats: () => this.scrapeTeamStats(),
      historicalData: () => this.scrapeHistoricalData(),
    };

    const jobFunction = jobFunctions[jobType];
    if (!jobFunction) {
      throw new Error(`Unknown job type: ${jobType}`);
    }

    logger.info(`ScrapingScheduler: Manually triggering job ${jobType}`);
    await this.queueJob(`manual_${jobType}`, jobFunction);
  }
}

module.exports = ScrapingScheduler;

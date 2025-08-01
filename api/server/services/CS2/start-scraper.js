#!/usr/bin/env node

/**
 * HLTV Scraper Startup Script
 * Starts the automated HLTV data collection scheduler
 * Usage: node api/server/services/CS2/start-scraper.js
 */

const path = require('path');

// Set up module aliases
const moduleAlias = require('module-alias');
const apiRoot = path.resolve(__dirname, '../../..');
moduleAlias.addAlias('~', apiRoot);

// Set up environment
if (!process.env.MONGO_URI) {
    process.env.MONGO_URI = 'mongodb://mongodb:27017/LibreChat';
}

const { connectDb } = require('~/db/connect');
const ScrapingScheduler = require('./ScrapingScheduler');
const config = require('./config');
const logger = require('~/utils/logger');

async function startScraper() {
    try {
        // Check if scraper is enabled
        if (!config.scraper.enabled) {
            logger.warn('[HLTV Scraper] Scraper is disabled. Set CS2_SCRAPER_ENABLED=true to enable.');
            return;
        }

        // Connect to database
        await connectDb();
        logger.info('[HLTV Scraper] Database connected');

        // Create and start the scraping scheduler
        const scheduler = new ScrapingScheduler({
            maxConcurrentJobs: 2,
            retryAttempts: 3,
            retryDelay: 60000,
        });

        // Set up event listeners
        scheduler.on('started', () => {
            logger.info('[HLTV Scraper] Scheduler started successfully');
        });

        scheduler.on('jobCompleted', (jobName, duration) => {
            logger.info(`[HLTV Scraper] Job "${jobName}" completed in ${duration}ms`);
        });

        scheduler.on('jobFailed', (jobName, error) => {
            logger.error(`[HLTV Scraper] Job "${jobName}" failed:`, error);
        });

        scheduler.on('liveMatchesUpdated', (data) => {
            logger.info(`[HLTV Scraper] Updated ${data.matches} live matches`);
        });

        scheduler.on('upcomingMatchesUpdated', (data) => {
            logger.info(`[HLTV Scraper] Updated ${data.matches} upcoming matches`);
        });

        scheduler.on('recentMatchesUpdated', (data) => {
            logger.info(`[HLTV Scraper] Updated ${data.matches} recent matches`);
        });

        scheduler.on('teamStatsUpdated', (data) => {
            logger.info(`[HLTV Scraper] Updated ${data.teams} team stats`);
        });

        scheduler.on('historicalDataUpdated', (data) => {
            logger.info(
                `[HLTV Scraper] Updated ${data.matches} historical matches and ${data.players} players`,
            );
        });

        // Start the scheduler
        scheduler.start();

        // Run initial data population
        logger.info('[HLTV Scraper] Running initial data population...');

        // Fetch some initial data
        await scheduler.scrapeRecentMatches();
        await scheduler.scrapeUpcomingMatches();

        logger.info('[HLTV Scraper] Initial data population completed');
        logger.info('[HLTV Scraper] Scheduler is now running with the following schedule:');
        logger.info('  - Live matches: Every 15 minutes');
        logger.info('  - Upcoming matches: Every hour');
        logger.info('  - Recent matches: Every 6 hours');
        logger.info('  - Team stats: Daily at 2 AM');
        logger.info('  - Historical data: Weekly on Sunday at 3 AM');

        // Keep the process running
        process.on('SIGINT', () => {
            logger.info('[HLTV Scraper] Shutting down scheduler...');
            scheduler.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            logger.info('[HLTV Scraper] Shutting down scheduler...');
            scheduler.stop();
            process.exit(0);
        });
    } catch (error) {
        logger.error('[HLTV Scraper] Failed to start:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startScraper();
}

module.exports = { startScraper };

/**
 * CS2 Scraper Configuration
 */

const config = {
  // Scraper settings
  scraper: {
    enabled: process.env.CS2_SCRAPER_ENABLED === 'true',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    requestDelay: parseInt(process.env.CS2_REQUEST_DELAY) || 2000,
    timeout: parseInt(process.env.CS2_TIMEOUT) || 30000,
    headless: process.env.CS2_HEADLESS !== 'false',
  },

  // HLTV URLs
  urls: {
    base: 'https://www.hltv.org',
    matches: 'https://www.hltv.org/matches',
    results: 'https://www.hltv.org/results',
    teams: 'https://www.hltv.org/team',
    players: 'https://www.hltv.org/player',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.CS2_RATE_WINDOW) || 60000, // 1 minute
    maxRequests: parseInt(process.env.CS2_MAX_REQUESTS) || 30,
  },

  // Error handling
  errors: {
    maxRetries: parseInt(process.env.CS2_MAX_RETRIES) || 3,
    backoffMultiplier: parseFloat(process.env.CS2_BACKOFF_MULTIPLIER) || 2,
    maxBackoffDelay: parseInt(process.env.CS2_MAX_BACKOFF_DELAY) || 60000,
    maxConsecutiveFailures: parseInt(process.env.CS2_MAX_CONSECUTIVE_FAILURES) || 5,
  },

  // Embeddings
  embeddings: {
    model: process.env.CS2_EMBEDDING_MODEL || 'text-embedding-3-small',
    batchSize: parseInt(process.env.CS2_EMBEDDING_BATCH_SIZE) || 20,
    dimensions: parseInt(process.env.CS2_EMBEDDING_DIMENSIONS) || 1536,
  },

  // Scheduling
  schedule: {
    matches: process.env.CS2_SCHEDULE_MATCHES || '0 */15 * * * *', // Every 15 minutes
    live: process.env.CS2_SCHEDULE_LIVE || '0 */2 * * * *', // Every 2 minutes
    historical: process.env.CS2_SCHEDULE_HISTORICAL || '0 0 2 * * *', // Daily at 2 AM
  },

  // Database
  database: {
    connectionTimeout: parseInt(process.env.CS2_DB_TIMEOUT) || 10000,
    maxPoolSize: parseInt(process.env.CS2_DB_POOL_SIZE) || 10,
  },

  // Prediction engine
  prediction: {
    enabled: process.env.CS2_PREDICTIONS_ENABLED === 'true',
    confidenceThreshold: parseFloat(process.env.CS2_CONFIDENCE_THRESHOLD) || 0.6,
    updateInterval: parseInt(process.env.CS2_PREDICTION_UPDATE_INTERVAL) || 300000, // 5 minutes
  },
};

module.exports = config;

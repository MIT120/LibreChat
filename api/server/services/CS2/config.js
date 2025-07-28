/**
 * HLTV CS2 Scraper Configuration
 */

const config = {
  // Scraper settings
  scraper: {
    enabled: process.env.HLTV_SCRAPER_ENABLED === 'true' || true,
    userAgent: process.env.HLTV_SCRAPER_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    requestDelay: parseInt(process.env.HLTV_SCRAPER_REQUEST_DELAY) || 2000,
    maxRetries: parseInt(process.env.HLTV_SCRAPER_MAX_RETRIES) || 3,
    timeout: parseInt(process.env.HLTV_SCRAPER_TIMEOUT) || 30000,
    headless: process.env.HLTV_SCRAPER_HEADLESS !== 'false',
  },

  // Scheduling settings
  schedule: {
    matches: process.env.HLTV_SCRAPER_SCHEDULE_MATCHES || '0 */30 * * * *', // Every 30 minutes
    live: process.env.HLTV_SCRAPER_SCHEDULE_LIVE || '0 */5 * * * *', // Every 5 minutes
    historical: process.env.HLTV_SCRAPER_SCHEDULE_HISTORICAL || '0 2 * * *', // Daily at 2 AM
  },

  // Vector embeddings settings
  embeddings: {
    enabled: process.env.HLTV_EMBEDDINGS_ENABLED !== 'false',
    model: process.env.HLTV_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    batchSize: parseInt(process.env.HLTV_EMBEDDINGS_BATCH_SIZE) || 100,
  },

  // Prediction engine settings
  predictions: {
    enabled: process.env.HLTV_PREDICTIONS_ENABLED !== 'false',
    minConfidence: parseFloat(process.env.HLTV_PREDICTIONS_MIN_CONFIDENCE) || 0.6,
    accuracyThreshold: parseFloat(process.env.HLTV_PREDICTIONS_ACCURACY_THRESHOLD) || 0.7,
  },

  // HLTV URLs
  urls: {
    base: 'https://www.hltv.org',
    matches: 'https://www.hltv.org/matches',
    results: 'https://www.hltv.org/results',
    teams: 'https://www.hltv.org/teams',
    players: 'https://www.hltv.org/players',
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // Max 30 requests per minute
  },

  // Error handling
  errors: {
    maxConsecutiveFailures: 5,
    backoffMultiplier: 2,
    maxBackoffDelay: 60000, // 1 minute
  },
};

module.exports = config;
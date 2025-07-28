/**
 * Utility functions for HLTV CS2 Scraper
 */

const { logger } = require('~/config');

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Exponential backoff with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @param {number} jitterFactor - Jitter factor (0-1)
 * @returns {number} Delay in milliseconds
 */
const exponentialBackoff = (attempt, baseDelay = 1000, maxDelay = 60000, jitterFactor = 0.1) => {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = exponentialDelay * jitterFactor * Math.random();
  return Math.floor(exponentialDelay + jitter);
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {Function} shouldRetry - Function to determine if error should trigger retry
 * @returns {Promise<any>} Result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000, shouldRetry = () => true) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = exponentialBackoff(attempt, baseDelay);
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

/**
 * Sanitize team name for consistent storage
 * @param {string} teamName - Raw team name
 * @returns {string} Sanitized team name
 */
const sanitizeTeamName = (teamName) => {
  if (!teamName) return '';
  return teamName.trim().replace(/\s+/g, ' ');
};

/**
 * Parse HLTV match ID from URL
 * @param {string} url - HLTV match URL
 * @returns {string|null} Match ID or null if not found
 */
const parseMatchId = (url) => {
  const match = url.match(/\/matches\/(\d+)\//);
  return match ? match[1] : null;
};

/**
 * Parse HLTV team ID from URL
 * @param {string} url - HLTV team URL
 * @returns {string|null} Team ID or null if not found
 */
const parseTeamId = (url) => {
  const match = url.match(/\/team\/(\d+)\//);
  return match ? match[1] : null;
};

/**
 * Parse HLTV player ID from URL
 * @param {string} url - HLTV player URL
 * @returns {string|null} Player ID or null if not found
 */
const parsePlayerId = (url) => {
  const match = url.match(/\/player\/(\d+)\//);
  return match ? match[1] : null;
};

/**
 * Convert map name to standardized format
 * @param {string} mapName - Raw map name
 * @returns {string} Standardized map name
 */
const standardizeMapName = (mapName) => {
  if (!mapName) return '';
  
  const mapMappings = {
    'de_dust2': 'Dust2',
    'de_mirage': 'Mirage',
    'de_inferno': 'Inferno',
    'de_cache': 'Cache',
    'de_overpass': 'Overpass',
    'de_train': 'Train',
    'de_cobblestone': 'Cobblestone',
    'de_nuke': 'Nuke',
    'de_vertigo': 'Vertigo',
    'de_ancient': 'Ancient',
    'de_anubis': 'Anubis',
  };
  
  const normalized = mapName.toLowerCase().trim();
  return mapMappings[normalized] || mapName;
};

/**
 * Calculate win rate from match history
 * @param {Array} matches - Array of match results (1 for win, 0 for loss)
 * @returns {number} Win rate as decimal (0-1)
 */
const calculateWinRate = (matches) => {
  if (!matches || matches.length === 0) return 0;
  const wins = matches.filter(result => result === 1).length;
  return wins / matches.length;
};

/**
 * Calculate team momentum based on recent results
 * @param {Array} recentResults - Array of recent match results (1 for win, 0 for loss)
 * @param {number} weightDecay - Weight decay factor for older matches
 * @returns {number} Momentum score (0-1)
 */
const calculateMomentum = (recentResults, weightDecay = 0.8) => {
  if (!recentResults || recentResults.length === 0) return 0.5;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < recentResults.length; i++) {
    const weight = Math.pow(weightDecay, i);
    weightedSum += recentResults[i] * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
};

/**
 * Validate match data structure
 * @param {Object} matchData - Match data to validate
 * @returns {boolean} True if valid
 */
const validateMatchData = (matchData) => {
  if (!matchData || typeof matchData !== 'object') return false;
  
  const requiredFields = ['hltvId', 'date', 'teams'];
  return requiredFields.every(field => matchData.hasOwnProperty(field));
};

/**
 * Generate cache key for match data
 * @param {string} type - Cache type (match, team, player)
 * @param {string} id - Entity ID
 * @param {Object} options - Additional options
 * @returns {string} Cache key
 */
const generateCacheKey = (type, id, options = {}) => {
  const baseKey = `cs2:${type}:${id}`;
  const optionsStr = Object.keys(options).length > 0 ? `:${JSON.stringify(options)}` : '';
  return baseKey + optionsStr;
};

/**
 * Format timestamp for logging
 * @param {Date} date - Date to format
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (date = new Date()) => {
  return date.toISOString().replace('T', ' ').replace('Z', '');
};

module.exports = {
  sleep,
  exponentialBackoff,
  retryWithBackoff,
  sanitizeTeamName,
  parseMatchId,
  parseTeamId,
  parsePlayerId,
  standardizeMapName,
  calculateWinRate,
  calculateMomentum,
  validateMatchData,
  generateCacheKey,
  formatTimestamp,
};
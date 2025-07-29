/**
 * Caching Service for CS2 Data
 */

const Redis = require('ioredis');
const logger = require('../../../../utils/logger');
const { generateCacheKey } = require('./utils');

class CS2CacheService {
  constructor(options = {}) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: options.db || 2, // Use separate DB for CS2 cache
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.defaultTTL = options.defaultTTL || 3600; // 1 hour
    this.keyPrefix = options.keyPrefix || 'cs2:';
    
    this.redis.on('error', (error) => {
      logger.error('CS2 Cache Redis error:', error);
    });
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null
   */
  async get(key) {
    try {
      const fullKey = this.keyPrefix + key;
      const data = await this.redis.get(fullKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, data, ttl = this.defaultTTL) {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.setex(fullKey, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.warn('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.del(fullKey);
      return true;
    } catch (error) {
      logger.warn('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Cache match data with appropriate TTL based on status
   * @param {Object} matchData - Match data to cache
   * @returns {Promise<boolean>} Success status
   */
  async cacheMatch(matchData) {
    const key = generateCacheKey('match', matchData.hltvId);
    
    // Set TTL based on match status
    let ttl = this.defaultTTL;
    if (matchData.status === 'live') {
      ttl = 120; // 2 minutes for live matches
    } else if (matchData.status === 'finished') {
      ttl = 86400; // 24 hours for finished matches
    } else {
      ttl = 3600; // 1 hour for upcoming matches
    }

    return this.set(key, matchData, ttl);
  }

  /**
   * Cache team data
   * @param {Object} teamData - Team data to cache
   * @returns {Promise<boolean>} Success status
   */
  async cacheTeam(teamData) {
    const key = generateCacheKey('team', teamData.hltvId || teamData.name);
    return this.set(key, teamData, 7200); // 2 hours for team data
  }

  /**
   * Cache player data
   * @param {Object} playerData - Player data to cache
   * @returns {Promise<boolean>} Success status
   */
  async cachePlayer(playerData) {
    const key = generateCacheKey('player', playerData.hltvId || playerData.name);
    return this.set(key, playerData, 7200); // 2 hours for player data
  }

  /**
   * Get cached match data
   * @param {string} hltvId - HLTV match ID
   * @returns {Promise<Object|null>} Cached match data
   */
  async getCachedMatch(hltvId) {
    const key = generateCacheKey('match', hltvId);
    return this.get(key);
  }

  /**
   * Get cached team data
   * @param {string} identifier - Team HLTV ID or name
   * @returns {Promise<Object|null>} Cached team data
   */
  async getCachedTeam(identifier) {
    const key = generateCacheKey('team', identifier);
    return this.get(key);
  }

  /**
   * Get cached player data
   * @param {string} identifier - Player HLTV ID or name
   * @returns {Promise<Object|null>} Cached player data
   */
  async getCachedPlayer(identifier) {
    const key = generateCacheKey('player', identifier);
    return this.get(key);
  }

  /**
   * Invalidate cache for a specific pattern
   * @param {string} pattern - Cache key pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidatePattern(pattern) {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.warn('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        connected: this.redis.status === 'ready',
        keyCount,
        memoryInfo: info,
      };
    } catch (error) {
      logger.warn('Cache stats error:', error);
      return { connected: false, keyCount: 0 };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

module.exports = CS2CacheService;
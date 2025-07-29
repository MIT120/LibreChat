const { CS2Match } = require('~/db/models');
const logger = require('~/utils/logger');
const { getFromCache, setCache } = require('~/cache');

/**
 * Repository class for CS2 Match data access
 * Separates data access logic from business logic
 */
class CS2MatchRepository {
  constructor() {
    this.model = CS2Match;
    this.logger = logger.child({ repository: 'CS2Match' });
  }

  /**
   * Create a new match
   * @param {Object} matchData - Match data
   * @returns {Promise<Object>} Created match
   */
  async create(matchData) {
    try {
      const match = await this.model.create(matchData);
      this.logger.info('Match created', { hltvId: match.hltvId });
      return match;
    } catch (error) {
      this.logger.error('Failed to create match', { error: error.message });
      throw error;
    }
  }

  /**
   * Find match by HLTV ID
   * @param {string} hltvId - HLTV match ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Match document
   */
  async findByHltvId(hltvId, options = {}) {
    const { populate = true, useCache = true } = options;

    try {
      const cacheKey = `match:${hltvId}`;

      if (useCache) {
        const cached = await getFromCache(cacheKey);
        if (cached) return cached;
      }

      let query = this.model.findOne({ hltvId });

      if (populate) {
        query = query
          .populate('teams.team', 'name logo country ranking.current')
          .populate('maps.winner', 'name logo')
          .populate('maps.pickBy', 'name logo');
      }

      const match = await query.lean();

      if (match && useCache) {
        const ttl = match.status === 'finished' ? 3600 : 300;
        await setCache(cacheKey, match, ttl);
      }

      return match;
    } catch (error) {
      this.logger.error('Failed to find match by HLTV ID', { error: error.message, hltvId });
      throw error;
    }
  }

  /**
   * Update match by HLTV ID
   * @param {string} hltvId - HLTV match ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object|null>} Updated match
   */
  async updateByHltvId(hltvId, updateData, options = {}) {
    try {
      const { session } = options;

      const updateOptions = {
        new: true,
        lean: true,
        ...(session && { session }),
      };

      const updatedMatch = await this.model.findOneAndUpdate(
        { hltvId },
        {
          ...updateData,
          'metadata.lastUpdated': new Date(),
        },
        updateOptions,
      );

      if (updatedMatch) {
        // Invalidate cache
        await this.invalidateCache(`match:${hltvId}`);
        this.logger.info('Match updated', { hltvId });
      }

      return updatedMatch;
    } catch (error) {
      this.logger.error('Failed to update match', { error: error.message, hltvId });
      throw error;
    }
  }

  /**
   * Find matches with complex criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of matches
   */
  async findByCriteria(criteria, options = {}) {
    try {
      const { limit = 20, sort = { date: -1 }, populate = true } = options;

      let query = this.model.find(criteria);

      if (populate) {
        query = query
          .populate('teams.team', 'name logo country ranking.current')
          .populate('tournament');
      }

      return await query.sort(sort).limit(limit).lean();
    } catch (error) {
      this.logger.error('Failed to find matches by criteria', { error: error.message, criteria });
      throw error;
    }
  }

  /**
   * Aggregate match statistics
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>} Aggregation results
   */
  async aggregate(pipeline) {
    try {
      return await this.model.aggregate(pipeline);
    } catch (error) {
      this.logger.error('Failed to aggregate matches', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache for a key
   * @param {string} key - Cache key
   */
  async invalidateCache(key) {
    try {
      // Implementation depends on cache provider
      // await deleteFromCache(key);
    } catch (error) {
      this.logger.warn('Failed to invalidate cache', { error: error.message, key });
    }
  }
}

module.exports = CS2MatchRepository;

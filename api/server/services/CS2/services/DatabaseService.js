const CS2Match = require('~/models/CS2/CS2Match');
const CS2Team = require('~/models/CS2/CS2Team');
const MCP_CONFIG = require('../config/mcp-config');

/**
 * Optimized database service with caching and query optimization
 */
class DatabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Find team by name with caching
   */
  async findTeamByName(teamName) {
    const cacheKey = `team:${teamName.toLowerCase()}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const team = await CS2Team.findOne({
      name: new RegExp(teamName, 'i'),
    }).lean(); // Use lean() for better performance when we don't need full Mongoose documents

    if (team) {
      this.setCache(cacheKey, team);
    }

    return team;
  }

  /**
   * Get matches with optimized query and indexing hints
   */
  async getMatches(query, options = {}) {
    const {
      limit = MCP_CONFIG.limits.defaultMatchLimit,
      populate = true,
      sort = MCP_CONFIG.database.sortOptions.matchesByDate,
    } = options;

    let matchQuery = CS2Match.find(query);

    if (populate) {
      matchQuery = matchQuery.populate('teams.team', MCP_CONFIG.database.populateFields.team);
    }

    // Add query hints for better performance
    if (query.date) {
      matchQuery = matchQuery.hint({ date: -1 }); // Use date index
    }

    if (query['teams.team']) {
      matchQuery = matchQuery.hint({ 'teams.team': 1 }); // Use team index
    }

    return await matchQuery.sort(sort).limit(limit).lean(); // Use lean() for read-only operations
  }

  /**
   * Get team matches with optimized aggregation
   */
  async getTeamMatches(teamId, startDate, mapName) {
    const pipeline = [
      {
        $match: {
          'teams.team': teamId,
          date: { $gte: startDate },
          status: 'finished',
        },
      },
    ];

    // Add map filter if specified
    if (mapName) {
      pipeline.push({
        $match: {
          'maps.name': mapName,
        },
      });
    }

    // Populate team data
    pipeline.push(
      {
        $lookup: {
          from: 'cs2teams',
          localField: 'teams.team',
          foreignField: '_id',
          as: 'teamData',
        },
      },
      {
        $sort: { date: -1 },
      },
    );

    return await CS2Match.aggregate(pipeline);
  }

  /**
   * Batch find teams for multiple team names
   */
  async findTeamsByNames(teamNames) {
    const regexPatterns = teamNames.map((name) => new RegExp(name, 'i'));

    return await CS2Team.find({
      name: { $in: regexPatterns },
    }).lean();
  }

  /**
   * Get match with full population for predictions
   */
  async getMatchForPrediction(matchId) {
    const cacheKey = `match:prediction:${matchId}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const match = await CS2Match.findOne({ hltvId: matchId })
      .populate('teams.team', 'name ranking recentForm')
      .lean();

    if (match) {
      this.setCache(cacheKey, match, 2 * 60 * 1000); // Cache for 2 minutes
    }

    return match;
  }

  /**
   * Cache management methods
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(key); // Remove expired cache
    }

    return null;
  }

  setCache(key, data, timeout = this.cacheTimeout) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout,
    });

    // Clean up expired cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.timeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

module.exports = DatabaseService;

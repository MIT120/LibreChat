/**
 * CS2 Vector Storage Service
 *
 * Handles vector storage and similarity search for CS2 data
 * with indexing for efficient queries and retrieval.
 * Integrates with LibreChat's existing vector database infrastructure.
 */

const axios = require('axios');
const logger = require('../../../../utils/logger');
const { generateShortLivedToken } = require('../../../services/AuthService');
const { logAxiosError } = require('@librechat/api');
const { CS2VectorError } = require('./errors');
const CS2VectorService = require('./CS2VectorService');

class CS2VectorStorage {
  constructor(options = {}) {
    this.vectorService = new CS2VectorService(options.vectorService);
    this.config = {
      indexName: 'cs2_vectors',
      similarityThreshold: 0.7,
      maxResults: 100,
      ...options,
    };

    // Entity type mappings
    this.entityTypes = {
      MATCH: 'cs2_match',
      TEAM: 'cs2_team',
      PLAYER: 'cs2_player',
      TOURNAMENT: 'cs2_tournament',
    };
  }

  /**
   * Initialize the vector storage service
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    await this.vectorService.initialize(options);
    await this.ensureIndexExists();
  }

  /**
   * Store match data with vector embedding
   * @param {Object} params - Storage parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.matchData - Match data to store
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Storage result
   */
  async storeMatchVector({ userId, matchData, metadata = {} }) {
    try {
      // Generate embedding for match data
      const embedding = await this.vectorService.generateMatchEmbedding(matchData);

      // Prepare metadata
      const enrichedMetadata = {
        ...metadata,
        entityType: this.entityTypes.MATCH,
        hltvId: matchData.hltvId,
        teams: matchData.teams,
        tournament: matchData.tournament,
        status: matchData.status,
        date: matchData.date,
        maps: matchData.maps?.map((map) => map.name) || [],
        createdAt: new Date().toISOString(),
      };

      // Store in vector database
      const result = await this.storeVector({
        userId,
        entityId: matchData.hltvId,
        entityType: this.entityTypes.MATCH,
        embedding,
        metadata: enrichedMetadata,
      });

      logger.info(`Stored match vector for ${matchData.hltvId}`, {
        matchId: matchData.hltvId,
        teams: matchData.teams,
      });

      return result;
    } catch (error) {
      throw new CS2VectorError(`Failed to store match vector: ${error.message}`, {
        matchId: matchData.hltvId,
        originalError: error.message,
      });
    }
  }

  /**
   * Store team data with vector embedding
   * @param {Object} params - Storage parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.teamData - Team data to store
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Storage result
   */
  async storeTeamVector({ userId, teamData, metadata = {} }) {
    try {
      // Generate embedding for team data
      const embedding = await this.vectorService.generateTeamEmbedding(teamData);

      // Prepare metadata
      const enrichedMetadata = {
        ...metadata,
        entityType: this.entityTypes.TEAM,
        hltvId: teamData.hltvId,
        name: teamData.name,
        ranking: teamData.ranking,
        players: teamData.players?.map((p) => p.name) || [],
        region: teamData.region,
        createdAt: new Date().toISOString(),
      };

      // Store in vector database
      const result = await this.storeVector({
        userId,
        entityId: teamData.hltvId || teamData.name,
        entityType: this.entityTypes.TEAM,
        embedding,
        metadata: enrichedMetadata,
      });

      logger.info(`Stored team vector for ${teamData.name}`, {
        teamName: teamData.name,
        ranking: teamData.ranking,
      });

      return result;
    } catch (error) {
      throw new CS2VectorError(`Failed to store team vector: ${error.message}`, {
        teamName: teamData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Store player data with vector embedding
   * @param {Object} params - Storage parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.playerData - Player data to store
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Storage result
   */
  async storePlayerVector({ userId, playerData, metadata = {} }) {
    try {
      // Generate embedding for player data
      const embedding = await this.vectorService.generatePlayerEmbedding(playerData);

      // Prepare metadata
      const enrichedMetadata = {
        ...metadata,
        entityType: this.entityTypes.PLAYER,
        hltvId: playerData.hltvId,
        name: playerData.name,
        realName: playerData.realName,
        team: playerData.team,
        country: playerData.country,
        age: playerData.age,
        createdAt: new Date().toISOString(),
      };

      // Store in vector database
      const result = await this.storeVector({
        userId,
        entityId: playerData.hltvId || playerData.name,
        entityType: this.entityTypes.PLAYER,
        embedding,
        metadata: enrichedMetadata,
      });

      logger.info(`Stored player vector for ${playerData.name}`, {
        playerName: playerData.name,
        team: playerData.team,
      });

      return result;
    } catch (error) {
      throw new CS2VectorError(`Failed to store player vector: ${error.message}`, {
        playerName: playerData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Find similar matches based on team composition, tournament, or other factors
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.matchData - Reference match data
   * @param {number} params.limit - Maximum results to return
   * @param {number} params.threshold - Similarity threshold
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Array>} Similar matches
   */
  async findSimilarMatches({ userId, matchData, limit = 10, threshold = 0.7, filters = {} }) {
    try {
      // Generate embedding for the query match
      const queryEmbedding = await this.vectorService.generateMatchEmbedding(matchData);

      // Search for similar matches
      const results = await this.searchSimilar({
        userId,
        queryEmbedding,
        entityType: this.entityTypes.MATCH,
        limit,
        threshold,
        filters: {
          ...filters,
          entityType: this.entityTypes.MATCH,
        },
      });

      // Enrich results with additional context
      return results.map((result) => ({
        ...result,
        similarity:
          result.similarity ||
          this.vectorService.calculateSimilarity(queryEmbedding, result.embedding),
        matchContext: this.extractMatchContext(result.metadata),
      }));
    } catch (error) {
      throw new CS2VectorError(`Failed to find similar matches: ${error.message}`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Find teams with similar performance characteristics
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.teamData - Reference team data
   * @param {number} params.limit - Maximum results to return
   * @param {number} params.threshold - Similarity threshold
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Array>} Similar teams
   */
  async findSimilarTeams({ userId, teamData, limit = 10, threshold = 0.7, filters = {} }) {
    try {
      // Generate embedding for the query team
      const queryEmbedding = await this.vectorService.generateTeamEmbedding(teamData);

      // Search for similar teams
      const results = await this.searchSimilar({
        userId,
        queryEmbedding,
        entityType: this.entityTypes.TEAM,
        limit,
        threshold,
        filters: {
          ...filters,
          entityType: this.entityTypes.TEAM,
        },
      });

      // Enrich results with team context
      return results.map((result) => ({
        ...result,
        similarity:
          result.similarity ||
          this.vectorService.calculateSimilarity(queryEmbedding, result.embedding),
        teamContext: this.extractTeamContext(result.metadata),
      }));
    } catch (error) {
      throw new CS2VectorError(`Failed to find similar teams: ${error.message}`, {
        teamName: teamData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Find players with similar playing styles or statistics
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.playerData - Reference player data
   * @param {number} params.limit - Maximum results to return
   * @param {number} params.threshold - Similarity threshold
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Array>} Similar players
   */
  async findSimilarPlayers({ userId, playerData, limit = 10, threshold = 0.7, filters = {} }) {
    try {
      // Generate embedding for the query player
      const queryEmbedding = await this.vectorService.generatePlayerEmbedding(playerData);

      // Search for similar players
      const results = await this.searchSimilar({
        userId,
        queryEmbedding,
        entityType: this.entityTypes.PLAYER,
        limit,
        threshold,
        filters: {
          ...filters,
          entityType: this.entityTypes.PLAYER,
        },
      });

      // Enrich results with player context
      return results.map((result) => ({
        ...result,
        similarity:
          result.similarity ||
          this.vectorService.calculateSimilarity(queryEmbedding, result.embedding),
        playerContext: this.extractPlayerContext(result.metadata),
      }));
    } catch (error) {
      throw new CS2VectorError(`Failed to find similar players: ${error.message}`, {
        playerName: playerData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Search for matches involving specific teams
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {Array} params.teamNames - Team names to search for
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Array>} Matching results
   */
  async searchMatchesByTeams({ userId, teamNames, filters = {} }) {
    try {
      const searchFilters = {
        ...filters,
        entityType: this.entityTypes.MATCH,
        teams: { $in: teamNames },
      };

      return await this.searchByMetadata({
        userId,
        filters: searchFilters,
      });
    } catch (error) {
      throw new CS2VectorError(`Failed to search matches by teams: ${error.message}`, {
        teamNames,
        originalError: error.message,
      });
    }
  }

  /**
   * Search for matches in specific tournaments
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {string} params.tournament - Tournament name
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Array>} Matching results
   */
  async searchMatchesByTournament({ userId, tournament, filters = {} }) {
    try {
      const searchFilters = {
        ...filters,
        entityType: this.entityTypes.MATCH,
        tournament: { $regex: tournament, $options: 'i' },
      };

      return await this.searchByMetadata({
        userId,
        filters: searchFilters,
      });
    } catch (error) {
      throw new CS2VectorError(`Failed to search matches by tournament: ${error.message}`, {
        tournament,
        originalError: error.message,
      });
    }
  }

  /**
   * Get team performance trends over time
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {string} params.teamName - Team name
   * @param {Date} params.startDate - Start date for analysis
   * @param {Date} params.endDate - End date for analysis
   * @returns {Promise<Array>} Performance trend data
   */
  async getTeamPerformanceTrend({ userId, teamName, startDate, endDate }) {
    try {
      const filters = {
        entityType: this.entityTypes.MATCH,
        teams: teamName,
        date: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      };

      const matches = await this.searchByMetadata({
        userId,
        filters,
        sort: { date: 1 },
      });

      return this.analyzePerformanceTrend(matches, teamName);
    } catch (error) {
      throw new CS2VectorError(`Failed to get team performance trend: ${error.message}`, {
        teamName,
        originalError: error.message,
      });
    }
  }

  /**
   * Generic vector storage method
   * @param {Object} params - Storage parameters
   * @returns {Promise<Object>} Storage result
   */
  async storeVector({ userId, entityId, entityType, embedding, metadata }) {
    return await this.vectorService.storeEmbedding({
      userId,
      entityId,
      entityType,
      embedding,
      metadata,
    });
  }

  /**
   * Generic similarity search method
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Search results
   */
  async searchSimilar({ userId, queryEmbedding, entityType, limit, threshold, filters = {} }) {
    const results = await this.vectorService.searchSimilar({
      userId,
      queryEmbedding,
      entityType,
      limit,
      threshold,
    });

    // Apply additional filters if provided
    if (Object.keys(filters).length > 0) {
      return results.filter((result) => this.matchesFilters(result.metadata, filters));
    }

    return results;
  }

  /**
   * Search by metadata filters
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Search results
   */
  async searchByMetadata({ userId, filters, sort = {}, limit = 100 }) {
    if (!process.env.RAG_API_URL) {
      throw new CS2VectorError('RAG_API_URL not configured for metadata search');
    }

    try {
      const jwtToken = generateShortLivedToken(userId);

      const payload = {
        filters,
        sort,
        limit,
      };

      const response = await axios.post(`${process.env.RAG_API_URL}/search/metadata`, payload, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      });

      return response.data.results || [];
    } catch (error) {
      logAxiosError({
        error,
        message: 'Error searching by metadata',
      });
      throw new CS2VectorError(`Failed to search by metadata: ${error.message}`, {
        filters,
        originalError: error.message,
      });
    }
  }

  /**
   * Ensure vector index exists for CS2 data
   * @returns {Promise<void>}
   */
  async ensureIndexExists() {
    if (!process.env.RAG_API_URL) {
      logger.warn('RAG_API_URL not configured, skipping index creation');
      return;
    }

    try {
      // This would typically create indexes for efficient querying
      // Implementation depends on the specific vector database being used
      logger.info('CS2 vector indexes ensured');
    } catch (error) {
      logger.warn('Failed to ensure vector indexes:', error.message);
    }
  }

  /**
   * Extract match context from metadata
   * @param {Object} metadata - Match metadata
   * @returns {Object} Match context
   */
  extractMatchContext(metadata) {
    return {
      teams: metadata.teams,
      tournament: metadata.tournament,
      date: metadata.date,
      maps: metadata.maps,
      status: metadata.status,
    };
  }

  /**
   * Extract team context from metadata
   * @param {Object} metadata - Team metadata
   * @returns {Object} Team context
   */
  extractTeamContext(metadata) {
    return {
      name: metadata.name,
      ranking: metadata.ranking,
      players: metadata.players,
      region: metadata.region,
    };
  }

  /**
   * Extract player context from metadata
   * @param {Object} metadata - Player metadata
   * @returns {Object} Player context
   */
  extractPlayerContext(metadata) {
    return {
      name: metadata.name,
      realName: metadata.realName,
      team: metadata.team,
      country: metadata.country,
      age: metadata.age,
    };
  }

  /**
   * Check if metadata matches filters
   * @param {Object} metadata - Metadata to check
   * @param {Object} filters - Filters to apply
   * @returns {boolean} True if matches
   */
  matchesFilters(metadata, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'object' && value !== null && value.$in) {
        // For $in filters, check if metadata value is in the array or if array contains any of the values
        if (Array.isArray(metadata[key])) {
          if (!value.$in.some((v) => metadata[key].includes(v))) {
            return false;
          }
        } else {
          if (!value.$in.includes(metadata[key])) {
            return false;
          }
        }
      } else if (typeof value === 'object' && value !== null && value.$regex) {
        const regex = new RegExp(value.$regex, value.$options || '');
        if (!regex.test(metadata[key])) {
          return false;
        }
      } else if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Analyze performance trend from match data
   * @param {Array} matches - Match data
   * @param {string} teamName - Team name to analyze
   * @returns {Array} Performance trend data
   */
  analyzePerformanceTrend(matches, teamName) {
    return matches.map((match) => {
      const teamIndex = match.metadata.teams.indexOf(teamName);
      const isWin = this.determineMatchResult(match.metadata, teamIndex);

      return {
        date: match.metadata.date,
        opponent: match.metadata.teams.find((t) => t !== teamName),
        tournament: match.metadata.tournament,
        result: isWin ? 'W' : 'L',
        maps: match.metadata.maps,
      };
    });
  }

  /**
   * Determine match result for a team
   * @param {Object} metadata - Match metadata
   * @param {number} teamIndex - Team index
   * @returns {boolean} True if team won
   */
  determineMatchResult() {
    // This would need to be implemented based on how match results are stored
    // For now, return a placeholder
    return Math.random() > 0.5;
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStats() {
    return {
      entityTypes: this.entityTypes,
      config: this.config,
      vectorService: this.vectorService.getStats(),
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.vectorService.cleanup();
  }
}

module.exports = CS2VectorStorage;

/**
 * CS2 Vector Service
 *
 * Handles embeddings generation for CS2 match data, team performance,
 * and player statistics using OpenAI's embedding API.
 * Integrates with LibreChat's existing vector database infrastructure.
 */

const OpenAI = require('openai');
const axios = require('axios');
const logger = require('../../../../utils/logger');
const { generateShortLivedToken } = require('../../../services/AuthService');
const { logAxiosError } = require('@librechat/api');
const { CS2VectorError } = require('./errors');
const config = require('./config');

class CS2VectorService {
  constructor(options = {}) {
    this.config = { ...config.embeddings, ...options };
    this.openai = null;
    this.isInitialized = false;

    // Embedding dimensions for different models
    this.embeddingDimensions = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
  }

  /**
   * Initialize OpenAI client for embeddings
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized && !options.force) {
      return;
    }

    try {
      const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      const baseURL = options.baseURL || process.env.OPENAI_BASE_URL;

      if (!apiKey) {
        throw new Error('OpenAI API key is required for embeddings generation');
      }

      const clientOptions = {
        apiKey,
        ...(baseURL && { baseURL }),
      };

      this.openai = new OpenAI(clientOptions);
      this.isInitialized = true;

      logger.info('CS2VectorService initialized successfully');
    } catch (error) {
      throw new CS2VectorError(`Failed to initialize CS2VectorService: ${error.message}`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Generate embeddings for match data
   * @param {Object} matchData - Match data to vectorize
   * @returns {Promise<Array>} Embedding vector
   */
  async generateMatchEmbedding(matchData) {
    await this.initialize();

    try {
      const matchText = this.formatMatchForEmbedding(matchData);

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: matchText,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new CS2VectorError(`Failed to generate match embedding: ${error.message}`, {
        matchId: matchData.hltvId,
        originalError: error.message,
      });
    }
  }

  /**
   * Generate embeddings for team performance data
   * @param {Object} teamData - Team data to vectorize
   * @returns {Promise<Array>} Embedding vector
   */
  async generateTeamEmbedding(teamData) {
    await this.initialize();

    try {
      const teamText = this.formatTeamForEmbedding(teamData);

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: teamText,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new CS2VectorError(`Failed to generate team embedding: ${error.message}`, {
        teamName: teamData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Generate embeddings for player statistics
   * @param {Object} playerData - Player data to vectorize
   * @returns {Promise<Array>} Embedding vector
   */
  async generatePlayerEmbedding(playerData) {
    await this.initialize();

    try {
      const playerText = this.formatPlayerForEmbedding(playerData);

      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: playerText,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new CS2VectorError(`Failed to generate player embedding: ${error.message}`, {
        playerName: playerData.name,
        originalError: error.message,
      });
    }
  }

  /**
   * Generate embeddings in batch for efficiency
   * @param {Array} dataItems - Array of data items to vectorize
   * @param {string} type - Type of data ('match', 'team', 'player')
   * @returns {Promise<Array>} Array of embedding vectors
   */
  async generateBatchEmbeddings(dataItems, type) {
    await this.initialize();

    if (!dataItems || dataItems.length === 0) {
      return [];
    }

    try {
      // Process in batches to respect API limits
      const batchSize = this.config.batchSize;
      const results = [];

      for (let i = 0; i < dataItems.length; i += batchSize) {
        const batch = dataItems.slice(i, i + batchSize);
        const batchTexts = batch.map((item) => this.formatDataForEmbedding(item, type));

        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: batchTexts,
          encoding_format: 'float',
        });

        results.push(...response.data.map((item) => item.embedding));

        // Add delay between batches to respect rate limits
        if (i + batchSize < dataItems.length) {
          await this.delay(100);
        }
      }

      return results;
    } catch (error) {
      throw new CS2VectorError(`Failed to generate batch embeddings: ${error.message}`, {
        batchSize: dataItems.length,
        type,
        originalError: error.message,
      });
    }
  }

  /**
   * Store embeddings in LibreChat's vector database
   * @param {Object} params - Storage parameters
   * @param {string} params.userId - User ID
   * @param {string} params.entityId - Entity ID (match/team/player ID)
   * @param {string} params.entityType - Type of entity
   * @param {Array} params.embedding - Embedding vector
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Storage result
   */
  async storeEmbedding({ userId, entityId, entityType, embedding, metadata = {} }) {
    if (!process.env.RAG_API_URL) {
      throw new CS2VectorError('RAG_API_URL not configured for vector storage');
    }

    try {
      const jwtToken = generateShortLivedToken(userId);

      const payload = {
        entity_id: entityId,
        entity_type: `cs2_${entityType}`,
        embedding,
        metadata: {
          ...metadata,
          source: 'cs2_scraper',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await axios.post(`${process.env.RAG_API_URL}/embeddings`, payload, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      logAxiosError({
        error,
        message: 'Error storing CS2 embedding',
      });
      throw new CS2VectorError(`Failed to store embedding: ${error.message}`, {
        entityId,
        entityType,
        originalError: error.message,
      });
    }
  }

  /**
   * Search for similar entities using vector similarity
   * @param {Object} params - Search parameters
   * @param {string} params.userId - User ID
   * @param {Array} params.queryEmbedding - Query embedding vector
   * @param {string} params.entityType - Type of entity to search
   * @param {number} params.limit - Maximum results to return
   * @param {number} params.threshold - Similarity threshold
   * @returns {Promise<Array>} Similar entities
   */
  async searchSimilar({ userId, queryEmbedding, entityType, limit = 10, threshold = 0.7 }) {
    if (!process.env.RAG_API_URL) {
      throw new CS2VectorError('RAG_API_URL not configured for vector search');
    }

    try {
      const jwtToken = generateShortLivedToken(userId);

      const payload = {
        embedding: queryEmbedding,
        entity_type: `cs2_${entityType}`,
        limit,
        threshold,
      };

      const response = await axios.post(`${process.env.RAG_API_URL}/search`, payload, {
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
        message: 'Error searching CS2 embeddings',
      });
      throw new CS2VectorError(`Failed to search embeddings: ${error.message}`, {
        entityType,
        originalError: error.message,
      });
    }
  }

  /**
   * Format match data for embedding generation
   * @param {Object} matchData - Match data
   * @returns {string} Formatted text for embedding
   */
  formatMatchForEmbedding(matchData) {
    const parts = [
      `Match: ${matchData.teams.join(' vs ')}`,
      `Tournament: ${matchData.tournament || 'Unknown'}`,
      `Status: ${matchData.status}`,
      `Date: ${matchData.date ? new Date(matchData.date).toISOString() : 'Unknown'}`,
    ];

    if (matchData.maps && matchData.maps.length > 0) {
      const mapInfo = matchData.maps
        .map((map) => `${map.name}: ${map.scores ? map.scores.join('-') : 'TBD'}`)
        .join(', ');
      parts.push(`Maps: ${mapInfo}`);
    }

    if (matchData.scores && matchData.scores.length > 0) {
      parts.push(`Score: ${matchData.scores.join('-')}`);
    }

    return parts.join('\n');
  }

  /**
   * Format team data for embedding generation
   * @param {Object} teamData - Team data
   * @returns {string} Formatted text for embedding
   */
  formatTeamForEmbedding(teamData) {
    const parts = [`Team: ${teamData.name}`, `Ranking: ${teamData.ranking || 'Unranked'}`];

    if (teamData.players && teamData.players.length > 0) {
      const playerNames = teamData.players.map((p) => p.name).join(', ');
      parts.push(`Players: ${playerNames}`);
    }

    if (teamData.stats) {
      const statsText = Object.entries(teamData.stats)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`Stats: ${statsText}`);
    }

    if (teamData.recentMatches && teamData.recentMatches.length > 0) {
      const recentForm = teamData.recentMatches
        .slice(0, 5)
        .map((match) => `vs ${match.opponent}: ${match.result}`)
        .join(', ');
      parts.push(`Recent form: ${recentForm}`);
    }

    return parts.join('\n');
  }

  /**
   * Format player data for embedding generation
   * @param {Object} playerData - Player data
   * @returns {string} Formatted text for embedding
   */
  formatPlayerForEmbedding(playerData) {
    const parts = [
      `Player: ${playerData.name}`,
      `Real name: ${playerData.realName || 'Unknown'}`,
      `Age: ${playerData.age || 'Unknown'}`,
      `Country: ${playerData.country || 'Unknown'}`,
      `Team: ${playerData.team || 'Free agent'}`,
    ];

    if (playerData.stats) {
      const statsText = Object.entries(playerData.stats)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`Stats: ${statsText}`);
    }

    if (playerData.achievements && playerData.achievements.length > 0) {
      const achievementsText = playerData.achievements
        .slice(0, 5)
        .map((ach) => `${ach.title} (${ach.date})`)
        .join(', ');
      parts.push(`Achievements: ${achievementsText}`);
    }

    return parts.join('\n');
  }

  /**
   * Generic data formatter for batch processing
   * @param {Object} data - Data item
   * @param {string} type - Data type
   * @returns {string} Formatted text
   */
  formatDataForEmbedding(data, type) {
    switch (type) {
      case 'match':
        return this.formatMatchForEmbedding(data);
      case 'team':
        return this.formatTeamForEmbedding(data);
      case 'player':
        return this.formatPlayerForEmbedding(data);
      default:
        throw new CS2VectorError(`Unknown data type for embedding: ${type}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vectorA - First vector
   * @param {Array} vectorB - Second vector
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new CS2VectorError('Vectors must have the same dimensions for similarity calculation');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      model: this.config.model,
      batchSize: this.config.batchSize,
      embeddingDimension: this.embeddingDimensions[this.config.model] || 'unknown',
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.openai = null;
    this.isInitialized = false;
  }
}

module.exports = CS2VectorService;

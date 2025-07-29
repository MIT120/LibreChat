/**
 * Configuration for CS2 MCP Server
 * Centralizes all configuration values for better maintainability
 */

const MCP_CONFIG = {
  server: {
    name: 'cs2-hltv-server',
    version: '1.0.0',
    description: 'CS2 HLTV data and prediction server for MCP'
  },

  limits: {
    maxMatchResults: 100,
    defaultMatchLimit: 10,
    maxTeamNameLength: 50,
    maxMapNameLength: 30
  },

  timeframes: {
    '1month': 30,
    '3months': 90,
    '6months': 180,
    '1year': 365
  },

  validStatuses: ['upcoming', 'live', 'finished'],
  
  validTimeframes: ['1month', '3months', '6months', '1year'],
  
  validPredictionTypes: ['half_time', 'map_winner', 'series_outcome'],

  predictions: {
    confidence: {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    },
    
    probabilityBounds: {
      halfTime: { min: 0.1, max: 0.9 },
      mapWinner: { min: 0.15, max: 0.85 },
      seriesOutcome: { min: 0.2, max: 0.8 }
    },

    rankingMultipliers: {
      halfTime: 0.1,
      mapWinner: 0.08,
      seriesOutcome: 0.06
    }
  },

  database: {
    populateFields: {
      team: 'name ranking recentForm',
      match: 'teams.team'
    },
    
    sortOptions: {
      matchesByDate: { date: -1 },
      teamsByRanking: { ranking: 1 }
    }
  },

  logging: {
    prefix: '[CS2MCPServer]',
    levels: {
      error: 'error',
      warn: 'warn',
      info: 'info',
      debug: 'debug'
    }
  }
};

module.exports = MCP_CONFIG;
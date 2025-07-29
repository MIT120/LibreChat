/**
 * Configuration constants for CS2 Match operations
 */

module.exports = {
  // Cache TTL values (in seconds)
  CACHE_TTL: {
    FINISHED_MATCH: 3600, // 1 hour for finished matches
    LIVE_MATCH: 300, // 5 minutes for live matches
    UPCOMING_MATCH: 600, // 10 minutes for upcoming matches
    TEAM_STATS: 1800, // 30 minutes for team statistics
  },

  // Default query limits
  QUERY_LIMITS: {
    DEFAULT_MATCHES: 20,
    MAX_MATCHES: 100,
    LIVE_MATCHES: 10,
    UPCOMING_MATCHES: 20,
    RECENT_MATCHES: 30,
    HEAD_TO_HEAD: 10,
  },

  // Time periods (in days)
  TIME_PERIODS: {
    RECENT_MATCHES: 7,
    TEAM_STATS: 90,
    HEAD_TO_HEAD: 365,
    UPCOMING_HOURS: 24,
  },

  // Population fields
  POPULATE_FIELDS: {
    TEAM: 'name logo country ranking.current',
    TOURNAMENT: 'name tier prizePool',
    MAP_WINNER: 'name logo',
    MAP_PICK: 'name logo',
  },

  // Match statuses
  MATCH_STATUS: {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    FINISHED: 'finished',
    CANCELLED: 'cancelled',
  },

  // Validation rules
  VALIDATION: {
    MIN_TEAMS: 2,
    MAX_TEAMS: 2,
    MAX_HLTV_ID_LENGTH: 20,
    MAX_TEAM_NAME_LENGTH: 100,
  },
};

/**
 * Input validation for MCP tool requests
 * Provides type-safe validation with detailed error messages
 */
class MCPValidators {
  static validateGetMatchData(args) {
    const errors = [];

    if (args.matchId && typeof args.matchId !== 'string') {
      errors.push('matchId must be a string');
    }

    if (args.teamName && typeof args.teamName !== 'string') {
      errors.push('teamName must be a string');
    }

    if (args.dateRange) {
      if (typeof args.dateRange !== 'object') {
        errors.push('dateRange must be an object');
      } else {
        if (args.dateRange.start && !this.isValidDate(args.dateRange.start)) {
          errors.push('dateRange.start must be a valid date string');
        }
        if (args.dateRange.end && !this.isValidDate(args.dateRange.end)) {
          errors.push('dateRange.end must be a valid date string');
        }
      }
    }

    if (args.status && !['upcoming', 'live', 'finished'].includes(args.status)) {
      errors.push('status must be one of: upcoming, live, finished');
    }

    if (args.limit && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)) {
      errors.push('limit must be an integer between 1 and 100');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validateGetTeamStats(args) {
    const errors = [];

    if (!args.teamName || typeof args.teamName !== 'string') {
      errors.push('teamName is required and must be a string');
    }

    if (args.mapName && typeof args.mapName !== 'string') {
      errors.push('mapName must be a string');
    }

    if (args.timeframe && !['1month', '3months', '6months', '1year'].includes(args.timeframe)) {
      errors.push('timeframe must be one of: 1month, 3months, 6months, 1year');
    }

    return { isValid: errors.length === 0, errors };
  }

  static validatePredictMatchOutcome(args) {
    const errors = [];

    if (!args.matchId || typeof args.matchId !== 'string') {
      errors.push('matchId is required and must be a string');
    }

    if (
      !args.predictionType ||
      !['half_time', 'map_winner', 'series_outcome'].includes(args.predictionType)
    ) {
      errors.push(
        'predictionType is required and must be one of: half_time, map_winner, series_outcome',
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

/**
 * Custom error classes for better error handling
 */
class MCPValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'MCPValidationError';
    this.errors = errors;
  }
}

class MCPNotFoundError extends Error {
  constructor(resource, identifier) {
    super(`${resource} not found: ${identifier}`);
    this.name = 'MCPNotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }
}

module.exports = {
  MCPValidators,
  MCPValidationError,
  MCPNotFoundError,
};

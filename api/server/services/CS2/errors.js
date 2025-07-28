/**
 * Custom error classes for HLTV CS2 Scraper
 */

class CS2ScraperError extends Error {
  constructor(message, code = 'CS2_SCRAPER_ERROR', details = {}) {
    super(message);
    this.name = 'CS2ScraperError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class HLTVParsingError extends CS2ScraperError {
  constructor(message, url, details = {}) {
    super(message, 'HLTV_PARSING_ERROR', { url, ...details });
    this.name = 'HLTVParsingError';
  }
}

class HLTVRateLimitError extends CS2ScraperError {
  constructor(message, retryAfter = null) {
    super(message, 'HLTV_RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'HLTVRateLimitError';
    this.retryAfter = retryAfter;
  }
}

class HLTVNetworkError extends CS2ScraperError {
  constructor(message, statusCode = null, details = {}) {
    super(message, 'HLTV_NETWORK_ERROR', { statusCode, ...details });
    this.name = 'HLTVNetworkError';
    this.statusCode = statusCode;
  }
}

class CS2VectorError extends CS2ScraperError {
  constructor(message, details = {}) {
    super(message, 'CS2_VECTOR_ERROR', details);
    this.name = 'CS2VectorError';
  }
}

class CS2PredictionError extends CS2ScraperError {
  constructor(message, predictionType = null, details = {}) {
    super(message, 'CS2_PREDICTION_ERROR', { predictionType, ...details });
    this.name = 'CS2PredictionError';
    this.predictionType = predictionType;
  }
}

class CS2MCPError extends CS2ScraperError {
  constructor(message, toolName = null, details = {}) {
    super(message, 'CS2_MCP_ERROR', { toolName, ...details });
    this.name = 'CS2MCPError';
    this.toolName = toolName;
  }
}

module.exports = {
  CS2ScraperError,
  HLTVParsingError,
  HLTVRateLimitError,
  HLTVNetworkError,
  CS2VectorError,
  CS2PredictionError,
  CS2MCPError,
};
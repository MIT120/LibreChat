/**
 * Custom Error Classes for CS2 Scraper
 */

class CS2ScraperError extends Error {
  constructor(message, code = 'CS2_SCRAPER_ERROR', details = {}) {
    super(message);
    this.name = 'CS2ScraperError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CS2ScraperError);
    }
  }
}

class HLTVParsingError extends CS2ScraperError {
  constructor(message, url = '', details = {}) {
    super(message, 'HLTV_PARSING_ERROR', { ...details, url });
    this.name = 'HLTVParsingError';
  }
}

class HLTVNetworkError extends CS2ScraperError {
  constructor(message, statusCode = 0, details = {}) {
    super(message, 'HLTV_NETWORK_ERROR', { ...details, statusCode });
    this.name = 'HLTVNetworkError';
    this.statusCode = statusCode;
  }
}

class HLTVRateLimitError extends CS2ScraperError {
  constructor(message, retryAfter = null, details = {}) {
    super(message, 'HLTV_RATE_LIMIT_ERROR', { ...details, retryAfter });
    this.name = 'HLTVRateLimitError';
    this.retryAfter = retryAfter;
  }
}

class CS2VectorError extends CS2ScraperError {
  constructor(message, details = {}) {
    super(message, 'CS2_VECTOR_ERROR', details);
    this.name = 'CS2VectorError';
  }
}

class CS2PredictionError extends CS2ScraperError {
  constructor(message, details = {}) {
    super(message, 'CS2_PREDICTION_ERROR', details);
    this.name = 'CS2PredictionError';
  }
}

module.exports = {
  CS2ScraperError,
  HLTVParsingError,
  HLTVNetworkError,
  HLTVRateLimitError,
  CS2VectorError,
  CS2PredictionError,
};

/**
 * Retry Handler for HLTV Scraper
 *
 * Implements retry logic with exponential backoff and jitter
 * for handling transient failures.
 */

const { CS2ScraperError, HLTVNetworkError, HLTVRateLimitError } = require('./errors');
const config = require('./config');

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || config.errors.maxRetries;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || config.errors.maxBackoffDelay;
    this.backoffMultiplier = options.backoffMultiplier || config.errors.backoffMultiplier;
    this.jitterFactor = options.jitterFactor || 0.1;

    // Retryable error patterns
    this.retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'EHOSTUNREACH',
      'EAI_AGAIN',
    ];

    this.retryableMessages = [
      'timeout',
      'network error',
      'connection',
      'socket hang up',
      'request timeout',
    ];
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @param {...any} args - Arguments to pass to function
   * @returns {Promise<any>} Result of function execution
   */
  async executeWithRetry(fn, options = {}, ...args) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    // Throw wrapped error after all retries exhausted
    throw new CS2ScraperError(
      `Retry handler: operation failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`,
      'RETRY_EXHAUSTED',
      {
        attempts: maxRetries + 1,
        lastError: lastError.message,
        context: options.context,
      },
    );
  }

  /**
   * Check if error should trigger a retry
   * @param {Error} error - Error to check
   * @returns {boolean} True if retryable
   */
  isRetryableError(error) {
    // Don't retry rate limit errors
    if (error instanceof HLTVRateLimitError) {
      return false;
    }

    // Don't retry parsing errors
    if (error.code === 'HLTV_PARSING_ERROR') {
      return false;
    }

    // Retry network errors with 5xx status codes
    if (error instanceof HLTVNetworkError) {
      return error.statusCode >= 500;
    }

    // Check error code
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message
    const message = error.message.toLowerCase();
    return this.retryableMessages.some((pattern) => message.includes(pattern));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(this.backoffMultiplier, attempt),
      this.maxDelay,
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.jitterFactor * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Create a retryable version of a function
   * @param {Function} fn - Function to make retryable
   * @param {Object} options - Default retry options
   * @returns {Function} Retryable function
   */
  makeRetryable(fn, options = {}) {
    return (...args) => this.executeWithRetry(fn, options, ...args);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get retry handler statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      backoffMultiplier: this.backoffMultiplier,
      jitterFactor: this.jitterFactor,
      retryableErrors: this.retryableErrors,
    };
  }
}

module.exports = RetryHandler;

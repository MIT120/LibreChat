/**
 * Retry Handler for HLTV Scraper
 * 
 * Implements retry logic with exponential backoff and jitter
 * for handling transient failures.
 */

const { HLTVNetworkError, HLTVRateLimitError, CS2ScraperError } = require('./errors');
const config = require('./config');

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || config.scraper.maxRetries;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || config.errors.maxBackoffDelay;
    this.backoffMultiplier = options.backoffMultiplier || config.errors.backoffMultiplier;
    this.jitterFactor = options.jitterFactor || 0.1; // 10% jitter
    
    // Retryable error types
    this.retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'TIMEOUT'
    ];
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} Result of the function execution
   */
  async executeWithRetry(fn, options = {}, ...args) {
    const maxRetries = options.maxRetries || this.maxRetries;
    const context = options.context || 'operation';
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn(...args);
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          console.log(`${context} succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.log(`${context} failed with non-retryable error:`, error.message);
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        
        console.log(`${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted, throw the last error
    throw new CS2ScraperError(
      `${context} failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      'RETRY_EXHAUSTED',
      {
        originalError: lastError,
        attempts: maxRetries + 1,
        context
      }
    );
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    // Don't retry rate limit errors (they should be handled by rate limiter)
    if (error instanceof HLTVRateLimitError) {
      return false;
    }
    
    // Don't retry parsing errors (they indicate structural issues)
    if (error.code === 'HLTV_PARSING_ERROR') {
      return false;
    }
    
    // Retry network errors
    if (error instanceof HLTVNetworkError) {
      // Don't retry client errors (4xx), but retry server errors (5xx)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      return true;
    }
    
    // Check for specific error codes
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check error message for common network issues
    const message = error.message.toLowerCase();
    const retryableMessages = [
      'timeout',
      'connection reset',
      'connection refused',
      'network error',
      'socket hang up',
      'econnreset',
      'enotfound',
      'etimedout'
    ];
    
    return retryableMessages.some(msg => message.includes(msg));
  }

  /**
   * Calculate delay for retry attempt with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    
    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter to avoid thundering herd problem
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5) * 2;
    const delayWithJitter = cappedDelay + jitter;
    
    // Ensure delay is not negative and doesn't exceed max delay
    return Math.max(Math.min(delayWithJitter, this.maxDelay), 0);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retryable version of a function
   * @param {Function} fn - Function to make retryable
   * @param {Object} options - Default retry options
   * @returns {Function} Retryable function
   */
  makeRetryable(fn, options = {}) {
    return (...args) => {
      return this.executeWithRetry(fn, options, ...args);
    };
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
      retryableErrors: this.retryableErrors
    };
  }
}

module.exports = RetryHandler;
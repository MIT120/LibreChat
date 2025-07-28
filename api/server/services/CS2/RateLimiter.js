/**
 * Rate Limiter for HLTV Scraper
 *
 * Implements exponential backoff with jitter and request throttling
 * to respect HLTV server limits and avoid detection.
 */

const { HLTVRateLimitError } = require('./errors');
const config = require('./config');

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || config.rateLimit.windowMs;
    this.maxRequests = options.maxRequests || config.rateLimit.maxRequests;
    this.requestDelay = options.requestDelay || config.scraper.requestDelay;

    // Request tracking
    this.requests = [];
    this.lastRequestTime = 0;
    this.consecutiveFailures = 0;
    this.isBlocked = false;
    this.blockUntil = 0;
  }

  /**
   * Check if we can make a request now
   * @returns {boolean} True if request is allowed
   */
  canMakeRequest() {
    const now = Date.now();

    // Check if we're currently blocked
    if (this.isBlocked && now < this.blockUntil) {
      return false;
    } else if (this.isBlocked && now >= this.blockUntil) {
      // Unblock if block period has expired
      this.isBlocked = false;
      this.blockUntil = 0;
      this.consecutiveFailures = 0;
    }

    // Clean old requests from the window
    this.cleanOldRequests(now);

    // Check if we're within rate limits
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Check minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      return false;
    }

    return true;
  }

  /**
   * Wait until we can make a request
   * @returns {Promise<void>}
   */
  async waitForRequest() {
    const now = Date.now();

    // If blocked, wait until unblocked
    if (this.isBlocked && now < this.blockUntil) {
      const waitTime = this.blockUntil - now;
      await this.sleep(waitTime);
      return this.waitForRequest(); // Recursive check after unblocking
    }

    // If not allowed due to rate limits, calculate wait time
    if (!this.canMakeRequest()) {
      const waitTime = this.calculateWaitTime();
      await this.sleep(waitTime);
      return this.waitForRequest(); // Recursive check after waiting
    }
  }

  /**
   * Record a successful request
   */
  recordRequest() {
    const now = Date.now();
    this.requests.push(now);
    this.lastRequestTime = now;
    this.consecutiveFailures = 0; // Reset failure count on success
  }

  /**
   * Record a failed request and apply backoff
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    this.consecutiveFailures++;

    // Apply exponential backoff for consecutive failures
    if (this.consecutiveFailures >= config.errors.maxConsecutiveFailures) {
      this.blockTemporarily();
    }

    // Special handling for rate limit errors
    if (error instanceof HLTVRateLimitError && error.retryAfter) {
      const retryAfter = parseInt(error.retryAfter) * 1000; // Convert to ms
      this.blockUntil = Date.now() + retryAfter;
      this.isBlocked = true;
    }
  }

  /**
   * Calculate wait time based on current state
   * @returns {number} Wait time in milliseconds
   */
  calculateWaitTime() {
    const now = Date.now();

    // If we have too many requests, wait until the oldest one expires
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;
      return Math.max(waitTime, 0);
    }

    // If we need to respect minimum delay
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      return this.requestDelay - timeSinceLastRequest;
    }

    return 0;
  }

  /**
   * Apply exponential backoff with jitter
   * @returns {number} Backoff delay in milliseconds
   */
  calculateBackoffDelay() {
    const baseDelay = this.requestDelay;
    const exponentialDelay =
      baseDelay * Math.pow(config.errors.backoffMultiplier, this.consecutiveFailures - 1);
    const maxDelay = config.errors.maxBackoffDelay;

    // Apply jitter (±25% randomization)
    const jitter = 0.25;
    const jitterMultiplier = 1 + (Math.random() - 0.5) * 2 * jitter;

    const delayWithJitter = exponentialDelay * jitterMultiplier;
    return Math.min(delayWithJitter, maxDelay);
  }

  /**
   * Block requests temporarily due to consecutive failures
   */
  blockTemporarily() {
    const backoffDelay = this.calculateBackoffDelay();
    this.blockUntil = Date.now() + backoffDelay;
    this.isBlocked = true;
  }

  /**
   * Clean old requests from the tracking window
   * @param {number} now - Current timestamp
   */
  cleanOldRequests(now) {
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((timestamp) => timestamp > cutoff);
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
   * Reset rate limiter state
   */
  reset() {
    this.requests = [];
    this.lastRequestTime = 0;
    this.consecutiveFailures = 0;
    this.isBlocked = false;
    this.blockUntil = 0;
  }

  /**
   * Get current rate limiter statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = Date.now();
    this.cleanOldRequests(now);

    return {
      requestsInWindow: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      consecutiveFailures: this.consecutiveFailures,
      isBlocked: this.isBlocked,
      blockUntil: this.blockUntil,
      timeUntilUnblocked: this.isBlocked ? Math.max(0, this.blockUntil - now) : 0,
      lastRequestTime: this.lastRequestTime,
      canMakeRequest: this.canMakeRequest(),
    };
  }
}

module.exports = RateLimiter;

/**
 * Circuit Breaker for HLTV Scraper
 *
 * Implements circuit breaker pattern to handle extended outages
 * and prevent cascading failures.
 */

const { CS2ScraperError } = require('./errors');

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitorTimeout = options.monitorTimeout || 30000; // 30 seconds

    // Circuit states: CLOSED, OPEN, HALF_OPEN
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    // Statistics
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} Result of the function execution
   */
  async execute(fn, ...args) {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CS2ScraperError(
          'Circuit breaker is OPEN - service temporarily unavailable',
          'CIRCUIT_BREAKER_OPEN',
          {
            state: this.state,
            failureCount: this.failureCount,
            nextAttemptTime: this.nextAttemptTime,
          },
        );
      } else {
        // Transition to HALF_OPEN for testing
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
    }
  }

  /**
   * Check if the circuit breaker allows requests
   * @returns {boolean} True if requests are allowed
   */
  allowsRequests() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      return Date.now() >= this.nextAttemptTime;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

  /**
   * Force the circuit breaker to open state
   */
  forceOpen() {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.recoveryTimeout;
  }

  /**
   * Force the circuit breaker to closed state
   */
  forceClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = null;
  }

  /**
   * Reset circuit breaker statistics
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = Date.now();

    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      timeUntilNextAttempt: this.nextAttemptTime ? Math.max(0, this.nextAttemptTime - now) : 0,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      successRate: this.totalRequests > 0 ? this.totalSuccesses / this.totalRequests : 0,
      failureRate: this.totalRequests > 0 ? this.totalFailures / this.totalRequests : 0,
      allowsRequests: this.allowsRequests(),
    };
  }

  /**
   * Get current health status
   * @returns {string} Health status: 'healthy', 'degraded', 'unhealthy'
   */
  getHealthStatus() {
    if (this.state === 'CLOSED' && this.failureCount === 0) {
      return 'healthy';
    }

    if (this.state === 'CLOSED' && this.failureCount > 0) {
      return 'degraded';
    }

    if (this.state === 'HALF_OPEN') {
      return 'recovering';
    }

    return 'unhealthy';
  }
}

module.exports = CircuitBreaker;

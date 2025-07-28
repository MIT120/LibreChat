/**
 * Unit tests for RateLimiter
 */

const RateLimiter = require('./RateLimiter');
const { HLTVRateLimitError } = require('./errors');

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000, // 1 second window for testing
      maxRequests: 3,
      requestDelay: 100, // 100ms delay for testing
    });
  });

  describe('Constructor', () => {
    test('should create instance with default config', () => {
      const limiter = new RateLimiter();
      expect(limiter.windowMs).toBeDefined();
      expect(limiter.maxRequests).toBeDefined();
      expect(limiter.requestDelay).toBeDefined();
    });

    test('should merge custom options', () => {
      const limiter = new RateLimiter({
        windowMs: 5000,
        maxRequests: 10,
        requestDelay: 500,
      });
      expect(limiter.windowMs).toBe(5000);
      expect(limiter.maxRequests).toBe(10);
      expect(limiter.requestDelay).toBe(500);
    });
  });

  describe('Request Limiting', () => {
    test('should allow requests within limits', () => {
      expect(rateLimiter.canMakeRequest()).toBe(true);
      rateLimiter.recordRequest();
      expect(rateLimiter.canMakeRequest()).toBe(false); // Due to delay
    });

    test('should block requests when max requests reached', () => {
      // Make maximum requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    test('should allow requests after window expires', async () => {
      // Fill up the window
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.canMakeRequest()).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    test('should respect minimum delay between requests', async () => {
      rateLimiter.recordRequest();
      expect(rateLimiter.canMakeRequest()).toBe(false);

      // Wait for delay to pass
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });
  });

  describe('Wait for Request', () => {
    test('should wait for rate limit to allow request', async () => {
      rateLimiter.recordRequest();

      const startTime = Date.now();
      await rateLimiter.waitForRequest();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    test('should wait for window to expire when max requests reached', async () => {
      // Fill up the window
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest();
      }

      const startTime = Date.now();
      await rateLimiter.waitForRequest();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(900); // Should wait ~1 second
    });
  });

  describe('Failure Handling', () => {
    test('should track consecutive failures', () => {
      const error = new Error('Test error');

      rateLimiter.recordFailure(error);
      expect(rateLimiter.consecutiveFailures).toBe(1);

      rateLimiter.recordFailure(error);
      expect(rateLimiter.consecutiveFailures).toBe(2);
    });

    test('should reset failures on successful request', () => {
      const error = new Error('Test error');

      rateLimiter.recordFailure(error);
      rateLimiter.recordFailure(error);
      expect(rateLimiter.consecutiveFailures).toBe(2);

      rateLimiter.recordRequest();
      expect(rateLimiter.consecutiveFailures).toBe(0);
    });

    test('should block temporarily after max consecutive failures', () => {
      const error = new Error('Test error');

      // Trigger max consecutive failures
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(error);
      }

      expect(rateLimiter.isBlocked).toBe(true);
      expect(rateLimiter.blockUntil).toBeGreaterThan(Date.now());
    });

    test('should handle rate limit errors with retry-after', () => {
      const rateLimitError = new HLTVRateLimitError('Rate limited', '30');

      rateLimiter.recordFailure(rateLimitError);

      expect(rateLimiter.isBlocked).toBe(true);
      expect(rateLimiter.blockUntil).toBeGreaterThan(Date.now() + 29000); // ~30 seconds
    });
  });

  describe('Backoff Calculation', () => {
    test('should calculate exponential backoff with jitter', () => {
      rateLimiter.consecutiveFailures = 3;

      const delay1 = rateLimiter.calculateBackoffDelay();
      const delay2 = rateLimiter.calculateBackoffDelay();

      // Should be different due to jitter
      expect(delay1).not.toBe(delay2);

      // Should be within reasonable range
      expect(delay1).toBeGreaterThan(0);
      expect(delay1).toBeLessThan(60000); // Max delay
    });

    test('should respect maximum delay', () => {
      rateLimiter.consecutiveFailures = 10; // High failure count

      const delay = rateLimiter.calculateBackoffDelay();
      expect(delay).toBeLessThanOrEqual(60000); // Max delay from config
    });
  });

  describe('Statistics', () => {
    test('should return correct statistics', () => {
      rateLimiter.recordRequest();
      rateLimiter.recordRequest();

      const stats = rateLimiter.getStats();

      expect(stats.requestsInWindow).toBe(2);
      expect(stats.maxRequests).toBe(3);
      expect(stats.consecutiveFailures).toBe(0);
      expect(stats.isBlocked).toBe(false);
      expect(stats.canMakeRequest).toBeDefined();
    });

    test('should show blocked status in statistics', () => {
      const error = new Error('Test error');

      // Trigger blocking
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(error);
      }

      const stats = rateLimiter.getStats();

      expect(stats.isBlocked).toBe(true);
      expect(stats.timeUntilUnblocked).toBeGreaterThan(0);
      expect(stats.canMakeRequest).toBe(false);
    });
  });

  describe('Reset', () => {
    test('should reset all state', () => {
      // Set up some state
      rateLimiter.recordRequest();
      rateLimiter.recordFailure(new Error('Test'));

      rateLimiter.reset();

      expect(rateLimiter.requests).toHaveLength(0);
      expect(rateLimiter.lastRequestTime).toBe(0);
      expect(rateLimiter.consecutiveFailures).toBe(0);
      expect(rateLimiter.isBlocked).toBe(false);
      expect(rateLimiter.blockUntil).toBe(0);
    });
  });
});

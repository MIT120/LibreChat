/**
 * Unit tests for RetryHandler
 */

const RetryHandler = require('./RetryHandler');
const { HLTVNetworkError, HLTVRateLimitError, CS2ScraperError } = require('./errors');

describe('RetryHandler', () => {
  let retryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 100, // 100ms for testing
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    });
  });

  describe('Constructor', () => {
    test('should create instance with default config', () => {
      const handler = new RetryHandler();
      expect(handler.maxRetries).toBeDefined();
      expect(handler.baseDelay).toBeDefined();
      expect(handler.backoffMultiplier).toBeDefined();
    });

    test('should merge custom options', () => {
      const handler = new RetryHandler({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 5000,
      });
      expect(handler.maxRetries).toBe(5);
      expect(handler.baseDelay).toBe(500);
      expect(handler.maxDelay).toBe(5000);
    });
  });

  describe('Retry Logic', () => {
    test('should succeed on first attempt', async () => {
      const successFunction = jest.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(successFunction);

      expect(result).toBe('success');
      expect(successFunction).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable errors', async () => {
      const failingFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(failingFunction);

      expect(result).toBe('success');
      expect(failingFunction).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const rateLimitError = new HLTVRateLimitError('Rate limited');
      const failingFunction = jest.fn().mockRejectedValue(rateLimitError);

      await expect(retryHandler.executeWithRetry(failingFunction)).rejects.toThrow('Rate limited');

      expect(failingFunction).toHaveBeenCalledTimes(1);
    });

    test('should exhaust retries and throw final error', async () => {
      const testError = new Error('ECONNRESET');
      const failingFunction = jest.fn().mockRejectedValue(testError);

      await expect(retryHandler.executeWithRetry(failingFunction)).rejects.toThrow(CS2ScraperError);
      expect(failingFunction).toHaveBeenCalledTimes(4); // Initial + 3 retries
      
      // Test the error message separately
      try {
        await retryHandler.executeWithRetry(failingFunction);
      } catch (error) {
        expect(error.message).toContain('operation failed after 4 attempts');
      }
    });

    test('should pass arguments to function', async () => {
      const testFunction = jest.fn().mockResolvedValue('result');

      await retryHandler.executeWithRetry(testFunction, {}, 'arg1', 'arg2');

      expect(testFunction).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should respect custom maxRetries option', async () => {
      const testError = new Error('ECONNRESET');
      const failingFunction = jest.fn().mockRejectedValue(testError);

      await expect(
        retryHandler.executeWithRetry(failingFunction, { maxRetries: 1 }),
      ).rejects.toThrow(CS2ScraperError);

      expect(failingFunction).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Error Classification', () => {
    test('should identify retryable network errors', () => {
      const networkError = new HLTVNetworkError('Server error', 500);
      expect(retryHandler.isRetryableError(networkError)).toBe(true);
    });

    test('should not retry client errors (4xx)', () => {
      const clientError = new HLTVNetworkError('Not found', 404);
      expect(retryHandler.isRetryableError(clientError)).toBe(false);
    });

    test('should retry server errors (5xx)', () => {
      const serverError = new HLTVNetworkError('Internal server error', 500);
      expect(retryHandler.isRetryableError(serverError)).toBe(true);
    });

    test('should not retry rate limit errors', () => {
      const rateLimitError = new HLTVRateLimitError('Rate limited');
      expect(retryHandler.isRetryableError(rateLimitError)).toBe(false);
    });

    test('should not retry parsing errors', () => {
      const parsingError = new Error('Parse failed');
      parsingError.code = 'HLTV_PARSING_ERROR';
      expect(retryHandler.isRetryableError(parsingError)).toBe(false);
    });

    test('should identify retryable error codes', () => {
      const errors = [
        { code: 'ECONNRESET' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
      ];

      errors.forEach((error) => {
        expect(retryHandler.isRetryableError(error)).toBe(true);
      });
    });

    test('should identify retryable error messages', () => {
      const errors = [
        new Error('Connection timeout'),
        new Error('Network error occurred'),
        new Error('Socket hang up'),
        new Error('ECONNRESET: Connection reset by peer'),
      ];

      errors.forEach((error) => {
        expect(retryHandler.isRetryableError(error)).toBe(true);
      });
    });
  });

  describe('Delay Calculation', () => {
    test('should calculate exponential backoff', () => {
      const delay0 = retryHandler.calculateDelay(0);
      const delay1 = retryHandler.calculateDelay(1);
      const delay2 = retryHandler.calculateDelay(2);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    test('should respect maximum delay', () => {
      const delay = retryHandler.calculateDelay(10); // High attempt number
      expect(delay).toBeLessThanOrEqual(retryHandler.maxDelay);
    });

    test('should add jitter to delays', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(retryHandler.calculateDelay(2));
      }

      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    test('should not return negative delays', () => {
      for (let i = 0; i < 5; i++) {
        const delay = retryHandler.calculateDelay(i);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Retryable Function Creation', () => {
    test('should create retryable version of function', async () => {
      const originalFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const retryableFunction = retryHandler.makeRetryable(originalFunction);
      const result = await retryableFunction();

      expect(result).toBe('success');
      expect(originalFunction).toHaveBeenCalledTimes(2);
    });

    test('should use default options for retryable function', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
      const retryableFunction = retryHandler.makeRetryable(failingFunction);

      await expect(retryableFunction()).rejects.toThrow(CS2ScraperError);
      expect(failingFunction).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should pass arguments to retryable function', async () => {
      const testFunction = jest.fn().mockResolvedValue('result');
      const retryableFunction = retryHandler.makeRetryable(testFunction);

      await retryableFunction('arg1', 'arg2');

      expect(testFunction).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('Statistics', () => {
    test('should return configuration statistics', () => {
      const stats = retryHandler.getStats();

      expect(stats.maxRetries).toBe(3);
      expect(stats.baseDelay).toBe(100);
      expect(stats.maxDelay).toBe(1000);
      expect(stats.backoffMultiplier).toBe(2);
      expect(stats.jitterFactor).toBe(0.1);
      expect(stats.retryableErrors).toBeInstanceOf(Array);
    });
  });

  describe('Integration with Real Delays', () => {
    test('should actually wait between retries', async () => {
      const failingFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retryHandler.executeWithRetry(failingFunction);
      const endTime = Date.now();

      // Should have waited at least the base delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});

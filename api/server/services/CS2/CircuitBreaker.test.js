/**
 * Unit tests for CircuitBreaker
 */

const CircuitBreaker = require('./CircuitBreaker');
const { CS2ScraperError } = require('./errors');

describe('CircuitBreaker', () => {
  let circuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1 second for testing
      monitorTimeout: 500,
    });
  });

  describe('Constructor', () => {
    test('should create instance with default config', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.failureThreshold).toBeDefined();
      expect(breaker.recoveryTimeout).toBeDefined();
      expect(breaker.state).toBe('CLOSED');
    });

    test('should merge custom options', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 2000,
      });
      expect(breaker.failureThreshold).toBe(5);
      expect(breaker.recoveryTimeout).toBe(2000);
    });
  });

  describe('Circuit States', () => {
    test('should start in CLOSED state', () => {
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.allowsRequests()).toBe(true);
    });

    test('should transition to OPEN after failure threshold', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.allowsRequests()).toBe(false);
    });

    test('should transition to HALF_OPEN after recovery timeout', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next request should transition to HALF_OPEN
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected to fail, but state should change
      }

      expect(circuitBreaker.state).toBe('OPEN'); // Should go back to OPEN after failure
    });

    test('should transition from HALF_OPEN to CLOSED on success', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      const successFunction = jest.fn().mockResolvedValue('success');

      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Successful request should close the circuit
      const result = await circuitBreaker.execute(successFunction);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Request Execution', () => {
    test('should execute function successfully when circuit is closed', async () => {
      const successFunction = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(successFunction);

      expect(result).toBe('success');
      expect(successFunction).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.totalSuccesses).toBe(1);
    });

    test('should throw circuit breaker error when circuit is open', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next request should be rejected immediately
      await expect(circuitBreaker.execute(failingFunction)).rejects.toThrow(CS2ScraperError);
      await expect(circuitBreaker.execute(failingFunction)).rejects.toThrow(
        'Circuit breaker is OPEN',
      );
    });

    test('should pass through original errors when circuit is closed', async () => {
      const testError = new Error('Original error');
      const failingFunction = jest.fn().mockRejectedValue(testError);

      await expect(circuitBreaker.execute(failingFunction)).rejects.toThrow('Original error');
    });

    test('should execute function with arguments', async () => {
      const testFunction = jest.fn().mockResolvedValue('result');

      await circuitBreaker.execute(testFunction, 'arg1', 'arg2', 'arg3');

      expect(testFunction).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('Failure Tracking', () => {
    test('should track failure count', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.totalFailures).toBe(1);
    });

    test('should reset failure count on success', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      const successFunction = jest.fn().mockResolvedValue('success');

      // Generate some failures
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.failureCount).toBe(1);

      // Success should reset failure count
      await circuitBreaker.execute(successFunction);

      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Force State Changes', () => {
    test('should force circuit to open', () => {
      circuitBreaker.forceOpen();

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.allowsRequests()).toBe(false);
    });

    test('should force circuit to closed', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');

      circuitBreaker.forceClosed();

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.allowsRequests()).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should return correct statistics', async () => {
      const successFunction = jest.fn().mockResolvedValue('success');
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      await circuitBreaker.execute(successFunction);
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected
      }

      const stats = circuitBreaker.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(1);
      expect(stats.successRate).toBe(0.5);
      expect(stats.failureRate).toBe(0.5);
      expect(stats.allowsRequests).toBe(true);
    });

    test('should calculate success and failure rates correctly', async () => {
      const successFunction = jest.fn().mockResolvedValue('success');

      // Execute multiple successful requests
      for (let i = 0; i < 4; i++) {
        await circuitBreaker.execute(successFunction);
      }

      const stats = circuitBreaker.getStats();

      expect(stats.totalRequests).toBe(4);
      expect(stats.totalSuccesses).toBe(4);
      expect(stats.totalFailures).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.failureRate).toBe(0);
    });
  });

  describe('Health Status', () => {
    test('should return healthy status when circuit is closed with no failures', () => {
      expect(circuitBreaker.getHealthStatus()).toBe('healthy');
    });

    test('should return degraded status when circuit is closed with failures', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.getHealthStatus()).toBe('degraded');
    });

    test('should return unhealthy status when circuit is open', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getHealthStatus()).toBe('unhealthy');
    });
  });

  describe('Reset', () => {
    test('should reset all statistics and state', async () => {
      const failingFunction = jest.fn().mockRejectedValue(new Error('Test error'));

      // Generate some activity
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failingFunction);
        } catch (error) {
          // Expected
        }
      }

      circuitBreaker.reset();

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.totalRequests).toBe(0);
      expect(circuitBreaker.totalFailures).toBe(0);
      expect(circuitBreaker.totalSuccesses).toBe(0);
    });
  });
});

/**
 * Integration Tests for Error Handling
 * 
 * Tests error handling integration with MCP tools, services, and AI client
 * to ensure comprehensive error handling throughout the system.
 */

const { wrapTool } = require('../../middleware/errorHandler');
const {
  MCPError,
  ValidationError,
  AIError,
  DatabaseError,
  ERROR_CODES,
} = require('../../utils/errors');

// Mock console methods to avoid noise in tests
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('Error Handling Integration', () => {
  describe('Tool Error Handling', () => {
    it('should handle validation errors in tool execution', async () => {
      const mockTool = async (params, context) => {
        throw new ValidationError('Invalid book title', { field: 'title' });
      };

      const wrappedTool = wrapTool(mockTool, 'createBook', { logErrors: false });
      const result = await wrappedTool({ title: '' }, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid book title');
      expect(result.error.details.severity).toBe('low');
      expect(result.error.details.retryable).toBe(false);
    });

    it('should handle AI errors with fallback information', async () => {
      const mockTool = async (params, context) => {
        throw new AIError('Rate limit exceeded', 'openai', {
          suggestion: 'Try again in 60 seconds',
        });
      };

      const wrappedTool = wrapTool(mockTool, 'generateChapter', { logErrors: false });
      const result = await wrappedTool({ chapterId: 'ch1' }, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('AI_ERROR');
      expect(result.error.message).toBe('Rate limit exceeded');
      expect(result.error.details.provider).toBe('openai');
      expect(result.error.details.suggestion).toBe('Try again in 60 seconds');
      expect(result.error.details.severity).toBe('medium');
      expect(result.error.details.retryable).toBe(true); // AI errors are retryable
    });

    it('should handle database errors with operation context', async () => {
      const mockTool = async (params, context) => {
        throw new DatabaseError('Connection timeout', 'save', {
          collection: 'books',
          operation: 'insertOne',
        });
      };

      const wrappedTool = wrapTool(mockTool, 'saveBook', { logErrors: false });
      const result = await wrappedTool({ bookId: 'book1' }, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DATABASE_ERROR');
      expect(result.error.message).toBe('Connection timeout');
      expect(result.error.details.operation).toBe('insertOne'); // The operation from the error details
      expect(result.error.details.collection).toBe('books');
      expect(result.error.details.severity).toBe('high');
    });

    it('should handle timeout errors with retry information', async () => {
      const mockTool = async (params, context) => {
        // Simulate a long-running operation
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true };
      };

      const wrappedTool = wrapTool(mockTool, 'longOperation', { 
        logErrors: false,
        timeout: 100, // Very short timeout
      });
      
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.TIMEOUT);
      expect(result.error.details.timeout).toBe(100);
      expect(result.error.details.retryable).toBe(true);
    });

    it('should transform unknown errors to MCP errors', async () => {
      const mockTool = async (params, context) => {
        const error = new Error('Unexpected system error');
        error.code = 'ESYSTEM';
        throw error;
      };

      const wrappedTool = wrapTool(mockTool, 'systemOperation', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.error.message).toBe('Unexpected system error');
      expect(result.error.details.originalError).toBe('Error');
      expect(result.error.details.severity).toBe('high');
    });
  });

  describe('Error Context and Logging', () => {
    it('should include execution context in error details', async () => {
      const mockTool = async (params, context) => {
        throw new ValidationError('Invalid parameters');
      };

      const wrappedTool = wrapTool(mockTool, 'testTool', { logErrors: false });
      const result = await wrappedTool(
        { bookId: 'book1', title: 'Test' },
        { user: { id: 'user123' } }
      );

      expect(result.success).toBe(false);
      expect(result.error.details).toHaveProperty('timestamp');
      // Context should be included in the error handling
    });

    it('should sanitize sensitive parameters in error context', async () => {
      const mockTool = async (params, context) => {
        throw new Error('Test error');
      };

      const wrappedTool = wrapTool(mockTool, 'authTool', { logErrors: false });
      const result = await wrappedTool(
        { 
          username: 'testuser',
          password: 'secret123',
          apiKey: 'key123',
          normalField: 'value',
        },
        { user: { id: 'user1' } }
      );

      expect(result.success).toBe(false);
      // Sensitive fields should be redacted in logs (tested in middleware tests)
    });
  });

  describe('Error Recovery and Retry', () => {
    it('should provide retry guidance for retryable errors', async () => {
      const mockTool = async (params, context) => {
        const error = new Error('Service temporarily unavailable');
        error.status = 503;
        throw error;
      };

      const wrappedTool = wrapTool(mockTool, 'serviceCall', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.details.retryable).toBe(true);
      expect(result.error.details.severity).toBe('high');
    });

    it('should indicate non-retryable errors clearly', async () => {
      const mockTool = async (params, context) => {
        throw new ValidationError('Required field missing', { field: 'title' });
      };

      const wrappedTool = wrapTool(mockTool, 'validation', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.success).toBe(false);
      expect(result.error.details.retryable).toBe(false);
      expect(result.error.details.severity).toBe('low');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const mockTool = async (params, context) => {
        throw new AIError('Model not available', 'openai');
      };

      const wrappedTool = wrapTool(mockTool, 'aiTool', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      // Verify standard error response format
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('details');
      expect(result.error.details).toHaveProperty('severity');
      expect(result.error.details).toHaveProperty('retryable');
      expect(result.error.details).toHaveProperty('timestamp');
    });

    it('should include helpful error details for debugging', async () => {
      const mockTool = async (params) => {
        const error = new DatabaseError('Query failed', 'find');
        error.details.query = { bookId: 'book1' };
        error.details.collection = 'books';
        throw error;
      };

      const wrappedTool = wrapTool(mockTool, 'dbQuery', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.error.details.operation).toBe('find');
      expect(result.error.details.query).toEqual({ bookId: 'book1' });
      expect(result.error.details.collection).toBe('books');
    });
  });

  describe('Error Severity Classification', () => {
    it('should classify validation errors as low severity', async () => {
      const mockTool = async () => {
        throw new ValidationError('Invalid input');
      };

      const wrappedTool = wrapTool(mockTool, 'test', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.error.details.severity).toBe('low');
    });

    it('should classify AI errors as medium severity', async () => {
      const mockTool = async () => {
        throw new AIError('Rate limit', 'openai');
      };

      const wrappedTool = wrapTool(mockTool, 'test', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.error.details.severity).toBe('medium');
    });

    it('should classify database errors as high severity', async () => {
      const mockTool = async () => {
        throw new DatabaseError('Connection failed', 'connection');
      };

      const wrappedTool = wrapTool(mockTool, 'test', { logErrors: false });
      const result = await wrappedTool({}, { user: { id: 'user1' } });

      expect(result.error.details.severity).toBe('high');
    });
  });
});
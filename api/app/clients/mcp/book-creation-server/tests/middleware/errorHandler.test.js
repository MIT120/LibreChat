/**
 * Tests for Error Handling Middleware
 * 
 * Tests for MCP tool error handling middleware, retry logic,
 * and error transformation functionality.
 */

const {
  ErrorHandlingMiddleware,
  errorHandler,
  wrapTool,
  withDatabaseRetry,
  withAIRetry,
} = require('../../middleware/errorHandler');

const {
  
  ValidationError,
  DatabaseError,
  AIError,
  TimeoutError,
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

describe('ErrorHandlingMiddleware', () => {
  let middleware;

  beforeEach(() => {
    middleware = new ErrorHandlingMiddleware({
      logErrors: false, // Disable logging for tests
      timeout: 1000,
      maxRetries: 2,
      retryDelay: 10,
    });
  });

  describe('wrapToolExecution', () => {
    it('should execute tool successfully', async () => {
      const mockTool = jest.fn().mockResolvedValue({ success: true, data: 'test' });
      const wrappedTool = middleware.wrapToolExecution(mockTool, 'testTool');
      
      const result = await wrappedTool({ param: 'value' }, { user: { id: 'user1' } });
      
      expect(result).toEqual({ success: true, data: 'test' });
      expect(mockTool).toHaveBeenCalledWith({ param: 'value' }, { user: { id: 'user1' } });
    });

    it('should handle tool execution timeout', async () => {
      const mockTool = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );
      const wrappedTool = middleware.wrapToolExecution(mockTool, 'testTool');
      
      const result = await wrappedTool({}, { user: { id: 'user1' } });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.TIMEOUT);
    });

    it('should handle MCP errors', async () => {
      const error = new ValidationError('Invalid input');
      const mockTool = jest.fn().mockRejectedValue(error);
      const wrappedTool = middleware.wrapToolExecution(mockTool, 'testTool');
      
      const result = await wrappedTool({}, { user: { id: 'user1' } });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid input');
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      const mockTool = jest.fn().mockRejectedValue(error);
      const wrappedTool = middleware.wrapToolExecution(mockTool, 'testTool');
      
      const result = await wrappedTool({}, { user: { id: 'user1' } });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('handleError', () => {
    it('should handle validation errors from external libraries', () => {
      const error = { 
        name: 'ValidationError', 
        message: 'Validation failed',
        errors: [{ field: 'name', message: 'Required' }],
      };
      
      const result = middleware.handleError(error, { tool: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle MongoDB errors', () => {
      const error = { 
        name: 'MongoError', 
        message: 'Connection failed',
        code: 11000,
        keyPattern: { email: 1 },
        keyValue: { email: 'test@example.com' },
      };
      
      const result = middleware.handleError(error, { tool: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('Duplicate entry');
    });

    it('should handle AI client errors', () => {
      const error = { 
        name: 'OpenAIError', 
        message: 'API rate limit exceeded',
      };
      
      const result = middleware.handleError(error, { tool: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('AI_ERROR');
    });

    it('should handle timeout errors', () => {
      const error = { 
        name: 'TimeoutError', 
        message: 'Operation timed out',
      };
      
      const result = middleware.handleError(error, { tool: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.TIMEOUT);
    });

    it('should handle network errors', () => {
      const error = { 
        code: 'ECONNREFUSED', 
        message: 'Connection refused',
      };
      
      const result = middleware.handleError(error, { tool: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.CONNECTION_ERROR);
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle duplicate key errors', () => {
      const error = {
        code: 11000,
        keyPattern: { email: 1 },
        keyValue: { email: 'test@example.com' },
      };
      
      const result = middleware.handleDatabaseError(error);
      
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toContain('Duplicate entry');
      expect(result.details.field).toBe('email');
      expect(result.details.value).toBe('test@example.com');
    });

    it('should handle Mongoose validation errors', () => {
      const error = {
        name: 'ValidationError',
        errors: {
          name: { message: 'Name is required', value: '' },
          email: { message: 'Invalid email', value: 'invalid' },
        },
        model: { modelName: 'User' },
      };
      
      const result = middleware.handleDatabaseError(error);
      
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toContain('Database validation failed');
      expect(result.fieldErrors).toHaveLength(2);
      expect(result.fieldErrors[0].field).toBe('name');
      expect(result.fieldErrors[1].field).toBe('email');
    });

    it('should handle connection errors', () => {
      const error = {
        name: 'MongoNetworkError',
        message: 'Connection failed',
      };
      
      const result = middleware.handleDatabaseError(error);
      
      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toContain('Database connection failed');
      expect(result.details.operation).toBe('connection');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const retryWrapper = middleware.withRetry(operation);
      
      const result = await retryWrapper();
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const error = new TimeoutError('Timeout');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const retryWrapper = middleware.withRetry(operation, 2);
      
      const result = await retryWrapper();
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new ValidationError('Invalid input');
      const operation = jest.fn().mockRejectedValue(error);
      
      const retryWrapper = middleware.withRetry(operation, 2);
      
      await expect(retryWrapper()).rejects.toThrow(ValidationError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const error = new TimeoutError('Timeout');
      const operation = jest.fn().mockRejectedValue(error);
      
      const retryWrapper = middleware.withRetry(operation, 2);
      
      await expect(retryWrapper()).rejects.toThrow(TimeoutError);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('sanitizeParamsForLogging', () => {
    it('should redact sensitive fields', () => {
      const params = {
        username: 'user1',
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123',
        data: 'normal data',
      };
      
      const sanitized = middleware.sanitizeParamsForLogging(params);
      
      expect(sanitized.username).toBe('user1');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.data).toBe('normal data');
    });

    it('should handle non-object params', () => {
      expect(middleware.sanitizeParamsForLogging('string')).toBe('string');
      expect(middleware.sanitizeParamsForLogging(123)).toBe(123);
      expect(middleware.sanitizeParamsForLogging(null)).toBe(null);
    });
  });
});

describe('Convenience Functions', () => {
  describe('wrapTool', () => {
    it('should create wrapped tool with custom options', async () => {
      const mockTool = jest.fn().mockResolvedValue({ success: true });
      const wrappedTool = wrapTool(mockTool, 'testTool', { 
        logErrors: false,
        maxRetries: 1,
      });
      
      const result = await wrappedTool({}, { user: { id: 'user1' } });
      
      expect(result).toEqual({ success: true });
    });
  });

  describe('withDatabaseRetry', () => {
    it('should retry database operations', async () => {
      const error = new DatabaseError('Connection failed', 'connection');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const retryWrapper = withDatabaseRetry(operation);
      const result = await retryWrapper();
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withAIRetry', () => {
    it('should retry AI operations', async () => {
      const error = new AIError('Rate limit', 'openai');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const retryWrapper = withAIRetry(operation);
      const result = await retryWrapper();
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
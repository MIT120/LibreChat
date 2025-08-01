/**
 * Tests for Error Handling System
 * 
 * Comprehensive tests for custom error classes, error handling middleware,
 * and error transformation utilities.
 */

const {
  MCPError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  AIError,
  ConfigurationError,
  RateLimitError,
  TimeoutError,
  BusinessLogicError,
  ERROR_CODES,
  ERROR_SEVERITY,
  getErrorSeverity,
  isRetryableError,
  createErrorResponse,
  withErrorHandling,
} = require('../../utils/errors');

describe('Error Classes', () => {
  describe('MCPError', () => {
    it('should create error with all properties', () => {
      const error = new MCPError('Test message', 'TEST_CODE', { detail: 'test' }, 400);
      
      expect(error.name).toBe('MCPError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.statusCode).toBe(400);
      expect(error.timestamp).toBeDefined();
    });

    it('should convert to JSON format', () => {
      const error = new MCPError('Test message', 'TEST_CODE', { detail: 'test' });
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name', 'MCPError');
      expect(json).toHaveProperty('message', 'Test message');
      expect(json).toHaveProperty('code', 'TEST_CODE');
      expect(json).toHaveProperty('details');
      expect(json).toHaveProperty('statusCode');
      expect(json).toHaveProperty('timestamp');
    });

    it('should get user message', () => {
      const error = new MCPError('Technical message', 'TEST_CODE', { 
        userMessage: 'User-friendly message' 
      });
      
      expect(error.getUserMessage()).toBe('User-friendly message');
    });

    it('should fallback to main message if no user message', () => {
      const error = new MCPError('Technical message', 'TEST_CODE');
      
      expect(error.getUserMessage()).toBe('Technical message');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field errors', () => {
      const fieldErrors = [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email format' },
      ];
      
      const error = new ValidationError('Validation failed', { context: 'test' }, fieldErrors);
      
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual(fieldErrors);
      expect(error.details.fieldErrors).toEqual(fieldErrors);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid API key');
      
      expect(error.message).toBe('Invalid API key');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with resource info', () => {
      const error = new NotFoundError('Book', 'book-123');
      
      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Book not found: book-123');
      expect(error.details.resource).toBe('Book');
      expect(error.details.identifier).toBe('book-123');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with operation info', () => {
      const error = new DatabaseError('Connection failed', 'connection');
      
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details.operation).toBe('connection');
    });
  });

  describe('AIError', () => {
    it('should create AI error with provider info', () => {
      const error = new AIError('Generation failed', 'openai');
      
      expect(error.name).toBe('AIError');
      expect(error.code).toBe('AI_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.details.provider).toBe('openai');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry info', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.details.retryAfter).toBe(60);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error with timeout info', () => {
      const error = new TimeoutError('Operation timed out', 30000);
      
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(408);
      expect(error.timeout).toBe(30000);
      expect(error.details.timeout).toBe(30000);
    });
  });
});

describe('Error Utilities', () => {
  describe('getErrorSeverity', () => {
    it('should return correct severity for different error types', () => {
      expect(getErrorSeverity(new AuthenticationError())).toBe(ERROR_SEVERITY.MEDIUM);
      expect(getErrorSeverity(new ValidationError('test'))).toBe(ERROR_SEVERITY.LOW);
      expect(getErrorSeverity(new NotFoundError('test', 'id'))).toBe(ERROR_SEVERITY.LOW);
      expect(getErrorSeverity(new DatabaseError('test', 'op'))).toBe(ERROR_SEVERITY.HIGH);
      expect(getErrorSeverity(new AIError('test', 'provider'))).toBe(ERROR_SEVERITY.MEDIUM);
      expect(getErrorSeverity(new ConfigurationError('test', 'key'))).toBe(ERROR_SEVERITY.HIGH);
      expect(getErrorSeverity(new TimeoutError())).toBe(ERROR_SEVERITY.MEDIUM);
      expect(getErrorSeverity(new RateLimitError())).toBe(ERROR_SEVERITY.MEDIUM);
    });

    it('should return high severity for unknown errors', () => {
      const unknownError = new Error('Unknown error');
      expect(getErrorSeverity(unknownError)).toBe(ERROR_SEVERITY.HIGH);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const retryableError = new MCPError('test', ERROR_CODES.CONNECTION_ERROR);
      expect(isRetryableError(retryableError)).toBe(true);
      
      const timeoutError = new TimeoutError();
      expect(isRetryableError(timeoutError)).toBe(true);
      
      const rateLimitError = new RateLimitError();
      expect(isRetryableError(rateLimitError)).toBe(true);
      
      const serverError = new MCPError('test', 'TEST', {}, 500);
      expect(isRetryableError(serverError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const validationError = new ValidationError('test');
      expect(isRetryableError(validationError)).toBe(false);
      
      const authError = new AuthenticationError();
      expect(isRetryableError(authError)).toBe(false);
      
      const clientError = new MCPError('test', 'TEST', {}, 400);
      expect(isRetryableError(clientError)).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response for MCP error', () => {
      const error = new ValidationError('Validation failed', { field: 'name' });
      const response = createErrorResponse(error, { tool: 'test' });
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Validation failed');
      expect(response.error.details.severity).toBe(ERROR_SEVERITY.LOW);
      expect(response.error.details.retryable).toBe(false);
      expect(response.error.details.timestamp).toBeDefined();
    });

    it('should create error response for generic error', () => {
      const error = new Error('Generic error');
      const response = createErrorResponse(error, { tool: 'test' });
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(response.error.message).toBe('Generic error');
      expect(response.error.details.context).toEqual({ tool: 'test' });
    });
  });

  describe('withErrorHandling', () => {
    it('should execute function successfully', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrappedFn = withErrorHandling(fn, { context: 'test' });
      
      const result = await wrappedFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle MCP errors', async () => {
      const error = new ValidationError('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(fn, { context: 'test' });
      
      await expect(wrappedFn()).rejects.toThrow(ValidationError);
    });

    it('should transform generic errors to MCP errors', async () => {
      const error = new Error('Generic error');
      const fn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(fn, { context: 'test' });
      
      await expect(wrappedFn()).rejects.toThrow(MCPError);
    });
  });
});

describe('Error Constants', () => {
  it('should have all required error codes', () => {
    expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
    expect(ERROR_CODES.DATABASE_ERROR).toBe('DATABASE_ERROR');
    expect(ERROR_CODES.AI_ERROR).toBe('AI_ERROR');
    expect(ERROR_CODES.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ERROR_CODES.TIMEOUT).toBe('TIMEOUT');
    expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('should have all severity levels', () => {
    expect(ERROR_SEVERITY.LOW).toBe('low');
    expect(ERROR_SEVERITY.MEDIUM).toBe('medium');
    expect(ERROR_SEVERITY.HIGH).toBe('high');
    expect(ERROR_SEVERITY.CRITICAL).toBe('critical');
  });
});
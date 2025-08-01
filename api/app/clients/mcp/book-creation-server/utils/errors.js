/**
 * Custom Error Classes and Error Handling Utilities
 * 
 * Provides comprehensive error handling for the Book Creation MCP Server
 * with specific error codes, detailed messages, and structured error responses.
 */

/**
 * Base MCP Error class with specific error codes and details
 */
class MCPError extends Error {
  constructor(message, code, details = {}, statusCode = 500) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Convert error to JSON format for MCP responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create a user-friendly error message
   */
  getUserMessage() {
    return this.details.userMessage || this.message;
  }
}

/**
 * Validation Error - for input validation failures
 */
class ValidationError extends MCPError {
  constructor(message, details = {}, fieldErrors = []) {
    super(message, 'VALIDATION_ERROR', { ...details, fieldErrors }, 400);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Authentication Error - for user authentication failures
 */
class AuthenticationError extends MCPError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 'UNAUTHORIZED', details, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error - for permission failures
 */
class AuthorizationError extends MCPError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 'FORBIDDEN', details, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource Not Found Error
 */
class NotFoundError extends MCPError {
  constructor(resource, identifier, details = {}) {
    const message = `${resource} not found: ${identifier}`;
    super(message, 'NOT_FOUND', { resource, identifier, ...details }, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Database Operation Error
 */
class DatabaseError extends MCPError {
  constructor(message, operation, details = {}) {
    super(message, 'DATABASE_ERROR', { operation, ...details }, 500);
    this.name = 'DatabaseError';
  }
}

/**
 * AI Integration Error
 */
class AIError extends MCPError {
  constructor(message, provider, details = {}) {
    super(message, 'AI_ERROR', { provider, ...details }, 502);
    this.name = 'AIError';
  }
}

/**
 * Configuration Error
 */
class ConfigurationError extends MCPError {
  constructor(message, configKey, details = {}) {
    super(message, 'CONFIGURATION_ERROR', { configKey, ...details }, 500);
    this.name = 'ConfigurationError';
  }
}

/**
 * Rate Limiting Error
 */
class RateLimitError extends MCPError {
  constructor(message = 'Rate limit exceeded', retryAfter, details = {}) {
    super(message, 'RATE_LIMIT_EXCEEDED', { retryAfter, ...details }, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout Error
 */
class TimeoutError extends MCPError {
  constructor(message = 'Operation timed out', timeout, details = {}) {
    super(message, 'TIMEOUT', { timeout, ...details }, 408);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Business Logic Error
 */
class BusinessLogicError extends MCPError {
  constructor(message, rule, details = {}) {
    super(message, 'BUSINESS_LOGIC_ERROR', { rule, ...details }, 422);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Error code constants
 */
const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  CHAPTER_NOT_FOUND: 'CHAPTER_NOT_FOUND',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  
  // AI Integration
  AI_ERROR: 'AI_ERROR',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',
  
  // Configuration
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Timeouts
  TIMEOUT: 'TIMEOUT',
  
  // Business Logic
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  INVALID_STATE: 'INVALID_STATE',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * Error severity levels
 */
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Determine error severity based on error type and code
 */
function getErrorSeverity(error) {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return ERROR_SEVERITY.MEDIUM;
  }
  
  if (error instanceof ValidationError) {
    return ERROR_SEVERITY.LOW;
  }
  
  if (error instanceof NotFoundError) {
    return ERROR_SEVERITY.LOW;
  }
  
  if (error instanceof DatabaseError) {
    return ERROR_SEVERITY.HIGH;
  }
  
  if (error instanceof AIError) {
    return ERROR_SEVERITY.MEDIUM;
  }
  
  if (error instanceof ConfigurationError) {
    return ERROR_SEVERITY.HIGH;
  }
  
  if (error instanceof TimeoutError || error instanceof RateLimitError) {
    return ERROR_SEVERITY.MEDIUM;
  }
  
  // Default to high severity for unknown errors
  return ERROR_SEVERITY.HIGH;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error) {
  const retryableCodes = [
    ERROR_CODES.CONNECTION_ERROR,
    ERROR_CODES.AI_TIMEOUT,
    ERROR_CODES.TIMEOUT,
    ERROR_CODES.AI_RATE_LIMIT,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ];
  
  return retryableCodes.includes(error.code) || 
         (error instanceof TimeoutError) ||
         (error instanceof RateLimitError) ||
         (error.statusCode >= 500 && error.statusCode < 600);
}

/**
 * Create a standardized error response for MCP tools
 */
function createErrorResponse(error, context = {}) {
  const mcpError = error instanceof MCPError ? error : new MCPError(
    error.message || 'An unexpected error occurred',
    ERROR_CODES.INTERNAL_ERROR,
    { originalError: error.name || 'Error', context }
  );
  
  const severity = getErrorSeverity(mcpError);
  const isRetryable = isRetryableError(mcpError);
  
  return {
    success: false,
    error: {
      code: mcpError.code,
      message: mcpError.getUserMessage(),
      details: {
        ...mcpError.details,
        severity,
        retryable: isRetryable,
        timestamp: mcpError.timestamp,
      },
    },
  };
}

/**
 * Wrap async functions with error handling
 */
function withErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error with context
      console.error('[ErrorHandler]', {
        error: error.message,
        code: error.code || 'UNKNOWN',
        context,
        stack: error.stack,
      });
      
      // Re-throw as MCPError if not already
      if (error instanceof MCPError) {
        throw error;
      }
      
      throw new MCPError(
        error.message || 'An unexpected error occurred',
        ERROR_CODES.INTERNAL_ERROR,
        { originalError: error.name || 'Error', context }
      );
    }
  };
}

module.exports = {
  // Error classes
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
  
  // Constants
  ERROR_CODES,
  ERROR_SEVERITY,
  
  // Utilities
  getErrorSeverity,
  isRetryableError,
  createErrorResponse,
  withErrorHandling,
};
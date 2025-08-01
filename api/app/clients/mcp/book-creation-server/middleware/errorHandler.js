/**
 * Error Handling Middleware for MCP Tools
 * 
 * Provides comprehensive error handling middleware for all MCP tool calls
 * with logging, error transformation, and standardized responses.
 */

const {
  MCPError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError,
  AIError,
  createErrorResponse,
  getErrorSeverity,
  isRetryableError,
  ERROR_CODES,
} = require('../utils/errors');

/**
 * Logger utility for error handling
 */
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};

/**
 * Error handling middleware for MCP tool execution
 */
class ErrorHandlingMiddleware {
  constructor(options = {}) {
    this.options = {
      logErrors: options.logErrors !== false,
      includeStackTrace: options.includeStackTrace || false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options,
    };
  }

  /**
   * Wrap a tool execution function with error handling
   * @param {Function} toolFunction - The tool execution function
   * @param {string} toolName - Name of the tool for logging
   * @returns {Function} Wrapped function with error handling
   */
  wrapToolExecution(toolFunction, toolName) {
    return async (params, context) => {
      const startTime = Date.now();
      const executionId = this.generateExecutionId();
      
      try {
        // Log tool execution start
        if (this.options.logErrors) {
          logger.info(`[${toolName}] Starting execution`, {
            executionId,
            userId: context?.user?.id || 'anonymous',
            params: this.sanitizeParamsForLogging(params),
          });
        }

        // Execute the tool with timeout
        const result = await this.executeWithTimeout(
          toolFunction,
          [params, context],
          this.options.timeout || 30000
        );

        // Log successful execution
        const duration = Date.now() - startTime;
        if (this.options.logErrors) {
          logger.info(`[${toolName}] Execution completed successfully`, {
            executionId,
            duration,
            userId: context?.user?.id || 'anonymous',
          });
        }

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log the error with context
        this.logError(error, {
          toolName,
          executionId,
          duration,
          userId: context?.user?.id || 'anonymous',
          params: this.sanitizeParamsForLogging(params),
        });

        // Transform and return error response
        return this.handleError(error, {
          toolName,
          executionId,
          userId: context?.user?.id || 'anonymous',
        });
      }
    };
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, args, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new MCPError(
          `Tool execution timed out after ${timeout}ms`,
          ERROR_CODES.TIMEOUT,
          { timeout }
        ));
      }, timeout);

      Promise.resolve(fn(...args))
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Handle different types of errors and create appropriate responses
   */
  handleError(error, context = {}) {
    // Handle known MCP errors
    if (error instanceof MCPError) {
      return createErrorResponse(error, context);
    }

    // Handle validation errors from external libraries
    if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
      const validationError = new ValidationError(
        error.message || 'Validation failed',
        { originalError: error.name },
        error.errors || []
      );
      return createErrorResponse(validationError, context);
    }

    // Handle MongoDB/Mongoose errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      const dbError = this.handleDatabaseError(error, context);
      return createErrorResponse(dbError, context);
    }

    // Handle AI client errors
    if (error.name === 'OpenAIError' || error.name === 'AnthropicError' || 
        error.message?.includes('AI') || error.message?.includes('model')) {
      const aiError = new AIError(
        error.message || 'AI service error',
        error.provider || 'unknown',
        { originalError: error.name }
      );
      return createErrorResponse(aiError, context);
    }

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      const timeoutError = new MCPError(
        'Operation timed out',
        ERROR_CODES.TIMEOUT,
        { originalError: error.name }
      );
      return createErrorResponse(timeoutError, context);
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const connectionError = new MCPError(
        'Connection error',
        ERROR_CODES.CONNECTION_ERROR,
        { originalError: error.code }
      );
      return createErrorResponse(connectionError, context);
    }

    // Handle unknown errors
    const unknownError = new MCPError(
      error.message || 'An unexpected error occurred',
      ERROR_CODES.INTERNAL_ERROR,
      { 
        originalError: error.name || 'Error',
        stack: this.options.includeStackTrace ? error.stack : undefined,
      }
    );
    
    return createErrorResponse(unknownError, context);
  }

  /**
   * Handle database-specific errors
   */
  handleDatabaseError(error, context = {}) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      return new ValidationError(
        'Duplicate entry found',
        { 
          field: Object.keys(error.keyPattern || {})[0],
          value: Object.values(error.keyValue || {})[0],
        }
      );
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const fieldErrors = Object.keys(error.errors || {}).map(field => ({
        field,
        message: error.errors[field].message,
        value: error.errors[field].value,
      }));
      
      return new ValidationError(
        'Database validation failed',
        { model: error.model?.modelName },
        fieldErrors
      );
    }

    // Handle connection errors
    if (error.name === 'MongoNetworkError') {
      return new DatabaseError(
        'Database connection failed',
        'connection',
        { originalError: error.name }
      );
    }

    // Generic database error
    return new DatabaseError(
      error.message || 'Database operation failed',
      'unknown',
      { originalError: error.name }
    );
  }

  /**
   * Log errors with appropriate detail level
   */
  logError(error, context = {}) {
    if (!this.options.logErrors) return;

    const severity = getErrorSeverity(error);
    const isRetryable = isRetryableError(error);
    
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        severity,
        retryable: isRetryable,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    // Include stack trace for high severity errors
    if (severity === 'high' || severity === 'critical') {
      logData.error.stack = error.stack;
    }

    // Log with appropriate level based on severity
    switch (severity) {
      case 'critical':
      case 'high':
        logger.error('[ErrorHandler] High severity error:', logData);
        break;
      case 'medium':
        logger.warn('[ErrorHandler] Medium severity error:', logData);
        break;
      case 'low':
      default:
        logger.info('[ErrorHandler] Low severity error:', logData);
        break;
    }
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  sanitizeParamsForLogging(params) {
    if (!params || typeof params !== 'object') return params;

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    const sanitized = { ...params };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Generate unique execution ID for tracking
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create retry wrapper for retryable operations
   */
  withRetry(fn, maxRetries = this.options.maxRetries) {
    return async (...args) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;
          
          // Don't retry if error is not retryable
          if (!isRetryableError(error)) {
            throw error;
          }
          
          // Don't retry on last attempt
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Calculate delay with exponential backoff
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          
          logger.warn(`[ErrorHandler] Retrying operation (attempt ${attempt}/${maxRetries}) after ${delay}ms`, {
            error: error.message,
            code: error.code,
          });
          
          await this.sleep(delay);
        }
      }
      
      throw lastError;
    };
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
const errorHandler = new ErrorHandlingMiddleware();

/**
 * Convenience function to wrap tool execution
 */
function wrapTool(toolFunction, toolName, options = {}) {
  const handler = new ErrorHandlingMiddleware(options);
  return handler.wrapToolExecution(toolFunction, toolName);
}

/**
 * Middleware for database operations with retry logic
 */
function withDatabaseRetry(fn, maxRetries = 3) {
  return errorHandler.withRetry(fn, maxRetries);
}

/**
 * Middleware for AI operations with retry logic
 */
function withAIRetry(fn, maxRetries = 2) {
  return errorHandler.withRetry(fn, maxRetries);
}

module.exports = {
  ErrorHandlingMiddleware,
  errorHandler,
  wrapTool,
  withDatabaseRetry,
  withAIRetry,
};
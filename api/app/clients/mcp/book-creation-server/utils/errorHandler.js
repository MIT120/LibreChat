/**
 * Standardized error handling utilities for the MCP server
 */

class BookCreationError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'BookCreationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends BookCreationError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class DatabaseError extends BookCreationError {
  constructor(message, details = {}) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

class AIGenerationError extends BookCreationError {
  constructor(message, details = {}) {
    super(message, 'AI_GENERATION_ERROR', details);
    this.name = 'AIGenerationError';
  }
}

/**
 * Standardized error handler for service methods
 * @param {Function} operation - The async operation to execute
 * @param {string} context - Context for logging (e.g., 'BookService.createBook')
 * @param {Object} logger - Logger instance
 * @returns {Promise<any>} Result of operation or throws standardized error
 */
async function handleServiceOperation(operation, context, logger) {
  try {
    return await operation();
  } catch (error) {
    logger.error(`[${context}] Operation failed:`, {
      error: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
    });

    // Re-throw if already a BookCreationError
    if (error instanceof BookCreationError) {
      throw error;
    }

    // Convert mongoose validation errors
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message, { originalError: error });
    }

    // Convert mongoose/mongodb errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      throw new DatabaseError(error.message, { originalError: error });
    }

    // Default to generic BookCreationError
    throw new BookCreationError(
      `Unexpected error in ${context}: ${error.message}`,
      'INTERNAL_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Format error for MCP tool response
 * @param {Error} error - The error to format
 * @returns {Object} Formatted error response
 */
function formatMCPError(error) {
  if (error instanceof BookCreationError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: { originalMessage: error.message },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  BookCreationError,
  ValidationError,
  DatabaseError,
  AIGenerationError,
  handleServiceOperation,
  formatMCPError,
};
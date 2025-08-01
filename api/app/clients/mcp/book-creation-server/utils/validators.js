/**
 * Validation Utilities for MCP Tool Parameters
 *
 * Provides validation functions for all MCP tool parameters and inputs.
 * Ensures data integrity and provides meaningful error messages.
 */

const { ValidationError } = require('./errors');

/**
 * Validate book creation parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateCreateBookParams(params) {
  const errors = [];
  const required = ['theme', 'title', 'genre'];

  // Check required fields
  for (const field of required) {
    if (!params[field] || typeof params[field] !== 'string' || params[field].trim() === '') {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  }

  // Validate genre
  const validGenres = ['fiction', 'non-fiction', 'technical', 'educational'];
  if (params.genre && !validGenres.includes(params.genre)) {
    errors.push(`genre must be one of: ${validGenres.join(', ')}`);
  }

  // Validate optional numeric fields
  if (params.chapterCount !== undefined) {
    const chapterCount = Number(params.chapterCount);
    if (isNaN(chapterCount) || chapterCount < 3 || chapterCount > 50) {
      errors.push('chapterCount must be a number between 3 and 50');
    }
  }

  // Validate writing style
  const validStyles = ['formal', 'casual', 'academic', 'creative'];
  if (params.writingStyle && !validStyles.includes(params.writingStyle)) {
    errors.push(`writingStyle must be one of: ${validStyles.join(', ')}`);
  }

  // Validate target audience
  if (params.targetAudience && typeof params.targetAudience !== 'string') {
    errors.push('targetAudience must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate book ID parameter
 * @param {string} bookId - Book ID to validate
 * @returns {Object} Validation result
 */
function validateBookId(bookId) {
  const errors = [];

  if (!bookId || typeof bookId !== 'string') {
    errors.push('bookId is required and must be a string');
  } else if (bookId.trim() === '') {
    errors.push('bookId cannot be empty');
  } else if (!/^[a-zA-Z0-9-_]+$/.test(bookId)) {
    errors.push('bookId must contain only alphanumeric characters, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate chapter ID parameter
 * @param {string} chapterId - Chapter ID to validate
 * @returns {Object} Validation result
 */
function validateChapterId(chapterId) {
  const errors = [];

  if (!chapterId || typeof chapterId !== 'string') {
    errors.push('chapterId is required and must be a string');
  } else if (chapterId.trim() === '') {
    errors.push('chapterId cannot be empty');
  } else if (!/^[a-zA-Z0-9-_]+$/.test(chapterId)) {
    errors.push('chapterId must contain only alphanumeric characters, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate chapter approval parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateApproveChapterParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  // Validate chapterId
  const chapterIdValidation = validateChapterId(params.chapterId);
  if (!chapterIdValidation.isValid) {
    errors.push(...chapterIdValidation.errors);
  }

  // Validate optional feedback
  if (params.feedback !== undefined && typeof params.feedback !== 'string') {
    errors.push('feedback must be a string if provided');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate chapter regeneration parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateRegenerateChapterParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  // Validate chapterId
  const chapterIdValidation = validateChapterId(params.chapterId);
  if (!chapterIdValidation.isValid) {
    errors.push(...chapterIdValidation.errors);
  }

  // Validate feedback (required for regeneration)
  if (!params.feedback || typeof params.feedback !== 'string' || params.feedback.trim() === '') {
    errors.push('feedback is required for chapter regeneration and must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate export book parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateExportBookParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  // Validate format
  const validFormats = ['markdown', 'html', 'pdf', 'docx', 'txt'];
  if (params.format && !validFormats.includes(params.format)) {
    errors.push(`format must be one of: ${validFormats.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate approve outline parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateApproveOutlineParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  // Validate optional feedback
  if (params.feedback !== undefined && typeof params.feedback !== 'string') {
    errors.push('feedback must be a string if provided');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate list books parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateListBooksParams(params) {
  const errors = [];

  // Validate optional status filter
  const validStatuses = ['outline_pending', 'in_progress', 'completed', 'cancelled'];
  if (params.status && !validStatuses.includes(params.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate optional genre filter
  const validGenres = ['fiction', 'non-fiction', 'technical', 'educational'];
  if (params.genre && !validGenres.includes(params.genre)) {
    errors.push(`genre must be one of: ${validGenres.join(', ')}`);
  }

  // Validate optional limit
  if (params.limit !== undefined) {
    const limitValidation = validateNumber(params.limit, 'limit', {
      min: 1,
      max: 100,
      integer: true,
    });
    if (!limitValidation.isValid) {
      errors.push(...limitValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate get book progress parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateGetBookProgressParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate delete book parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateDeleteBookParams(params) {
  const errors = [];

  // Validate bookId
  const bookIdValidation = validateBookId(params.bookId);
  if (!bookIdValidation.isValid) {
    errors.push(...bookIdValidation.errors);
  }

  // Validate confirmation (required for safety)
  if (!params.confirm || typeof params.confirm !== 'boolean' || params.confirm !== true) {
    errors.push('confirm must be true to delete a book');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate get status updates parameters
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validation result
 */
function validateGetStatusUpdatesParams(params) {
  const errors = [];

  // Validate optional bookId
  if (params.bookId !== undefined) {
    const bookIdValidation = validateBookId(params.bookId);
    if (!bookIdValidation.isValid) {
      errors.push(...bookIdValidation.errors);
    }
  }

  // Validate optional includeCompleted
  if (params.includeCompleted !== undefined && typeof params.includeCompleted !== 'boolean') {
    errors.push('includeCompleted must be a boolean if provided');
  }

  // Validate optional includeProgressSummary
  if (
    params.includeProgressSummary !== undefined &&
    typeof params.includeProgressSummary !== 'boolean'
  ) {
    errors.push('includeProgressSummary must be a boolean if provided');
  }

  // Validate optional format
  const validFormats = ['detailed', 'summary', 'minimal'];
  if (params.format && !validFormats.includes(params.format)) {
    errors.push(`format must be one of: ${validFormats.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate string parameter
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateString(value, fieldName, options = {}) {
  const errors = [];
  const { required = false, minLength = 0, maxLength = Infinity, pattern = null } = options;

  if (required && (value === undefined || value === null)) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  if (value === undefined || value === null) {
    return { isValid: true, errors: [] };
  }

  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
    return { isValid: false, errors };
  }

  if (value.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters long`);
  }

  if (value.length > maxLength) {
    errors.push(`${fieldName} must be at most ${maxLength} characters long`);
  }

  if (pattern && !pattern.test(value)) {
    errors.push(`${fieldName} format is invalid`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate number parameter
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateNumber(value, fieldName, options = {}) {
  const errors = [];
  const { required = false, min = -Infinity, max = Infinity, integer = false } = options;

  if (required && (value === undefined || value === null)) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  if (value === undefined || value === null) {
    return { isValid: true, errors: [] };
  }

  const numValue = Number(value);
  if (isNaN(numValue)) {
    errors.push(`${fieldName} must be a number`);
    return { isValid: false, errors };
  }

  if (integer && !Number.isInteger(numValue)) {
    errors.push(`${fieldName} must be an integer`);
  }

  if (numValue < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }

  if (numValue > max) {
    errors.push(`${fieldName} must be at most ${max}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Validate enum parameter
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Array} validValues - Array of valid values
 * @param {boolean} required - Whether the field is required
 * @returns {Object} Validation result
 */
function validateEnum(value, fieldName, validValues, required = false) {
  const errors = [];

  if (required && (value === undefined || value === null)) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  if (value === undefined || value === null) {
    return { isValid: true, errors: [] };
  }

  if (!validValues.includes(value)) {
    errors.push(`${fieldName} must be one of: ${validValues.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Sanitize and validate MCP tool parameters
 * @param {Object} params - Parameters to sanitize and validate
 * @param {Function} validator - Validation function to use
 * @returns {Object} Result with sanitized params and validation
 */
function sanitizeAndValidate(params, validator) {
  // Sanitize string parameters
  const sanitizedParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      sanitizedParams[key] = sanitizeString(value);
    } else {
      sanitizedParams[key] = value;
    }
  }

  // Validate sanitized parameters
  const validation = validator(sanitizedParams);

  return {
    params: sanitizedParams,
    validation: validation,
    isValid: validation.isValid,
    errors: validation.errors,
  };
}

/**
 * Format validation errors for user-friendly display
 * @param {Array} errors - Array of validation error messages
 * @param {string} context - Context for the errors (e.g., tool name)
 * @returns {string} Formatted error message
 */
function formatValidationErrors(errors, context = 'Input validation') {
  if (!errors || errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return `${context} failed: ${errors[0]}`;
  }

  const errorList = errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
  return `${context} failed with ${errors.length} errors:\n${errorList}`;
}

/**
 * Create a comprehensive validation result
 * @param {boolean} isValid - Whether validation passed
 * @param {Array} errors - Array of error messages
 * @param {Array} warnings - Array of warning messages
 * @param {Object} data - Additional data to include
 * @returns {Object} Comprehensive validation result
 */
function createValidationResult(isValid, errors = [], warnings = [], data = {}) {
  return {
    isValid,
    errors,
    warnings,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    summary: isValid ? 'Validation passed' : `Validation failed with ${errors.length} error(s)`,
    ...data,
  };
}

/**
 * Validate multiple parameters with different validators
 * @param {Object} validationMap - Map of parameter names to validation functions
 * @param {Object} params - Parameters to validate
 * @returns {Object} Combined validation result
 */
function validateMultiple(validationMap, params) {
  const allErrors = [];
  const allWarnings = [];
  const results = {};

  for (const [paramName, validator] of Object.entries(validationMap)) {
    if (params[paramName] !== undefined) {
      const result = validator(params[paramName]);
      results[paramName] = result;

      if (!result.isValid) {
        allErrors.push(...result.errors.map((error) => `${paramName}: ${error}`));
      }

      if (result.warnings) {
        allWarnings.push(...result.warnings.map((warning) => `${paramName}: ${warning}`));
      }
    }
  }

  return createValidationResult(allErrors.length === 0, allErrors, allWarnings, {
    individualResults: results,
  });
}

module.exports = {
  ValidationError,
  validateCreateBookParams,
  validateBookId,
  validateChapterId,
  validateApproveChapterParams,
  validateRegenerateChapterParams,
  validateExportBookParams,
  validateApproveOutlineParams,
  validateListBooksParams,
  validateGetBookProgressParams,
  validateDeleteBookParams,
  validateGetStatusUpdatesParams,
  validateString,
  validateNumber,
  validateEnum,
  sanitizeString,
  sanitizeAndValidate,
  formatValidationErrors,
  createValidationResult,
  validateMultiple,
};

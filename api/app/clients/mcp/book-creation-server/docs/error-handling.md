# Comprehensive Error Handling System

This document describes the comprehensive error handling system implemented for the Book Creation MCP Server, providing robust error management, retry logic, and fallback mechanisms.

## Overview

The error handling system consists of several components working together to provide:

- **Custom Error Classes**: Structured error types with specific codes and details
- **Error Handling Middleware**: Centralized error processing for MCP tools
- **Database Error Handling**: Retry logic and rollback mechanisms for database operations
- **AI Integration Error Handling**: Fallback mechanisms and token limit handling
- **Comprehensive Validation**: Field-level validation with detailed error messages

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Tools     │───▶│ Error Middleware │───▶│ Error Response  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Services      │───▶│ Custom Errors    │───▶│ Logging System  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Database Ops    │───▶│ Retry Logic      │
└─────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────┐
│   AI Client     │
└─────────────────┘
```

## Custom Error Classes

### Base Error Class: MCPError

```javascript
class MCPError extends Error {
  constructor(message, code, details = {}, statusCode = 500) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }
}
```

### Specialized Error Classes

1. **ValidationError**: Input validation failures
   - Status Code: 400
   - Severity: Low
   - Retryable: No

2. **AuthenticationError**: Authentication failures
   - Status Code: 401
   - Severity: Medium
   - Retryable: No

3. **AuthorizationError**: Permission failures
   - Status Code: 403
   - Severity: Medium
   - Retryable: No

4. **NotFoundError**: Resource not found
   - Status Code: 404
   - Severity: Low
   - Retryable: No

5. **DatabaseError**: Database operation failures
   - Status Code: 500
   - Severity: High
   - Retryable: Yes (for connection issues)

6. **AIError**: AI service failures
   - Status Code: 502
   - Severity: Medium
   - Retryable: Yes (for rate limits, timeouts)

7. **ConfigurationError**: Configuration issues
   - Status Code: 500
   - Severity: High
   - Retryable: No

8. **RateLimitError**: Rate limiting
   - Status Code: 429
   - Severity: Medium
   - Retryable: Yes (with delay)

9. **TimeoutError**: Operation timeouts
   - Status Code: 408
   - Severity: Medium
   - Retryable: Yes

10. **BusinessLogicError**: Business rule violations
    - Status Code: 422
    - Severity: Medium
    - Retryable: No

## Error Codes

```javascript
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
```

## Error Handling Middleware

### Tool Execution Wrapper

The `ErrorHandlingMiddleware` provides a wrapper for MCP tool execution:

```javascript
const wrappedTool = middleware.wrapToolExecution(toolFunction, 'toolName');
```

Features:
- **Timeout Handling**: Configurable timeouts for tool execution
- **Error Transformation**: Converts various error types to standardized format
- **Logging**: Comprehensive error logging with context
- **Sanitization**: Removes sensitive data from logs
- **Execution Tracking**: Unique execution IDs for debugging

### Error Response Format

All errors are returned in a standardized format:

```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'User-friendly error message',
    details: {
      severity: 'low|medium|high|critical',
      retryable: true|false,
      timestamp: '2025-01-08T...',
      // Additional context-specific details
    }
  }
}
```

## Database Error Handling

### Connection Management

```javascript
class DatabaseManager {
  async connect(uri, options = {}) {
    // Retry logic with exponential backoff
    // Connection health monitoring
    // Automatic reconnection
  }
}
```

### Transaction Management

```javascript
class TransactionManager {
  async withTransaction(operations, options = {}) {
    // Automatic retry for transient errors
    // Proper rollback on failures
    // Session management
  }
}
```

### Operation Wrapper

```javascript
const dbOperations = new DatabaseOperations();

// Wrap database operations with retry logic
const result = await dbOperations.withRetry(async () => {
  return await Model.findById(id);
});
```

Features:
- **Retry Logic**: Exponential backoff for retryable errors
- **Transaction Support**: Automatic rollback on failures
- **Error Classification**: Distinguishes between retryable and non-retryable errors
- **Connection Pooling**: Efficient connection management
- **Timeout Handling**: Configurable operation timeouts

## AI Integration Error Handling

### Provider Fallback

The AI client supports multiple providers with automatic fallback:

```javascript
const aiClient = new AIClient({
  providerPriority: ['openai', 'anthropic', 'google'],
  fallbackConfig: {
    enableFallback: true,
    maxFallbackAttempts: 2,
    fallbackDelay: 5000,
  }
});
```

### Token Limit Handling

- **Content Chunking**: Automatically splits large content
- **Context Truncation**: Intelligently reduces context size
- **Provider-Specific Limits**: Respects each provider's token limits

### Rate Limiting

- **Rate Limit Tracking**: Monitors rate limits per provider
- **Automatic Backoff**: Respects retry-after headers
- **Provider Switching**: Falls back to other providers when rate limited

### Error Recovery

```javascript
// Retry with exponential backoff
const result = await aiClient.executeWithFallback(
  async (provider) => {
    return await aiClient.generateContent(prompt, { provider });
  },
  preferredProvider,
  'generateContent'
);
```

## Validation Error Handling

### Field-Level Validation

```javascript
const validationResult = sanitizeAndValidate(params, validateCreateBookParams);
if (!validationResult.isValid) {
  throw new ValidationError(
    'Validation failed',
    { context: 'createBook' },
    validationResult.errors
  );
}
```

### Sanitization

- **Input Sanitization**: Removes potentially harmful content
- **Parameter Cleaning**: Normalizes whitespace and formatting
- **Sensitive Data Redaction**: Removes sensitive information from logs

## Usage Examples

### Tool Implementation

```javascript
const { wrapTool } = require('./middleware/errorHandler');

const createBookTool = {
  name: 'create_book_project',
  description: 'Create a new book project',
  inputSchema: { /* schema */ },
  
  async execute(params, context) {
    // Tool implementation
    const result = await bookService.createBook(params);
    return { success: true, data: result };
  }
};

// Wrap with error handling
module.exports = wrapTool(createBookTool.execute, 'create_book_project');
```

### Service Implementation

```javascript
const { withDatabaseRetry } = require('./middleware/errorHandler');
const { AIError, ValidationError } = require('./utils/errors');

class BookService {
  async createBook(bookData) {
    // Validate input
    if (!bookData.title) {
      throw new ValidationError('Title is required', { field: 'title' });
    }
    
    // Database operation with retry
    const book = await withDatabaseRetry(async () => {
      return await BookModel.create(bookData);
    });
    
    // AI operation with fallback
    try {
      const outline = await this.aiClient.generateOutline(bookData.theme);
      book.outline = outline;
      await book.save();
    } catch (error) {
      throw new AIError(
        'Failed to generate book outline',
        'openai',
        { originalError: error.message }
      );
    }
    
    return book;
  }
}
```

## Configuration

### Error Handler Options

```javascript
const errorHandler = new ErrorHandlingMiddleware({
  logErrors: true,
  includeStackTrace: false,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
});
```

### Database Options

```javascript
const dbManager = new DatabaseManager({
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 10000,
  operationTimeout: 30000,
});
```

### AI Client Options

```javascript
const aiClient = new AIClient({
  defaultProvider: 'openai',
  providerPriority: ['openai', 'anthropic', 'google'],
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBase: 2,
    jitter: true,
  },
  tokenLimits: {
    openai: { input: 8000, output: 4000 },
    anthropic: { input: 100000, output: 4000 },
    google: { input: 30000, output: 2000 },
  },
  timeouts: {
    default: 60000,
    outline: 90000,
    chapter: 120000,
    summary: 30000,
  },
  fallbackConfig: {
    enableFallback: true,
    maxFallbackAttempts: 2,
    fallbackDelay: 5000,
  },
});
```

## Testing

The error handling system includes comprehensive tests:

- **Unit Tests**: Individual error classes and utilities
- **Middleware Tests**: Error handling middleware functionality
- **Integration Tests**: End-to-end error handling scenarios
- **Database Tests**: Database error handling and retry logic
- **AI Client Tests**: AI integration error handling and fallbacks

### Running Tests

```bash
# Run all error handling tests
npm test tests/utils/errors.test.js
npm test tests/middleware/errorHandler.test.js
npm test tests/integration/errorHandling.test.js

# Run with coverage
npm test -- --coverage
```

## Best Practices

1. **Use Specific Error Types**: Choose the most appropriate error class
2. **Include Context**: Provide relevant details in error objects
3. **Handle Retryable Errors**: Implement retry logic for transient failures
4. **Log Appropriately**: Use appropriate log levels based on error severity
5. **Sanitize Sensitive Data**: Remove sensitive information from logs
6. **Provide User-Friendly Messages**: Include helpful error messages for users
7. **Test Error Scenarios**: Comprehensive testing of error conditions
8. **Monitor Error Rates**: Track error patterns for system health

## Monitoring and Alerting

The error handling system provides structured logging that can be integrated with monitoring systems:

- **Error Severity**: Classify errors by impact level
- **Error Codes**: Standardized codes for automated processing
- **Context Information**: Rich context for debugging
- **Retry Information**: Track retry attempts and success rates
- **Performance Metrics**: Error rates and response times

This comprehensive error handling system ensures robust operation of the Book Creation MCP Server with graceful degradation, automatic recovery, and detailed error reporting.
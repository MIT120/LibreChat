import { ErrorContext, ValidationIssue } from './index.js';

// Base error class
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  
  constructor(message: string, public readonly context?: ErrorContext) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  
  constructor(
    message: string,
    public readonly validationErrors: ValidationIssue[],
    context?: ErrorContext
  ) {
    super(message, context);
  }
}

// Database error
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = true;
  
  constructor(message: string, context?: ErrorContext) {
    super(message, context);
  }
}

// Not found error
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
  
  constructor(resource: string, id: string, context?: ErrorContext) {
    super(`${resource} with ID ${id} not found`, context);
  }
}

// Authorization error
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;
  
  constructor(message: string = 'Unauthorized access', context?: ErrorContext) {
    super(message, context);
  }
}

// Connection error
export class ConnectionError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;
  
  constructor(message: string = 'Service unavailable', context?: ErrorContext) {
    super(message, context);
  }
}

// Timeout error
export class TimeoutError extends AppError {
  readonly statusCode = 408;
  readonly isOperational = true;
  
  constructor(operation: string, timeout: number, context?: ErrorContext) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, context);
  }
}

// Configuration error
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
  
  constructor(message: string, context?: ErrorContext) {
    super(message, context);
  }
}

// Business logic error
export class BusinessLogicError extends AppError {
  readonly statusCode = 422;
  readonly isOperational = true;
  
  constructor(message: string, context?: ErrorContext) {
    super(message, context);
  }
}
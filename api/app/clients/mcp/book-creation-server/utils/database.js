/**
 * Database Error Handling and Retry Logic
 * 
 * Provides comprehensive database error handling with retry logic,
 * rollback mechanisms, and connection management for MongoDB operations.
 */

const mongoose = require('mongoose');
const {
  DatabaseError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  ERROR_CODES,
  isRetryableError,
} = require('./errors');

/**
 * Logger utility for database operations
 */
const logger = {
  info: (...args) => console.log('[DB-INFO]', ...args),
  warn: (...args) => console.warn('[DB-WARN]', ...args),
  error: (...args) => console.error('[DB-ERROR]', ...args),
  debug: (...args) => console.log('[DB-DEBUG]', ...args),
};

/**
 * Database connection manager with retry logic
 */
class DatabaseManager {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      connectionTimeout: options.connectionTimeout || 10000,
      operationTimeout: options.operationTimeout || 30000,
      ...options,
    };
    
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect(uri, options = {}) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connectWithRetry(uri, options);
    return this.connectionPromise;
  }

  /**
   * Internal connection method with retry logic
   */
  async _connectWithRetry(uri, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.info(`Attempting database connection (attempt ${attempt}/${this.options.maxRetries})`);
        
        const connectionOptions = {
          serverSelectionTimeoutMS: this.options.connectionTimeout,
          socketTimeoutMS: this.options.operationTimeout,
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 30000,
          ...options,
        };

        await mongoose.connect(uri, connectionOptions);
        
        this.isConnected = true;
        logger.info('Database connected successfully');
        
        // Set up connection event handlers
        this._setupConnectionHandlers();
        
        return mongoose.connection;
        
      } catch (error) {
        lastError = error;
        logger.error(`Database connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.options.maxRetries) {
          break;
        }
        
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying connection in ${delay}ms...`);
        await this._sleep(delay);
      }
    }
    
    this.connectionPromise = null;
    throw new DatabaseError(
      `Failed to connect to database after ${this.options.maxRetries} attempts`,
      'connection',
      { originalError: lastError.message }
    );
  }

  /**
   * Set up connection event handlers
   */
  _setupConnectionHandlers() {
    mongoose.connection.on('error', (error) => {
      logger.error('Database connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Database disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Database reconnected');
      this.isConnected = true;
    });
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      this.connectionPromise = null;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw new DatabaseError(
        'Failed to disconnect from database',
        'disconnection',
        { originalError: error.message }
      );
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Transaction manager for multi-document operations
 */
class TransactionManager {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 100,
      ...options,
    };
  }

  /**
   * Execute operations within a transaction with retry logic
   */
  async withTransaction(operations, options = {}) {
    const session = await mongoose.startSession();
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.debug(`Starting transaction (attempt ${attempt}/${this.options.maxRetries})`);
        
        const result = await session.withTransaction(async () => {
          return await operations(session);
        }, {
          readPreference: 'primary',
          readConcern: { level: 'local' },
          writeConcern: { w: 'majority' },
          ...options,
        });
        
        logger.debug('Transaction completed successfully');
        return result;
        
      } catch (error) {
        lastError = error;
        logger.error(`Transaction attempt ${attempt} failed:`, error.message);
        
        // Don't retry if it's not a retryable error
        if (!this._isRetryableTransactionError(error)) {
          break;
        }
        
        if (attempt === this.options.maxRetries) {
          break;
        }
        
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        await this._sleep(delay);
        
      } finally {
        if (attempt === this.options.maxRetries || !this._isRetryableTransactionError(lastError)) {
          await session.endSession();
        }
      }
    }
    
    await session.endSession();
    throw this._transformTransactionError(lastError);
  }

  /**
   * Check if a transaction error is retryable
   */
  _isRetryableTransactionError(error) {
    if (!error) return false;
    
    // MongoDB transient transaction errors
    const retryableErrorCodes = [
      112, // WriteConflict
      117, // ConflictingOperationInProgress
      251, // NoSuchTransaction
      244, // TransactionTooOld
    ];
    
    return retryableErrorCodes.includes(error.code) ||
           error.hasErrorLabel('TransientTransactionError') ||
           error.hasErrorLabel('UnknownTransactionCommitResult');
  }

  /**
   * Transform transaction errors to appropriate error types
   */
  _transformTransactionError(error) {
    if (error.name === 'ValidationError') {
      return new ValidationError(
        'Transaction validation failed',
        { originalError: error.message },
        this._extractValidationErrors(error)
      );
    }
    
    if (error.code === 11000) {
      return new ValidationError(
        'Duplicate key error in transaction',
        { 
          field: Object.keys(error.keyPattern || {})[0],
          value: Object.values(error.keyValue || {})[0],
        }
      );
    }
    
    return new DatabaseError(
      error.message || 'Transaction failed',
      'transaction',
      { originalError: error.name, code: error.code }
    );
  }

  /**
   * Extract validation errors from Mongoose validation error
   */
  _extractValidationErrors(error) {
    if (!error.errors) return [];
    
    return Object.keys(error.errors).map(field => ({
      field,
      message: error.errors[field].message,
      value: error.errors[field].value,
      kind: error.errors[field].kind,
    }));
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Database operation wrapper with error handling and retry logic
 */
class DatabaseOperations {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      operationTimeout: options.operationTimeout || 30000,
      ...options,
    };
    
    this.transactionManager = new TransactionManager(options);
  }

  /**
   * Execute a database operation with retry logic
   */
  async withRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Set operation timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new TimeoutError(
              `Database operation timed out after ${this.options.operationTimeout}ms`,
              this.options.operationTimeout
            ));
          }, this.options.operationTimeout);
        });
        
        const result = await Promise.race([
          operation(),
          timeoutPromise,
        ]);
        
        const duration = Date.now() - startTime;
        logger.debug(`Database operation completed in ${duration}ms`, context);
        
        return result;
        
      } catch (error) {
        lastError = error;
        const duration = Date.now() - Date.now();
        
        logger.error(`Database operation attempt ${attempt} failed after ${duration}ms:`, {
          error: error.message,
          code: error.code,
          context,
        });
        
        // Don't retry if error is not retryable
        if (!this._isRetryableError(error)) {
          break;
        }
        
        if (attempt === this.options.maxRetries) {
          break;
        }
        
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        logger.debug(`Retrying database operation in ${delay}ms...`);
        await this._sleep(delay);
      }
    }
    
    throw this._transformError(lastError, context);
  }

  /**
   * Execute operations within a transaction
   */
  async withTransaction(operations, options = {}) {
    return this.transactionManager.withTransaction(operations, options);
  }

  /**
   * Check if an error is retryable
   */
  _isRetryableError(error) {
    // Network errors
    if (error.name === 'MongoNetworkError' || 
        error.name === 'MongoNetworkTimeoutError') {
      return true;
    }
    
    // Server selection errors
    if (error.name === 'MongoServerSelectionError') {
      return true;
    }
    
    // Timeout errors
    if (error instanceof TimeoutError || 
        error.name === 'MongoTimeoutError') {
      return true;
    }
    
    // Specific MongoDB error codes that are retryable
    const retryableErrorCodes = [
      11600, // InterruptedAtShutdown
      11601, // Interrupted
      11602, // InterruptedDueToReplStateChange
      13435, // NotMaster
      13436, // NotMasterNoSlaveOk
      189,   // PrimarySteppedDown
      91,    // ShutdownInProgress
    ];
    
    return retryableErrorCodes.includes(error.code);
  }

  /**
   * Transform database errors to appropriate error types
   */
  _transformError(error, context = {}) {
    // Handle timeout errors
    if (error instanceof TimeoutError) {
      return error;
    }
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      return new ValidationError(
        'Database validation failed',
        { context, originalError: error.message },
        this._extractValidationErrors(error)
      );
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return new ValidationError(
        'Duplicate entry found',
        { 
          field: Object.keys(error.keyPattern || {})[0],
          value: Object.values(error.keyValue || {})[0],
          context,
        }
      );
    }
    
    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return new ValidationError(
        `Invalid ${error.kind}: ${error.value}`,
        { 
          field: error.path,
          value: error.value,
          kind: error.kind,
          context,
        }
      );
    }
    
    // Handle document not found errors
    if (error.name === 'DocumentNotFoundError') {
      return new NotFoundError(
        error.model?.modelName || 'Document',
        error.query || 'unknown',
        { context }
      );
    }
    
    // Handle connection errors
    if (error.name === 'MongoNetworkError' || 
        error.name === 'MongoServerSelectionError') {
      return new DatabaseError(
        'Database connection failed',
        'connection',
        { originalError: error.message, context }
      );
    }
    
    // Generic database error
    return new DatabaseError(
      error.message || 'Database operation failed',
      'operation',
      { 
        originalError: error.name,
        code: error.code,
        context,
      }
    );
  }

  /**
   * Extract validation errors from Mongoose validation error
   */
  _extractValidationErrors(error) {
    if (!error.errors) return [];
    
    return Object.keys(error.errors).map(field => ({
      field,
      message: error.errors[field].message,
      value: error.errors[field].value,
      kind: error.errors[field].kind,
    }));
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global database manager instance
 */
const dbManager = new DatabaseManager();
const dbOperations = new DatabaseOperations();

/**
 * Convenience functions for common database operations
 */

/**
 * Execute a database operation with retry logic
 */
function withDatabaseRetry(operation, context = {}) {
  return dbOperations.withRetry(operation, context);
}

/**
 * Execute operations within a transaction
 */
function withTransaction(operations, options = {}) {
  return dbOperations.withTransaction(operations, options);
}

/**
 * Connect to database with retry logic
 */
function connectDatabase(uri, options = {}) {
  return dbManager.connect(uri, options);
}

/**
 * Disconnect from database
 */
function disconnectDatabase() {
  return dbManager.disconnect();
}

/**
 * Check database health
 */
function isDatabaseHealthy() {
  return dbManager.isHealthy();
}

/**
 * Create a model operation wrapper with error handling
 */
function wrapModelOperation(Model, operation) {
  return async (...args) => {
    return withDatabaseRetry(async () => {
      return await Model[operation](...args);
    }, { model: Model.modelName, operation });
  };
}

/**
 * Create CRUD operations with error handling for a model
 */
function createModelOperations(Model) {
  return {
    create: wrapModelOperation(Model, 'create'),
    findById: wrapModelOperation(Model, 'findById'),
    findOne: wrapModelOperation(Model, 'findOne'),
    find: wrapModelOperation(Model, 'find'),
    findByIdAndUpdate: wrapModelOperation(Model, 'findByIdAndUpdate'),
    findOneAndUpdate: wrapModelOperation(Model, 'findOneAndUpdate'),
    updateMany: wrapModelOperation(Model, 'updateMany'),
    findByIdAndDelete: wrapModelOperation(Model, 'findByIdAndDelete'),
    findOneAndDelete: wrapModelOperation(Model, 'findOneAndDelete'),
    deleteMany: wrapModelOperation(Model, 'deleteMany'),
    countDocuments: wrapModelOperation(Model, 'countDocuments'),
    aggregate: wrapModelOperation(Model, 'aggregate'),
  };
}

module.exports = {
  DatabaseManager,
  TransactionManager,
  DatabaseOperations,
  dbManager,
  dbOperations,
  withDatabaseRetry,
  withTransaction,
  connectDatabase,
  disconnectDatabase,
  isDatabaseHealthy,
  wrapModelOperation,
  createModelOperations,
};
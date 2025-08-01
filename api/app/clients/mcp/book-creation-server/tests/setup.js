const mongoose = require('mongoose');

// Set up test environment
process.env.NODE_ENV = 'test';

// Increase timeout for database operations
jest.setTimeout(30000);

// Test database connection
let testDbConnection = null;

/**
 * Set up test database connection with proper configuration
 */
async function setupTestDatabase() {
  if (testDbConnection && mongoose.connection.readyState === 1) {
    return testDbConnection;
  }

  const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/book-creation-test';

  try {
    // Optimized connection options for testing
    testDbConnection = await mongoose.connect(testDbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 5, // Limit connections for tests
      serverSelectionTimeoutMS: 5000, // Fail fast in tests
      socketTimeoutMS: 45000,
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
    });

    // Suppress mongoose deprecation warnings in tests
    mongoose.set('strictQuery', false);

    return testDbConnection;
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
}

/**
 * Clean up test database with better isolation
 */
async function cleanupTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    try {
      // Drop all collections with better error handling
      const collections = await mongoose.connection.db.collections();
      const dropPromises = collections.map(async (collection) => {
        try {
          await collection.drop();
        } catch (error) {
          // Only ignore "ns not found" errors (collection doesn't exist)
          if (error.code !== 26) {
            console.warn(
              `Warning: Could not drop collection ${collection.collectionName}:`,
              error.message,
            );
          }
        }
      });

      await Promise.all(dropPromises);
    } catch (error) {
      console.warn('Warning: Error during collection cleanup:', error.message);
    }

    await mongoose.disconnect();
    testDbConnection = null;
  }
}

/**
 * Create isolated test database for each test suite
 * @param {string} suiteName - Name of the test suite for unique DB
 * @returns {Promise<Object>} Database connection
 */
async function createIsolatedTestDb(suiteName) {
  const testDbUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017';
  const uniqueDbName = `book-creation-test-${suiteName}-${Date.now()}`;

  return await mongoose.connect(`${testDbUri}/${uniqueDbName}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0,
  });
}

// Global test setup
beforeAll(async () => {
  // Suppress mongoose deprecation warnings in tests
  mongoose.set('strictQuery', false);
});

// Global test teardown
afterAll(async () => {
  // Close any remaining connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Mock logger to avoid console output during tests
jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Create a test logger factory for better control
const createTestLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Global test utilities
global.createTestLogger = createTestLogger;

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  createIsolatedTestDb,
};

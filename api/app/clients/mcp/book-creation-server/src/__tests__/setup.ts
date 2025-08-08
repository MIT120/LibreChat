/**
 * Test setup file for TypeScript tests
 */

// Mock console methods to avoid noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/librechat_test';

// Increase timeout for async operations
jest.setTimeout(30000);

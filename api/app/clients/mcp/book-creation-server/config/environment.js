/**
 * Environment configuration management for the MCP server
 */

/**
 * Get environment configuration with defaults and validation
 * @returns {Object} Configuration object
 */
function getEnvironmentConfig() {
  const config = {
    // Database configuration
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat',
      testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/book-creation-test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
        serverSelectionTimeoutMS: parseInt(process.env.DB_TIMEOUT) || 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
      },
    },

    // AI client configuration
    ai: {
      provider: process.env.AI_PROVIDER || 'openai',
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4000,
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      timeout: parseInt(process.env.AI_TIMEOUT) || 30000,
    },

    // Server configuration
    server: {
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || 'localhost',
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
    },

    // Book creation limits
    limits: {
      maxChapters: parseInt(process.env.MAX_CHAPTERS) || 50,
      minChapters: parseInt(process.env.MIN_CHAPTERS) || 3,
      maxWordCount: parseInt(process.env.MAX_WORD_COUNT) || 50000,
      maxBooks: parseInt(process.env.MAX_BOOKS_PER_USER) || 10,
      maxRegenerations: parseInt(process.env.MAX_REGENERATIONS) || 3,
    },

    // Feature flags
    features: {
      enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
      enableExport: process.env.ENABLE_EXPORT !== 'false',
      enableProgressTracking: process.env.ENABLE_PROGRESS_TRACKING !== 'false',
      enableStatusMessages: process.env.ENABLE_STATUS_MESSAGES !== 'false',
    },
  };

  // Validate required configuration
  validateConfig(config);

  return config;
}

/**
 * Validate configuration and throw errors for missing required values
 * @param {Object} config - Configuration object
 */
function validateConfig(config) {
  const errors = [];

  // Check required AI configuration
  if (!config.ai.apiKey) {
    errors.push('AI API key is required (OPENAI_API_KEY or AI_API_KEY)');
  }

  // Check database URI in production
  if (config.server.nodeEnv === 'production' && config.database.uri.includes('localhost')) {
    errors.push('Production database URI should not use localhost');
  }

  // Validate numeric limits
  if (config.limits.maxChapters < config.limits.minChapters) {
    errors.push('MAX_CHAPTERS must be greater than MIN_CHAPTERS');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration for specific environment
 * @param {string} env - Environment name
 * @returns {Object} Environment-specific configuration
 */
function getConfigForEnvironment(env = process.env.NODE_ENV) {
  const baseConfig = getEnvironmentConfig();

  switch (env) {
    case 'test':
      return {
        ...baseConfig,
        database: {
          ...baseConfig.database,
          uri: baseConfig.database.testUri,
          options: {
            ...baseConfig.database.options,
            maxPoolSize: 5, // Limit connections in tests
          },
        },
        ai: {
          ...baseConfig.ai,
          timeout: 10000, // Shorter timeout for tests
        },
        server: {
          ...baseConfig.server,
          logLevel: 'error', // Reduce log noise in tests
        },
      };

    case 'development':
      return {
        ...baseConfig,
        server: {
          ...baseConfig.server,
          logLevel: 'debug',
        },
      };

    case 'production':
      return {
        ...baseConfig,
        server: {
          ...baseConfig.server,
          logLevel: 'warn',
        },
        limits: {
          ...baseConfig.limits,
          maxRegenerations: 5, // Allow more regenerations in production
        },
      };

    default:
      return baseConfig;
  }
}

module.exports = {
  getEnvironmentConfig,
  getConfigForEnvironment,
  validateConfig,
};
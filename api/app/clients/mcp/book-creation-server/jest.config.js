export default {
  testEnvironment: 'node',
  preset: 'jest',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    jest: true,
  },
  moduleNameMapping: {
    '^~/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['services/**/*.js', 'models/**/*.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};

/**
 * Jest Configuration for rechtsinformationen-bund-de-mcp
 *
 * Supports:
 * - ES Modules (type: "module" in package.json)
 * - TypeScript tests (if needed in future)
 * - Code coverage reporting
 * - E2E tests with longer timeouts
 */

export default {
  // Use Node environment for MCP server testing
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // Ignore these directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tmp/',
  ],

  // Transform files (needed for TypeScript if we add it later)
  transform: {},

  // Module file extensions
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],

  // Setup files
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/',
    '/debug/',
    '/tmp/',
  ],

  // Coverage thresholds (aspirational - not enforced yet)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Timeout for tests (longer for E2E tests)
  testTimeout: 30000, // 30 seconds

  // Verbose output
  verbose: true,

  // Show individual test results
  displayName: {
    name: 'rechtsinformationen-bund-de-mcp',
    color: 'blue',
  },

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Detect open handles (helps find async issues)
  detectOpenHandles: false, // Enable for debugging

  // Force exit after tests complete
  forceExit: false,

  // Globals
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};

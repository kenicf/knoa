module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'src/lib/adapters/**/*.js',
    'src/lib/core/error-framework.js',
    'src/lib/core/event-system.js',
    'src/lib/utils/errors.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    },
    'src/lib/adapters/': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    },
    'src/lib/core/error-framework.js': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  verbose: true,
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
};
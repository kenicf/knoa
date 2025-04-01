module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverage: true,
  testPathIgnorePatterns: ['node_modules'],
  collectCoverageFrom: [
    'src/**/*.js', // すべてのソースコードファイル
    '!**/node_modules/**', // node_modulesは除外
    '!**/examples/**', // 例示コードは除外
    '!**/templates/**', // テンプレートファイルは除外
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 55,
      functions: 60,
      lines: 60,
    },
    'src/lib/adapters/': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    'src/lib/core/error-framework.js': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
  verbose: true,
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};

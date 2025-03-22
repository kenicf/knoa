module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli/**/*.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
};
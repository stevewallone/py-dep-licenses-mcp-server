export default {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transform: {},
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};

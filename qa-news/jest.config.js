const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './src',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

module.exports = createJestConfig(customJestConfig);

// Root jest config - only for root-level tests
// qa-news has its own jest.config.js and should not use this config

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  // Floor set just below the measured baseline (2026-11-17: 90 / 76 / 94 / 90).
  // Raise as coverage improves; never lower without a reason.
  coverageThreshold: {
    global: { statements: 88, branches: 72, functions: 90, lines: 88 },
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};

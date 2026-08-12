/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out modules that require Next.js server runtime
    '^next/headers$': '<rootDir>/src/__tests__/__mocks__/next-headers.ts',
    '^next/server$': '<rootDir>/src/__tests__/__mocks__/next-server.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};

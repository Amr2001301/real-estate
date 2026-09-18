/** @type {import('jest').Config} */
module.exports = {
  // Default environment. Individual test files override with @jest-environment jsdom.
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Next.js tsconfig uses module=ESNext / moduleResolution=Bundler which
        // ts-jest cannot run. Override to CommonJS for the test runner only.
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // next/headers is a server-only module; map to a jest.fn() stub
    '^next/headers$': '<rootDir>/src/__tests__/__mocks__/next-headers.ts',
    // next/server fallback (middleware.test.ts overrides it inline with jest.mock)
    '^next/server$': '<rootDir>/src/__tests__/__mocks__/next-server.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};

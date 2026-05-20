// Flat ESLint config (ESLint 9+). One root config drives the whole monorepo;
// apps/web-admin layers Next.js rules on top via its own eslint.config.mjs.
//
// Philosophy: this is a brownfield codebase. Start permissive (warnings, not
// errors) so CI goes green today, then ratchet rules up over time.

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const COMMON_GLOBALS = {
  // Browser
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  location: 'readonly',
  // Node
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  // Universal
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  queueMicrotask: 'readonly',
  // Fetch/web
  fetch: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  FormData: 'readonly',
  File: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  crypto: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  // Node-style modules
  module: 'readonly',
  require: 'readonly',
  exports: 'writable',
};

export default [
  // Global ignores — applied to every file ESLint sees.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/*.min.js',
      // Generated / vendored
      '**/prisma/migrations/**',
      '**/next-env.d.ts',
      'pnpm-lock.yaml',
      // Anything Docker-built
      'apps/web-admin/.next/standalone/**',
    ],
  },

  // Base JS recommended for everything ESLint touches.
  js.configs.recommended,

  // TypeScript files — use the non-type-checked recommended set so we don't
  // need `parserOptions.project` (faster, and side-steps monorepo path issues).
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: COMMON_GLOBALS,
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Defer to the TS-ESLint variant; the core rule double-fires on enums/types.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Brownfield-friendly: warn, not error.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // NestJS uses namespaces in some generated types; leave alone.
      '@typescript-eslint/no-namespace': 'off',
      // Empty catch blocks are sometimes intentional (best-effort cleanup).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Test files — jest globals + relaxed `any`.
  {
    files: ['**/*.{spec,test}.{ts,tsx,js}', '**/__tests__/**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        ...COMMON_GLOBALS,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Plain JS / mjs / cjs (configs, scripts).
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: COMMON_GLOBALS,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];

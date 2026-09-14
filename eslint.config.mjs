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
  FileList: 'readonly',
  XMLHttpRequest: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  HTMLHeadingElement: 'readonly',
  HTMLParagraphElement: 'readonly',
  HTMLTableElement: 'readonly',
  HTMLLabelElement: 'readonly',
  HTMLSpanElement: 'readonly',
  SVGElement: 'readonly',
  SVGRectElement: 'readonly',
  SVGSVGElement: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  IntersectionObserverEntry: 'readonly',
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
      // TS compiler handles redeclaration; the base rule false-fires on type/value name sharing.
      'no-redeclare': 'off',
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
      // Allow ternary expressions used as statements (e.g. cond ? a() : b()).
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },

  // Test files — jest globals + relaxed `any`.
  {
    files: ['**/*.{spec,test}.{ts,tsx,js}', '**/*.e2e-spec.ts', '**/__tests__/**/*.{ts,tsx,js}'],
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

  // Backend API — security-sensitive static restrictions.
  //
  // 1. $queryRawUnsafe: bypasses tenant middleware and is SQL-injection-prone.
  // 2. prisma.user.*: User is TENANT_CONTROLLED (MT-012). Direct access outside
  //    authorized files risks cross-tenant IDOR. Authorized files are listed in
  //    the override block below.
  //
  // Limitations of the prisma.user selectors:
  //   - Catches `this.prisma.user.*` and `prisma.user.*` call patterns.
  //   - Does NOT catch destructuring (`const { user } = this.prisma`) or
  //     index notation (`this.prisma['user']`). These are rare; treat as
  //     known gap documented here.
  //   - Test files (*.spec.ts, __tests__/**) are excluded via the ignores list
  //     below because mock setup objects may reference .user properties.
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      // Authorized prisma.user access locations (TENANT_CONTROLLED policy enforced internally):
      'apps/api/src/modules/users/users.service.ts',
      'apps/api/src/modules/auth/auth.service.ts',
      'apps/api/src/modules/auth/jwt.strategy.ts',
      'apps/api/src/modules/super-admin/super-admin.service.ts',
      'apps/api/src/common/utils/identity-claim.ts',
      'apps/api/src/common/utils/sales-scope.ts',
      'apps/api/src/common/tenant/resolve-tenant-entity.ts',
      // Tests: mock objects may reference prisma.user shape; exempt from this check.
      'apps/api/src/**/*.spec.ts',
      'apps/api/src/**/*.e2e-spec.ts',
      'apps/api/src/**/__tests__/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
          message: 'Use $queryRaw(Prisma.sql`...`) — $queryRawUnsafe bypasses the tenant middleware and is SQL-injection-prone.',
        },
        {
          // Catches: this.prisma.user.findMany(...) — the most common pattern.
          selector: "MemberExpression[property.name='user'][object.property.name='prisma']",
          message:
            "Direct prisma.user access is restricted. User is TENANT_CONTROLLED (MT-012) — " +
            "route through UsersService or an explicitly authorized file.",
        },
        {
          // Catches: prisma.user.findMany(...) — when prisma is a local identifier.
          selector: "MemberExpression[property.name='user'][object.name='prisma']",
          message:
            "Direct prisma.user access is restricted. User is TENANT_CONTROLLED (MT-012) — " +
            "route through UsersService or an explicitly authorized file.",
        },
      ],
    },
  },

  // Authorized files that need direct prisma.user access — keep $queryRawUnsafe
  // restriction but remove the prisma.user restriction.
  {
    files: [
      'apps/api/src/modules/users/users.service.ts',
      'apps/api/src/modules/auth/auth.service.ts',
      'apps/api/src/modules/auth/jwt.strategy.ts',
      'apps/api/src/modules/super-admin/super-admin.service.ts',
      'apps/api/src/common/utils/identity-claim.ts',
      'apps/api/src/common/utils/sales-scope.ts',
      'apps/api/src/common/tenant/resolve-tenant-entity.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
          message: 'Use $queryRaw(Prisma.sql`...`) — $queryRawUnsafe bypasses the tenant middleware and is SQL-injection-prone.',
        },
        // prisma.user access is intentionally allowed in these files.
      ],
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

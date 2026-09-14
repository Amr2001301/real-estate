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
    files: ['**/*.{spec,test}.{ts,tsx,js}', '**/*.e2e-spec.ts', '**/*.security-spec.ts', '**/__tests__/**/*.{ts,tsx,js}'],
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

  // ── MT-012: Backend API — security-sensitive static restrictions ───────────
  //
  // Rule 1: $queryRawUnsafe is always banned (SQL-injection + tenant bypass risk).
  //
  // Rule 2 (prisma.user.*): User is TENANT_CONTROLLED.  The Prisma middleware
  // does NOT auto-inject companyId for User, so every read outside the allowlist
  // below is a potential cross-tenant data leak.
  //
  // DESIGN: Every non-auth prisma.user read must go through one of the helpers
  // exported from resolve-tenant-entity.ts:
  //   • resolveTenantUser()    — single record, throws 404 if not in tenant
  //   • findTenantUser()       — single record, returns null if not in tenant
  //   • scopedUserFindMany()   — bulk reads, always merges companyId from ALS
  //   • scopedUserCount()      — aggregates, always merges companyId from ALS
  //
  // These helpers call getRequiredCompanyId() internally and are the ONLY
  // approved path for scoped prisma.user reads outside the allowlist.
  //
  // STATIC LIMITATION: The rule verifies that direct prisma.user.* calls do not
  // appear outside the allowlist. It does NOT verify the value of companyId at
  // call sites inside allowlisted files — a developer could write a hardcoded
  // ID or omit companyId entirely and the rule would not catch it. The residual
  // risk is documented in docs/audit/13-user-tenancy.md §4 option (a).
  //
  // SELECTORS CATCH: `this.prisma.user.*` and `prisma.user.*` call expressions.
  // SELECTORS MISS:  Destructuring (`const { user } = this.prisma`) and index
  //   notation (`this.prisma['user']`). These are rare; treat as a known gap.
  //   Test files (*.spec.ts, __tests__/**) are excluded because mock objects
  //   routinely reference .user shape.
  //
  // ALLOWLIST TIERS:
  //   Tier A — Cross-tenant by design: email/phone are @unique globally; JWT sub
  //     is cross-company; OTP claim flow finds rows across tenants by phone.
  //     These files must NOT add companyId to their user queries.
  //   Tier B — Scoped-access helpers: must enforce companyId internally (via
  //     getRequiredCompanyId() or explicit where clause). Adding companyId to
  //     these files is a contract, not enforced by this lint rule.
  //   Tier C — Identity/peer resolution: phone-suffix scan and email lookup for
  //     building ownership filters must cross tenants (legacy identity merge).
  //
  // Keeping this allowlist SHORT and DOCUMENTED is the primary defence against
  // the class of vulnerability that produced V-01..V-26. Any new file added here
  // requires a PR comment explaining the cross-tenant or scoped justification.
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      // ── Tier A: Cross-tenant auth paths ────────────────────────────────────
      // email/phone are @unique globally; these files look up users before
      // any tenant context exists (login, OTP, register, JWT validation).
      'apps/api/src/modules/auth/auth.service.ts',
      'apps/api/src/modules/auth/jwt.strategy.ts',
      // Broker portal: email/phone global uniqueness check before creating a
      // broker team member. No caller-supplied user ID — existence-check only.
      'apps/api/src/modules/broker-portal/broker-portal-team.service.ts',
      // Broker-users: same global uniqueness guarantee as broker-portal-team.
      'apps/api/src/modules/broker-users/broker-users.service.ts',
      // Public inbound leads: find-or-create by phone/email; user may exist
      // under any tenant (legacy anonymous rows with companyId: null).
      'apps/api/src/modules/requests/requests.module.ts',

      // ── Tier B: Scoped-access helpers ──────────────────────────────────────
      // resolve-tenant-entity.ts: implements resolveTenantUser, findTenantUser,
      // scopedUserFindMany, scopedUserCount. All helpers call getRequiredCompanyId().
      'apps/api/src/common/tenant/resolve-tenant-entity.ts',
      // users.service.ts: user CRUD. Every query must include companyId in the
      // where clause — enforced by code review, not by this rule.
      'apps/api/src/modules/users/users.service.ts',
      // sales-scope.ts: salesActorIds and teamSalesIds call getRequiredCompanyId().
      'apps/api/src/common/utils/sales-scope.ts',
      // identity-claim.ts: OTP claim flow — phone/email match may cross tenants
      // (V2 multi-tenant redesign deferred; see docs/audit/13-user-tenancy.md).
      'apps/api/src/common/utils/identity-claim.ts',
      // super-admin.service.ts: SUPER_ADMIN operates in bypass mode; explicit,
      // platform-wide queries are intentional.
      'apps/api/src/modules/super-admin/super-admin.service.ts',

      // ── Tier C: Identity-peer resolution ───────────────────────────────────
      // reservations.module.ts: phone-suffix scan + email lookup to build
      // ownership filters for legacy identity merging (lines with prisma.user.*
      // after the findTenantUser refactor are cross-tenant by design).
      'apps/api/src/modules/reservations/reservations.module.ts',

      // Tests: mock objects reference prisma.user shape; exempt from this check.
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
            "Direct prisma.user access is restricted (MT-012). User is TENANT_CONTROLLED — " +
            "use scopedUserFindMany/scopedUserCount/resolveTenantUser/findTenantUser from " +
            "'../../common/tenant/resolve-tenant-entity', or add this file to the MT-012 " +
            "allowlist in eslint.config.mjs with a documented justification.",
        },
        {
          // Catches: prisma.user.findMany(...) — when prisma is a local identifier.
          selector: "MemberExpression[property.name='user'][object.name='prisma']",
          message:
            "Direct prisma.user access is restricted (MT-012). User is TENANT_CONTROLLED — " +
            "use scopedUserFindMany/scopedUserCount/resolveTenantUser/findTenantUser from " +
            "'../../common/tenant/resolve-tenant-entity', or add this file to the MT-012 " +
            "allowlist in eslint.config.mjs with a documented justification.",
        },
      ],
    },
  },

  // Allowlisted files: keep $queryRawUnsafe restriction, lift prisma.user restriction.
  // Every entry in this block has a documented justification in the ignores list above.
  {
    files: [
      // Tier A
      'apps/api/src/modules/auth/auth.service.ts',
      'apps/api/src/modules/auth/jwt.strategy.ts',
      'apps/api/src/modules/broker-portal/broker-portal-team.service.ts',
      'apps/api/src/modules/broker-users/broker-users.service.ts',
      'apps/api/src/modules/requests/requests.module.ts',
      // Tier B
      'apps/api/src/common/tenant/resolve-tenant-entity.ts',
      'apps/api/src/modules/users/users.service.ts',
      'apps/api/src/common/utils/sales-scope.ts',
      'apps/api/src/common/utils/identity-claim.ts',
      'apps/api/src/modules/super-admin/super-admin.service.ts',
      // Tier C
      'apps/api/src/modules/reservations/reservations.module.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
          message: 'Use $queryRaw(Prisma.sql`...`) — $queryRawUnsafe bypasses the tenant middleware and is SQL-injection-prone.',
        },
        // prisma.user access is intentionally allowed — see justification in
        // the MT-012 allowlist above.
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

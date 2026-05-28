/**
 * Phase 7C — RBAC route-coverage master spec.
 *
 * Walks every HTTP route declared on every controller in the application
 * and asserts each one is EITHER:
 *   - explicitly marked `@Public()`, OR
 *   - guarded by `@Roles(...)` (at the method or controller level).
 *
 * Routes that legitimately lack both — currently just the two HealthController
 * endpoints, which are decorated `@Public()` already — are allow-listed by
 * `${controllerName}.${methodName}` exact-match so the list is auditable.
 *
 * Implementation notes:
 *   - We rely on `Reflect.getMetadata('path', handler)` to identify HTTP
 *     handlers (set by Nest's `@Get/@Post/@Patch/@Delete` decorators).
 *     Non-handler methods (lifecycle hooks, helpers) skip the check.
 *   - `Reflector.getAllAndOverride` walks both the handler and the
 *     controller class — exactly what the production `RolesGuard` /
 *     `JwtAuthGuard` use. So a class-level `@Roles(...)` (e.g. on
 *     `BrokerPortalController`) satisfies every method below it, matching
 *     runtime behavior.
 *   - We do NOT assert `@Permissions(...)` — that's a tighter "permission
 *     code" check that's only meaningful on top of `@Roles`. Adding it
 *     would force every route to have a code, which is a different (and
 *     larger) refactor.
 */

import 'reflect-metadata';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

/**
 * Routes that genuinely should lack both @Public + @Roles. Keep tiny +
 * reviewed. Every entry is a `@Roles`-less authenticated-only route whose
 * scoping is done by `user.sub` at the service layer, so adding @Roles
 * would only re-state "must be logged in" which the global JwtAuthGuard
 * already enforces.
 *
 * Surfaced as a real finding by Phase 7C's first run of this spec — these
 * 7 routes were not previously documented as a deliberate "any
 * authenticated user can read their own data" set. If a future change
 * tightens the role gate on any of them (e.g. CUSTOMER-only), remove the
 * entry; the spec will then assert the role decoration is present.
 */
const ALLOW_LIST_FULL_NAMES = new Set<string>([
  // /v1/me + PATCH /v1/me — current user self-profile read + update.
  'UsersController.me',
  'UsersController.updateMe',
  // /v1/me/notifications/* — current user's own notification feed + ack.
  'NotificationsController.myList',
  'NotificationsController.unreadCount',
  'NotificationsController.markRead',
  'NotificationsController.markAllRead',
  // /v1/me/devices — push-token registration for the current user.
  'NotificationsController.registerDevice',
]);

describe('RBAC route coverage (master spec)', () => {
  it('every controller HTTP route is either @Public() or has @Roles(...)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const scanner = new MetadataScanner();

    const violations: string[] = [];
    let checked = 0;

    for (const wrapper of discovery.getControllers()) {
      const { metatype, instance } = wrapper;
      if (!metatype || !instance) continue;
      const proto = Object.getPrototypeOf(instance);
      const methodNames = scanner.getAllMethodNames(proto);

      for (const methodName of methodNames) {
        const handler = (proto as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function') continue;
        // Only Nest HTTP handlers carry the 'path' + 'method' metadata.
        const path = Reflect.getMetadata('path', handler as object);
        const httpMethod = Reflect.getMetadata('method', handler as object);
        if (path === undefined || httpMethod === undefined) continue;

        const fullName = `${metatype.name}.${methodName}`;
        if (ALLOW_LIST_FULL_NAMES.has(fullName)) {
          checked++;
          continue;
        }

        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]);
        const roles = reflector.getAllAndOverride<unknown[]>(ROLES_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]);

        const hasRoles = Array.isArray(roles) && roles.length > 0;
        if (!isPublic && !hasRoles) {
          violations.push(`${fullName} (${String(httpMethod)} ${path})`);
        }
        checked++;
      }
    }

    await app.close();

    if (violations.length > 0) {
      throw new Error(
        `${violations.length} controller route(s) lack both @Public() and @Roles(): \n  ` +
          violations.join('\n  ') +
          '\n(If a route is genuinely meant to be unguarded, add its ' +
          '"ControllerName.methodName" exact name to ALLOW_LIST_FULL_NAMES in ' +
          'this spec — keep that list tiny and reviewed.)',
      );
    }

    // Sanity: the spec must actually find SOMETHING — guards against a
    // future refactor that silently breaks introspection.
    expect(checked).toBeGreaterThan(50);
  });
});

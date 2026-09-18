/**
 * MT-039 — CapabilityGuard unit tests
 *
 * Verifies:
 *  1. No @RequireCapability decorator → guard passes
 *  2. SUPER_ADMIN → guard passes regardless of capability
 *  3. Capability enabled → passes
 *  4. Capability disabled/missing → throws ForbiddenException (code: CAPABILITY_NOT_ENABLED)
 *  5. No companyId for non-SUPER_ADMIN → throws ForbiddenException
 *  6. Company A capability does not affect Company B routing
 *  7. Unauthenticated request (no user) → returns false
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard } from '../capability.guard';
import { REQUIRE_CAPABILITY_KEY } from '../../decorators/require-capability.decorator';

function makeContext(user: Record<string, unknown> | null = null, handlerMeta: string | undefined = undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(handlerMeta),
  } as unknown as Reflector;

  const req = { user };
  const ctx = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { reflector, ctx };
}

function makeCapabilityService(has: boolean = true) {
  return {
    requireCapability: has
      ? jest.fn().mockResolvedValue(undefined)
      : jest.fn().mockRejectedValue(
          new ForbiddenException({ message: 'Capability not enabled: crm', code: 'CAPABILITY_NOT_ENABLED', capability: 'crm' }),
        ),
    hasCapability: jest.fn().mockResolvedValue(has),
  };
}

// ── 1. No decorator ───────────────────────────────────────────────────────────

test('no @RequireCapability decorator → guard passes but still runs app-level always-check', async () => {
  // Phase 2: even without a decorator, ADMIN role triggers staffApp always-check.
  const { reflector, ctx } = makeContext({ sub: 'u1', role: 'ADMIN', companyId: 'c1' }, undefined);
  const service = makeCapabilityService();
  const guard = new CapabilityGuard(reflector, service as never);
  const result = await guard.canActivate(ctx);
  expect(result).toBe(true);
  // Always-check fires for staff roles even without @RequireCapability
  expect(service.requireCapability).toHaveBeenCalledWith('c1', 'feature.staffApp');
});

// ── 2. SUPER_ADMIN bypasses capability check ───────────────────────────────────

test('SUPER_ADMIN bypasses capability guard even when decorator is present', async () => {
  const { reflector, ctx } = makeContext({ sub: 'sa1', role: 'SUPER_ADMIN', companyId: null }, 'crm');
  const service = makeCapabilityService(false);
  const guard = new CapabilityGuard(reflector, service as never);
  const result = await guard.canActivate(ctx);
  expect(result).toBe(true);
  expect(service.requireCapability).not.toHaveBeenCalled();
});

// ── 3. Capability enabled → passes ───────────────────────────────────────────

test('capability enabled → canActivate returns true', async () => {
  const { reflector, ctx } = makeContext({ sub: 'u1', role: 'ADMIN', companyId: 'c-aaa' }, 'crm');
  const service = makeCapabilityService(true);
  const guard = new CapabilityGuard(reflector, service as never);
  const result = await guard.canActivate(ctx);
  expect(result).toBe(true);
  expect(service.requireCapability).toHaveBeenCalledWith('c-aaa', 'crm');
});

// ── 4. Capability missing → ForbiddenException ────────────────────────────────

test('capability disabled → throws ForbiddenException with code CAPABILITY_NOT_ENABLED', async () => {
  const { reflector, ctx } = makeContext({ sub: 'u1', role: 'SALES', companyId: 'c-aaa' }, 'broker');
  const service = {
    requireCapability: jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'CAPABILITY_NOT_ENABLED', capability: 'broker' }),
    ),
  };
  const guard = new CapabilityGuard(reflector, service as never);
  await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
});

// ── 5. No companyId for tenant user ───────────────────────────────────────────

test('non-SUPER_ADMIN without companyId → throws ForbiddenException', async () => {
  const { reflector, ctx } = makeContext({ sub: 'u1', role: 'ADMIN', companyId: null }, 'crm');
  const service = makeCapabilityService(false);
  const guard = new CapabilityGuard(reflector, service as never);
  await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  expect(service.requireCapability).not.toHaveBeenCalled();
});

// ── 6. Different companies are independent ────────────────────────────────────

test('Company A capability does not affect Company B (uses correct companyId)', async () => {
  const capService = { requireCapability: jest.fn().mockResolvedValue(undefined) };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue('crm') } as unknown as Reflector;
  const guard = new CapabilityGuard(reflector, capService as never);

  const makeCtx = (companyId: string) => ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1', role: 'ADMIN', companyId } }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

  await guard.canActivate(makeCtx('company-aaa'));
  await guard.canActivate(makeCtx('company-bbb'));

  // Phase 2: ADMIN triggers always-check (feature.staffApp) then decorator check (crm).
  // Calls per activation: (companyId, 'feature.staffApp') then (companyId, 'crm').
  const calls = (capService.requireCapability as jest.Mock).mock.calls;
  expect(calls.filter((c: string[]) => c[0] === 'company-aaa' && c[1] === 'feature.staffApp').length).toBe(1);
  expect(calls.filter((c: string[]) => c[0] === 'company-aaa' && c[1] === 'crm').length).toBe(1);
  expect(calls.filter((c: string[]) => c[0] === 'company-bbb' && c[1] === 'feature.staffApp').length).toBe(1);
  expect(calls.filter((c: string[]) => c[0] === 'company-bbb' && c[1] === 'crm').length).toBe(1);
  // No Company A call leaked into Company B's checks
  expect(calls.every((c: string[]) => ['company-aaa', 'company-bbb'].includes(c[0]!))).toBe(true);
});

// ── 7. Unauthenticated ────────────────────────────────────────────────────────

test('no user on request → canActivate returns true (public route, no checks)', async () => {
  // Phase 2: unauthenticated request is treated as a public route — guard passes.
  // The auth guard is responsible for rejecting unauthenticated calls to protected routes.
  const { reflector, ctx } = makeContext(null, 'crm');
  const service = makeCapabilityService();
  const guard = new CapabilityGuard(reflector, service as never);
  const result = await guard.canActivate(ctx);
  expect(result).toBe(true);
  expect(service.requireCapability).not.toHaveBeenCalled();
});

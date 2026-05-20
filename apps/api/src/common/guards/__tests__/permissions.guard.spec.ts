import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from '../permissions.guard';
import {
  PERMISSIONS_KEY,
  Permissions,
  PermissionsStrict,
  type PermissionsMeta,
} from '../../decorators/permissions.decorator';

interface MockReq {
  user?: { sub?: string; role?: UserRole };
  _userPermissions?: Set<string>;
}

function makeContext(req: MockReq): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: <T,>() => req as unknown as T,
      getResponse: <T,>() => ({}) as T,
      getNext: <T,>() => ({}) as T,
    }),
    getHandler: () => (() => undefined) as unknown as () => void,
    getClass: () => class {} as unknown as new () => unknown,
    getArgs: () => [] as never[],
    getArgByIndex: () => undefined as never,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeReflectorWithMeta(meta: PermissionsMeta | undefined) {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(meta),
  } as unknown as Reflector;
}

function makePrismaWithCodes(codes: string[], call: { count: number }) {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        call.count += 1;
        return codes.map((code) => ({ permission: { code } }));
      }),
    },
  } as never;
}

describe('PermissionsGuard', () => {
  it('returns true when no @Permissions metadata is set', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta(undefined),
      makePrismaWithCodes([], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 'u1', role: UserRole.SALES } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns true when codes array is empty', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: [], adminBypass: true }),
      makePrismaWithCodes([], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 'u1', role: UserRole.SALES } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('skips non-HTTP contexts', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['x:y'], adminBypass: true }),
      makePrismaWithCodes([], { count: 0 }),
    );
    const ctx = {
      ...makeContext({ user: { sub: 'u1', role: UserRole.SALES } }),
      getType: () => 'rpc',
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws structured 403 when the user is unauthenticated', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:read'], adminBypass: true }),
      makePrismaWithCodes([], { count: 0 }),
    );
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: {
        code: 'missing_permission',
        permissions: ['settings:read'],
      },
    });
  });

  it('ADMIN bypasses by default (no DB hit)', async () => {
    const call = { count: 0 };
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:read'], adminBypass: true }),
      makePrismaWithCodes(['something:else'], call),
    );
    const ctx = makeContext({ user: { sub: 'admin', role: UserRole.ADMIN } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(call.count).toBe(0);
  });

  it('@PermissionsStrict blocks ADMIN without the explicit code', async () => {
    const call = { count: 0 };
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['deposits:verify'], adminBypass: false }),
      makePrismaWithCodes(['settings:read'], call),
    );
    const ctx = makeContext({ user: { sub: 'admin', role: UserRole.ADMIN } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    expect(call.count).toBe(1);
  });

  it('@PermissionsStrict allows ADMIN when the code is granted', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['deposits:verify'], adminBypass: false }),
      makePrismaWithCodes(['deposits:verify'], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 'admin', role: UserRole.ADMIN } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('SALES without the code is rejected', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:write'], adminBypass: true }),
      makePrismaWithCodes(['settings:read'], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 's1', role: UserRole.SALES } });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: {
        code: 'missing_permission',
        permissions: ['settings:write'],
        message: 'Missing permission: settings:write',
      },
    });
  });

  it('SALES with the code is allowed', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:read'], adminBypass: true }),
      makePrismaWithCodes(['settings:read'], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 's1', role: UserRole.SALES } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('OR semantics — having any one of the listed codes is enough', async () => {
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:read', 'settings:write'], adminBypass: true }),
      makePrismaWithCodes(['settings:write'], { count: 0 }),
    );
    const ctx = makeContext({ user: { sub: 's1', role: UserRole.SALES } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('memoises the permission set per request (single DB call across two guard invocations)', async () => {
    const call = { count: 0 };
    const guard = new PermissionsGuard(
      makeReflectorWithMeta({ codes: ['settings:read'], adminBypass: true }),
      makePrismaWithCodes(['settings:read'], call),
    );
    const req: MockReq = { user: { sub: 's1', role: UserRole.SALES } };
    const ctx = makeContext(req);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    expect(call.count).toBe(1);
    expect(req._userPermissions).toBeInstanceOf(Set);
  });

  describe('decorator factories', () => {
    it('@Permissions sets adminBypass: true', () => {
      class T {}
      Permissions('a:b')(T);
      const meta = Reflect.getMetadata(PERMISSIONS_KEY, T) as PermissionsMeta;
      expect(meta).toEqual({ codes: ['a:b'], adminBypass: true });
    });

    it('@PermissionsStrict sets adminBypass: false', () => {
      class T {}
      PermissionsStrict('a:b', 'c:d')(T);
      const meta = Reflect.getMetadata(PERMISSIONS_KEY, T) as PermissionsMeta;
      expect(meta).toEqual({ codes: ['a:b', 'c:d'], adminBypass: false });
    });
  });
});

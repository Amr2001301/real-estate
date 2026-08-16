import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TenantContextInterceptor } from '../tenant-context.interceptor';
import { getTenantContext } from '../../tenant/tenant-context';
import { BYPASS_TENANT_KEY } from '../../decorators/bypass-tenant.decorator';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function makeReflector(bypassTenant: boolean, isPublic: boolean): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === BYPASS_TENANT_KEY) return bypassTenant;
      if (key === IS_PUBLIC_KEY) return isPublic;
      return undefined;
    }),
  } as unknown as Reflector;
}

function makeContext(user?: { companyId?: string | null; role?: string | null }): ExecutionContext {
  const req = { user };
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

/** Run the interceptor and return the ALS context that was active when next.handle() was called. */
async function runInterceptor(
  interceptor: TenantContextInterceptor,
  execCtx: ExecutionContext,
): Promise<ReturnType<typeof getTenantContext>> {
  let captured: ReturnType<typeof getTenantContext>;
  const callHandler = {
    handle: () => {
      captured = getTenantContext();
      return of(null);
    },
  };

  await new Promise<void>((resolve, reject) => {
    interceptor.intercept(execCtx, callHandler).subscribe({
      complete: resolve,
      error: reject,
    });
  });

  return captured!;
}

// ---------------------------------------------------------------------------
// @BypassTenant() path
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — @BypassTenant()', () => {
  it('sets bypass=true with null companyId', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(true, false));
    const ctx = await runInterceptor(interceptor, makeContext());
    expect(ctx).toEqual({ companyId: null, bypass: true, isPublic: false });
  });
});

// ---------------------------------------------------------------------------
// @Public() path
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — @Public()', () => {
  const COMPANY_ID = 'default-company-uuid';

  beforeEach(() => {
    process.env.DEFAULT_COMPANY_ID = COMPANY_ID;
  });

  afterEach(() => {
    delete process.env.DEFAULT_COMPANY_ID;
  });

  it('sets isPublic=true with DEFAULT_COMPANY_ID when env var is present', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, true));
    const ctx = await runInterceptor(interceptor, makeContext());
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: true });
  });

  it('throws ServiceUnavailableException when DEFAULT_COMPANY_ID is missing', () => {
    delete process.env.DEFAULT_COMPANY_ID;
    const interceptor = new TenantContextInterceptor(makeReflector(false, true));
    expect(() => interceptor.intercept(makeContext(), { handle: () => of(null) })).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when DEFAULT_COMPANY_ID is empty string', () => {
    process.env.DEFAULT_COMPANY_ID = '';
    const interceptor = new TenantContextInterceptor(makeReflector(false, true));
    expect(() => interceptor.intercept(makeContext(), { handle: () => of(null) })).toThrow(
      ServiceUnavailableException,
    );
  });
});

// ---------------------------------------------------------------------------
// Authenticated path
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — authenticated', () => {
  const COMPANY_ID = 'auth-company-uuid';

  it('sets companyId from req.user.companyId for normal staff user', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false));
    const ctx = await runInterceptor(interceptor, makeContext({ companyId: COMPANY_ID, role: 'ADMIN' }));
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: false });
  });

  it('throws UnauthorizedException for staff user with null companyId', () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false));
    expect(() =>
      interceptor.intercept(makeContext({ companyId: null, role: 'ADMIN' }), { handle: () => of(null) }),
    ).toThrow(UnauthorizedException);
  });

  it('falls back to DEFAULT_COMPANY_ID for CLIENT with null companyId', async () => {
    const fallback = 'fallback-company-uuid';
    process.env.DEFAULT_COMPANY_ID = fallback;
    try {
      const interceptor = new TenantContextInterceptor(makeReflector(false, false));
      const ctx = await runInterceptor(interceptor, makeContext({ companyId: null, role: 'CLIENT' }));
      expect(ctx).toEqual({ companyId: fallback, bypass: false, isPublic: false });
    } finally {
      delete process.env.DEFAULT_COMPANY_ID;
    }
  });

  it('falls back to DEFAULT_COMPANY_ID for CUSTOMER with null companyId', async () => {
    const fallback = 'fallback-company-uuid';
    process.env.DEFAULT_COMPANY_ID = fallback;
    try {
      const interceptor = new TenantContextInterceptor(makeReflector(false, false));
      const ctx = await runInterceptor(interceptor, makeContext({ companyId: null, role: 'CUSTOMER' }));
      expect(ctx).toEqual({ companyId: fallback, bypass: false, isPublic: false });
    } finally {
      delete process.env.DEFAULT_COMPANY_ID;
    }
  });

  it('throws UnauthorizedException for CLIENT/CUSTOMER when DEFAULT_COMPANY_ID is also missing', () => {
    delete process.env.DEFAULT_COMPANY_ID;
    const interceptor = new TenantContextInterceptor(makeReflector(false, false));
    expect(() =>
      interceptor.intercept(makeContext({ companyId: null, role: 'CLIENT' }), { handle: () => of(null) }),
    ).toThrow(UnauthorizedException);
  });

  it('uses req.user.companyId even for CLIENT role when set', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false));
    const ctx = await runInterceptor(interceptor, makeContext({ companyId: COMPANY_ID, role: 'CLIENT' }));
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: false });
  });
});

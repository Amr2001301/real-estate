import { ExecutionContext, ForbiddenException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TenantContextInterceptor } from '../tenant-context.interceptor';
import { getTenantContext } from '../../tenant/tenant-context';
import { BYPASS_TENANT_KEY } from '../../decorators/bypass-tenant.decorator';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { IS_PLATFORM_PUBLIC_KEY } from '../../decorators/platform-public.decorator';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function makeReflector(bypassTenant: boolean, isPublic: boolean, isPlatformPublic = false): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === BYPASS_TENANT_KEY) return bypassTenant;
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === IS_PLATFORM_PUBLIC_KEY) return isPlatformPublic;
      return undefined;
    }),
  } as unknown as Reflector;
}

function makeTenantResolver(
  result: { companyId: string; slug: string; country: string; isActive: boolean; lifecycleStatus: string } | null = null,
) {
  return {
    tryResolveBySlug: jest.fn().mockResolvedValue(result),
    resolveBySlug: jest.fn().mockResolvedValue(result),
  };
}

function makeContext(
  user?: { companyId?: string | null; role?: string | null },
  headers: Record<string, string> = {},
): ExecutionContext {
  const req = { user, headers };
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

/** Run the interceptor and return the ALS context captured when next.handle() is called. */
async function runInterceptor(
  interceptor: TenantContextInterceptor,
  execCtx: ExecutionContext,
): Promise<NonNullable<ReturnType<typeof getTenantContext>>> {
  let captured: ReturnType<typeof getTenantContext> | undefined;
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

  if (!captured) throw new Error('TenantContext was never set');
  return captured;
}

// ---------------------------------------------------------------------------
// @BypassTenant() path
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — @BypassTenant()', () => {
  it('sets bypass=true with null companyId', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(true, false), makeTenantResolver() as never);
    const ctx = await runInterceptor(interceptor, makeContext());
    expect(ctx).toEqual({ companyId: null, bypass: true, isPublic: false });
  });
});

// ---------------------------------------------------------------------------
// @PlatformPublic() path — MT-024
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — @PlatformPublic()', () => {
  it('sets isPlatformPublic=true, bypass=false, companyId=null', async () => {
    const interceptor = new TenantContextInterceptor(
      makeReflector(false, false, true),
      makeTenantResolver() as never,
    );
    const ctx = await runInterceptor(interceptor, makeContext());
    expect(ctx).toEqual({ companyId: null, bypass: false, isPublic: false, isPlatformPublic: true });
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
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), makeTenantResolver() as never);
    const ctx = await runInterceptor(interceptor, makeContext());
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: true });
  });

  it('throws ServiceUnavailableException when DEFAULT_COMPANY_ID is missing', async () => {
    delete process.env.DEFAULT_COMPANY_ID;
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), makeTenantResolver() as never);
    await expect(runInterceptor(interceptor, makeContext())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when DEFAULT_COMPANY_ID is empty string', async () => {
    process.env.DEFAULT_COMPANY_ID = '';
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), makeTenantResolver() as never);
    await expect(runInterceptor(interceptor, makeContext())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

// ---------------------------------------------------------------------------
// MT-053 — @Public() + X-Tenant-Slug header (host-based tenant routing)
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — MT-053 @Public() + X-Tenant-Slug', () => {
  const RESOLVED_COMPANY = 'resolved-company-uuid';

  afterEach(() => {
    delete process.env.DEFAULT_COMPANY_ID;
  });

  it('uses resolved companyId when X-Tenant-Slug is present and tenant is ACTIVE', async () => {
    const resolver = makeTenantResolver({
      companyId: RESOLVED_COMPANY,
      slug: 'acme',
      country: 'SA',
      isActive: true,
      lifecycleStatus: 'ACTIVE',
    });
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), resolver as never);
    const ctx = await runInterceptor(
      interceptor,
      makeContext(undefined, { 'x-tenant-slug': 'acme' }),
    );
    expect(ctx).toEqual({ companyId: RESOLVED_COMPANY, bypass: false, isPublic: true });
    expect(resolver.tryResolveBySlug).toHaveBeenCalledWith('acme');
  });

  it('throws NotFoundException when X-Tenant-Slug resolves to unknown slug', async () => {
    const resolver = makeTenantResolver(null);
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), resolver as never);
    await expect(
      runInterceptor(interceptor, makeContext(undefined, { 'x-tenant-slug': 'no-such-tenant' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when X-Tenant-Slug resolves to SUSPENDED tenant', async () => {
    const resolver = makeTenantResolver({
      companyId: RESOLVED_COMPANY,
      slug: 'acme',
      country: 'SA',
      isActive: true,
      lifecycleStatus: 'SUSPENDED',
    });
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), resolver as never);
    await expect(
      runInterceptor(interceptor, makeContext(undefined, { 'x-tenant-slug': 'acme' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when X-Tenant-Slug resolves to ARCHIVED tenant', async () => {
    const resolver = makeTenantResolver({
      companyId: RESOLVED_COMPANY,
      slug: 'acme',
      country: 'SA',
      isActive: true,
      lifecycleStatus: 'ARCHIVED',
    });
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), resolver as never);
    await expect(
      runInterceptor(interceptor, makeContext(undefined, { 'x-tenant-slug': 'acme' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('falls back to DEFAULT_COMPANY_ID when X-Tenant-Slug header is absent', async () => {
    process.env.DEFAULT_COMPANY_ID = 'default-uuid';
    const resolver = makeTenantResolver();
    const interceptor = new TenantContextInterceptor(makeReflector(false, true), resolver as never);
    const ctx = await runInterceptor(interceptor, makeContext()); // no slug header
    expect(ctx).toEqual({ companyId: 'default-uuid', bypass: false, isPublic: true });
    expect(resolver.tryResolveBySlug).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MT-058 — @PlatformPublic() fail-closed invariant
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — MT-058 @PlatformPublic() fail-closed', () => {
  it('sets bypass=false so TENANT_OWNED Prisma middleware throws MissingTenantContextError', async () => {
    const interceptor = new TenantContextInterceptor(
      makeReflector(false, false, true),
      makeTenantResolver() as never,
    );
    const ctx = await runInterceptor(interceptor, makeContext());
    // bypass=false is the contract: Prisma middleware sees companyId=null + bypass=false
    // and throws MissingTenantContextError, preventing any TENANT_OWNED query from leaking
    // data from DEFAULT_COMPANY_ID or any other tenant.
    expect(ctx.bypass).toBe(false);
    expect(ctx.companyId).toBeNull();
    expect(ctx).toMatchObject({ isPlatformPublic: true });
  });
});

// ---------------------------------------------------------------------------
// Authenticated path
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — authenticated', () => {
  const COMPANY_ID = 'auth-company-uuid';

  it('sets companyId from req.user.companyId for normal staff user', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    const ctx = await runInterceptor(interceptor, makeContext({ companyId: COMPANY_ID, role: 'ADMIN' }));
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: false });
  });

  it('throws UnauthorizedException for staff user with null companyId', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    await expect(
      runInterceptor(interceptor, makeContext({ companyId: null, role: 'ADMIN' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falls back to DEFAULT_COMPANY_ID for CLIENT with null companyId', async () => {
    const fallback = 'fallback-company-uuid';
    process.env.DEFAULT_COMPANY_ID = fallback;
    try {
      const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
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
      const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
      const ctx = await runInterceptor(interceptor, makeContext({ companyId: null, role: 'CUSTOMER' }));
      expect(ctx).toEqual({ companyId: fallback, bypass: false, isPublic: false });
    } finally {
      delete process.env.DEFAULT_COMPANY_ID;
    }
  });

  it('throws UnauthorizedException for CLIENT/CUSTOMER when DEFAULT_COMPANY_ID is also missing', async () => {
    delete process.env.DEFAULT_COMPANY_ID;
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    await expect(
      runInterceptor(interceptor, makeContext({ companyId: null, role: 'CLIENT' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses req.user.companyId even for CLIENT role when set', async () => {
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    const ctx = await runInterceptor(interceptor, makeContext({ companyId: COMPANY_ID, role: 'CLIENT' }));
    expect(ctx).toEqual({ companyId: COMPANY_ID, bypass: false, isPublic: false });
  });
});

// ---------------------------------------------------------------------------
// MT-031 — X-Tenant-Slug mismatch checks
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — MT-031 X-Tenant-Slug mismatch', () => {
  const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000001';
  const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000001';

  it('allows user A + slug A (matching)', async () => {
    const resolver = makeTenantResolver({ companyId: COMPANY_A, slug: 'acme', country: 'SA', isActive: true, lifecycleStatus: 'ACTIVE' });
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), resolver as never);
    const ctx = await runInterceptor(
      interceptor,
      makeContext({ companyId: COMPANY_A, role: 'ADMIN' }, { 'x-tenant-slug': 'acme' }),
    );
    expect(ctx.companyId).toBe(COMPANY_A);
  });

  it('rejects user A + slug B (mismatch) with 403 and TENANT_CONTEXT_MISMATCH code', async () => {
    const resolver = makeTenantResolver({ companyId: COMPANY_B, slug: 'other', country: 'SA', isActive: true, lifecycleStatus: 'ACTIVE' });
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), resolver as never);
    await expect(
      runInterceptor(
        interceptor,
        makeContext({ companyId: COMPANY_A, role: 'ADMIN' }, { 'x-tenant-slug': 'other' }),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'TENANT_CONTEXT_MISMATCH' }) });
  });

  it('rejects unknown slug on authenticated request with 403', async () => {
    const resolver = makeTenantResolver(null); // unknown slug
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), resolver as never);
    await expect(
      runInterceptor(
        interceptor,
        makeContext({ companyId: COMPANY_A, role: 'ADMIN' }, { 'x-tenant-slug': 'does-not-exist' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SUPER_ADMIN is exempt from mismatch check — receives bypass=true', async () => {
    const resolver = makeTenantResolver({ companyId: COMPANY_B, slug: 'other', country: 'SA', isActive: true, lifecycleStatus: 'ACTIVE' });
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), resolver as never);
    const ctx = await runInterceptor(
      interceptor,
      makeContext({ companyId: null, role: 'SUPER_ADMIN' }, { 'x-tenant-slug': 'other' }),
    );
    expect(ctx).toEqual({ companyId: null, bypass: true, isPublic: false });
    // SUPER_ADMIN never calls tryResolveBySlug
    expect(resolver.tryResolveBySlug).not.toHaveBeenCalled();
  });

  it('no X-Tenant-Slug header — uses req.user.companyId directly', async () => {
    const resolver = makeTenantResolver();
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), resolver as never);
    const ctx = await runInterceptor(
      interceptor,
      makeContext({ companyId: COMPANY_A, role: 'ADMIN' }), // no slug header
    );
    expect(ctx.companyId).toBe(COMPANY_A);
    expect(resolver.tryResolveBySlug).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MT-032 — DISABLE_DEFAULT_COMPANY_FALLBACK
// ---------------------------------------------------------------------------

describe('TenantContextInterceptor — MT-032 DISABLE_DEFAULT_COMPANY_FALLBACK', () => {
  afterEach(() => {
    delete process.env.DISABLE_DEFAULT_COMPANY_FALLBACK;
    delete process.env.DEFAULT_COMPANY_ID;
  });

  it('CLIENT with null companyId falls back when flag is false (default)', async () => {
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
    process.env.DEFAULT_COMPANY_ID = 'fallback-id';
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    const ctx = await runInterceptor(interceptor, makeContext({ companyId: null, role: 'CLIENT' }));
    expect(ctx.companyId).toBe('fallback-id');
  });

  it('CLIENT with null companyId is rejected when flag is true', async () => {
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'true';
    process.env.DEFAULT_COMPANY_ID = 'fallback-id';
    const interceptor = new TenantContextInterceptor(makeReflector(false, false), makeTenantResolver() as never);
    await expect(
      runInterceptor(interceptor, makeContext({ companyId: null, role: 'CLIENT' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

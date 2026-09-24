/**
 * MT-055 — PublicBrandingController unit tests.
 *
 * Coverage:
 *   §C1  neither param → 400 LOOKUP_PARAM_REQUIRED
 *   §C2  both params   → 400 LOOKUP_PARAM_AMBIGUOUS
 *   §C3  slug only, unknown → 404 COMPANY_NOT_FOUND
 *   §C4  slug only, found   → returns branding
 *   §C5  hostname only, unknown → 404 COMPANY_NOT_FOUND
 *   §C6  hostname only, found   → returns branding
 *   §C7  company with zero branding → response has only slug + name
 *   §C8  invalid hostname → 400 HOSTNAME_INVALID
 *   §C9  whitespace-only slug → treated as missing → 400
 *   §C10 whitespace-only hostname → treated as missing → 400
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicBrandingController } from '../public-branding.controller';
import { InvalidHostnameError } from '../../../common/utils/hostname-normalize';
import type { CompanyBrandingResponse } from '../company-branding.service';

const FULL_BRANDING: CompanyBrandingResponse = {
  slug: 'acme',
  name: 'Acme Real Estate',
  displayName: 'Acme',
  logoUrl: 'https://cdn.example.com/logo.png',
  primaryColor: '#1E3A5F',
  contactEmail: 'info@acme.sa',
};

const BARE_BRANDING: CompanyBrandingResponse = {
  slug: 'bare',
  name: 'Bare Corp',
};

function makeService(overrides: Partial<{
  getBySlug: jest.Mock;
  getByHostname: jest.Mock;
}> = {}) {
  return {
    getBySlug: jest.fn().mockResolvedValue(null),
    getByHostname: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeController(service = makeService()) {
  return new PublicBrandingController(service as never);
}

// ── parameter validation ──────────────────────────────────────────────────────

describe('PublicBrandingController — parameter validation', () => {
  test('§C1 — neither param → 400 LOOKUP_PARAM_REQUIRED', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding(undefined, undefined).catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('LOOKUP_PARAM_REQUIRED');
  });

  test('§C2 — both params → 400 LOOKUP_PARAM_AMBIGUOUS', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding('acme', 'acme.devora.com').catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('LOOKUP_PARAM_AMBIGUOUS');
  });

  test('§C9 — whitespace-only slug treated as missing → 400 LOOKUP_PARAM_REQUIRED', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding('   ', undefined).catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('LOOKUP_PARAM_REQUIRED');
  });

  test('§C10 — whitespace-only hostname treated as missing → 400 LOOKUP_PARAM_REQUIRED', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding(undefined, '   ').catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('LOOKUP_PARAM_REQUIRED');
  });
});

// ── slug lookup ───────────────────────────────────────────────────────────────

describe('PublicBrandingController — slug lookup', () => {
  test('§C3 — service returns null → 404 COMPANY_NOT_FOUND', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding('unknown', undefined).catch((e: unknown) => e) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);
    expect((err.getResponse() as { code: string }).code).toBe('COMPANY_NOT_FOUND');
  });

  test('§C4 — service returns branding → response passed through', async () => {
    const ctrl = makeController(makeService({ getBySlug: jest.fn().mockResolvedValue(FULL_BRANDING) }));
    const result = await ctrl.getBranding('acme', undefined);
    expect(result).toEqual(FULL_BRANDING);
  });

  test('§C4 — delegates to getBySlug with the provided slug', async () => {
    const getBySlug = jest.fn().mockResolvedValue(FULL_BRANDING);
    const ctrl = makeController(makeService({ getBySlug }));
    await ctrl.getBranding('acme', undefined);
    expect(getBySlug).toHaveBeenCalledWith('acme');
  });

  test('§C7 — company with zero branding returns only slug + name', async () => {
    const ctrl = makeController(makeService({ getBySlug: jest.fn().mockResolvedValue(BARE_BRANDING) }));
    const result = await ctrl.getBranding('bare', undefined);
    expect(result).toEqual({ slug: 'bare', name: 'Bare Corp' });
    expect(result).not.toHaveProperty('logoUrl');
    expect(result).not.toHaveProperty('primaryColor');
    expect(result).not.toHaveProperty('contactEmail');
  });
});

// ── hostname lookup ───────────────────────────────────────────────────────────

describe('PublicBrandingController — hostname lookup', () => {
  test('§C5 — service returns null → 404 COMPANY_NOT_FOUND', async () => {
    const ctrl = makeController();
    const err = await ctrl.getBranding(undefined, 'unknown.example.com').catch((e: unknown) => e) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);
    expect((err.getResponse() as { code: string }).code).toBe('COMPANY_NOT_FOUND');
  });

  test('§C6 — service returns branding → response passed through', async () => {
    const ctrl = makeController(makeService({ getByHostname: jest.fn().mockResolvedValue(FULL_BRANDING) }));
    const result = await ctrl.getBranding(undefined, 'acme.devora.com');
    expect(result).toEqual(FULL_BRANDING);
  });

  test('§C6 — delegates to getByHostname with the provided hostname', async () => {
    const getByHostname = jest.fn().mockResolvedValue(FULL_BRANDING);
    const ctrl = makeController(makeService({ getByHostname }));
    await ctrl.getBranding(undefined, 'acme.devora.com');
    expect(getByHostname).toHaveBeenCalledWith('acme.devora.com');
  });

  test('§C8 — service throws InvalidHostnameError → 400 HOSTNAME_INVALID', async () => {
    const ctrl = makeController(makeService({
      getByHostname: jest.fn().mockRejectedValue(new InvalidHostnameError('bad hostname')),
    }));
    const err = await ctrl.getBranding(undefined, 'not a valid hostname!!').catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('HOSTNAME_INVALID');
  });
});

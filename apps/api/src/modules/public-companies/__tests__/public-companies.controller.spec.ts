/**
 * MT-056 / MT-057 — PublicCompaniesController unit tests.
 *
 * Tests:
 *   - search: query length validation, empty result, results returned
 *   - resolve: missing slug, not found, eligible slug found
 *   - No companyId in any response
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicCompaniesController } from '../public-companies.controller';
import type { DiscoveredCompany } from '../public-companies.service';

function makeService(overrides: Partial<{ search: jest.Mock; resolveBySlug: jest.Mock }> = {}) {
  return {
    search: jest.fn().mockResolvedValue([]),
    resolveBySlug: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeController(service = makeService()) {
  return new PublicCompaniesController(service as never);
}

// ── search ────────────────────────────────────────────────────────────────────

describe('PublicCompaniesController.search', () => {
  test('throws BadRequestException when q is missing', async () => {
    const ctrl = makeController();
    await expect(ctrl.search(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  test('throws BadRequestException with QUERY_TOO_SHORT when q is too short (< 2 chars)', async () => {
    const ctrl = makeController();
    const err = await ctrl.search('a').catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('QUERY_TOO_SHORT');
  });

  test('throws BadRequestException with QUERY_TOO_LONG when q exceeds 100 chars', async () => {
    const ctrl = makeController();
    const longQ = 'a'.repeat(101);
    const err = await ctrl.search(longQ).catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('QUERY_TOO_LONG');
  });

  test('returns empty array when no eligible companies match', async () => {
    const ctrl = makeController(makeService({ search: jest.fn().mockResolvedValue([]) }));
    const result = await ctrl.search('xyz');
    expect(result).toEqual([]);
  });

  test('returns matching companies with slug and name only', async () => {
    const companies: DiscoveredCompany[] = [
      { slug: 'acme', name: 'Acme Developer' },
      { slug: 'beta', name: 'Beta Corp' },
    ];
    const ctrl = makeController(makeService({ search: jest.fn().mockResolvedValue(companies) }));

    const result = await ctrl.search('corp');

    expect(result).toEqual(companies);
    result.forEach((r: DiscoveredCompany) => {
      expect(r).not.toHaveProperty('id');
      expect(r).not.toHaveProperty('companyId');
    });
  });

  test('delegates to service with the provided query', async () => {
    const searchMock = jest.fn().mockResolvedValue([]);
    const ctrl = makeController(makeService({ search: searchMock }));

    await ctrl.search('devora');

    expect(searchMock).toHaveBeenCalledWith('devora');
  });
});

// ── resolve ───────────────────────────────────────────────────────────────────

describe('PublicCompaniesController.resolve', () => {
  test('throws BadRequestException with SLUG_REQUIRED when slug is missing', async () => {
    const ctrl = makeController();
    const err = await ctrl.resolve(undefined).catch((e: unknown) => e) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { code: string }).code).toBe('SLUG_REQUIRED');
  });

  test('throws BadRequestException when slug is empty string', async () => {
    const ctrl = makeController();
    await expect(ctrl.resolve('   ')).rejects.toBeInstanceOf(BadRequestException);
  });

  test('throws NotFoundException with COMPANY_NOT_AVAILABLE when service returns null', async () => {
    const ctrl = makeController(makeService({ resolveBySlug: jest.fn().mockResolvedValue(null) }));

    const err = await ctrl.resolve('unknown').catch((e: unknown) => e) as NotFoundException;

    expect(err).toBeInstanceOf(NotFoundException);
    expect((err.getResponse() as { code: string }).code).toBe('COMPANY_NOT_AVAILABLE');
  });

  test('returns { slug, name } when company is eligible', async () => {
    const company: DiscoveredCompany = { slug: 'acme', name: 'Acme Developer' };
    const ctrl = makeController(makeService({ resolveBySlug: jest.fn().mockResolvedValue(company) }));

    const result = await ctrl.resolve('acme');

    expect(result).toEqual({ slug: 'acme', name: 'Acme Developer' });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('companyId');
  });

  test('delegates to service with the provided slug', async () => {
    const resolveMock = jest.fn().mockResolvedValue(null);
    const ctrl = makeController(makeService({ resolveBySlug: resolveMock }));

    await ctrl.resolve('my-company').catch(() => {});

    expect(resolveMock).toHaveBeenCalledWith('my-company');
  });
});

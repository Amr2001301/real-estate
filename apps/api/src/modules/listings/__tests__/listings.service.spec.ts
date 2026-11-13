/**
 * BRK-2 — ListingsService: codes per company, the unit type resolved from the
 * company's types, rent without a down payment, the agent from the company.
 */
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListingKind, UnitUsage } from '@prisma/client';
import { ListingsService } from '../listings.service';
import { CreateListingDto } from '../dto/listing.dto';
import { findTenantUser } from '../../../common/tenant/resolve-tenant-entity';

jest.mock('../../../common/tenant/resolve-tenant-entity', () => ({ findTenantUser: jest.fn() }));

function make(existingCodes: string[] = []) {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    listing: {
      findMany: jest.fn().mockResolvedValue(existingCodes.map((code) => ({ code }))),
      create: jest.fn().mockImplementation(({ data }) => {
        created.push(data);
        return Promise.resolve({ id: 'l1', ...data });
      }),
    },
  };
  const unitTypes = {
    resolveActive: jest.fn().mockResolvedValue({ code: 'APARTMENT', usage: UnitUsage.RESIDENTIAL, active: true }),
  };
  const r2 = { createPresignedUpload: jest.fn().mockResolvedValue({ uploadUrl: 'u', key: 'k', publicUrl: 'p' }) };
  const svc = new ListingsService(prisma as never, unitTypes as never, r2 as never);
  return { svc, prisma, unitTypes, r2, created };
}

const base: CreateListingDto = {
  kind: ListingKind.RESALE,
  title: 'شقة 3 غرف بالتجمع',
  unitType: 'شقة',
  city: 'القاهرة الجديدة',
  area: 165,
  price: 4_500_000,
};

describe('ListingsService (BRK-2)', () => {
  it('files the listing under the company type it resolved, with the next code', async () => {
    const { svc, created, unitTypes } = make(['L-0001', 'L-0007', 'X-99']);
    await svc.create({ ...base, district: '  ', ownerPhone: '01001234567' }, 'u1');
    expect(unitTypes.resolveActive).toHaveBeenCalledWith('شقة');
    expect(created[0]).toMatchObject({ code: 'L-0008', unitType: 'APARTMENT', usage: UnitUsage.RESIDENTIAL, district: null, createdById: 'u1' });
  });

  it('starts at L-0001 for a company without listings', async () => {
    const { svc, created } = make();
    await svc.create(base, 'u1');
    expect(created[0]!.code).toBe('L-0001');
  });

  it('refuses a down payment on a rent, and one above the price', async () => {
    const { svc } = make();
    await expect(svc.create({ ...base, kind: ListingKind.RENT, price: 25_000, downPayment: 50_000 }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ ...base, downPayment: 5_000_000 }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an agent who is not on the company staff, or not on its sales side', async () => {
    const { svc, created } = make();
    const agentId = '00000000-0000-0000-0000-000000000009';
    (findTenantUser as jest.Mock).mockResolvedValueOnce(null);
    await expect(svc.create({ ...base, agentId }, 'u1')).rejects.toThrow('الموظف المسؤول غير موجود');
    (findTenantUser as jest.Mock).mockResolvedValueOnce({ id: agentId, role: 'CLIENT' });
    await expect(svc.create({ ...base, agentId }, 'u1')).rejects.toThrow('الموظف المسؤول غير موجود');
    (findTenantUser as jest.Mock).mockResolvedValueOnce({ id: agentId, role: 'SALES' });
    await svc.create({ ...base, agentId }, 'u1');
    expect(created[0]).toMatchObject({ agentId });
  });

  it('signs photo uploads into the public listings folder, images only up to 10 MB', async () => {
    const { svc, r2 } = make();
    await svc.presignPhoto({ contentType: 'image/webp', sizeBytes: 1024 });
    expect(r2.createPresignedUpload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'listings' }));
    expect(() => svc.presignPhoto({ contentType: 'image/png', sizeBytes: 11 * 1024 * 1024 })).toThrow(BadRequestException);
  });
});

describe('CreateListingDto', () => {
  const errors = (o: object) => validateSync(plainToInstance(CreateListingDto, o)).map((e) => e.property);

  it('requires the developer on a primary sale only', () => {
    expect(errors({ ...base, kind: 'PRIMARY' })).toContain('developerName');
    expect(errors({ ...base, kind: 'PRIMARY', developerName: 'ماونتن فيو' })).toEqual([]);
    expect(errors(base)).toEqual([]);
  });

  it('takes photos as http(s) URLs only', () => {
    expect(errors({ ...base, photos: ['javascript:alert(1)'] })).toContain('photos');
    expect(errors({ ...base, photos: ['https://cdn.example.com/listings/a.webp'] })).toEqual([]);
  });
});

/**
 * P4 — PrintSettingsService: the company's paper, signature and stamp, and
 * the wording of its documents. Every query names the company; the images
 * are checked to be small real PNG/JPEG files; one default wording per kind.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { runTenantContext } from '../../../common/tenant/tenant-context';
import { PRINT_ASSET_MAX_BYTES, PrintSettingsService } from '../print-settings.service';

const COMPANY = 'company-a';

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function makePrisma(row: Record<string, unknown> | null = null) {
  const tx = {
    documentTemplate: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't-new', ...data })),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  return {
    tx,
    printSettings: {
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ps-1', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ps-1', ...(row ?? {}), ...data })),
    },
    documentTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
}

const inCompany = <T>(fn: () => Promise<T>) =>
  runTenantContext({ companyId: COMPANY, bypass: false, isPublic: false }, fn);

function service(prisma: ReturnType<typeof makePrisma>) {
  return new PrintSettingsService(prisma as never);
}

describe('PrintSettingsService — settings', () => {
  it('reads the platform defaults when the company saved none, scoped to the company', async () => {
    const prisma = makePrisma(null);
    const s = await inCompany(() => service(prisma).get());
    expect(prisma.printSettings.findFirst).toHaveBeenCalledWith({ where: { companyId: COMPANY } });
    expect(s).toMatchObject({ letterheadMode: 'BUILT_IN', marginTopMm: 14, signature: null, stamp: null, sealDocuments: [] });
  });

  it('creates the row on the first save, with the company', async () => {
    const prisma = makePrisma(null);
    await inCompany(() => service(prisma).update({ marginSideMm: 20, sealDocuments: ['CONTRACT'] }));
    expect(prisma.printSettings.create).toHaveBeenCalledWith({
      data: { marginSideMm: 20, sealDocuments: ['CONTRACT'], companyId: COMPANY },
    });
  });

  it('refuses a letterhead mode without its paper', async () => {
    const prisma = makePrisma(null);
    await expect(inCompany(() => service(prisma).update({ letterheadMode: 'HEADER_FOOTER' }))).rejects.toThrow(BadRequestException);
    await expect(inCompany(() => service(prisma).update({ letterheadMode: 'FULL_PAGE', headerImageUrl: 'https://cdn/x.png' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.printSettings.create).not.toHaveBeenCalled();
  });

  it('accepts a mode whose paper was saved before', async () => {
    const prisma = makePrisma({ id: 'ps-1', companyId: COMPANY, pageImageUrl: 'https://cdn/page.png' });
    const s = await inCompany(() => service(prisma).update({ letterheadMode: 'FULL_PAGE' }));
    expect(prisma.printSettings.update).toHaveBeenCalledWith({ where: { id: 'ps-1' }, data: { letterheadMode: 'FULL_PAGE' } });
    expect(s.letterheadMode).toBe('FULL_PAGE');
  });
});

describe('PrintSettingsService — signature and stamp', () => {
  it('stores a PNG and returns it as a data URI', async () => {
    const prisma = makePrisma(null);
    const s = await inCompany(() => service(prisma).setAsset('stamp', { buffer: PNG, size: PNG.length }));
    expect(prisma.printSettings.create).toHaveBeenCalledWith({
      data: { stampImage: PNG, stampType: 'image/png', companyId: COMPANY },
    });
    expect(s.stamp).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
    expect(s.signature).toBeNull();
  });

  it('refuses a file that is not a PNG or JPEG (whatever its name says)', async () => {
    const prisma = makePrisma(null);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(inCompany(() => service(prisma).setAsset('signature', { buffer: svg, size: svg.length }))).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.printSettings.create).not.toHaveBeenCalled();
  });

  it('refuses an empty or oversized file', async () => {
    const prisma = makePrisma(null);
    await expect(inCompany(() => service(prisma).setAsset('signature', undefined))).rejects.toThrow(BadRequestException);
    const big = Buffer.concat([PNG, Buffer.alloc(PRINT_ASSET_MAX_BYTES)]);
    await expect(inCompany(() => service(prisma).setAsset('signature', { buffer: big, size: big.length }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('removes one image and keeps the other', async () => {
    const prisma = makePrisma({ id: 'ps-1', companyId: COMPANY, stampImage: PNG, stampType: 'image/png', signatureImage: PNG, signatureType: 'image/png' });
    const s = await inCompany(() => service(prisma).clearAsset('signature'));
    expect(prisma.printSettings.update).toHaveBeenCalledWith({ where: { id: 'ps-1' }, data: { signatureImage: null, signatureType: null } });
    expect(s.signature).toBeNull();
    expect(s.stamp).toContain('data:image/png;base64,');
  });
});

describe('PrintSettingsService — wording', () => {
  it('the first wording of its kind is the default; a booking wording is for any sale', async () => {
    const prisma = makePrisma();
    const t = await inCompany(() =>
      service(prisma).createTemplate({ documentType: 'RESERVATION', variant: 'CASH', name: 'Terms', body: 'x' }),
    );
    expect(prisma.tx.documentTemplate.count).toHaveBeenCalledWith({ where: { companyId: COMPANY, documentType: 'RESERVATION', variant: 'ANY' } });
    expect(t).toMatchObject({ companyId: COMPANY, variant: 'ANY', isDefault: true });
  });

  it('a new default takes over from the old one of the same kind', async () => {
    const prisma = makePrisma();
    prisma.tx.documentTemplate.count.mockResolvedValue(2);
    await inCompany(() =>
      service(prisma).createTemplate({ documentType: 'CONTRACT', variant: 'CASH', name: 'Cash', body: 'x', isDefault: true }),
    );
    expect(prisma.tx.documentTemplate.updateMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY, documentType: 'CONTRACT', variant: 'CASH' },
      data: { isDefault: false },
    });
  });

  it('is not the default when others of its kind exist and none was asked', async () => {
    const prisma = makePrisma();
    prisma.tx.documentTemplate.count.mockResolvedValue(1);
    const t = await inCompany(() => service(prisma).createTemplate({ documentType: 'CONTRACT', name: 'B', body: 'x' }));
    expect(t).toMatchObject({ isDefault: false, variant: 'ANY' });
    expect(prisma.tx.documentTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('another company’s wording is not found', async () => {
    const prisma = makePrisma();
    await expect(inCompany(() => service(prisma).updateTemplate('t-other', { name: 'x' }))).rejects.toThrow(NotFoundException);
    expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith({ where: { id: 't-other', companyId: COMPANY } });
    await expect(inCompany(() => service(prisma).deleteTemplate('t-other'))).rejects.toThrow(NotFoundException);
    expect(prisma.documentTemplate.deleteMany).not.toHaveBeenCalled();
  });

  it('moving a default to another sale type clears the other default there', async () => {
    const prisma = makePrisma();
    prisma.documentTemplate.findFirst.mockResolvedValue({
      id: 't-1', companyId: COMPANY, documentType: 'CONTRACT', variant: 'ANY', isDefault: true,
    });
    const t = await inCompany(() => service(prisma).updateTemplate('t-1', { variant: 'INSTALLMENT', isDefault: true }));
    expect(prisma.tx.documentTemplate.updateMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY, documentType: 'CONTRACT', variant: 'INSTALLMENT', id: { not: 't-1' } },
      data: { isDefault: false },
    });
    expect(t).toMatchObject({ variant: 'INSTALLMENT', isDefault: true });
  });

  it('lists only the company’s wordings', async () => {
    const prisma = makePrisma();
    await inCompany(() => service(prisma).listTemplates('CONTRACT'));
    expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY, documentType: 'CONTRACT' } }),
    );
  });
});

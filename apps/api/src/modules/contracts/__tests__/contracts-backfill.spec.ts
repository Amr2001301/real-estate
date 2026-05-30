import {
  ContractsService,
  deriveContractDocFileName,
  deriveContractDocMimeType,
} from '../contracts.module';

/**
 * P12 legacy backfill — unit coverage for ContractsService.backfillContractDocument
 * and its pure metadata helpers. The service method only touches `this.prisma`,
 * so we instantiate the service directly with a minimal prisma mock (the other
 * constructor deps are unused on this path).
 */

interface DocCreateArgs {
  data: {
    ownerType: string;
    ownerId: string;
    category: string;
    title: string;
    fileUrl: string;
    fileName: string;
    mimeType: string | null;
    visibility: string;
    uploadedById: string | null;
  };
}

function makeService(existingDoc: { id: string } | null) {
  const document = {
    findFirst: jest.fn().mockResolvedValue(existingDoc),
    create: jest.fn().mockImplementation(async ({ data }: DocCreateArgs) => ({ id: 'doc-new', ...data })),
  };
  const prisma = { document } as unknown as ConstructorParameters<typeof ContractsService>[0];
  const svc = new ContractsService(
    prisma,
    {} as never, // brokerCommissions — unused on this path
    {} as never, // bonus — unused
    {} as never, // documents — unused (we write prisma directly to bypass assertSafeUrl)
    {} as never, // notifications — unused (backfill never notifies)
  );
  return { svc, document };
}

describe('P12 backfill · deriveContractDocFileName', () => {
  it('extracts a sane filename from a presign-style key path', () => {
    expect(
      deriveContractDocFileName('http://localhost:9000/real-estate-media/documents/2026-05-30/abc-123.pdf', 'CT-1'),
    ).toBe('abc-123.pdf');
  });

  it('strips query/hash before taking the segment', () => {
    expect(
      deriveContractDocFileName('https://cdn.example.com/contracts/file.png?X-Amz-Signature=zzz', 'CT-2'),
    ).toBe('file.png');
  });

  it('falls back to a contractNumber-derived name when no usable extension', () => {
    expect(deriveContractDocFileName('https://cdn.example.com/contracts/no-extension-here', 'CT-3')).toBe(
      'contract-CT-3.pdf',
    );
  });

  it('falls back to a generic name when contractNumber is null', () => {
    expect(deriveContractDocFileName('https://cdn.example.com/contracts/', null)).toBe('contract.pdf');
  });
});

describe('P12 backfill · deriveContractDocMimeType', () => {
  it.each([
    ['x.pdf', 'application/pdf'],
    ['x.PDF', 'application/pdf'],
    ['x.jpg', 'image/jpeg'],
    ['x.jpeg', 'image/jpeg'],
    ['x.png', 'image/png'],
    ['x.webp', 'image/webp'],
  ])('maps %s → %s', (name, mime) => {
    expect(deriveContractDocMimeType(`https://cdn.example.com/${name}`)).toBe(mime);
  });

  it('returns undefined for unknown/extension-less URLs', () => {
    expect(deriveContractDocMimeType('https://cdn.example.com/file.bin')).toBeUndefined();
    expect(deriveContractDocMimeType('https://cdn.example.com/file')).toBeUndefined();
  });
});

describe('P12 backfill · ContractsService.backfillContractDocument', () => {
  const LEGACY = {
    id: 'c0000000-0000-4000-8000-000000000001',
    contractNumber: 'CT-LEGACY',
    pdfUrl: 'https://r2.example.com/contracts/legacy/old.pdf',
  };

  it('creates a CUSTOMER_VISIBLE CONTRACT document for a legacy contract (execute)', async () => {
    const { svc, document } = makeService(null);
    const result = await svc.backfillContractDocument(LEGACY, { dryRun: false });

    expect(result).toBe('created');
    expect(document.create).toHaveBeenCalledTimes(1);
    const args = document.create.mock.calls[0]![0] as DocCreateArgs;
    expect(args.data).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: LEGACY.id,
      category: 'CONTRACT',
      visibility: 'CUSTOMER_VISIBLE',
      fileUrl: LEGACY.pdfUrl,
      fileName: 'old.pdf',
      mimeType: 'application/pdf',
      uploadedById: null,
    });
    expect(args.data.title).toContain('CT-LEGACY');
  });

  it('is idempotent: skips when a CONTRACT document already exists (no write)', async () => {
    const { svc, document } = makeService({ id: 'existing-doc' });
    const result = await svc.backfillContractDocument(LEGACY, { dryRun: false });

    expect(result).toBe('exists');
    expect(document.create).not.toHaveBeenCalled();
  });

  it('dry-run reports would-create without writing', async () => {
    const { svc, document } = makeService(null);
    const result = await svc.backfillContractDocument(LEGACY, { dryRun: true });

    expect(result).toBe('would-create');
    expect(document.create).not.toHaveBeenCalled();
  });

  it('skips a contract with no/empty pdfUrl (never queries or writes)', async () => {
    const { svc, document } = makeService(null);
    expect(await svc.backfillContractDocument({ id: 'c1', contractNumber: 'CT', pdfUrl: null }, { dryRun: false })).toBe(
      'no-pdfurl',
    );
    expect(await svc.backfillContractDocument({ id: 'c1', contractNumber: 'CT', pdfUrl: '   ' }, { dryRun: false })).toBe(
      'no-pdfurl',
    );
    expect(document.findFirst).not.toHaveBeenCalled();
    expect(document.create).not.toHaveBeenCalled();
  });

  it('defaults to dry-run when opts are omitted (safety rail)', async () => {
    const { svc, document } = makeService(null);
    const result = await svc.backfillContractDocument(LEGACY);
    expect(result).toBe('would-create');
    expect(document.create).not.toHaveBeenCalled();
  });
});

import { NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentVisibility } from '@prisma/client';
import { OwnershipService } from '../ownership.service';

function makePrisma() {
  return {
    contract: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    contractAmendment: { findMany: jest.fn().mockResolvedValue([]) },
    deposit: { findFirst: jest.fn() },
    maintenanceRequest: { findFirst: jest.fn() },
    document: { findFirst: jest.fn() },
  };
}

describe('OwnershipService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: OwnershipService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new OwnershipService(prisma as never);
  });

  describe('assertContractOwner', () => {
    it('passes when the contract belongs to the user', async () => {
      prisma.contract.findMany.mockResolvedValue([{ id: 'c1' }]);
      await expect(svc.assertContractOwner('u1', 'c1')).resolves.toBeUndefined();
      expect(prisma.contract.findMany).toHaveBeenCalledWith({
        where: { customerId: 'u1', deletedAt: null },
        select: { id: true },
      });
    });

    it('throws NotFound on cross-account access', async () => {
      prisma.contract.findMany.mockResolvedValue([]);
      await expect(svc.assertContractOwner('u2', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getCustomerDocumentOrThrow', () => {
    it('returns the doc when CUSTOMER_VISIBLE and owned via its contract', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        ownerType: DocumentOwnerType.CONTRACT,
        ownerId: 'c1',
        fileUrl: 'https://cdn/x.pdf',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        createdAt: new Date('2026-01-01'),
      });
      prisma.contract.findMany.mockResolvedValue([{ id: 'c1' }]);

      const doc = await svc.getCustomerDocumentOrThrow('u1', 'd1');
      expect(doc.id).toBe('d1');
      // only CUSTOMER_VISIBLE docs are queryable
      expect(prisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: DocumentVisibility.CUSTOMER_VISIBLE,
            deletedAt: null,
          }),
        }),
      );
    });

    it('throws NotFound when the document is not customer-visible / missing', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(svc.getCustomerDocumentOrThrow('u1', 'd1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the owning contract belongs to someone else', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        ownerType: DocumentOwnerType.CONTRACT,
        ownerId: 'c1',
        fileUrl: 'https://cdn/x.pdf',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
      });
      prisma.contract.findMany.mockResolvedValue([]); // not owned
      await expect(svc.getCustomerDocumentOrThrow('intruder', 'd1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('denies owner types customers cannot reach (e.g. BROKER)', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        ownerType: DocumentOwnerType.BROKER,
        ownerId: 'b1',
        fileUrl: 'https://cdn/x.pdf',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
      });
      await expect(svc.getCustomerDocumentOrThrow('u1', 'd1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('contract documents after a transfer', () => {
    const transfer = { contractId: 'c1', fromCustomerId: 'old', toCustomerId: 'new', createdAt: new Date('2026-06-01') };
    const doc = (createdAt: string) => ({
      id: 'd1',
      ownerType: DocumentOwnerType.CONTRACT,
      ownerId: 'c1',
      fileUrl: 'https://cdn/x.pdf',
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      createdAt: new Date(createdAt),
    });

    it('the new owner gets documents uploaded from the transfer on, not the earlier ones', async () => {
      prisma.contract.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.contractAmendment.findMany.mockResolvedValue([transfer]);
      prisma.document.findFirst.mockResolvedValue(doc('2026-03-01'));
      await expect(svc.getCustomerDocumentOrThrow('new', 'd1')).rejects.toBeInstanceOf(NotFoundException);
      prisma.document.findFirst.mockResolvedValue(doc('2026-07-01'));
      await expect(svc.getCustomerDocumentOrThrow('new', 'd1')).resolves.toMatchObject({ id: 'd1' });
    });

    it('the previous owner keeps the documents uploaded before it', async () => {
      prisma.contract.findMany.mockImplementation(({ where }: { where: { id?: unknown } }) =>
        Promise.resolve(where.id ? [{ id: 'c1' }] : []),
      );
      prisma.contractAmendment.findMany.mockResolvedValue([transfer]);
      prisma.document.findFirst.mockResolvedValue(doc('2026-03-01'));
      await expect(svc.getCustomerDocumentOrThrow('old', 'd1')).resolves.toMatchObject({ id: 'd1' });
      prisma.document.findFirst.mockResolvedValue(doc('2026-07-01'));
      await expect(svc.getCustomerDocumentOrThrow('old', 'd1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

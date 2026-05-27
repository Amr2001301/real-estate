import { NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentVisibility } from '@prisma/client';
import { OwnershipService } from '../ownership.service';

function makePrisma() {
  return {
    contract: { findFirst: jest.fn() },
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
      prisma.contract.findFirst.mockResolvedValue({ id: 'c1' });
      await expect(svc.assertContractOwner('u1', 'c1')).resolves.toBeUndefined();
      expect(prisma.contract.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', customerId: 'u1' },
        select: { id: true },
      });
    });

    it('throws NotFound on cross-account access', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);
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
      });
      prisma.contract.findFirst.mockResolvedValue({ id: 'c1' });

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
      prisma.contract.findFirst.mockResolvedValue(null); // not owned
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
});

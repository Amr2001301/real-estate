import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomerDocument {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
}

/**
 * Centralized customer ownership policy. Each `assert*` throws
 * [NotFoundException] (never Forbidden — no existence leak) when the resource
 * isn't owned by the user. Use this on by-id / download routes instead of
 * relying on list-time filtering alone.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertContractOwner(userId: string, contractId: string): Promise<void> {
    const found = await this.prisma.contract.findFirst({
      where: { id: contractId, customerId: userId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Contract not found');
  }

  /**
   * The deposits (receipts, proofs) that are this customer's. A transfer
   * (تنازل) splits a contract's payments by who owned it when they were
   * made: the new owner sees payments from the transfer on, the previous
   * owner keeps the ones made before it. Following contract.customerId alone
   * showed the new owner the previous owner's receipts and cut the previous
   * owner off from their own.
   */
  async depositOwnershipWhere(userId: string): Promise<Prisma.DepositWhereInput> {
    const transfers = await this.prisma.contractAmendment.findMany({
      where: { type: 'TRANSFER', OR: [{ toCustomerId: userId }, { fromCustomerId: userId }] },
      select: { contractId: true, toCustomerId: true, fromCustomerId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const since = new Map<string, Date>(); // became theirs (latest)
    const until = new Map<string, Date>(); // stopped being theirs (latest)
    for (const t of transfers) {
      if (t.toCustomerId === userId) since.set(t.contractId, t.createdAt);
      if (t.fromCustomerId === userId) until.set(t.contractId, t.createdAt);
    }
    const transferredIn = [...since.keys()];
    return {
      OR: [
        { contract: { customerId: userId }, ...(transferredIn.length ? { contractId: { notIn: transferredIn } } : {}) },
        ...[...since].map(([contractId, at]) => ({ contractId, paidAt: { gte: at } })),
        ...[...until].map(([contractId, at]) => ({ contractId, paidAt: { lt: at } })),
      ],
    };
  }

  async assertDepositOwner(userId: string, depositId: string): Promise<void> {
    const found = await this.prisma.deposit.findFirst({
      where: { AND: [{ id: depositId }, await this.depositOwnershipWhere(userId)] },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Deposit not found');
  }

  async assertMaintenanceOwner(userId: string, requestId: string): Promise<void> {
    const found = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, customerId: userId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Maintenance request not found');
  }

  /**
   * Loads a `CUSTOMER_VISIBLE` document and verifies the user owns the entity
   * it's attached to. Throws [NotFoundException] otherwise (no cross-account
   * existence leak). The visibility + ownership checks run at access time.
   */
  async getCustomerDocumentOrThrow(
    userId: string,
    documentId: string,
  ): Promise<CustomerDocument> {
    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
      },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
        fileUrl: true,
        fileName: true,
        mimeType: true,
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertOwnsOwner(userId, doc.ownerType, doc.ownerId);
    return doc;
  }

  /**
   * Verifies the user owns the given document-owner entity (contract / deposit
   * / maintenance request / their own user record). Throws [NotFoundException]
   * for anything a customer can't reach. Used by document list + download.
   */
  async assertOwnsOwner(
    userId: string,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<void> {
    switch (ownerType) {
      case DocumentOwnerType.CONTRACT:
        return this.assertContractOwner(userId, ownerId);
      case DocumentOwnerType.DEPOSIT:
        return this.assertDepositOwner(userId, ownerId);
      case DocumentOwnerType.MAINTENANCE_REQUEST:
        return this.assertMaintenanceOwner(userId, ownerId);
      case DocumentOwnerType.USER:
        if (ownerId !== userId) throw new NotFoundException('Document not found');
        return;
      default:
        // Customers can't reach documents on other owner types.
        throw new NotFoundException('Document not found');
    }
  }
}

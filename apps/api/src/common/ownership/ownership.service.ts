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

  /**
   * The contracts whose documents this customer may see, each with the upload
   * window that is theirs. A transfer (تنازل) splits a contract's documents
   * like its payments: the new owner gets the ones uploaded from the transfer
   * on, the previous owner keeps the ones uploaded before it. A deleted
   * contract shows nothing.
   */
  async contractDocumentWindows(userId: string): Promise<Map<string, { from?: Date; to?: Date }>> {
    const [owned, transfers] = await Promise.all([
      this.prisma.contract.findMany({ where: { customerId: userId, deletedAt: null }, select: { id: true } }),
      this.prisma.contractAmendment.findMany({
        where: { type: 'TRANSFER', OR: [{ toCustomerId: userId }, { fromCustomerId: userId }] },
        select: { contractId: true, toCustomerId: true, fromCustomerId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const since = new Map<string, Date>();
    const until = new Map<string, Date>();
    for (const t of transfers) {
      if (t.toCustomerId === userId) since.set(t.contractId, t.createdAt);
      if (t.fromCustomerId === userId) until.set(t.contractId, t.createdAt);
    }
    const windows = new Map<string, { from?: Date; to?: Date }>();
    for (const { id } of owned) windows.set(id, since.has(id) ? { from: since.get(id) } : {});
    const formerIds = [...until.keys()].filter((id) => !windows.has(id));
    if (formerIds.length) {
      const live = await this.prisma.contract.findMany({
        where: { id: { in: formerIds }, deletedAt: null },
        select: { id: true },
      });
      for (const { id } of live) windows.set(id, { to: until.get(id) });
    }
    return windows;
  }

  /** The CONTRACT documents that are this customer's, as a document filter. */
  async contractDocumentWhere(userId: string): Promise<Prisma.DocumentWhereInput[]> {
    const windows = await this.contractDocumentWindows(userId);
    return [...windows].map(([contractId, w]) => ({
      ownerType: DocumentOwnerType.CONTRACT,
      ownerId: contractId,
      ...(w.from || w.to
        ? { createdAt: { ...(w.from ? { gte: w.from } : {}), ...(w.to ? { lt: w.to } : {}) } }
        : {}),
    }));
  }

  /** The upload window of a contract's documents for this customer; 404 when none. */
  async contractDocumentWindow(userId: string, contractId: string): Promise<{ from?: Date; to?: Date }> {
    const w = (await this.contractDocumentWindows(userId)).get(contractId);
    if (!w) throw new NotFoundException('Contract not found');
    return w;
  }

  async assertContractOwner(userId: string, contractId: string): Promise<void> {
    await this.contractDocumentWindow(userId, contractId);
  }

  /**
   * The deposits (receipts, proofs) that are this customer's. A transfer
   * (تنازل) splits a contract's payments by who owned it when they were
   * made: the new owner sees payments from the transfer on, the previous
   * owner keeps the ones made before it. Following contract.customerId alone
   * showed the new owner the previous owner's receipts and cut the previous
   * owner off from their own. "Made" is when the payment was recorded
   * (createdAt): paidAt is typed by the customer and could move a receipt to
   * the other side of the transfer.
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
        ...[...since].map(([contractId, at]) => ({ contractId, createdAt: { gte: at } })),
        ...[...until].map(([contractId, at]) => ({ contractId, createdAt: { lt: at } })),
      ],
    };
  }

  /**
   * The booking payments (made on the reservation, before the contract) that
   * are this customer's. They stay with whoever paid them (decided
   * 2026-10-16): a transfer moves the reservation to the new owner, but the
   * receipts recorded before it remain the previous owner's.
   */
  async bookingDepositWhere(userId: string): Promise<Prisma.DepositWhereInput> {
    const transfers = await this.prisma.contractAmendment.findMany({
      where: { type: 'TRANSFER', OR: [{ toCustomerId: userId }, { fromCustomerId: userId }] },
      select: { contractId: true, toCustomerId: true, fromCustomerId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const since = new Map<string, Date>();
    const until = new Map<string, Date>();
    for (const t of transfers) {
      if (t.toCustomerId === userId) since.set(t.contractId, t.createdAt);
      if (t.fromCustomerId === userId) until.set(t.contractId, t.createdAt);
    }
    const transferred = [...new Set([...since.keys(), ...until.keys()])];
    const notTransferred: Prisma.DepositWhereInput = transferred.length
      ? { NOT: { reservation: { contract: { id: { in: transferred } } } } }
      : {};
    return {
      contractId: null,
      OR: [
        { reservation: { clientId: userId }, ...notTransferred },
        { reservation: { lead: { is: { clientId: userId } } }, ...notTransferred },
        ...[...since].map(([contractId, at]) => ({ reservation: { contract: { id: contractId } }, createdAt: { gte: at } })),
        ...[...until].map(([contractId, at]) => ({ reservation: { contract: { id: contractId } }, createdAt: { lt: at } })),
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
        createdAt: true,
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerType === DocumentOwnerType.CONTRACT) {
      const w = await this.contractDocumentWindow(userId, doc.ownerId);
      if ((w.from && doc.createdAt < w.from) || (w.to && doc.createdAt >= w.to)) {
        throw new NotFoundException('Document not found');
      }
    } else {
      await this.assertOwnsOwner(userId, doc.ownerType, doc.ownerId);
    }
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

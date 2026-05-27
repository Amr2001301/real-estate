import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentVisibility } from '@prisma/client';
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

  async assertDepositOwner(userId: string, depositId: string): Promise<void> {
    const found = await this.prisma.deposit.findFirst({
      where: { id: depositId, contract: { customerId: userId } },
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

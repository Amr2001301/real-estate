import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  NotificationChannel,
  Prisma,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentsModule, DocumentsService } from '../documents/documents.module';
import {
  NotificationsModule,
  NotificationsService,
} from '../notifications/notifications.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { teamSalesIds, assertSalesRecordInScope } from '../../common/utils/sales-scope';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { BrokerCommissionsModule } from '../broker-commissions/broker-commissions.module';
import { BrokerCommissionsService } from '../broker-commissions/broker-commissions.service';
import { BonusModule } from '../bonus/bonus.module';
import { BonusService } from '../bonus/bonus.module';

// ── P12 legacy backfill helpers ─────────────────────────────────────────────
// Pure (exported for unit tests). Derive safe display metadata for a backfilled
// contract Document from the contract's stored pdfUrl — never trust the URL as
// a filename blindly.

const CONTRACT_DOC_MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Best-effort fileName from a pdfUrl's last path segment; falls back to a
 *  contractNumber-derived name. Strips query/hash and sanitises. */
export function deriveContractDocFileName(pdfUrl: string, contractNumber: string | null): string {
  try {
    const noQuery = pdfUrl.split(/[?#]/)[0] ?? pdfUrl;
    const seg = noQuery.split('/').filter(Boolean).pop() ?? '';
    let decoded = seg;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      /* keep raw segment if it isn't valid percent-encoding */
    }
    const cleaned = decoded.replace(/[^\w.\-() ]+/g, '_').trim();
    if (cleaned && /\.[a-z0-9]{1,8}$/i.test(cleaned)) return cleaned;
  } catch {
    /* fall through to the contractNumber fallback */
  }
  return contractNumber ? `contract-${contractNumber}.pdf` : 'contract.pdf';
}

/** MIME type guessed from a pdfUrl's extension, or undefined when unknown. */
export function deriveContractDocMimeType(pdfUrl: string): string | undefined {
  const noQuery = (pdfUrl.split(/[?#]/)[0] ?? pdfUrl).toLowerCase();
  const m = noQuery.match(/(\.[a-z0-9]{1,8})$/);
  return m ? CONTRACT_DOC_MIME_BY_EXT[m[1]!] : undefined;
}

/** Outcome of a single contract's backfill evaluation. */
export type ContractDocBackfillResult = 'created' | 'would-create' | 'exists' | 'no-pdfurl';

class CreateContractDto {
  // `signedAt` is intentionally NOT accepted here. Creation produces an
  // unsigned contract; signing is a separate action (POST /contracts/:id/sign)
  // that requires the strict `contracts:sign` permission and fires broker
  // activity, notification, and commission materialisation side effects.
  // The global ValidationPipe is configured with `forbidNonWhitelisted: true`
  // so any inbound `signedAt` on POST /contracts is rejected with 400 rather
  // than silently bypassing the strict permission.
  @IsUUID() customerId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() @IsPositive() totalAmount!: number;
  @IsOptional() @IsNumber() @Min(0) downPayment?: number;
  @IsOptional() @IsString() pdfUrl?: string;
}

class UpdateContractDto {
  // `signedAt` is intentionally NOT accepted here. Signing has substantial
  // side effects (broker activity log, notification fan-out, broker
  // commission materialization) and a distinct permission code; it is
  // performed via POST /contracts/:id/sign. The global ValidationPipe is
  // configured with forbidNonWhitelisted=true so an inbound `signedAt` will
  // be rejected with 400 rather than silently signing.
  @IsOptional() @IsString() pdfUrl?: string;
}

class SignContractDto {
  @IsDateString() signedAt!: string;
}

/// P11 — admin attaches a presigned-uploaded file as the contract PDF.
class AttachContractDocumentDto {
  @IsString() fileUrl!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsNumber() @Min(0) sizeBytes?: number;
  @IsOptional() @IsString() title?: string;
}

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brokerCommissions: BrokerCommissionsService,
    private readonly bonus: BonusService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Link a contract PDF as a first-class CONTRACT document. Idempotent: skips
  // when a matching (contract, CONTRACT, fileUrl) document already exists.
  //
  // P12 — the contract file IS the customer's contract, so it is registered
  // CUSTOMER_VISIBLE: it shows up in the Admin Documents Center AND is
  // downloadable by the owning customer through the signed-download endpoint
  // (GET /v1/me/documents/:id/download) — never via a permanent URL. Returns
  // `created` so callers fire `contract_document_available` exactly once.
  private async linkContractDocument(
    contractId: string,
    pdfUrl: string,
    uploadedById: string,
    meta?: { fileName?: string; mimeType?: string; sizeBytes?: number; title?: string },
  ): Promise<{ document: { id: string }; created: boolean }> {
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: DocumentOwnerType.CONTRACT,
        ownerId: contractId,
        category: DocumentCategory.CONTRACT,
        fileUrl: pdfUrl,
        deletedAt: null,
      },
    });
    if (existing) return { document: existing, created: false };
    const document = await this.documents.create(uploadedById, {
      ownerType: DocumentOwnerType.CONTRACT,
      ownerId: contractId,
      category: DocumentCategory.CONTRACT,
      title: meta?.title?.trim() || 'ملف العقد',
      fileUrl: pdfUrl,
      fileName: meta?.fileName,
      mimeType: meta?.mimeType,
      sizeBytes: meta?.sizeBytes,
      visibility: DocumentVisibility.CUSTOMER_VISIBLE,
    });
    return { document, created: true };
  }

  // Best-effort linking — a document failure must never fail the PDF attach,
  // contract creation, or signing. Fires `contract_document_available` to the
  // customer the first time the file is registered (idempotent re-links are
  // silent). Safe payload only — never a file URL/key (see buildContractPayload).
  private async tryLinkContractDocument(
    contractId: string,
    pdfUrl: string,
    uploadedById: string,
    meta?: { fileName?: string; mimeType?: string; sizeBytes?: number; title?: string },
  ) {
    try {
      const { created } = await this.linkContractDocument(contractId, pdfUrl, uploadedById, meta);
      if (created) await this.notifyContractDocumentAvailable(contractId);
    } catch (e) {
      this.logger.warn(`linkContractDocument(${contractId}) failed: ${(e as Error).message}`);
    }
  }

  // Notify the owning customer that a downloadable contract document now
  // exists. Best-effort (sendToUser already swallows + needs no Firebase).
  private async notifyContractDocumentAvailable(contractId: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { customerId: true },
    });
    await this.notifications.sendToUser(
      c?.customerId,
      'contract_document_available',
      await this.buildContractPayload(contractId),
    );
  }

  /**
   * P12 — side effects for a contract that was just created via reservation
   * conversion (reservations.module.ts convertReservation). Notifies the
   * customer their contract exists and, when the admin attached a file during
   * conversion, registers it as a CUSTOMER_VISIBLE CONTRACT document (so it
   * lands in the Documents Center + is downloadable) and notifies that it is
   * available. Best-effort: a document/notification failure must NEVER fail
   * the conversion — the contract is already committed by the caller.
   */
  async handleConvertedContract(
    contractId: string,
    customerId: string,
    uploadedById: string,
    file?: { fileUrl: string; fileName?: string; mimeType?: string; sizeBytes?: number },
  ): Promise<void> {
    await this.notifications.sendToUser(
      customerId,
      'contract_created_customer',
      await this.buildContractPayload(contractId),
    );
    if (file?.fileUrl) {
      await this.tryLinkContractDocument(contractId, file.fileUrl, uploadedById, file);
    }
  }

  /**
   * P12 legacy backfill — repair a contract created BEFORE P12 that carries a
   * pdfUrl but has no CONTRACT-category Document. Without the Document the file
   * is invisible in the Admin Documents Center and the customer's signed-
   * download lookup finds nothing ("العقد غير متاح بعد"). Registers a
   * CUSTOMER_VISIBLE CONTRACT Document so both surfaces work, identically to a
   * P12-created one.
   *
   * Idempotent per the task's condition: skips when ANY non-deleted
   * CONTRACT-category Document already exists for the contract (so re-running,
   * or a contract already fixed by the P12 hooks, is a no-op).
   *
   * Trusted existing data: the row is written directly (NOT through
   * DocumentsService.create / assertSafeUrl, which would reject some legacy URL
   * shapes) with fileUrl = pdfUrl verbatim, so the customer's keyFromPublicUrl
   * resolves it exactly as it does for new contracts. `uploadedById` is null —
   * the original uploader is unknown for legacy rows (the column is nullable).
   *
   * DELIBERATELY sends NO notification: legacy contracts are often long
   * finalised and mass-notifying on backfill would spam customers. New
   * contracts still notify via handleConvertedContract / create /
   * attachDocument. `dryRun` reports the action without writing.
   */
  async backfillContractDocument(
    contract: { id: string; contractNumber: string | null; pdfUrl: string | null },
    opts: { dryRun: boolean } = { dryRun: true },
  ): Promise<ContractDocBackfillResult> {
    const pdfUrl = contract.pdfUrl?.trim();
    if (!pdfUrl) return 'no-pdfurl';
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: DocumentOwnerType.CONTRACT,
        ownerId: contract.id,
        category: DocumentCategory.CONTRACT,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return 'exists';
    if (opts.dryRun) return 'would-create';
    await this.prisma.document.create({
      data: {
        ownerType: DocumentOwnerType.CONTRACT,
        ownerId: contract.id,
        category: DocumentCategory.CONTRACT,
        title: contract.contractNumber ? `ملف العقد ${contract.contractNumber}` : 'ملف العقد',
        fileUrl: pdfUrl,
        fileName: deriveContractDocFileName(pdfUrl, contract.contractNumber),
        mimeType: deriveContractDocMimeType(pdfUrl) ?? null,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
        uploadedById: null,
      },
    });
    return 'created';
  }

  /**
   * P11 — attach a presigned-uploaded file as the contract's canonical PDF.
   * Admin flow: client browser PUTs to MinIO/R2 via the presign URL, then
   * POSTs here with the resulting publicUrl + fileName/mimeType/sizeBytes.
   * Sets Contract.pdfUrl and registers a CONTRACT-category Document. Errors
   * during the document registration ARE surfaced (it's the route's job).
   */
  async attachDocument(
    contractId: string,
    uploadedById: string,
    dto: { fileUrl: string; fileName?: string; mimeType?: string; sizeBytes?: number; title?: string },
  ) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');
    await this.prisma.contract.update({
      where: { id: contractId },
      data: { pdfUrl: dto.fileUrl },
    });
    // Idempotent + CUSTOMER_VISIBLE registration. Errors here ARE surfaced
    // (it's the route's job), so we call linkContractDocument directly rather
    // than the best-effort wrapper. The customer is notified the first time
    // the document is registered.
    const { document, created } = await this.linkContractDocument(
      contractId,
      dto.fileUrl,
      uploadedById,
      { fileName: dto.fileName, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes, title: dto.title },
    );
    if (created) await this.notifyContractDocumentAvailable(contractId);
    return { contract: await this.prisma.contract.findUnique({ where: { id: contractId } }), document };
  }

  async create(dto: CreateContractDto, actorId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === UnitStatus.SOLD) {
      throw new BadRequestException('Unit already sold');
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          customerId: dto.customerId,
          unitId: dto.unitId,
          totalAmount: new Prisma.Decimal(dto.totalAmount),
          downPayment: new Prisma.Decimal(dto.downPayment ?? 0),
          pdfUrl: dto.pdfUrl ?? null,
          // Contracts are created unsigned. Signing goes through sign().
          signedAt: null,
        },
      });
      // PROMOTION RULE — CLIENT → CUSTOMER happens ONLY when an ownership
      // milestone is recorded: a contract being created (here) or a
      // reservation being converted (reservations.module.ts convertReservation).
      // Creating a reservation alone must NOT promote the role — the customer
      // can still walk away from a reservation. Mirrored test:
      // apps/api/test/e2e/me-reservations.e2e-spec.ts
      const promoted = await tx.user.updateMany({
        where: { id: dto.customerId, role: 'CLIENT' },
        data: { role: 'CUSTOMER' },
      });
      // Invalidate active refresh tokens so the portal immediately reflects the
      // new CUSTOMER role — the user is bounced to /login on next page load
      // instead of seeing a stale CLIENT view for up to 15 minutes.
      if (promoted.count > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: dto.customerId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      // Mark unit SOLD
      const previous = unit.status;
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.SOLD, reservationExpiresAt: null },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId: dto.unitId,
          oldStatus: previous,
          newStatus: UnitStatus.SOLD,
          changedById: actorId,
          reason: `Contract ${created.id}`,
        },
      });
      return created;
    });
    // Mirror a contract-created PDF as a first-class document (best-effort).
    if (dto.pdfUrl) {
      await this.tryLinkContractDocument(contract.id, dto.pdfUrl, actorId);
    }
    // P4 — event: notify customer that a contract was created for them.
    // Safe payload: unit code + project name only — no amounts, no PDF URL.
    await this.notifications.sendToUser(
      dto.customerId,
      'contract_created_customer',
      await this.buildContractPayload(contract.id),
    );
    return contract;
  }

  /** Build a safe payload for contract notifications. Whitelist: unit code,
   *  project name, contract number. No PDF URL, no amounts, no internal ids
   *  beyond contractId for routing. */
  private async buildContractPayload(
    contractId: string,
    extras: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    try {
      const c = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: {
          contractNumber: true,
          unit: {
            select: {
              code: true,
              building: {
                select: { phase: { select: { project: { select: { name: true } } } } },
              },
            },
          },
        },
      });
      if (!c) return { contractId, ...extras };
      const project = c.unit?.building?.phase?.project?.name as
        | { ar?: string; en?: string }
        | undefined;
      return {
        contractId,
        contractNumber: c.contractNumber ?? '',
        unitCode: c.unit?.code ?? '',
        projectName: project?.ar || project?.en || '',
        ...extras,
      };
    } catch {
      return { contractId, ...extras };
    }
  }

  async list(opts: {
    page: number;
    pageSize: number;
    customerId?: string;
    q?: string;
    signed?: 'yes' | 'no';
    hasReservation?: 'yes' | 'no';
    brokerId?: string;
    brokerAgentId?: string;
    // Sales-team scope (SALES_MANAGER): contracts have no salesId column, so
    // attribution is derived via the linked reservation's salesId. An empty
    // team yields no rows; direct (reservation-less) contracts are excluded.
    salesIds?: string[];
  }) {
    const where: Prisma.ContractWhereInput = {
      ...(opts.salesIds ? { reservation: { salesId: { in: opts.salesIds } } } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.brokerId ? { brokerId: opts.brokerId } : {}),
      ...(opts.brokerAgentId ? { brokerAgentId: opts.brokerAgentId } : {}),
      ...(opts.signed === 'yes'
        ? { signedAt: { not: null } }
        : opts.signed === 'no'
          ? { signedAt: null }
          : {}),
      ...(opts.hasReservation === 'yes'
        ? { reservationId: { not: null } }
        : opts.hasReservation === 'no'
          ? { reservationId: null }
          : {}),
      ...(opts.q
        ? {
            OR: [
              { contractNumber: { contains: opts.q, mode: Prisma.QueryMode.insensitive } },
              { customer: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { customer: { phone: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { unit: { code: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          unit: {
            select: {
              id: true, code: true, type: true,
              building: { select: { phase: { select: { project: { select: { id: true, name: true } } } } } },
            },
          },
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              commissionLockedPct: true,
              commissionLockedAmount: true,
            },
          },
          installmentPlan: { select: { id: true, totalMonths: true, monthlyAmount: true, startsAt: true, frequency: true } },
          broker: {
            select: {
              id: true,
              companyName: true,
              commercialName: true,
              code: true,
              status: true,
            },
          },
          brokerAgent: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        unit: { include: { building: { include: { phase: { include: { project: true } } } } } },
        reservation: {
          select: {
            id: true,
            reservationNumber: true,
            commissionLockedPct: true,
            commissionLockedAmount: true,
            sales: { select: { id: true, fullName: true, email: true, phone: true } },
            lead: { select: { id: true, fullName: true, phone: true } },
          },
        },
        installmentPlan: { include: { installments: { orderBy: { dueDate: 'asc' } } } },
        deposits: { orderBy: { paidAt: 'desc' } },
        broker: {
          select: {
            id: true,
            companyName: true,
            commercialName: true,
            code: true,
            status: true,
          },
        },
        brokerAgent: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, actorId: string) {
    // Generic update path — pdfUrl only. Signing is performed via sign().
    const exists = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Contract not found');

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        pdfUrl: dto.pdfUrl ?? undefined,
      },
    });
    // Mirror the attached PDF as a first-class document (best-effort; pdfUrl is
    // already persisted on the contract for back-compat).
    if (dto.pdfUrl) {
      await this.tryLinkContractDocument(id, dto.pdfUrl, actorId);
    }
    return updated;
  }

  /**
   * Transition a contract from unsigned to signed. Runs the broker activity
   * log, the notification fan-out, and the broker commission materialisation
   * exactly as the previous PATCH-path did.
   *
   * Idempotent: signing an already-signed contract is a no-op and does NOT
   * re-fire side effects. The current contract state is returned.
   */
  async sign(id: string, dto: SignContractDto, actorId: string) {
    const before = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        signedAt: true,
        createdAt: true,
        unitId: true,
        customerId: true,
        pdfUrl: true,
        brokerId: true,
        brokerAgentId: true,
        reservationId: true,
        reservation: {
          select: {
            reservationNumber: true,
            leadId: true,
            salesId: true,
          },
        },
      },
    });
    if (!before) throw new NotFoundException('Contract not found');

    // Idempotent: already signed → return current state, no side effects.
    if (before.signedAt !== null) {
      return this.prisma.contract.findUnique({ where: { id } });
    }

    const signedAtDate = new Date(dto.signedAt);
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { signedAt: signedAtDate },
    });

    // Start warranties for the unit's selected maintenance items. Best-effort:
    // a failure here must never fail the sign. Idempotent — only items with no
    // warrantyStart yet are touched, and the per-item duration is snapshotted so
    // later category edits never change an already-started warranty.
    //
    // Warranty START anchors to the contract's CREATION date (not the signed
    // date) per product requirement — the warranty clock begins when the deal
    // is created. Triggered here at sign time (the moment items first qualify);
    // only affects future warranty starts, never already-started items.
    await this.startUnitWarranties(before.unitId, before.createdAt).catch((e) =>
      this.logger.warn(`startUnitWarranties(${id}) failed on sign: ${(e as Error).message}`),
    );

    // Ensure the existing contract PDF (if any) is linked as a document. No PDF
    // is generated on signing; this only mirrors an already-uploaded pdfUrl.
    // Best-effort + idempotent.
    if (before.pdfUrl) {
      await this.tryLinkContractDocument(id, before.pdfUrl, actorId);
    }

    if (before.brokerId) {
      // Broker portal activity timeline. Best-effort: failures are logged
      // but never thrown — the contract is already signed.
      try {
        if (before.reservation?.leadId) {
          await this.prisma.leadActivity.create({
            data: {
              leadId: before.reservation.leadId,
              type: 'broker_contract_signed',
              payload: {
                brokerId: before.brokerId,
                brokerAgentId: before.brokerAgentId,
                contractId: before.id,
                contractNumber: before.contractNumber,
                reservationId: before.reservationId,
                reservationNumber: before.reservation.reservationNumber,
                signedAt: dto.signedAt,
              },
            },
          });
        }

        const recipients = await this.prisma.brokerUser.findMany({
          where: { brokerId: before.brokerId, status: 'ACTIVE' },
          select: { userId: true },
        });
        const brokerPayload = await this.buildContractPayload(before.id);
        await this.notifications.sendToUsers(
          [
            ...recipients.map((r) => r.userId),
            before.reservation?.salesId ?? null,
          ],
          'broker_contract_signed',
          brokerPayload,
        );
      } catch (e) {
        // Defence in depth — the helpers already swallow, but in case the
        // prisma query above throws we log and continue.
        this.logger.warn(
          `Broker contract sign notify failed for ${id}: ${(e as Error).message}`,
        );
      }
      // P4 — also notify the customer directly that their contract was signed.
      await this.notifications.sendToUser(
        before.customerId,
        'contract_signed_customer',
        await this.buildContractPayload(before.id),
      );

      // Materialize the broker commission. Idempotent: a contract that
      // already has a BrokerCommission returns `already_exists`.
      try {
        await this.brokerCommissions.materializeFromContract(id);
      } catch (e) {
        this.logger.warn(
          `materializeFromContract(${id}) failed on sign: ${(e as Error).message}`,
        );
      }
    }

    // Materialize the automatic SALES commission for every newly-signed
    // contract (broker or not). Best-effort: a failure here must never fail the
    // sign request, and the generator self-skips when no eligible rule / sales
    // rep exists. Idempotent via BonusEntry.contractId.
    try {
      await this.bonus.materializeFromSignedContract(id);
    } catch (e) {
      this.logger.warn(
        `sales commission materialize(${id}) failed on sign: ${(e as Error).message}`,
      );
    }

    return updated;
  }

  /**
   * Start warranties for a sold unit's active maintenance items. For each item
   * that has not yet started (warrantyStart == null), freeze the warranty
   * duration (item snapshot if present, else the category's current duration)
   * and set warrantyStart = warrantyStartAt (the contract CREATION date — see
   * caller), warrantyEnd = warrantyStartAt + duration months.
   * Idempotent: items already started are left untouched, so a re-sign (or a
   * later category-duration change) never mutates an existing warranty.
   */
  private async startUnitWarranties(unitId: string, warrantyStartAt: Date) {
    const items = await this.prisma.unitMaintenanceItem.findMany({
      where: { unitId, active: true, warrantyStart: null },
      include: { category: { select: { warrantyDurationMonths: true } } },
    });
    for (const item of items) {
      const months = item.warrantyDurationMonthsSnapshot ?? item.category?.warrantyDurationMonths ?? null;
      const warrantyEnd =
        months != null
          ? (() => {
              const d = new Date(warrantyStartAt);
              d.setMonth(d.getMonth() + months);
              return d;
            })()
          : null;
      await this.prisma.unitMaintenanceItem.update({
        where: { id: item.id },
        data: {
          warrantyStart: warrantyStartAt,
          warrantyEnd,
          warrantyDurationMonthsSnapshot: months,
        },
      });
    }
  }
}

@ApiTags('contracts')
@Controller('contracts')
class ContractsController {
  constructor(
    private readonly svc: ContractsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Permissions('contracts:upload')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.svc.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('contracts:read')
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('q') q?: string,
    @Query('signed') signed?: string,
    @Query('hasReservation') hasReservation?: string,
    @Query('brokerId') brokerId?: string,
    @Query('brokerAgentId') brokerAgentId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    // SALES_MANAGER is scoped to their team's contracts (via reservation.salesId);
    // ADMIN/SALES are unscoped here (existing behavior).
    const salesIds =
      user.role === UserRole.SALES_MANAGER
        ? await teamSalesIds(this.prisma, user.sub)
        : undefined;
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId,
      q,
      signed: signed === 'yes' ? 'yes' : signed === 'no' ? 'no' : undefined,
      hasReservation:
        hasReservation === 'yes' ? 'yes' : hasReservation === 'no' ? 'no' : undefined,
      brokerId,
      brokerAgentId,
      salesIds,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('contracts:read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    // SALES_MANAGER may only read a contract owned by a team rep (via the linked
    // reservation's salesId). No-op for ADMIN; SALES behavior unchanged.
    if (user.role === UserRole.SALES_MANAGER) {
      const contract = await this.prisma.contract.findUnique({
        where: { id },
        select: { reservation: { select: { salesId: true } } },
      });
      await assertSalesRecordInScope(this.prisma, user, contract?.reservation?.salesId ?? null);
    }
    return this.svc.findOne(id);
  }

  // Customer view of their own contracts — intentionally NOT permission-gated.
  //
  // SECURITY: the underlying Contract row carries a permanent `pdfUrl`
  // (raw R2 public URL). Customers must reach the file ONLY through the
  // signed-download endpoint (`GET /v1/me/documents/:id/download`) where
  // the URL is short-lived (≤5 min) and ownership-guarded just-in-time.
  // We redact the field to `null` here so the customer surface can never
  // expose a permanent storage URL. Admin / sales / broker contract
  // listings are unchanged — they go through `@Get()` / `@Get(':id')`
  // above, not this method.
  @Roles(UserRole.CUSTOMER)
  @Get('me/contracts')
  async myContracts(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const result = await this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId: user.sub,
    });
    // P12 — surface a `hasDocument` flag so the customer UI can pre-gate the
    // download button (button vs "العقد غير متاح بعد") without leaking any
    // permanent URL. The flag reflects the existence of a CUSTOMER_VISIBLE
    // CONTRACT document; the actual file is reachable ONLY through the
    // signed-download endpoint. pdfUrl stays redacted to null.
    const ids = result.data.map((row) => row.id);
    const withDoc = new Set<string>();
    if (ids.length > 0) {
      const docs = await this.prisma.document.findMany({
        where: {
          ownerType: DocumentOwnerType.CONTRACT,
          ownerId: { in: ids },
          category: DocumentCategory.CONTRACT,
          visibility: DocumentVisibility.CUSTOMER_VISIBLE,
          deletedAt: null,
        },
        select: { ownerId: true },
      });
      for (const d of docs) withDoc.add(d.ownerId);
    }
    return {
      ...result,
      data: result.data.map((row) => ({
        ...row,
        pdfUrl: null,
        hasDocument: withDoc.has(row.id),
      })),
    };
  }

  @Roles(UserRole.ADMIN)
  @Permissions('contracts:update')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.svc.update(id, dto, user.sub);
  }

  // Strict: even an ADMIN must hold contracts:sign explicitly. Signing
  // triggers broker activity log, notification fan-out, and broker commission
  // materialisation. Segregation of duties — see PermissionsGuard tests.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('contracts:sign')
  @Post(':id/sign')
  sign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignContractDto,
  ) {
    return this.svc.sign(id, dto, user.sub);
  }

  // P11 — register a presigned-uploaded file as the contract's canonical PDF.
  // Admin uploads via /v1/documents/presign → PUT to R2 → POSTs the resulting
  // publicUrl here. Closes the post-presign linkage gap exposed by the upload
  // bug investigation. SALES_MANAGER also allowed (signing remains ADMIN).
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('contracts:update')
  @Post(':id/document')
  attachDocument(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachContractDocumentDto,
  ) {
    return this.svc.attachDocument(id, user.sub, dto);
  }
}

@Module({
  imports: [BrokerCommissionsModule, BonusModule, DocumentsModule, NotificationsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}

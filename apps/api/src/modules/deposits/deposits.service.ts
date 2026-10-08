import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DepositReviewStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  InstallmentStatus,
  PaymentCorrectionType,
  PaymentInstrumentStatus,
  PaymentInstrumentType,
  PaymentMethod,
  PlanPaymentType,
  Prisma,
  ReservationBookingPaymentStatus,
  UserRole,
} from '@prisma/client';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { UNCLEARED_INSTRUMENT_STATUSES, notAwaitingChequeWhere } from './review-queue';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { DocumentsService } from '../documents/documents.module';
import { R2Service } from '../media/r2.service';
import { NotificationsService } from '../notifications/notifications.module';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { takeSkip } from '../../common/utils/pagination';
import {
  ApproveDepositDto,
  AttachReceiptDto,
  CustomerResubmitProofDto,
  CustomerSubmitProofDto,
  ListDepositsOpts,
  RecordDepositDto,
  RejectDepositDto,
  VerifyDepositDto,
} from './deposits.dto';

const DEPOSIT_INCLUDE = {
  contract: {
    select: {
      id: true,
      contractNumber: true,
      customer: { select: { id: true, fullName: true } },
      unit: { select: { id: true, code: true } },
    },
  },
  installment: {
    select: {
      id: true,
      dueDate: true,
      amount: true,
      type: true,
      status: true,
      paidAt: true,
      lastCorrectionId: true,
      // Correction context — null when lastCorrectionId is null (§3.5)
      lastCorrection: {
        select: {
          id: true,
          type: true,
          reason: true,
          createdAt: true,
          performedBy: { select: { id: true, fullName: true } },
        },
      },
    },
  },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      createdAt: true,
      expiresAt: true,
      unit: { select: { id: true, code: true } },
      client: { select: { id: true, fullName: true } },
      lead: { select: { id: true, fullName: true } },
    },
  },
  // P11 — proof document reference. NEVER include fileUrl in this select;
  // customers reach the file ONLY through the signed-download endpoint.
  proofDocument: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  },
  reviewedBy: { select: { id: true, fullName: true } },
} as const;

/** FG-05 — the fields a reversal decision and its audit entry read. */
const REVERSAL_SELECT = {
  id: true,
  reviewStatus: true,
  verified: true,
  amount: true,
  createdAt: true,
  reviewedAt: true,
  deletedAt: true,
  installmentId: true,
  installment: { select: { id: true, status: true, paidAt: true } },
} satisfies Prisma.DepositSelect;
type ReversalDeposit = Prisma.DepositGetPayload<{ select: typeof REVERSAL_SELECT }>;

/** Review states in which a deposit counts towards its installment. */
const PAYING_REVIEW_STATUSES: DepositReviewStatus[] = [
  DepositReviewStatus.APPROVED,
  // Admin-recorded deposits stay NO_PROOF but mark the installment paid.
  DepositReviewStatus.NO_PROOF,
];

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly r2: R2Service,
  ) {}

  // Link a payment proof as a first-class RECEIPT document. Idempotent: skips
  // when a matching (deposit, RECEIPT, fileUrl) document already exists.
  private async linkReceiptDocument(
    depositId: string,
    receiptUrl: string,
    uploadedById: string,
    meta?: { fileName?: string; mimeType?: string; sizeBytes?: number; title?: string },
  ) {
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: DocumentOwnerType.DEPOSIT,
        ownerId: depositId,
        category: DocumentCategory.RECEIPT,
        fileUrl: receiptUrl,
        deletedAt: null,
      },
    });
    if (existing) return existing;
    return this.documents.create(uploadedById, {
      ownerType: DocumentOwnerType.DEPOSIT,
      ownerId: depositId,
      category: DocumentCategory.RECEIPT,
      title: meta?.title?.trim() || 'إيصال دفعة',
      fileUrl: receiptUrl,
      fileName: meta?.fileName,
      mimeType: meta?.mimeType,
      sizeBytes: meta?.sizeBytes,
      visibility: DocumentVisibility.ADMIN_ONLY,
    });
  }

  // Best-effort linking — a document failure must never fail deposit recording.
  private async tryLinkReceiptDocument(depositId: string, receiptUrl: string, uploadedById: string) {
    try {
      await this.linkReceiptDocument(depositId, receiptUrl, uploadedById);
    } catch (e) {
      this.logger.warn(`linkReceiptDocument(${depositId}) failed: ${(e as Error).message}`);
    }
  }

  async findOne(id: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id }, include: DEPOSIT_INCLUDE });
    if (!deposit) throw new NotFoundException('Deposit not found');
    // Lets the admin page offer "reverse" only when POST /reverse would succeed.
    const d = await this.prisma.deposit.findUnique({ where: { id }, select: REVERSAL_SELECT });
    const reversible = !!d && !d.deletedAt && (await this.stillPays(d));
    return { ...deposit, reversible };
  }

  /** The deposit is what keeps its installment PAID (FG-05). */
  private async stillPays(d: ReversalDeposit): Promise<boolean> {
    return (
      !!d.installmentId &&
      d.installment?.status === InstallmentStatus.PAID &&
      PAYING_REVIEW_STATUSES.includes(d.reviewStatus) &&
      !(await this.reversedSinceReview(d))
    );
  }

  /**
   * FG-05 — deleting a deposit that still pays its installment reverses it
   * first (PaymentCorrection + installment reopened), in the same
   * transaction; it used to leave the installment PAID with no payment behind
   * it. Restoring the deposit later does not re-pay the installment.
   */
  async softDelete(id: string, actor: AuthUser) {
    const d = await this.prisma.deposit.findUnique({ where: { id }, select: REVERSAL_SELECT });
    if (!d) throw new NotFoundException('Deposit not found');
    if (d.deletedAt) throw new NotFoundException('Deposit already deleted');
    if (!(await this.stillPays(d))) {
      await this.prisma.deposit.update({ where: { id }, data: { deletedAt: new Date() } });
      return;
    }
    const companyId = getRequiredCompanyId();
    await this.prisma.$transaction(async (tx) => {
      await this.writeReversal(tx, d, 'Deposit deleted by admin', actor.sub, companyId);
      await tx.deposit.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  async restore(id: string) {
    const exists = await this.prisma.deposit.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!exists) throw new NotFoundException('Deposit not found');
    await this.prisma.deposit.update({ where: { id }, data: { deletedAt: null } });
  }

  // Attach/replace proof after creation. Updates legacy receiptUrl and links a
  // RECEIPT document; document errors here ARE surfaced (it's the route's job).
  async attachReceipt(id: string, dto: AttachReceiptDto, uploadedById: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id } });
    if (!deposit) throw new NotFoundException('Deposit not found');
    await this.prisma.deposit.update({ where: { id }, data: { receiptUrl: dto.receiptUrl } });
    const document = await this.linkReceiptDocument(id, dto.receiptUrl, uploadedById, {
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      title: dto.title,
    });
    // Link document as the deposit's proof so proof/download can resolve it.
    await this.prisma.deposit.update({ where: { id }, data: { proofDocumentId: document.id } });
    return { deposit: await this.findOne(id), document };
  }

  async record(dto: RecordDepositDto, recordedById: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id: dto.contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    // Ownership: installment must belong to this contract's plan
    const installment = await this.prisma.installment.findFirst({
      where: {
        id: dto.installmentId,
        plan: { contractId: dto.contractId },
      },
    });
    if (!installment) throw new BadRequestException('القسط لا ينتمي إلى هذا العقد');

    // Amount validation
    const expected = Number(installment.amount);
    if (dto.amount < expected) {
      throw new BadRequestException('الدفعات الجزئية غير مدعومة حالياً');
    }
    if (dto.amount > expected) {
      throw new BadRequestException('لا يمكن دفع مبلغ أكبر من قيمة القسط');
    }

    // Map installment type → deposit type
    const depositTypeMap: Partial<Record<PlanPaymentType, DepositType>> = {
      [PlanPaymentType.DOWN_PAYMENT]: DepositType.DOWN_PAYMENT,
      [PlanPaymentType.INSTALLMENT]: DepositType.INSTALLMENT,
      [PlanPaymentType.FINAL_PAYMENT]: DepositType.FINAL_PAYMENT,
    };
    const depositType = depositTypeMap[installment.type] ?? DepositType.INSTALLMENT;

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    // FG-01 — the payment method decides when the installment counts as paid
    // (decided 2026-10-08): cash and bank transfers at once; a cheque only
    // when it clears (payment-instruments: clear / bounce). Cheque or transfer
    // details become a PaymentInstrument linked to the deposit — before, none
    // was ever linked, so clearing or bouncing a cheque reached no payment.
    const paymentMethod =
      dto.paymentMethod ?? (dto.cheque ? PaymentMethod.CHEQUE : dto.transfer ? PaymentMethod.BANK_TRANSFER : null);
    if (paymentMethod === PaymentMethod.CHEQUE && !dto.cheque) {
      throw new BadRequestException('بيانات الشيك مطلوبة (الرقم وتاريخ الاستحقاق)');
    }
    if (dto.cheque && paymentMethod !== PaymentMethod.CHEQUE) {
      throw new BadRequestException('بيانات الشيك تُرسل فقط مع طريقة الدفع شيك');
    }
    if (dto.transfer && paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('بيانات التحويل تُرسل فقط مع طريقة الدفع تحويل بنكي');
    }

    const deposit = await this.prisma.$transaction(async (tx) => {
      if (dto.cheque) {
        // The installment stays unpaid until the cheque clears; it must still
        // be payable, and not already waiting on another cheque. FOR UPDATE
        // holds the row until commit, so two cheques recorded at the same
        // moment cannot both pass the check below.
        const open = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Installment"
          WHERE "id" = ${dto.installmentId}::uuid
            AND "companyId" = ${getRequiredCompanyId()}::uuid
            AND "status" IN ('PENDING', 'OVERDUE')
          FOR UPDATE`);
        if (open.length === 0) throw new ConflictException('هذا القسط مدفوع بالفعل أو ملغى');
        const waiting = await tx.deposit.count({
          where: {
            installmentId: dto.installmentId,
            deletedAt: null,
            paymentInstrument: {
              status: { in: UNCLEARED_INSTRUMENT_STATUSES },
            },
          },
        });
        if (waiting > 0) {
          throw new ConflictException('هذا القسط عليه شيك لم يُصرف بعد');
        }
        const instrument = await tx.paymentInstrument.create({
          data: {
            type: PaymentInstrumentType.CHEQUE,
            chequeNumber: dto.cheque.chequeNumber,
            drawerBankName: dto.cheque.drawerBankName ?? null,
            chequeDueDate: new Date(dto.cheque.chequeDueDate),
            status: PaymentInstrumentStatus.PENDING_CLEARANCE,
            recordedById,
            companyId: getRequiredCompanyId(),
          },
        });
        return tx.deposit.create({
          data: {
            type: depositType,
            contractId: dto.contractId,
            installmentId: dto.installmentId,
            amount: new Prisma.Decimal(dto.amount),
            paidAt,
            receiptUrl: dto.receiptUrl ?? null,
            paymentMethod,
            // Waiting on the bank, not on a reviewer: approved by the clearing.
            reviewStatus: DepositReviewStatus.PENDING_REVIEW,
            paymentInstrumentId: instrument.id,
            recordedById,
          },
        });
      }

      // Atomic claim: mark PAID only if PENDING or OVERDUE.
      // Explicit IN excludes both PAID and CANCELLED (Step D1) — a cancelled
      // installment must not be re-activated by recording a new deposit.
      const claimed = await tx.installment.updateMany({
        where: { id: dto.installmentId, status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] } },
        data: { status: InstallmentStatus.PAID, paidAt },
      });
      if (claimed.count === 0) {
        throw new ConflictException('هذا القسط مدفوع بالفعل أو ملغى');
      }
      const transfer = dto.transfer
        ? await tx.paymentInstrument.create({
            data: {
              type: PaymentInstrumentType.BANK_TRANSFER,
              bankName: dto.transfer.bankName ?? null,
              referenceNumber: dto.transfer.referenceNumber ?? null,
              // A transfer is collected when recorded (decided 2026-10-08).
              status: PaymentInstrumentStatus.CLEARED,
              clearingDate: paidAt,
              recordedById,
              companyId: getRequiredCompanyId(),
            },
          })
        : null;
      return tx.deposit.create({
        data: {
          type: depositType,
          contractId: dto.contractId,
          installmentId: dto.installmentId,
          amount: new Prisma.Decimal(dto.amount),
          paidAt,
          receiptUrl: dto.receiptUrl ?? null,
          paymentMethod,
          paymentInstrumentId: transfer?.id ?? null,
          recordedById,
        },
      });
    });
    // Mirror the receipt as a first-class document (best-effort; legacy
    // receiptUrl is already persisted on the deposit).
    if (dto.receiptUrl) {
      await this.tryLinkReceiptDocument(deposit.id, dto.receiptUrl, recordedById);
    }
    // P4 — event: deposit recorded. Notify the customer (contract owner).
    // Safe payload: amount (high-level string) only — no card data, no
    // receipt URL, no internal ids beyond contractId for routing.
    await this.notifications.sendToUser(
      contract.customerId,
      'deposit_recorded',
      {
        contractId: deposit.contractId,
        amount: deposit.amount.toString(),
      },
    );
    return deposit;
  }

  async list(opts: ListDepositsOpts) {
    const and: Prisma.DepositWhereInput[] = [];

    // Legacy filters (kept for backward compatibility with customer portal)
    if (opts.contractId) and.push({ contractId: opts.contractId });
    // Customer scope must include BOTH contract-linked deposits AND
    // reservation-linked BOOKING_AMOUNT deposits. Booking-amount deposits carry
    // contractId = null and bind to the customer through the reservation's
    // client (or its linked lead's client), so matching only `contract.
    // customerId` silently dropped them — that's why /me/deposits showed the
    // booking payment as 0. Mirror the reservation ownership paths used by
    // GET /me/reservations (direct clientId + lead.clientId).
    if (opts.customerId) {
      and.push({
        OR: [
          { contract: { customerId: opts.customerId } },
          { reservation: { clientId: opts.customerId } },
          { reservation: { lead: { is: { clientId: opts.customerId } } } },
        ],
      });
    }

    // Type filter
    if (opts.type) and.push({ type: opts.type });

    // Verified filter
    if (opts.verified !== undefined) and.push({ verified: opts.verified });

    // P11 — review status filter for the admin review queue.
    if (opts.reviewStatus) and.push({ reviewStatus: opts.reviewStatus });
    // FG-01 — "under review" means waiting on a reviewer, not on the bank.
    if (opts.reviewStatus === DepositReviewStatus.PENDING_REVIEW) and.push(notAwaitingChequeWhere);

    // Unit filter (contract unit OR reservation unit)
    if (opts.unitId) {
      and.push({
        OR: [
          { contract: { unitId: opts.unitId } },
          { reservation: { unitId: opts.unitId } },
        ],
      });
    }

    // Project filter — Unit → Building → Phase → Project (3 hops)
    if (opts.projectId) {
      and.push({
        OR: [
          { contract: { unit: { building: { phase: { projectId: opts.projectId } } } } },
          { reservation: { unit: { building: { phase: { projectId: opts.projectId } } } } },
        ],
      });
    }

    // Customer name search
    if (opts.q) {
      and.push({
        OR: [
          { contract: { customer: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
          { reservation: { client: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
          { reservation: { lead: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } } },
        ],
      });
    }

    // Reference search (contract number or reservation number)
    if (opts.ref) {
      and.push({
        OR: [
          { contract: { contractNumber: { contains: opts.ref, mode: Prisma.QueryMode.insensitive } } },
          { reservation: { reservationNumber: { contains: opts.ref, mode: Prisma.QueryMode.insensitive } } },
        ],
      });
    }

    // Paid date range
    if (opts.paidAtFrom || opts.paidAtTo) {
      const filter: Prisma.DateTimeFilter<'Deposit'> = {};
      if (opts.paidAtFrom) filter.gte = new Date(opts.paidAtFrom);
      if (opts.paidAtTo) filter.lte = new Date(opts.paidAtTo);
      and.push({ paidAt: filter });
    }

    // Due date range — installment.dueDate for installment-linked, reservation.expiresAt for BOOKING_AMOUNT
    if (opts.dueDateFrom || opts.dueDateTo) {
      const gte = opts.dueDateFrom ? new Date(opts.dueDateFrom) : undefined;
      const lte = opts.dueDateTo ? new Date(opts.dueDateTo) : undefined;
      and.push({
        OR: [
          { installment: { dueDate: { gte, lte } } },
          {
            AND: [
              { type: DepositType.BOOKING_AMOUNT },
              { reservation: { expiresAt: { gte, lte } } },
            ],
          },
        ],
      });
    }

    const where: Prisma.DepositWhereInput = { deletedAt: null, ...(and.length > 0 ? { AND: and } : {}) };

    // "Paid money" totals exclude proofs that are still pending or were
    // rejected — those are records, not confirmed payments, and must never
    // inflate the customer's "إجمالي المدفوعات". NO_PROOF and APPROVED both
    // count as paid: admin-recorded deposits and admin-confirmed booking
    // amounts legitimately sit at NO_PROOF (with verified=true), while a
    // customer-submitted proof becomes APPROVED on review. The `data` list
    // below still returns every row (pending/rejected included) so they remain
    // visible as records.
    const paidWhere: Prisma.DepositWhereInput = {
      AND: [
        where,
        {
          reviewStatus: {
            notIn: [DepositReviewStatus.PENDING_REVIEW, DepositReviewStatus.REJECTED],
          },
        },
      ],
    };

    const [data, total, groups] = await Promise.all([
      this.prisma.deposit.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { paidAt: 'desc' },
        include: DEPOSIT_INCLUDE,
      }),
      this.prisma.deposit.count({ where }),
      this.prisma.deposit.groupBy({
        by: ['type'],
        where: paidWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Build per-type sums
    const sumMap: Partial<Record<DepositType, Prisma.Decimal>> = {};
    let totalCount = 0;
    for (const g of groups) {
      sumMap[g.type] = g._sum.amount ?? new Prisma.Decimal(0);
      totalCount += g._count.id;
    }
    const zero = new Prisma.Decimal(0);
    const totalAmount = Object.values(sumMap).reduce(
      (acc, v) => acc.add(v ?? zero),
      zero,
    );

    return {
      data,
      meta: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
      },
      totals: {
        totalAmount: totalAmount.toString(),
        bookingAmount: (sumMap[DepositType.BOOKING_AMOUNT] ?? zero).toString(),
        downPayment: (sumMap[DepositType.DOWN_PAYMENT] ?? zero).toString(),
        installment: (sumMap[DepositType.INSTALLMENT] ?? zero).toString(),
        finalPayment: (sumMap[DepositType.FINAL_PAYMENT] ?? zero).toString(),
        count: totalCount,
      },
    };
  }

  /**
   * FG-01 — a deposit paid by a cheque that has not cleared is settled by the
   * cheque (clear → approved and installment paid; bounce → rejected), never
   * by a reviewer: approving it here would mark the installment paid before
   * the bank had paid anything.
   */
  private async assertNotAwaitingCheque(depositId: string): Promise<void> {
    const d = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      select: { paymentInstrument: { select: { status: true } } },
    });
    const status = d?.paymentInstrument?.status;
    if (status && UNCLEARED_INSTRUMENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        'هذه الدفعة بشيك لم يُصرف بعد — تُعتمد بصرف الشيك أو ترفض بارتداده من صفحة الشيكات',
      );
    }
  }

  async verify(id: string, dto: VerifyDepositDto, actor: AuthUser) {
    await this.assertNotAwaitingCheque(id);
    // P11 — keep `verified` in lockstep with `reviewStatus`. Toggling
    // verified=true is equivalent to a manual approve action; verified=false
    // resets the row to the pre-review state (NO_PROOF if no receipt exists,
    // otherwise PENDING_REVIEW). This preserves the legacy semantics while
    // the new approve/reject endpoints carry forward.
    const target = await this.prisma.deposit.findUnique({
      where: { id },
      select: { ...REVERSAL_SELECT, receiptUrl: true },
    });
    if (!target) throw new NotFoundException('Deposit not found');
    const nextReviewStatus: DepositReviewStatus = dto.verified
      ? DepositReviewStatus.APPROVED
      : target.receiptUrl
        ? DepositReviewStatus.PENDING_REVIEW
        : DepositReviewStatus.NO_PROOF;

    // FG-06: un-verifying an APPROVED deposit that already settled an installment
    // must write a PaymentCorrection and reopen the installment. Without this,
    // the deposit status goes back to PENDING_REVIEW but the installment stays
    // PAID — an inconsistency that was the root of FG-06. FG-05: not twice —
    // a deposit already reversed since its last review only changes status.
    const needsReversal =
      !dto.verified &&
      target.reviewStatus === DepositReviewStatus.APPROVED &&
      !!target.installmentId &&
      target.installment?.status === InstallmentStatus.PAID &&
      !(await this.reversedSinceReview(target));

    if (needsReversal) {
      const companyId = getRequiredCompanyId();
      await this.prisma.$transaction(async (tx) => {
        await tx.deposit.update({
          where: { id },
          data: { verified: false, reviewStatus: nextReviewStatus, rejectionReason: null },
        });
        await this.writeReversal(tx, target, 'Deposit un-verified by admin', actor.sub, companyId);
      });
      return this.findOne(id);
    }

    const updated = await this.prisma.deposit.update({
      where: { id },
      data: {
        verified: dto.verified,
        reviewStatus: nextReviewStatus,
        ...(dto.verified ? {} : { rejectionReason: null }),
      },
      include: { contract: { select: { customerId: true } } },
    });
    // P4 — only fire the verified notification when this is a positive
    // verification (verified=true). Un-verifying is a back-office correction
    // and the customer shouldn't be told they "passed verification" twice.
    if (dto.verified) {
      await this.notifications.sendToUser(
        updated.contract?.customerId,
        'deposit_verified',
        {
          contractId: updated.contractId,
          amount: updated.amount.toString(),
        },
      );
    }
    return updated;
  }

  /**
   * Admin manually reverses an APPROVED deposit (deposits:reverse — §6.2).
   * Writes a PaymentCorrection(REVERSAL), reopens the linked installment as
   * PENDING, sets lastCorrectionId, preserves paidAt. All in ONE $transaction.
   *
   * AuditLog entry matches §6.3 deposit.reversed structure exactly.
   */
  async reverseDeposit(id: string, dto: import('./deposits.dto').ReverseDepositDto, actor: AuthUser) {
    const companyId = getRequiredCompanyId();
    const deposit = await this.prisma.deposit.findFirst({
      where: { id, companyId },
      select: REVERSAL_SELECT,
    });
    if (!deposit) throw new NotFoundException('Deposit not found');
    if (deposit.deletedAt) throw new BadRequestException('الدفعة محذوفة');
    await this.assertReversible(deposit);

    await this.prisma.$transaction((tx) =>
      this.writeReversal(tx, deposit, dto.reason.trim(), actor.sub, companyId),
    );

    return this.findOne(id);
  }

  /**
   * FG-05 — throws unless `d` still pays its installment, i.e. reversing it
   * would reopen something:
   *   - it counted towards the installment: APPROVED, or NO_PROOF (an
   *     admin-recorded deposit marks the installment paid when recorded —
   *     reversal used to accept APPROVED only, so those could not be undone);
   *   - it has not been reversed since it was last reviewed (a re-approval
   *     after a reversal counts again — reviewedAt moves past the correction);
   *   - the installment is PAID.
   * writeReversal re-checks the last condition atomically.
   */
  private async assertReversible(d: ReversalDeposit): Promise<void> {
    if (!d.installmentId || !d.installment) {
      throw new BadRequestException('Deposit is not linked to an installment');
    }
    if (!PAYING_REVIEW_STATUSES.includes(d.reviewStatus)) {
      throw new BadRequestException('لا يمكن عكس دفعة لم تُحتسب على القسط (قيد المراجعة أو مرفوضة)');
    }
    if (await this.reversedSinceReview(d)) {
      throw new ConflictException('تم عكس هذه الدفعة بالفعل');
    }
    if (d.installment.status !== InstallmentStatus.PAID) {
      throw new ConflictException('القسط غير مدفوع — لا يوجد ما يُعكس');
    }
  }

  /** A REVERSAL written for `d` after its last review (or creation). */
  private async reversedSinceReview(d: ReversalDeposit): Promise<boolean> {
    const found = await this.prisma.paymentCorrection.findFirst({
      where: {
        depositId: d.id,
        type: PaymentCorrectionType.REVERSAL,
        createdAt: { gte: d.reviewedAt ?? d.createdAt },
      },
      select: { id: true },
    });
    return !!found;
  }

  /**
   * Writes a reversal inside `tx`: reopens the installment (PAID → PENDING,
   * claimed atomically so two concurrent reversals cannot both pass), records
   * a PaymentCorrection(REVERSAL), points the installment's lastCorrectionId
   * at it and writes the §6.3 deposit.reversed audit entry. paidAt is kept
   * (Hard Rule 2 / §3.6); a manual reversal always reopens as PENDING (§5.1).
   */
  private async writeReversal(
    tx: Prisma.TransactionClient,
    d: ReversalDeposit,
    reason: string,
    actorId: string,
    companyId: string,
  ) {
    const installmentId = d.installmentId as string;
    const claimed = await tx.installment.updateMany({
      where: { id: installmentId, status: InstallmentStatus.PAID },
      data: { status: InstallmentStatus.PENDING },
    });
    if (claimed.count === 0) {
      throw new ConflictException('تم عكس هذه الدفعة بالفعل');
    }
    const correction = await tx.paymentCorrection.create({
      data: {
        type: PaymentCorrectionType.REVERSAL,
        depositId: d.id,
        sourceInstallmentId: installmentId,
        reason,
        performedById: actorId,
        companyId,
      },
    });
    await tx.installment.update({
      where: { id: installmentId },
      data: { lastCorrectionId: correction.id },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'deposit.reversed',
        entityType: 'Deposit',
        entityId: d.id,
        before: {
          reviewStatus: d.reviewStatus,
          verified: d.verified,
          amount: Number(d.amount),
        },
        after: {
          correctionId: correction.id,
          correctionType: 'REVERSAL',
          affectedInstallmentId: installmentId,
          installmentPreviousStatus: InstallmentStatus.PAID,
          installmentNewStatus: 'PENDING',
          installmentPaidAtPreserved: d.installment?.paidAt?.toISOString() ?? null,
          reason,
        },
        companyId,
      },
    });
    return correction;
  }

  // ── P11 — Customer payment-proof submission + admin review ────────────

  /**
   * Customer submits a payment proof against one of their own installments.
   * Validates ownership (installment belongs to a contract owned by the
   * caller), creates a Deposit row in PENDING_REVIEW state, and atomically
   * registers the uploaded receipt as a CONTRACT-scoped Document with
   * ADMIN_ONLY visibility (the customer keeps access via signed-download
   * since they're a known peer via ownership.service).
   *
   * Notification fan-out: payment_proof_submitted → ADMIN + SALES_MANAGER.
   * Push failure must never block the business action (see notifications
   * service contract — DB row first, push best-effort try/catch).
   */
  async submitProofForCustomer(userId: string, dto: CustomerSubmitProofDto) {
    // Exactly one target — an installment OR a reservation booking amount.
    const hasInstallment = !!dto.installmentId;
    const hasReservation = !!dto.reservationId;
    if (hasInstallment === hasReservation) {
      throw new BadRequestException(
        'يجب تحديد قسط واحد أو حجز واحد لإرسال إثبات الدفع',
      );
    }
    if (hasReservation) {
      return this.submitBookingProofForCustomer(userId, dto);
    }
    if (dto.amount == null) {
      throw new BadRequestException('المبلغ مطلوب');
    }
    const installment = await this.prisma.installment.findFirst({
      where: { id: dto.installmentId },
      include: {
        plan: { include: { contract: { select: { id: true, customerId: true } } } },
      },
    });
    if (!installment || !installment.plan?.contract) {
      throw new NotFoundException('Installment not found');
    }
    if (installment.plan.contract.customerId !== userId) {
      // 404 not 403 — don't disclose existence of other customers' rows.
      throw new NotFoundException('Installment not found');
    }
    if (installment.status === InstallmentStatus.PAID) {
      throw new BadRequestException('تم تأكيد دفع هذا القسط مسبقاً');
    }
    // Amount sanity — customer should only submit for the installment's
    // expected amount (manual/offline; partial payments are out of scope).
    const expected = Number(installment.amount);
    if (Math.abs(dto.amount - expected) > 0.005) {
      throw new BadRequestException('يجب أن يطابق المبلغ قيمة القسط بالضبط');
    }

    const depositType: DepositType = (() => {
      switch (installment.type) {
        case PlanPaymentType.DOWN_PAYMENT:
          return DepositType.DOWN_PAYMENT;
        case PlanPaymentType.FINAL_PAYMENT:
          return DepositType.FINAL_PAYMENT;
        default:
          return DepositType.INSTALLMENT;
      }
    })();

    // Create the Deposit first (its row needs to exist before
    // DocumentsService validates the DEPOSIT ownerId). Then register the
    // proof Document, then back-link it. Each step is small; failure
    // between them is acceptable (the Deposit lives with NULL
    // proofDocumentId — admin can still see it in the queue and ask the
    // customer to resubmit).
    const created = await this.prisma.deposit.create({
      data: {
        type: depositType,
        contractId: installment.plan!.contractId,
        installmentId: dto.installmentId,
        amount: new Prisma.Decimal(dto.amount),
        paidAt: new Date(dto.paidAt),
        receiptUrl: dto.receiptUrl,
        recordedById: userId,
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        paymentMethod: dto.paymentMethod,
        verified: false,
      },
    });
    const document = await this.documents.create(userId, {
      ownerType: DocumentOwnerType.DEPOSIT,
      ownerId: created.id,
      category: DocumentCategory.RECEIPT,
      title: dto.note?.trim() || 'إثبات الدفع',
      fileUrl: dto.receiptUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      visibility: DocumentVisibility.ADMIN_ONLY,
    });
    const deposit = await this.prisma.deposit.update({
      where: { id: created.id },
      data: { proofDocumentId: document.id },
    });

    // Notify ADMIN/SALES_MANAGER staff. Payload is intentionally minimal:
    // amount as string, dueDate ISO, projectId for routing. No URLs.
    const projectId = await this.resolveProjectIdForDeposit(deposit.id);
    await this.notifyStaff('payment_proof_submitted', {
      depositId: deposit.id,
      installmentDueDate: installment.dueDate.toISOString(),
      amount: deposit.amount.toString(),
      entityType: 'deposit',
      entityId: deposit.id,
      action: 'review_payment_proof',
      ...(projectId ? { projectId } : {}),
    });
    return deposit;
  }

  /**
   * Gap 3 — customer submits a payment proof for a reservation's BOOKING_AMOUNT.
   * Unlike the installment path, a booking deposit carries `reservationId`
   * (contractId stays null) and its amount is the reservation's authoritative
   * `bookingAmount`. Ownership is verified via the reservation's client (direct
   * or through its linked lead) — a mismatch returns 404 (no existence leak).
   *
   * Duplicate guard: at most one pending booking proof per reservation. A prior
   * REJECTED proof does NOT block a fresh submission (resubmission is allowed by
   * creating a new proof). On submit the reservation's booking payment flips to
   * PENDING; approval (DepositsService.approveProof — Gap 2) flips it to PAID,
   * rejection reverts it to UNPAID (see rejectProof).
   */
  async submitBookingProofForCustomer(userId: string, dto: CustomerSubmitProofDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      select: {
        id: true,
        clientId: true,
        reservationNumber: true,
        bookingAmount: true,
        bookingPaymentStatus: true,
        lead: { select: { clientId: true } },
        unit: {
          select: { building: { select: { phase: { select: { projectId: true } } } } },
        },
        deposits: {
          where: { type: DepositType.BOOKING_AMOUNT },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { reviewStatus: true },
        },
      },
    });
    // 404 (not 403) when missing OR not owned by the caller — don't disclose
    // existence of other customers' reservations.
    const owns =
      !!reservation &&
      (reservation.clientId === userId || reservation.lead?.clientId === userId);
    if (!reservation || !owns) {
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.bookingAmount.lte(0)) {
      throw new BadRequestException('لا يوجد مبلغ حجز مستحق على هذا الحجز');
    }
    if (reservation.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID) {
      throw new BadRequestException('تم سداد مبلغ الحجز مسبقاً');
    }
    if (reservation.bookingPaymentStatus === ReservationBookingPaymentStatus.WAIVED) {
      throw new BadRequestException('مبلغ الحجز مُعفى ولا يتطلب دفعاً');
    }
    if (reservation.deposits[0]?.reviewStatus === DepositReviewStatus.PENDING_REVIEW) {
      throw new BadRequestException('يوجد إثبات دفع قيد المراجعة بالفعل لهذا الحجز');
    }

    // Mirror the installment flow: create the Deposit, register the proof
    // Document, back-link it, then reflect PENDING on the reservation. Amount
    // is the reservation's authoritative bookingAmount (client `amount` is
    // ignored here to prevent under/over-statement).
    const created = await this.prisma.deposit.create({
      data: {
        type: DepositType.BOOKING_AMOUNT,
        reservationId: reservation.id,
        contractId: null,
        installmentId: null,
        amount: reservation.bookingAmount,
        paidAt: new Date(dto.paidAt),
        receiptUrl: dto.receiptUrl,
        recordedById: userId,
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        paymentMethod: dto.paymentMethod,
        verified: false,
      },
    });
    const document = await this.documents.create(userId, {
      ownerType: DocumentOwnerType.DEPOSIT,
      ownerId: created.id,
      category: DocumentCategory.RECEIPT,
      title: dto.note?.trim() || 'إثبات دفع مبلغ الحجز',
      fileUrl: dto.receiptUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      visibility: DocumentVisibility.ADMIN_ONLY,
    });
    const deposit = await this.prisma.deposit.update({
      where: { id: created.id },
      data: { proofDocumentId: document.id },
    });
    // Reflect "awaiting review" on the reservation so /me/reservations and the
    // admin reservation view show the pending state without a deposit join.
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { bookingPaymentStatus: ReservationBookingPaymentStatus.PENDING },
    });

    const projectId = reservation.unit?.building?.phase?.projectId ?? null;
    await this.notifyStaff('booking_payment_proof_submitted', {
      depositId: deposit.id,
      reservationId: reservation.id,
      amount: deposit.amount.toString(),
      reference: reservation.reservationNumber ?? '',
      entityType: 'deposit',
      entityId: deposit.id,
      action: 'review_payment_proof',
      ...(projectId ? { projectId } : {}),
    });
    return deposit;
  }

  /**
   * Customer resubmits a payment proof for a deposit currently in REJECTED.
   * Clears the rejectionReason and flips back to PENDING_REVIEW.
   */
  async resubmitProofForCustomer(
    userId: string,
    depositId: string,
    dto: CustomerResubmitProofDto,
  ) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: { contract: { select: { customerId: true } }, installment: true },
    });
    if (!deposit || deposit.contract?.customerId !== userId) {
      throw new NotFoundException('Deposit not found');
    }
    if (deposit.reviewStatus !== DepositReviewStatus.REJECTED) {
      throw new BadRequestException(
        'يمكن إعادة الإرسال فقط بعد رفض الإثبات السابق',
      );
    }

    // Document first (Deposit already exists, so no FK ordering issue).
    const newDoc = await this.documents.create(userId, {
      ownerType: DocumentOwnerType.DEPOSIT,
      ownerId: depositId,
      category: DocumentCategory.RECEIPT,
      title: dto.note?.trim() || 'إعادة إرسال إثبات الدفع',
      fileUrl: dto.receiptUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      visibility: DocumentVisibility.ADMIN_ONLY,
    });
    const updated = await this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        receiptUrl: dto.receiptUrl,
        paymentMethod: dto.paymentMethod,
        ...(dto.paidAt ? { paidAt: new Date(dto.paidAt) } : {}),
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
        proofDocumentId: newDoc.id,
        verified: false,
      },
    });

    const projectId = await this.resolveProjectIdForDeposit(depositId);
    await this.notifyStaff('payment_proof_resubmitted', {
      depositId,
      installmentDueDate: deposit.installment?.dueDate.toISOString(),
      amount: updated.amount.toString(),
      ...(projectId ? { projectId } : {}),
    });
    return updated;
  }

  /** Admin approves a customer-submitted payment proof. Mirrors verified=true
   *  and marks the linked Installment as PAID with paidAt. */
  async approveProof(id: string, actor: AuthUser, dto: ApproveDepositDto) {
    await this.assertNotAwaitingCheque(id);
    const target = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        contract: { select: { customerId: true } },
        installment: { select: { id: true, status: true, dueDate: true } },
        reservation: { select: { id: true, clientId: true, bookingPaymentStatus: true } },
      },
    });
    if (!target) throw new NotFoundException('Deposit not found');
    // Idempotent — already-approved deposits whose side effect is already in
    // place return the current row untouched. Two side-effect shapes exist:
    // installment-linked (installment PAID) and BOOKING_AMOUNT (reservation
    // booking PAID).
    const installmentSettled =
      target.reviewStatus === DepositReviewStatus.APPROVED &&
      target.installment?.status === InstallmentStatus.PAID;
    const bookingSettled =
      target.reviewStatus === DepositReviewStatus.APPROVED &&
      target.type === DepositType.BOOKING_AMOUNT &&
      target.reservation?.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID;
    if (installmentSettled || bookingSettled) {
      return target;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.deposit.update({
        where: { id },
        data: {
          reviewStatus: DepositReviewStatus.APPROVED,
          verified: true,
          rejectionReason: null,
          reviewedAt: new Date(),
          reviewedById: actor.sub,
        },
      });
      if (target.installment) {
        await tx.installment.update({
          where: { id: target.installment.id },
          data: { status: InstallmentStatus.PAID, paidAt: next.paidAt },
        });
      }
      // BOOKING_AMOUNT proofs bind to a Reservation (contractId is null), so
      // approving one must flip the reservation's booking payment to PAID —
      // the same source-of-truth update the admin confirm-booking path makes
      // (reservations.confirmBookingPayment). Without this, /me/reservations
      // keeps showing the booking as UNPAID after approval. Snapshot fields
      // (bookingAmount / mode / percent) are intentionally left untouched.
      if (target.type === DepositType.BOOKING_AMOUNT && target.reservationId) {
        await tx.reservation.update({
          where: { id: target.reservationId },
          data: {
            bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
            bookingPaidAt: next.paidAt,
          },
        });
      }
      return next;
    });

    // Recipient is the contract owner for installment deposits, or the
    // reservation's client for BOOKING_AMOUNT deposits (no contract).
    await this.notifications.sendToUser(
      target.contract?.customerId ?? target.reservation?.clientId,
      'payment_proof_approved',
      {
        depositId: id,
        installmentDueDate: target.installment?.dueDate.toISOString(),
        amount: updated.amount.toString(),
        contractId: updated.contractId,
        ...(target.reservationId
          ? { entityType: 'reservation', entityId: target.reservationId }
          : {}),
      },
    );
    if (dto.note) {
      this.logger.log(`Deposit ${id} approved by ${actor.sub} with note: ${dto.note.slice(0, 80)}`);
    }
    return updated;
  }

  /** Admin rejects a customer-submitted payment proof with a required
   *  reason. Customer notification carries only a short snippet of the
   *  reason (first 140 chars) — internal notes stay server-side. */
  async rejectProof(id: string, actor: AuthUser, dto: RejectDepositDto) {
    await this.assertNotAwaitingCheque(id);
    const target = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        contract: { select: { customerId: true } },
        installment: { select: { id: true, dueDate: true } },
        reservation: { select: { id: true, clientId: true } },
      },
    });
    if (!target) throw new NotFoundException('Deposit not found');
    if (target.reviewStatus !== DepositReviewStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'يمكن رفض الإثبات فقط من حالة قيد المراجعة',
      );
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('سبب الرفض مطلوب');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.deposit.update({
        where: { id },
        data: {
          reviewStatus: DepositReviewStatus.REJECTED,
          verified: false,
          rejectionReason: reason.slice(0, 2000),
          reviewedAt: new Date(),
          reviewedById: actor.sub,
        },
      });
      // Booking proofs flip the reservation to PENDING on submit; rejecting one
      // reverts it to UNPAID so the customer can resubmit. (The rejected
      // Deposit row keeps the reason for the customer to see.)
      if (target.type === DepositType.BOOKING_AMOUNT && target.reservationId) {
        await tx.reservation.update({
          where: { id: target.reservationId },
          data: { bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID },
        });
      }
      return next;
    });

    const reasonShort = reason.length > 140 ? `${reason.slice(0, 137)}...` : reason;
    await this.notifications.sendToUser(
      target.contract?.customerId ?? target.reservation?.clientId,
      'payment_proof_rejected',
      {
        depositId: id,
        installmentDueDate: target.installment?.dueDate.toISOString(),
        amount: updated.amount.toString(),
        reasonShort,
        ...(target.reservationId
          ? { entityType: 'reservation', entityId: target.reservationId }
          : {}),
      },
    );
    return updated;
  }

  /**
   * P11.6.1 — staff/admin signed download for a deposit's payment-proof
   * document. Mirrors the customer signed-download (GET /me/documents/:id/
   * download) but is keyed by the DEPOSIT, with strict proof-type safety so a
   * reviewer can only ever reach THAT deposit's RECEIPT proof — never an
   * unrelated contract / maintenance file.
   *
   * Returns ONLY a short-lived signed URL + display metadata. NEVER returns the
   * permanent fileUrl or the storage key, and the signed URL is never logged.
   * A missing deposit / missing proof / type-or-owner mismatch all return a
   * friendly 404 (no existence leak).
   */
  async getProofDownloadLink(
    depositId: string,
  ): Promise<{ url: string; fileName: string | null; contentType: string | null; expiresIn: number }> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      select: { id: true, proofDocumentId: true },
    });
    if (!deposit) throw new NotFoundException('Deposit not found');
    if (!deposit.proofDocumentId) {
      throw new NotFoundException('لا يوجد إثبات دفع مرفق');
    }

    // Resolve the proof STRICTLY: it must be this deposit's RECEIPT document
    // (ownerType=DEPOSIT, ownerId=deposit.id, category=RECEIPT). A mismatch —
    // e.g. a doctored proofDocumentId pointing at a contract file — yields 404.
    const doc = await this.prisma.document.findFirst({
      where: {
        id: deposit.proofDocumentId,
        ownerType: DocumentOwnerType.DEPOSIT,
        ownerId: deposit.id,
        category: DocumentCategory.RECEIPT,
        deletedAt: null,
      },
      select: { fileUrl: true, fileName: true, mimeType: true },
    });
    if (!doc) throw new NotFoundException('Payment proof not found');

    const key = this.r2.keyFromPublicUrl(doc.fileUrl);
    const signed = await this.r2.createPresignedDownload({
      key,
      fileName: doc.fileName,
      contentType: doc.mimeType,
    });
    return {
      url: signed.url,
      fileName: doc.fileName,
      contentType: doc.mimeType,
      expiresIn: signed.expiresIn,
    };
  }

  /** Resolve the projectId for a deposit via its contract → unit → building
   *  → phase chain. Used to route the staff-side notification. */
  private async resolveProjectIdForDeposit(depositId: string): Promise<string | null> {
    const row = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      select: {
        contract: {
          select: {
            unit: { select: { building: { select: { phase: { select: { projectId: true } } } } } },
          },
        },
      },
    });
    return row?.contract?.unit?.building?.phase?.projectId ?? null;
  }

  /** Fan-out to ADMIN + SALES_MANAGER. Best-effort: failures during the
   *  recipient lookup log but never throw, mirroring the notifications
   *  service contract. */
  private async notifyStaff(templateCode: string, payload: Record<string, unknown>) {
    try {
      const staff = await scopedUserFindMany(
        this.prisma,
        { role: { in: [UserRole.ADMIN, UserRole.SALES_MANAGER] }, active: true },
        { id: true },
      );
      for (const u of staff) {
        await this.notifications.sendToUser(u.id, templateCode, payload);
      }
    } catch (err) {
      this.logger.warn(
        `notifyStaff(${templateCode}) failed: ${(err as Error).message}`,
      );
    }
  }
}

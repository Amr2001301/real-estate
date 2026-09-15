import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DepositReviewStatus,
  PaymentCorrectionType,
  PaymentInstrumentStatus,
  PaymentInstrumentType,
  PlanPaymentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { NotificationsService } from '../notifications/notifications.module';
import {
  CreatePaymentInstrumentDto,
  RecordBounceDto,
  RecordClearingDto,
  ReplaceInstrumentDto,
} from './payment-instruments.dto';

// Compute the status an installment should be re-opened to after a Sub-case B
// bounce, per the operator-submitted installmentAction (§4.4).
function computeReopenStatus(
  dueDate: Date,
  action: 'REOPEN_AS_OVERDUE' | 'REOPEN_AS_PENDING',
): 'PENDING' | 'OVERDUE' {
  if (action === 'REOPEN_AS_PENDING') return 'PENDING';
  return dueDate < new Date() ? 'OVERDUE' : 'PENDING';
}

// Valid state-machine transitions (from → to)
const VALID_TRANSITIONS: Partial<Record<PaymentInstrumentStatus, PaymentInstrumentStatus[]>> = {
  [PaymentInstrumentStatus.PENDING_CLEARANCE]: [
    PaymentInstrumentStatus.DEPOSITED,
    PaymentInstrumentStatus.CANCELLED,
  ],
  [PaymentInstrumentStatus.DEPOSITED]: [
    PaymentInstrumentStatus.CLEARED,
    PaymentInstrumentStatus.BOUNCED,
  ],
  [PaymentInstrumentStatus.BOUNCED]: [
    PaymentInstrumentStatus.REPLACED,
  ],
};

@Injectable()
export class ChequeLifecycleService {
  private readonly logger = new Logger(ChequeLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** Load a PI, assert it belongs to the current tenant, throw 404 if absent. */
  private async loadOwned(id: string) {
    const companyId = getRequiredCompanyId();
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, companyId },
      include: {
        deposits: {
          select: {
            id: true,
            reviewStatus: true,
            installmentId: true,
            installment: {
              select: { id: true, status: true, dueDate: true, paidAt: true, planId: true },
            },
          },
        },
      },
    });
    if (!pi) throw new NotFoundException('PaymentInstrument not found');
    return pi;
  }

  /** Assert a transition is allowed by the state machine. */
  private assertTransition(current: PaymentInstrumentStatus, next: PaymentInstrumentStatus) {
    const allowed = VALID_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid transition: ${current} → ${next}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreatePaymentInstrumentDto, recordedById: string) {
    const companyId = getRequiredCompanyId();
    return this.prisma.paymentInstrument.create({
      data: {
        type: dto.type,
        bankName: dto.bankName ?? null,
        referenceNumber: dto.referenceNumber ?? null,
        chequeNumber: dto.chequeNumber ?? null,
        drawerBankName: dto.drawerBankName ?? null,
        chequeDueDate: dto.chequeDueDate ? new Date(dto.chequeDueDate) : null,
        status: PaymentInstrumentStatus.PENDING_CLEARANCE,
        recordedById,
        companyId,
      },
    });
  }

  // ── Find ────────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const companyId = getRequiredCompanyId();
    const pi = await this.prisma.paymentInstrument.findFirst({
      where: { id, companyId },
      include: {
        deposits: {
          select: {
            id: true,
            reviewStatus: true,
            installmentId: true,
            amount: true,
            paidAt: true,
            paymentMethod: true,
            installment: { select: { id: true, status: true, dueDate: true, amount: true } },
          },
        },
        recordedBy: { select: { id: true, fullName: true } },
        replacedBy: { select: { id: true, status: true, type: true, chequeNumber: true } },
      },
    });
    if (!pi) throw new NotFoundException('PaymentInstrument not found');
    return pi;
  }

  // ── PENDING_CLEARANCE → DEPOSITED ──────────────────────────────────────────

  async transitionToDeposited(id: string) {
    const pi = await this.loadOwned(id);
    this.assertTransition(pi.status, PaymentInstrumentStatus.DEPOSITED);
    return this.prisma.paymentInstrument.update({
      where: { id },
      data: { status: PaymentInstrumentStatus.DEPOSITED },
    });
  }

  // ── PENDING_CLEARANCE → CANCELLED ──────────────────────────────────────────

  async transitionToCancelled(id: string) {
    const pi = await this.loadOwned(id);
    this.assertTransition(pi.status, PaymentInstrumentStatus.CANCELLED);
    return this.prisma.paymentInstrument.update({
      where: { id },
      data: { status: PaymentInstrumentStatus.CANCELLED },
    });
  }

  // ── DEPOSITED → CLEARED ─────────────────────────────────────────────────────
  //
  // In a single $transaction:
  // 1. PI.status = CLEARED, clearingDate = now() (or supplied value)
  // 2. Linked PENDING_REVIEW Deposits: reviewStatus = APPROVED, verified = true
  // 3. Their linked Installments: status = PAID, paidAt = clearingDate

  async transitionToCleared(id: string, dto: RecordClearingDto) {
    const pi = await this.loadOwned(id);
    this.assertTransition(pi.status, PaymentInstrumentStatus.CLEARED);

    const clearingDate = dto.clearingDate ? new Date(dto.clearingDate) : new Date();
    const pendingDepositIds = pi.deposits
      .filter((d) => d.reviewStatus === DepositReviewStatus.PENDING_REVIEW)
      .map((d) => d.id);
    const installmentIds = pi.deposits
      .filter((d) => d.reviewStatus === DepositReviewStatus.PENDING_REVIEW && d.installmentId)
      .map((d) => d.installmentId as string);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentInstrument.update({
        where: { id },
        data: { status: PaymentInstrumentStatus.CLEARED, clearingDate },
      });
      if (pendingDepositIds.length > 0) {
        await tx.deposit.updateMany({
          where: { id: { in: pendingDepositIds } },
          data: { reviewStatus: DepositReviewStatus.APPROVED, verified: true },
        });
      }
      if (installmentIds.length > 0) {
        await tx.installment.updateMany({
          where: { id: { in: installmentIds } },
          data: { status: 'PAID', paidAt: clearingDate },
        });
      }
    });

    return this.findOne(id);
  }

  // ── DEPOSITED → BOUNCED ─────────────────────────────────────────────────────
  //
  // Branches per deposit, not per instrument — one cheque may cover deposits
  // at different review states (mixed instrument).
  //
  // Sub-case A (deposit PENDING_REVIEW): deposits → REJECTED; installments unchanged;
  //   zero PaymentCorrection rows. (design §3.4 Sub-case A)
  //
  // Sub-case B (deposit APPROVED): Deposit.reviewStatus stays APPROVED (Hard Rule 2
  //   / §3.6); PaymentCorrection(REVERSAL) written per deposit; installment status
  //   updated per installmentAction setting; lastCorrectionId set; paidAt NOT cleared.
  //   All in ONE $transaction. (design §3.4 Sub-case B, invariants 1–3)

  async recordBounce(id: string, dto: RecordBounceDto, performedById: string) {
    const pi = await this.loadOwned(id);
    this.assertTransition(pi.status, PaymentInstrumentStatus.BOUNCED);

    const bounceDate = new Date(dto.bounceDate);
    const bounceDateStr = bounceDate.toISOString().slice(0, 10);
    const instrumentLabel = pi.chequeNumber ?? pi.referenceNumber ?? pi.id.slice(0, 8);
    const installmentAction = dto.installmentAction ?? 'REOPEN_AS_OVERDUE';

    const pendingDeposits = pi.deposits.filter(
      (d) => d.reviewStatus === DepositReviewStatus.PENDING_REVIEW,
    );
    const approvedDeposits = pi.deposits.filter(
      (d) => d.reviewStatus === DepositReviewStatus.APPROVED,
    );

    const affectedDepositIds = pendingDeposits.map((d) => d.id);
    const rejectionReason = `Instrument bounced — ${pi.type === PaymentInstrumentType.CHEQUE ? 'cheque' : 'transfer'} ${instrumentLabel} returned ${bounceDateStr}`;

    // Determine the installment plan for a potential penalty installment.
    const firstInstallmentWithPlan = pi.deposits.find((d) => d.installment?.planId);
    const planId = firstInstallmentWithPlan?.installment?.planId ?? null;

    let penaltyInstallmentId: string | null = null;
    let correctionRowsWritten = 0;
    const correctionIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentInstrument.update({
        where: { id },
        data: {
          status: PaymentInstrumentStatus.BOUNCED,
          bounceDate,
          bounceReason: dto.bounceReason,
        },
      });

      // ── Sub-case A: PENDING_REVIEW deposits → REJECTED ──────────────────
      if (affectedDepositIds.length > 0) {
        await tx.deposit.updateMany({
          where: { id: { in: affectedDepositIds } },
          data: {
            reviewStatus: DepositReviewStatus.REJECTED,
            rejectionReason,
          },
        });
      }

      // ── Sub-case B: APPROVED deposits — write correction + reopen installment ──
      // Deposit.reviewStatus stays APPROVED (§3.6). paidAt NOT cleared (§3.6 / Hard Rule 2).
      const companyId = getRequiredCompanyId();
      for (const d of approvedDeposits) {
        if (!d.installmentId || !d.installment) continue;

        const correction = await tx.paymentCorrection.create({
          data: {
            type: PaymentCorrectionType.REVERSAL,
            depositId: d.id,
            sourceInstallmentId: d.installmentId,
            reason: dto.bounceReason,
            performedById,
            companyId,
          },
        });
        correctionIds.push(correction.id);
        correctionRowsWritten += 1;

        const newStatus = computeReopenStatus(d.installment.dueDate, installmentAction);
        await tx.installment.update({
          where: { id: d.installmentId },
          data: {
            status: newStatus,
            lastCorrectionId: correction.id,
            // paidAt intentionally NOT cleared — Hard Rule 2 / §3.6
          },
        });
      }

      // BOUNCE_PENALTY installment — only when planId is known and penalty > 0
      if (dto.penaltyAmount > 0 && planId) {
        if (!dto.penaltyDueDate) {
          throw new BadRequestException('penaltyDueDate is required when penaltyAmount > 0');
        }
        const penalty = await tx.installment.create({
          data: {
            planId,
            type: PlanPaymentType.BOUNCE_PENALTY,
            dueDate: new Date(dto.penaltyDueDate),
            amount: new Prisma.Decimal(dto.penaltyAmount),
            status: 'PENDING',
            companyId,
          },
        });
        penaltyInstallmentId = penalty.id;
      } else if (dto.penaltyAmount > 0 && !planId) {
        this.logger.warn(
          `recordBounce(${id}): penaltyAmount > 0 but no linked installment plan found — penalty installment skipped`,
        );
      }

      // AuditLog — §6.3
      const hasSubCaseB = approvedDeposits.length > 0;
      const subCase = hasSubCaseB ? (pendingDeposits.length > 0 ? 'A+B' : 'B') : 'A';
      await tx.auditLog.create({
        data: {
          actorId: performedById,
          action: 'payment-instrument.bounced',
          entityType: 'PaymentInstrument',
          entityId: id,
          before: { status: PaymentInstrumentStatus.DEPOSITED },
          after: {
            status: PaymentInstrumentStatus.BOUNCED,
            bounceDate: bounceDate.toISOString(),
            bounceReason: dto.bounceReason,
            subCase,
            affectedDepositIds: pi.deposits.map((d) => d.id),
            depositsSetToRejected: affectedDepositIds,
            correctionRowsWritten,
            correctionIds,
            penaltyInstallmentId,
          },
          companyId,
        },
      });
    });

    // Post-transaction: best-effort customer notification
    // Find the customer via the first linked contract
    const firstContractDeposit = pi.deposits.find((d) => d.installmentId);
    if (firstContractDeposit) {
      try {
        const plan = await this.prisma.installmentPlan.findFirst({
          where: { id: firstContractDeposit.installment?.planId },
          include: { contract: { select: { customerId: true } } },
        });
        if (plan?.contract?.customerId) {
          await this.notifications.sendToUser(
            plan.contract.customerId,
            'cheque_bounced',
            {
              chequeNumber: instrumentLabel,
              bounceDate: bounceDateStr,
              penaltyAmount: dto.penaltyAmount.toString(),
            },
          ).catch((e: Error) =>
            this.logger.warn(`cheque_bounced notification failed: ${e.message}`),
          );
        }
      } catch (e) {
        this.logger.warn(`cheque_bounced notification lookup failed: ${(e as Error).message}`);
      }
    }

    return this.findOne(id);
  }

  // ── BOUNCED → REPLACED ──────────────────────────────────────────────────────
  //
  // 1. Create new PI with status = PENDING_CLEARANCE.
  // 2. Set original.status = REPLACED, original.replacedById = newPI.id.
  // Old Deposits remain as permanent evidence — not touched.

  async transitionToReplaced(id: string, dto: ReplaceInstrumentDto, recordedById: string) {
    const pi = await this.loadOwned(id);
    this.assertTransition(pi.status, PaymentInstrumentStatus.REPLACED);

    const companyId = getRequiredCompanyId();

    const [newPi] = await this.prisma.$transaction(async (tx) => {
      const replacement = await tx.paymentInstrument.create({
        data: {
          type: dto.type,
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          chequeNumber: dto.chequeNumber ?? null,
          drawerBankName: dto.drawerBankName ?? null,
          chequeDueDate: dto.chequeDueDate ? new Date(dto.chequeDueDate) : null,
          status: PaymentInstrumentStatus.PENDING_CLEARANCE,
          recordedById,
          companyId,
        },
      });
      await tx.paymentInstrument.update({
        where: { id },
        data: {
          status: PaymentInstrumentStatus.REPLACED,
          replacedById: replacement.id,
        },
      });
      return [replacement];
    });

    return newPi;
  }
}

/**
 * Changes to a live contract that keep the deal alive:
 *
 *  - Transfer (تنازل): the contract passes to another customer. Its payments
 *    stay on it; the new customer sees the contract, its schedule and its
 *    booking from then on, and the old one no longer does.
 *  - Unit swap (تبديل): the contract moves to another unit. Money already
 *    paid stays where it is; the unpaid installments absorb the price
 *    difference. The old unit goes back on sale.
 *
 * Both refuse while a payment on the contract waits for review or for its
 * cheque to clear, and both are recorded as a ContractAmendment.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DepositReviewStatus,
  InstallmentStatus,
  PlanPaymentType,
  Prisma,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { findTenantUser, scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import { UNCLEARED_INSTRUMENT_STATUSES } from '../deposits/review-queue';
import {
  CONTRACT_CANCELLED_MESSAGE,
  isDeadContract,
  LIVE_CONTRACT_WHERE,
  SURCHARGE_PAYMENT_TYPES,
} from '../installments/live-contract';
import {
  closeOpenMaintenance,
  resetUnitWarranties,
  startUnitWarranties,
} from './unit-warranties';
import { resolveTransferFeeSettings, TRANSFER_FEE_SETTING_KEYS, transferFeeFor } from './transfer-fee';
import { feeDueDate, feePaymentDays } from '../installments/fee-settings';
import { assertDiscountAllowed, discountPct } from '../installments/discount-policy';
import { addMonths } from '../../common/utils/add-months';
import { companyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { assertUnitOnSale } from '../projects/inventory-blockers';
import { commissionBasis, MARKUP_SNAPSHOT_SELECT } from '../../common/finance/commission-basis';
import { rebalancePayout } from '../broker-payouts/payout-totals';

export class TransferContractDto {
  @IsUUID()
  toCustomerId!: string;

  /**
   * The transfer fee to charge this time. Omitted → the company's
   * transferFee.* setting; 0 → no fee.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  feeAmount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class SwapContractUnitDto {
  @IsUUID()
  unitId!: string;

  /** The contract's price on the new unit. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAmount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class ChangeContractPriceDto {
  /** The contract's new price. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAmount!: number;
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class RescheduleContractDto {
  /** How many months the unpaid monthly installments are spread over. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  months!: number;
  /** The first new installment's due date (YYYY-MM-DD). */
  @IsDateString()
  startsAt!: string;
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

/** Charges added on top of the price — they do not move with it. */
const SURCHARGE_TYPES = SURCHARGE_PAYMENT_TYPES;
const OPEN_STATUSES: InstallmentStatus[] = [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Spread a price change over the unpaid installments, in proportion to their
 * amounts; the last one takes the rounding. Returns the new amounts, in the
 * same order, or null when the unpaid amount cannot absorb a reduction.
 */
export function rescaleUnpaid(amounts: number[], delta: number): number[] | null {
  const cents = amounts.map((a) => Math.round(a * 100));
  const total = cents.reduce((a, c) => a + c, 0);
  const target = total + Math.round(delta * 100);
  if (target < 0 || (total === 0 && target !== 0)) return null;
  if (total === 0) return amounts.map(() => 0);
  const out: number[] = [];
  let used = 0;
  cents.forEach((c, i) => {
    const v = i === cents.length - 1 ? target - used : Math.round((c * target) / total);
    used += v;
    out.push(v / 100);
  });
  return out.some((v) => v < 0) ? null : out;
}

@Injectable()
export class ContractAmendmentsService {
  private readonly logger = new Logger(ContractAmendmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The contract's transfers and swaps, newest first, with names and unit codes. */
  async list(contractId: string) {
    const companyId = getRequiredCompanyId();
    const rows = await this.prisma.contractAmendment.findMany({
      where: { contractId, companyId },
      orderBy: { createdAt: 'desc' },
    });
    const ids = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => !!x))];
    const userIds = ids(rows.flatMap((r) => [r.fromCustomerId, r.toCustomerId, r.performedById]));
    const unitIds = ids(rows.flatMap((r) => [r.fromUnitId, r.toUnitId]));
    const [users, units] = await Promise.all([
      userIds.length ? scopedUserFindMany(this.prisma, { id: { in: userIds } }, { id: true, fullName: true }) : [],
      unitIds.length
        ? this.prisma.unit.findMany({ where: { id: { in: unitIds }, companyId }, select: { id: true, code: true } })
        : [],
    ]);
    const name = new Map(users.map((u) => [u.id, u.fullName]));
    const code = new Map(units.map((u) => [u.id, u.code]));
    return rows.map((r) => ({
      ...r,
      fromCustomerName: r.fromCustomerId ? (name.get(r.fromCustomerId) ?? null) : null,
      toCustomerName: r.toCustomerId ? (name.get(r.toCustomerId) ?? null) : null,
      performedByName: name.get(r.performedById) ?? null,
      fromUnitCode: r.fromUnitId ? (code.get(r.fromUnitId) ?? null) : null,
      toUnitCode: r.toUnitId ? (code.get(r.toUnitId) ?? null) : null,
    }));
  }

  private async liveContract(contractId: string, companyId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, companyId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        signedAt: true,
        createdAt: true,
        customerId: true,
        unitId: true,
        reservationId: true,
        contractNumber: true,
        totalAmount: true,
        unit: { select: { code: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (isDeadContract(contract)) throw new ConflictException(CONTRACT_CANCELLED_MESSAGE);
    return contract;
  }

  /** A payment still on its way belongs to the contract as it is now. */
  private async assertNoWaitingPayments(
    contractId: string,
    reservationId: string | null,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const waiting = await db.deposit.count({
      where: {
        deletedAt: null,
        AND: [
          {
            OR: [
              { contractId },
              { installment: { plan: { contractId } } },
              ...(reservationId ? [{ reservationId }] : []),
            ],
          },
          {
            OR: [
              { reviewStatus: DepositReviewStatus.PENDING_REVIEW },
              { paymentInstrument: { status: { in: UNCLEARED_INSTRUMENT_STATUSES } } },
            ],
          },
        ],
      },
    });
    if (waiting > 0) {
      throw new ConflictException('على العقد دفعة قيد المراجعة أو شيك لم يُصرف — سوِّها أولاً');
    }
  }

  /**
   * Inside the amendment's transaction: lock the contract's installment rows
   * and check again that no payment is on its way. A customer proof locks its
   * installment row before it is created (DepositsService), so a proof sent
   * while the amendment runs either is seen here or waits for it and then
   * meets the amended schedule.
   */
  private async lockSchedule(
    tx: Prisma.TransactionClient,
    contractId: string,
    reservationId: string | null,
    companyId: string,
  ) {
    await tx.$queryRaw`
      SELECT i.id FROM "Installment" i
      JOIN "InstallmentPlan" p ON p.id = i."planId"
      WHERE p."contractId" = ${contractId}::uuid AND p."companyId" = ${companyId}::uuid
      FOR UPDATE OF i`;
    await this.assertNoWaitingPayments(contractId, reservationId, tx);
  }

  // ── Transfer (تنازل) ──────────────────────────────────────────────────────

  async transfer(contractId: string, dto: TransferContractDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.liveContract(contractId, companyId);
    if (dto.toCustomerId === contract.customerId) {
      throw new BadRequestException('العميل الجديد هو نفسه صاحب العقد');
    }
    const to = await findTenantUser(this.prisma, dto.toCustomerId, {
      id: true,
      role: true,
      active: true,
      deletedAt: true,
      fullName: true,
    });
    if (!to || to.deletedAt || to.active === false) throw new BadRequestException('العميل الجديد غير موجود أو غير نشط');
    if (to.role !== UserRole.CLIENT && to.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('لا يمكن نقل العقد إلا لعميل');
    }
    await this.assertNoWaitingPayments(contractId, contract.reservationId);

    // The fee goes on the contract's schedule: the admin's amount, else the
    // company setting. Without a schedule there is nowhere to put it.
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { contractId, companyId, cancelledAt: null },
      select: { id: true },
    });
    let fee = dto.feeAmount;
    if (fee === undefined) {
      const settings = resolveTransferFeeSettings(
        await this.prisma.setting.findMany({
          where: { companyId, key: { in: TRANSFER_FEE_SETTING_KEYS } },
          select: { key: true, value: true },
        }),
      );
      fee = transferFeeFor(Number(contract.totalAmount), settings);
      if (fee > 0 && !plan) {
        this.logger.warn(`transfer ${contractId}: no installment plan — transfer fee ${fee} not charged`);
        fee = 0;
      }
    } else if (fee > 0 && !plan) {
      throw new BadRequestException('لا يوجد جدول أقساط على العقد لإضافة رسوم التنازل — أنشئ الجدول أولاً');
    }
    const feeAmount = fee;
    const feeDue = feeDueDate(new Date(), await feePaymentDays(this.prisma, companyId));

    const fromId = contract.customerId;
    const now = new Date();
    const amendment = await this.prisma.$transaction(async (tx) => {
      await this.lockSchedule(tx, contractId, contract.reservationId, companyId);
      const moved = await tx.contract.updateMany({
        where: { id: contractId, companyId, customerId: fromId, ...LIVE_CONTRACT_WHERE },
        data: { customerId: to.id },
      });
      if (moved.count === 0) throw new ConflictException('تغيّر العقد أثناء التنفيذ — أعد المحاولة');
      // The booking paid on the reservation is part of the contract's money.
      if (contract.reservationId) {
        await tx.reservation.updateMany({
          where: { id: contract.reservationId, companyId },
          data: { clientId: to.id },
        });
      }
      // The previous owner's open maintenance requests are closed, not handed
      // over with their photos (decided 2026-10-16): the new owner files their own.
      const maintenanceClosed = await closeOpenMaintenance(tx, contract.unitId, fromId, companyId);
      // The new owner gets the customer app; the old one keeps it only while
      // they still own another live contract. Both re-authenticate.
      const promoted = await tx.user.updateMany({
        where: { id: to.id, companyId, role: UserRole.CLIENT },
        data: { role: UserRole.CUSTOMER },
      });
      const otherLive = await tx.contract.count({
        where: { customerId: fromId, companyId, id: { not: contractId }, ...LIVE_CONTRACT_WHERE },
      });
      const demoted =
        otherLive === 0
          ? await tx.user.updateMany({
              where: { id: fromId, companyId, role: UserRole.CUSTOMER },
              data: { role: UserRole.CLIENT },
            })
          : { count: 0 };
      const revoke = [...(promoted.count > 0 ? [to.id] : []), ...(demoted.count > 0 ? [fromId] : [])];
      if (revoke.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: revoke }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      let feeInstallmentId: string | null = null;
      if (feeAmount > 0 && plan) {
        feeInstallmentId = (
          await tx.installment.create({
            data: {
              planId: plan.id,
              type: PlanPaymentType.TRANSFER_FEE,
              dueDate: feeDue,
              amount: new Prisma.Decimal(feeAmount),
              status: InstallmentStatus.PENDING,
              companyId,
            },
            select: { id: true },
          })
        ).id;
      }
      const row = await tx.contractAmendment.create({
        data: {
          type: 'TRANSFER',
          contractId,
          fromCustomerId: fromId,
          toCustomerId: to.id,
          feeAmount: feeAmount > 0 ? new Prisma.Decimal(feeAmount) : null,
          reason: dto.reason,
          performedById: actorId,
          companyId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.transferred',
          entityType: 'Contract',
          entityId: contractId,
          before: { customerId: fromId },
          after: { customerId: to.id, reason: dto.reason, feeAmount, feeInstallmentId, maintenanceClosed },
          companyId,
        },
      });
      return row;
    });

    const payload = {
      contractId,
      contractNumber: contract.contractNumber ?? '',
      unitCode: contract.unit?.code ?? '',
      customerName: to.fullName ?? '',
      entityType: 'contract',
      entityId: contractId,
    };
    try {
      await this.notifications.sendToUser(fromId, 'contract_transferred_out', payload, { except: actorId });
      await this.notifications.sendToUser(to.id, 'contract_transferred_in', payload, { except: actorId });
    } catch (err) {
      reportFailure(this.logger, 'notifications', `contract ${contractId} transfer notice failed`, err);
    }
    return amendment;
  }

  // ── Unit swap (تبديل) ─────────────────────────────────────────────────────

  /**
   * The broker commission and the sales bonus follow the contract to its new
   * price and unit (decided 2026-10-16). They are computed on the price after
   * discount, without the instalment markup.
   *
   * Broker commission:
   *  - not yet paid (pending, approved, or on a draft/approved payout): its
   *    amounts are recomputed; when they change, an approved commission goes
   *    back to PENDING for re-approval and leaves its payout, which goes back
   *    to DRAFT with its totals redone.
   *  - paid (its payout is being sent or was sent): it stays as paid; the
   *    difference is a TOP_UP (price up) or CLAWBACK (price down) adjustment,
   *    netted into the broker's next payout.
   * Sales bonus: the same — recomputed (approved → PENDING) until paid; once
   * paid, an ADJUSTMENT entry carries the difference.
   * A fixed-per-unit commission does not depend on the price.
   */
  private async followNewPrice(
    tx: Prisma.TransactionClient,
    contractId: string,
    companyId: string,
    unit: { id: string; building: { phase: { projectId: string } } },
    total: number,
    actorId: string,
    reason: string,
  ) {
    const reservation = await tx.contract.findFirst({
      where: { id: contractId, companyId },
      select: { reservation: { select: MARKUP_SNAPSHOT_SELECT } },
    });
    const basis = commissionBasis(total, reservation?.reservation);
    const brokerCommission = await this.followNewPriceBroker(tx, contractId, companyId, unit, basis, actorId, reason);
    const salesBonus = await this.followNewPriceBonus(tx, contractId, companyId, basis);
    return { brokerCommission, salesBonus };
  }

  private async followNewPriceBroker(
    tx: Prisma.TransactionClient,
    contractId: string,
    companyId: string,
    unit: { id: string; building: { phase: { projectId: string } } },
    basis: Prisma.Decimal,
    actorId: string,
    reason: string,
  ): Promise<'recomputed' | 'returned_for_approval' | 'top_up' | 'clawback' | 'kept' | null> {
    const bc = await tx.brokerCommission.findFirst({
      where: { contractId, companyId },
      select: {
        id: true,
        brokerId: true,
        status: true,
        payoutId: true,
        payout: { select: { status: true } },
        commissionPct: true,
        taxPct: true,
        withholdingPct: true,
        netAmount: true,
        adjustments: { select: { kind: true, amount: true } },
      },
    });
    if (!bc) return null;
    if (bc.status !== 'PENDING' && bc.status !== 'APPROVED') return 'kept';
    const fixed = bc.commissionPct === null;
    const gross = fixed ? null : basis.mul(bc.commissionPct!).div(100).toDecimalPlaces(2);
    const tax = gross?.mul(bc.taxPct).div(100).toDecimalPlaces(2);
    const withholding = gross?.mul(bc.withholdingPct).div(100).toDecimalPlaces(2);
    const net = gross ? gross.sub(tax!).sub(withholding!) : bc.netAmount;

    const paid = bc.payout?.status === 'PROCESSING' || bc.payout?.status === 'PAID';
    if (paid) {
      // What the broker has been or will be paid for this sale so far.
      const owed = bc.adjustments.reduce(
        (sum, a) => (a.kind === 'TOP_UP' ? sum.add(a.amount) : sum.sub(a.amount)),
        new Prisma.Decimal(bc.netAmount),
      );
      const delta = net.sub(owed);
      if (delta.isZero()) return 'kept';
      await tx.brokerCommissionAdjustment.create({
        data: {
          brokerId: bc.brokerId,
          commissionId: bc.id,
          kind: delta.isPositive() ? 'TOP_UP' : 'CLAWBACK',
          amount: delta.abs(),
          reason,
          createdById: actorId,
          companyId,
        },
      });
      return delta.isPositive() ? 'top_up' : 'clawback';
    }

    const data: Prisma.BrokerCommissionUncheckedUpdateManyInput = {
      basisAmount: basis,
      unitId: unit.id,
      projectId: unit.building.phase.projectId,
    };
    const changed = !net.equals(bc.netAmount);
    if (gross) Object.assign(data, { grossAmount: gross, taxAmount: tax, withholdingAmount: withholding, netAmount: net });
    if (changed && bc.status === 'APPROVED') {
      // Approved for another amount: approved again, and off its payout.
      Object.assign(data, { status: 'PENDING', approvedAt: null, approvedById: null, payoutId: null });
    }
    const moved = await tx.brokerCommission.updateMany({
      where: { id: bc.id, status: bc.status, payoutId: bc.payoutId },
      data,
    });
    if (moved.count === 0) throw new ConflictException('تغيّرت عمولة البروكر أثناء التنفيذ — أعد المحاولة');
    if (changed && bc.payoutId) {
      const reopened = await tx.brokerPayout.updateMany({
        where: { id: bc.payoutId, status: { in: ['DRAFT', 'APPROVED'] } },
        data: { status: 'DRAFT', approvedAt: null, approvedById: null },
      });
      if (reopened.count === 0) throw new ConflictException('تغيّرت دفعة البروكر أثناء التنفيذ — أعد المحاولة');
      await rebalancePayout(tx, bc.payoutId, bc.brokerId);
    }
    return changed && bc.status === 'APPROVED' ? 'returned_for_approval' : 'recomputed';
  }

  private async followNewPriceBonus(
    tx: Prisma.TransactionClient,
    contractId: string,
    companyId: string,
    basis: Prisma.Decimal,
  ): Promise<'recomputed' | 'returned_for_approval' | 'adjusted' | 'kept' | null> {
    const bonus = await tx.bonusEntry.findFirst({
      where: { contractId, companyId },
      select: { id: true, status: true, commissionPct: true, amount: true, salesId: true, ruleId: true },
    });
    if (!bonus) return null;
    if (bonus.commissionPct === null || bonus.status === 'CANCELLED') return 'kept';
    const amount = basis.mul(bonus.commissionPct).div(100).toDecimalPlaces(2);
    if (bonus.status === 'PAID') {
      const earlier = await tx.bonusEntry.aggregate({
        where: { adjustsEntryId: bonus.id, companyId, status: { not: 'CANCELLED' } },
        _sum: { amount: true },
      });
      const delta = amount.sub(bonus.amount).sub(earlier._sum.amount ?? 0);
      if (delta.isZero()) return 'kept';
      await tx.bonusEntry.create({
        data: {
          salesId: bonus.salesId,
          ruleId: bonus.ruleId,
          amount: delta,
          period: new Date().toISOString().slice(0, 7),
          status: 'PENDING',
          source: 'ADJUSTMENT',
          adjustsEntryId: bonus.id,
          basisAmount: basis,
          commissionPct: bonus.commissionPct,
          companyId,
        },
      });
      return 'adjusted';
    }
    const changed = !amount.equals(bonus.amount);
    const moved = await tx.bonusEntry.updateMany({
      where: { id: bonus.id, status: bonus.status },
      data: {
        basisAmount: basis,
        amount,
        // Approved for another amount: approved again.
        ...(changed && bonus.status === 'APPROVED' ? { status: 'PENDING' as const } : {}),
      },
    });
    if (moved.count === 0) throw new ConflictException('تغيّرت مكافأة المبيعات أثناء التنفيذ — أعد المحاولة');
    return changed && bonus.status === 'APPROVED' ? 'returned_for_approval' : 'recomputed';
  }

  /**
   * تعديل السعر — a discount or addendum on a live contract. The unpaid
   * installments absorb the difference (as in a unit swap); a discount below
   * the unit's price goes through the company's cap and is on record; the
   * sales bonus and broker commission follow the new price while unpaid.
   */
  async changePrice(contractId: string, dto: ChangeContractPriceDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.liveContract(contractId, companyId);
    await this.assertNoWaitingPayments(contractId, contract.reservationId);
    const oldTotal = Number(contract.totalAmount);
    const delta = Math.round((dto.totalAmount - oldTotal) * 100) / 100;
    if (delta === 0) throw new BadRequestException('السعر الجديد هو نفس سعر العقد الحالي');
    const unit = await this.prisma.unit.findFirst({
      where: { id: contract.unitId, companyId },
      select: { id: true, price: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await assertDiscountAllowed(this.prisma, {
      companyId,
      actorId,
      pct: discountPct(Number(unit.price), dto.totalAmount),
      listPrice: Number(unit.price),
      salePrice: dto.totalAmount,
      entityType: 'Contract',
      entityId: contractId,
    });

    const plan = await this.prisma.installmentPlan.findFirst({
      where: { contractId, companyId, cancelledAt: null },
      select: {
        id: true,
        installments: {
          where: { status: { in: OPEN_STATUSES }, type: { notIn: SURCHARGE_TYPES } },
          orderBy: { dueDate: 'asc' },
          select: { id: true, amount: true },
        },
      },
    });
    let rescaled: Array<{ id: string; amount: number }> = [];
    let extraRow: { amount: number; dueDate: Date } | null = null;
    if (plan) {
      const open = plan.installments;
      if (open.length > 0) {
        const amounts = rescaleUnpaid(open.map((i) => Number(i.amount)), delta);
        if (!amounts) {
          throw new BadRequestException('السعر الجديد أقل مما دُفع بالفعل — استخدم إلغاء العقد واسترداد المبلغ');
        }
        rescaled = open.map((i, k) => ({ id: i.id, amount: amounts[k]! }));
      } else if (delta > 0) {
        extraRow = { amount: delta, dueDate: new Date(Date.now() + 30 * DAY_MS) };
      } else {
        throw new BadRequestException('العقد مسدَّد بالكامل والسعر الجديد أقل — استخدم إلغاء العقد واسترداد المبلغ');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockSchedule(tx, contractId, contract.reservationId, companyId);
      const moved = await tx.contract.updateMany({
        where: { id: contractId, companyId, totalAmount: contract.totalAmount, ...LIVE_CONTRACT_WHERE },
        data: { totalAmount: new Prisma.Decimal(dto.totalAmount) },
      });
      if (moved.count === 0) throw new ConflictException('تغيّر العقد أثناء التنفيذ — أعد المحاولة');
      for (const r of rescaled) {
        const res = await tx.installment.updateMany({
          where: { id: r.id, status: { in: OPEN_STATUSES } },
          data: { amount: new Prisma.Decimal(r.amount) },
        });
        if (res.count === 0) throw new ConflictException('تغيّر جدول الأقساط أثناء التنفيذ — أعد المحاولة');
      }
      if (plan && extraRow) {
        await tx.installment.create({
          data: {
            planId: plan.id,
            type: PlanPaymentType.FINAL_PAYMENT,
            dueDate: extraRow.dueDate,
            amount: new Prisma.Decimal(extraRow.amount),
            status: InstallmentStatus.PENDING,
            companyId,
          },
        });
      }
      const commissions = await this.followNewPrice(tx, contractId, companyId, unit, dto.totalAmount, actorId, dto.reason);
      const row = await tx.contractAmendment.create({
        data: {
          type: 'PRICE_CHANGE',
          contractId,
          fromTotal: new Prisma.Decimal(oldTotal),
          toTotal: new Prisma.Decimal(dto.totalAmount),
          reason: dto.reason,
          performedById: actorId,
          companyId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.price-changed',
          entityType: 'Contract',
          entityId: contractId,
          before: { totalAmount: oldTotal },
          after: {
            totalAmount: dto.totalAmount,
            rescaledInstallments: rescaled.length,
            addedFinalPayment: extraRow?.amount ?? null,
            ...commissions,
            reason: dto.reason,
          },
          companyId,
        },
      });
      return row;
    });
  }

  /**
   * إعادة جدولة — the unpaid monthly installments are replaced by `months`
   * new ones from `startsAt`, adding up to the same amount to the cent (the
   * last one carries the rounding). Paid rows, the down and final payments
   * and fees stay as they are; the replaced rows are kept, cancelled.
   */
  async reschedule(contractId: string, dto: RescheduleContractDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.liveContract(contractId, companyId);
    await this.assertNoWaitingPayments(contractId, contract.reservationId);
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { contractId, companyId, cancelledAt: null },
      select: {
        id: true,
        totalMonths: true,
        installments: {
          where: { status: { in: OPEN_STATUSES }, type: PlanPaymentType.INSTALLMENT },
          orderBy: { dueDate: 'asc' },
          select: { id: true, amount: true },
        },
      },
    });
    if (!plan) throw new BadRequestException('لا توجد خطة تقسيط على هذا العقد');
    const open = plan.installments;
    if (open.length === 0) throw new BadRequestException('لا توجد أقساط شهرية غير مدفوعة لإعادة جدولتها');
    const totalCents = open.reduce((a, i) => a + Math.round(Number(i.amount) * 100), 0);
    const monthlyCents = Math.floor(totalCents / dto.months);
    if (monthlyCents <= 0) throw new BadRequestException('عدد الشهور أكبر من المبلغ المتبقي');
    const lastCents = totalCents - monthlyCents * (dto.months - 1);
    const startsAt = new Date(`${dto.startsAt.slice(0, 10)}T00:00:00Z`);
    // A first due date already past would make the new rows overdue — and
    // charge late fees — the moment they are created.
    if (startsAt < startOfLocalToday(await companyTimeZone(this.prisma, companyId))) {
      throw new BadRequestException('تاريخ أول قسط في الجدولة الجديدة لا يمكن أن يكون في الماضي');
    }
    const paidMonths = await this.prisma.installment.count({
      where: { planId: plan.id, type: PlanPaymentType.INSTALLMENT, status: InstallmentStatus.PAID },
    });

    return this.prisma.$transaction(async (tx) => {
      await this.lockSchedule(tx, contractId, contract.reservationId, companyId);
      const cancelled = await tx.installment.updateMany({
        where: { id: { in: open.map((i) => i.id) }, status: { in: OPEN_STATUSES } },
        data: { status: InstallmentStatus.CANCELLED },
      });
      if (cancelled.count !== open.length) throw new ConflictException('تغيّر جدول الأقساط أثناء التنفيذ — أعد المحاولة');
      await tx.installment.createMany({
        data: Array.from({ length: dto.months }, (_, i) => ({
          planId: plan.id,
          type: PlanPaymentType.INSTALLMENT,
          dueDate: addMonths(startsAt, i),
          amount: new Prisma.Decimal(i === dto.months - 1 ? lastCents : monthlyCents).div(100),
          status: InstallmentStatus.PENDING,
          companyId,
        })),
      });
      await tx.installmentPlan.update({
        where: { id: plan.id },
        data: { monthlyAmount: new Prisma.Decimal(monthlyCents).div(100), totalMonths: paidMonths + dto.months },
      });
      const row = await tx.contractAmendment.create({
        data: {
          type: 'RESCHEDULE',
          contractId,
          fromTotal: new Prisma.Decimal(totalCents).div(100),
          toTotal: new Prisma.Decimal(totalCents).div(100),
          reason: dto.reason,
          performedById: actorId,
          companyId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.rescheduled',
          entityType: 'Contract',
          entityId: contractId,
          before: { openMonthly: open.length },
          after: { months: dto.months, startsAt: dto.startsAt, monthly: monthlyCents / 100, last: lastCents / 100, reason: dto.reason },
          companyId,
        },
      });
      return row;
    });
  }

  async swapUnit(contractId: string, dto: SwapContractUnitDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.liveContract(contractId, companyId);
    if (dto.unitId === contract.unitId) throw new BadRequestException('الوحدة الجديدة هي نفس وحدة العقد');
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, companyId },
      select: {
        id: true,
        code: true,
        status: true,
        price: true,
        building: { select: { phase: { select: { projectId: true } } } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.assertNoWaitingPayments(contractId, contract.reservationId);
    // Moving to another unit is a sale of that unit: the same archived-project
    // block and discount cap as a new contract or a price change.
    await assertUnitOnSale(this.prisma, unit.id);
    await assertDiscountAllowed(this.prisma, {
      companyId,
      actorId,
      pct: discountPct(Number(unit.price), dto.totalAmount),
      listPrice: Number(unit.price),
      salePrice: dto.totalAmount,
      entityType: 'Contract',
      entityId: contractId,
    });

    const oldTotal = Number(contract.totalAmount);
    const delta = Math.round((dto.totalAmount - oldTotal) * 100) / 100;
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { contractId, companyId, cancelledAt: null },
      select: {
        id: true,
        installments: {
          where: { status: { in: OPEN_STATUSES }, type: { notIn: SURCHARGE_TYPES } },
          orderBy: { dueDate: 'asc' },
          select: { id: true, amount: true, dueDate: true },
        },
      },
    });
    // How the schedule changes: rescale the unpaid rows, or — when nothing is
    // left to pay — add one final payment for a higher price.
    let rescaled: Array<{ id: string; amount: number }> = [];
    let extraRow: { amount: number; dueDate: Date } | null = null;
    if (plan && delta !== 0) {
      const open = plan.installments;
      if (open.length > 0) {
        const amounts = rescaleUnpaid(open.map((i) => Number(i.amount)), delta);
        if (!amounts) {
          throw new BadRequestException('السعر الجديد أقل مما دُفع بالفعل — استخدم إلغاء العقد واسترداد المبلغ');
        }
        rescaled = open.map((i, k) => ({ id: i.id, amount: amounts[k]! }));
      } else if (delta > 0) {
        extraRow = { amount: delta, dueDate: new Date(Date.now() + 30 * DAY_MS) };
      } else {
        throw new BadRequestException('العقد مسدَّد بالكامل والسعر الجديد أقل — استخدم إلغاء العقد واسترداد المبلغ');
      }
    }

    const fromUnitId = contract.unitId;
    const amendment = await this.prisma.$transaction(async (tx) => {
      await this.lockSchedule(tx, contractId, contract.reservationId, companyId);
      // Claim the new unit exactly as a new contract would.
      const claimed = await tx.unit.updateMany({
        where: { id: unit.id, companyId, status: { not: UnitStatus.SOLD } },
        data: { status: UnitStatus.SOLD, reservationExpiresAt: null },
      });
      if (claimed.count === 0) throw new ConflictException('الوحدة الجديدة مباعة بالفعل');
      const liveOnNew = await tx.contract.count({ where: { unitId: unit.id, ...LIVE_CONTRACT_WHERE } });
      if (liveOnNew > 0) throw new ConflictException('على الوحدة الجديدة عقد قائم بالفعل');
      const heldForOther = await tx.reservation.count({
        where: {
          unitId: unit.id,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
          NOT: { OR: [{ clientId: contract.customerId }, { lead: { is: { clientId: contract.customerId } } }] },
        },
      });
      if (heldForOther > 0) throw new ConflictException('الوحدة الجديدة محجوزة لعميل آخر — ألغِ الحجز أولاً');
      await tx.unitStatusHistory.create({
        data: {
          unitId: unit.id,
          oldStatus: unit.status,
          newStatus: UnitStatus.SOLD,
          changedById: actorId,
          reason: `Contract ${contractId} moved here`,
          companyId,
        },
      });

      const moved = await tx.contract.updateMany({
        where: { id: contractId, companyId, unitId: fromUnitId, ...LIVE_CONTRACT_WHERE },
        data: { unitId: unit.id, totalAmount: new Prisma.Decimal(dto.totalAmount) },
      });
      if (moved.count === 0) throw new ConflictException('تغيّر العقد أثناء التنفيذ — أعد المحاولة');
      // The booking paid on the source reservation stays linked to it; the
      // reservation (CONVERTED, history) follows the contract to the new unit
      // so that money is reported with the project the sale now belongs to.
      if (contract.reservationId) {
        await tx.reservation.updateMany({
          where: { id: contract.reservationId, companyId },
          data: { unitId: unit.id },
        });
      }

      for (const r of rescaled) {
        const res = await tx.installment.updateMany({
          where: { id: r.id, status: { in: OPEN_STATUSES } },
          data: { amount: new Prisma.Decimal(r.amount) },
        });
        if (res.count === 0) throw new ConflictException('تغيّر جدول الأقساط أثناء التنفيذ — أعد المحاولة');
      }
      if (plan && extraRow) {
        await tx.installment.create({
          data: {
            planId: plan.id,
            type: PlanPaymentType.FINAL_PAYMENT,
            dueDate: extraRow.dueDate,
            amount: new Prisma.Decimal(extraRow.amount),
            status: InstallmentStatus.PENDING,
            companyId,
          },
        });
      }

      // The old unit goes back on sale, unless another live contract holds it.
      const otherLive = await tx.contract.count({
        where: { unitId: fromUnitId, id: { not: contractId }, ...LIVE_CONTRACT_WHERE },
      });
      if (otherLive === 0) {
        const freed = await tx.unit.updateMany({
          where: { id: fromUnitId, companyId, status: UnitStatus.SOLD },
          data: { status: UnitStatus.AVAILABLE },
        });
        if (freed.count > 0) {
          await tx.unitStatusHistory.create({
            data: {
              unitId: fromUnitId,
              oldStatus: UnitStatus.SOLD,
              newStatus: UnitStatus.AVAILABLE,
              changedById: actorId,
              reason: `Contract ${contractId} moved to unit ${unit.code}`,
              companyId,
            },
          });
          await resetUnitWarranties(tx, fromUnitId);
        }
      }
      const maintenanceClosed = await closeOpenMaintenance(tx, fromUnitId, contract.customerId, companyId);

      const commissions = await this.followNewPrice(tx, contractId, companyId, unit, dto.totalAmount, actorId, dto.reason);

      const row = await tx.contractAmendment.create({
        data: {
          type: 'UNIT_SWAP',
          contractId,
          fromUnitId,
          toUnitId: unit.id,
          fromTotal: new Prisma.Decimal(oldTotal),
          toTotal: new Prisma.Decimal(dto.totalAmount),
          reason: dto.reason,
          performedById: actorId,
          companyId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.unit-swapped',
          entityType: 'Contract',
          entityId: contractId,
          before: { unitId: fromUnitId, totalAmount: oldTotal },
          after: {
            unitId: unit.id,
            totalAmount: dto.totalAmount,
            rescaledInstallments: rescaled.length,
            addedFinalPayment: extraRow?.amount ?? null,
            maintenanceClosed,
            ...commissions,
            reason: dto.reason,
          },
          companyId,
        },
      });
      return row;
    });

    // A signed sale's warranties now run on the new unit.
    if (contract.signedAt) {
      try {
        await startUnitWarranties(this.prisma, unit.id, contract.createdAt);
      } catch (err) {
        reportFailure(this.logger, 'contracts', `contract ${contractId} warranty start on swap failed`, err);
      }
    }
    try {
      await this.notifications.sendToUser(
        contract.customerId,
        'contract_unit_swapped',
        {
          contractId,
          contractNumber: contract.contractNumber ?? '',
          oldUnitCode: contract.unit?.code ?? '',
          unitCode: unit.code,
          totalAmount: dto.totalAmount,
          entityType: 'contract',
          entityId: contractId,
        },
        { except: actorId },
      );
    } catch (err) {
      reportFailure(this.logger, 'notifications', `contract ${contractId} swap notice failed`, err);
    }
    return amendment;
  }
}

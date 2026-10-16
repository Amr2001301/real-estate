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
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { findTenantUser, scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import { UNCLEARED_INSTRUMENT_STATUSES } from '../deposits/review-queue';
import { CONTRACT_CANCELLED_MESSAGE, isDeadContract, LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { resetUnitWarranties } from './contract-cancellation.service';
import { startUnitWarranties } from './unit-warranties';
import { resolveTransferFeeSettings, TRANSFER_FEE_SETTING_KEYS, transferFeeFor } from './transfer-fee';

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

/** Charges added on top of the price — they do not move with it. */
const SURCHARGE_TYPES: PlanPaymentType[] = [
  PlanPaymentType.LATE_FEE,
  PlanPaymentType.BOUNCE_PENALTY,
  PlanPaymentType.TRANSFER_FEE,
];
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
  private async assertNoWaitingPayments(contractId: string, reservationId: string | null) {
    const waiting = await this.prisma.deposit.count({
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

    const fromId = contract.customerId;
    const now = new Date();
    const amendment = await this.prisma.$transaction(async (tx) => {
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
              dueDate: now,
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
          after: { customerId: to.id, reason: dto.reason, feeAmount, feeInstallmentId },
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
   * Commissions not yet paid out follow the contract to its new price and
   * unit: the broker commission while it is pending or approved and not on
   * a payout, the sales bonus until it is paid. Anything already on a payout
   * or paid keeps its amount — the audit row says which.
   */
  private async followNewPrice(
    tx: Prisma.TransactionClient,
    contractId: string,
    companyId: string,
    unit: { id: string; building: { phase: { projectId: string } } },
    total: number,
  ) {
    const basis = new Prisma.Decimal(total);
    let brokerCommission: 'recomputed' | 'kept' | null = null;
    const bc = await tx.brokerCommission.findFirst({
      where: { contractId, companyId },
      select: { id: true, status: true, payoutId: true, commissionPct: true, taxPct: true, withholdingPct: true },
    });
    if (bc) {
      const open = (bc.status === 'PENDING' || bc.status === 'APPROVED') && !bc.payoutId;
      if (open) {
        const data: Prisma.BrokerCommissionUpdateManyMutationInput & { unitId: string; projectId: string } = {
          basisAmount: basis,
          unitId: unit.id,
          projectId: unit.building.phase.projectId,
        };
        // A fixed-per-unit commission keeps its amount; a percentage follows the price.
        if (bc.commissionPct !== null) {
          const gross = basis.mul(bc.commissionPct).div(100).toDecimalPlaces(2);
          const tax = gross.mul(bc.taxPct).div(100).toDecimalPlaces(2);
          const withholding = gross.mul(bc.withholdingPct).div(100).toDecimalPlaces(2);
          Object.assign(data, {
            grossAmount: gross,
            taxAmount: tax,
            withholdingAmount: withholding,
            netAmount: gross.sub(tax).sub(withholding),
          });
        }
        await tx.brokerCommission.updateMany({ where: { id: bc.id, payoutId: null }, data });
        brokerCommission = 'recomputed';
      } else {
        brokerCommission = 'kept';
      }
    }
    let salesBonus: 'recomputed' | 'kept' | null = null;
    const bonus = await tx.bonusEntry.findFirst({
      where: { contractId, companyId },
      select: { id: true, status: true, commissionPct: true },
    });
    if (bonus) {
      if ((bonus.status === 'PENDING' || bonus.status === 'APPROVED') && bonus.commissionPct !== null) {
        await tx.bonusEntry.updateMany({
          where: { id: bonus.id, status: { in: ['PENDING', 'APPROVED'] } },
          data: { basisAmount: basis, amount: basis.mul(bonus.commissionPct).div(100).toDecimalPlaces(2) },
        });
        salesBonus = 'recomputed';
      } else {
        salesBonus = 'kept';
      }
    }
    return { brokerCommission, salesBonus };
  }

  async swapUnit(contractId: string, dto: SwapContractUnitDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.liveContract(contractId, companyId);
    if (dto.unitId === contract.unitId) throw new BadRequestException('الوحدة الجديدة هي نفس وحدة العقد');
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, companyId },
      select: { id: true, code: true, status: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.assertNoWaitingPayments(contractId, contract.reservationId);

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

      const commissions = await this.followNewPrice(tx, contractId, companyId, unit, dto.totalAmount);

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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClawbackStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CollectClawbackDto,
  WaiveClawbackDto,
} from './dto/broker-commission.dto';

// Resolvable states — OUTSTANDING means nothing collected yet; PARTIALLY_COLLECTED
// means partial repayment has been received and more is still owed.
const RESOLVABLE: ClawbackStatus[] = [
  ClawbackStatus.OUTSTANDING,
  ClawbackStatus.PARTIALLY_COLLECTED,
];

@Injectable()
export class ClawbackResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── BrokerCommission clawback resolve ─────────────────────────────────────

  async collectCommission(
    id: string,
    dto: CollectClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
        netAmount: true,
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (!commission.clawbackStatus) {
      throw new ConflictException(
        'This commission has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be resolved',
      );
    }
    if (!RESOLVABLE.includes(commission.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${commission.clawbackStatus}; cannot resolve again`,
      );
    }

    const collected = dto.amount;
    const previouslyCollected = commission.clawbackCollectedAmount
      ? Number(commission.clawbackCollectedAmount)
      : 0;
    const newTotal = new Prisma.Decimal(previouslyCollected).add(new Prisma.Decimal(collected));
    const fullAmount = commission.netAmount;
    const newStatus: ClawbackStatus = newTotal.gte(fullAmount)
      ? ClawbackStatus.COLLECTED
      : ClawbackStatus.PARTIALLY_COLLECTED;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.brokerCommission.update({
        where: { id },
        data: {
          // Hard Rule 2: commission.status is NEVER changed
          clawbackStatus: newStatus,
          clawbackCollectedAt: now,
          clawbackCollectedById: actor.sub,
          clawbackCollectedAmount: newTotal,
          clawbackCollectedReference: dto.reference ?? null,
          clawbackCollectedPaymentMethod: dto.paymentMethod,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'commission.clawback.collected',
          entityType: 'BrokerCommission',
          entityId: id,
          before: {
            clawbackStatus: commission.clawbackStatus,
            clawbackCollectedAmount: commission.clawbackCollectedAmount?.toString() ?? null,
            commissionStatus: commission.status,
          },
          after: {
            clawbackStatus: newStatus,
            collectedThisCall: collected,
            clawbackCollectedAmount: newTotal.toString(),
            clawbackCollectedReference: dto.reference ?? null,
            clawbackCollectedPaymentMethod: dto.paymentMethod,
            fullAmount: fullAmount.toString(),
            commissionStatusUnchanged: commission.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  async waiveCommission(
    id: string,
    dto: WaiveClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (!commission.clawbackStatus) {
      throw new ConflictException(
        'This commission has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be waived',
      );
    }
    if (!RESOLVABLE.includes(commission.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${commission.clawbackStatus}; cannot waive again`,
      );
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.brokerCommission.update({
        where: { id },
        data: {
          // Hard Rule 2: commission.status is NEVER changed
          clawbackStatus: ClawbackStatus.WAIVED,
          clawbackWaivedAt: now,
          clawbackWaivedById: actor.sub,
          clawbackWaiveReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'commission.clawback.waived',
          entityType: 'BrokerCommission',
          entityId: id,
          before: {
            clawbackStatus: commission.clawbackStatus,
            clawbackCollectedAmount: commission.clawbackCollectedAmount?.toString() ?? null,
            commissionStatus: commission.status,
          },
          after: {
            clawbackStatus: ClawbackStatus.WAIVED,
            clawbackWaiveReason: reason,
            commissionStatusUnchanged: commission.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  // ── BonusEntry clawback resolve ──────────────────────────────────────────
  // Simpler path: BonusEntryStatus has a real PAID value; no payout batching.

  async collectBonus(
    id: string,
    dto: CollectClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const bonus = await this.prisma.bonusEntry.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
        amount: true,
      },
    });
    if (!bonus) throw new NotFoundException('BonusEntry not found');
    if (!bonus.clawbackStatus) {
      throw new ConflictException(
        'This bonus entry has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be resolved',
      );
    }
    if (!RESOLVABLE.includes(bonus.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${bonus.clawbackStatus}; cannot resolve again`,
      );
    }

    const collected = dto.amount;
    const previouslyCollected = bonus.clawbackCollectedAmount
      ? Number(bonus.clawbackCollectedAmount)
      : 0;
    const newTotal = new Prisma.Decimal(previouslyCollected).add(new Prisma.Decimal(collected));
    const fullAmount = bonus.amount;
    const newStatus: ClawbackStatus = newTotal.gte(fullAmount)
      ? ClawbackStatus.COLLECTED
      : ClawbackStatus.PARTIALLY_COLLECTED;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bonusEntry.update({
        where: { id },
        data: {
          // Hard Rule 2: bonusEntry.status is NEVER changed
          clawbackStatus: newStatus,
          clawbackCollectedAt: now,
          clawbackCollectedById: actor.sub,
          clawbackCollectedAmount: newTotal,
          clawbackCollectedReference: dto.reference ?? null,
          clawbackCollectedPaymentMethod: dto.paymentMethod,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'bonus.clawback.collected',
          entityType: 'BonusEntry',
          entityId: id,
          before: {
            clawbackStatus: bonus.clawbackStatus,
            clawbackCollectedAmount: bonus.clawbackCollectedAmount?.toString() ?? null,
            bonusStatus: bonus.status,
          },
          after: {
            clawbackStatus: newStatus,
            collectedThisCall: collected,
            clawbackCollectedAmount: newTotal.toString(),
            clawbackCollectedReference: dto.reference ?? null,
            clawbackCollectedPaymentMethod: dto.paymentMethod,
            fullAmount: fullAmount.toString(),
            bonusStatusUnchanged: bonus.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  async waiveBonus(
    id: string,
    dto: WaiveClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const bonus = await this.prisma.bonusEntry.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
      },
    });
    if (!bonus) throw new NotFoundException('BonusEntry not found');
    if (!bonus.clawbackStatus) {
      throw new ConflictException(
        'This bonus entry has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be waived',
      );
    }
    if (!RESOLVABLE.includes(bonus.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${bonus.clawbackStatus}; cannot waive again`,
      );
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bonusEntry.update({
        where: { id },
        data: {
          // Hard Rule 2: bonusEntry.status is NEVER changed
          clawbackStatus: ClawbackStatus.WAIVED,
          clawbackWaivedAt: now,
          clawbackWaivedById: actor.sub,
          clawbackWaiveReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'bonus.clawback.waived',
          entityType: 'BonusEntry',
          entityId: id,
          before: {
            clawbackStatus: bonus.clawbackStatus,
            clawbackCollectedAmount: bonus.clawbackCollectedAmount?.toString() ?? null,
            bonusStatus: bonus.status,
          },
          after: {
            clawbackStatus: ClawbackStatus.WAIVED,
            clawbackWaiveReason: reason,
            bonusStatusUnchanged: bonus.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }
}

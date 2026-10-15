import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContractStatus, PaymentMethod, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';

export class RecordRefundDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) bankName?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

const REFUND_SELECT = {
  id: true,
  amount: true,
  paymentMethod: true,
  referenceNumber: true,
  bankName: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  recordedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.RefundSelect;

/**
 * Money returned to the customer after a contract is cancelled. The
 * cancellation fixes how much is owed (refundAmount); each payment out is a
 * Refund row, and the total paid can never pass what is owed.
 */
@Injectable()
export class ContractRefundsService {
  private readonly logger = new Logger(ContractRefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The cancellation of a contract with its refunds, paid and outstanding. */
  async getCancellation(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { id: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    const c = await this.prisma.contractCancellation.findUnique({
      where: { contractId },
      include: {
        cancelledBy: { select: { id: true, fullName: true } },
        refunds: { select: REFUND_SELECT, orderBy: { paidAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Contract is not cancelled');
    const refunded = c.refunds.reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
    return {
      ...c,
      refundedTotal: refunded.toString(),
      refundOutstanding: Prisma.Decimal.max(0, c.refundAmount.minus(refunded)).toString(),
    };
  }

  async record(contractId: string, dto: RecordRefundDto, actorId: string) {
    const companyId = getRequiredCompanyId();
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { id: true, status: true, contractNumber: true, customerId: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.CANCELLED) {
      throw new ConflictException('العقد غير ملغي — لا يوجد مبلغ مسترد');
    }
    const amount = new Prisma.Decimal(dto.amount);

    const refund = await this.prisma.$transaction(async (tx) => {
      // Lock the cancellation so two refunds recorded at once cannot both
      // pass the outstanding check.
      const locked = await tx.$queryRaw<Array<{ id: string; refundAmount: Prisma.Decimal }>>(Prisma.sql`
        SELECT "id", "refundAmount" FROM "ContractCancellation"
        WHERE "contractId" = ${contractId}::uuid AND "companyId" = ${companyId}::uuid
        FOR UPDATE`);
      const cancellation = locked[0];
      if (!cancellation) throw new NotFoundException('Contract is not cancelled');
      const paid = await tx.refund.aggregate({
        where: { contractCancellationId: cancellation.id },
        _sum: { amount: true },
      });
      const outstanding = new Prisma.Decimal(cancellation.refundAmount).minus(
        paid._sum.amount ?? new Prisma.Decimal(0),
      );
      if (amount.greaterThan(outstanding)) {
        throw new ConflictException(
          `المبلغ أكبر من المتبقي للعميل (${Prisma.Decimal.max(0, outstanding).toString()})`,
        );
      }
      const created = await tx.refund.create({
        data: {
          contractCancellationId: cancellation.id,
          amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
          bankName: dto.bankName?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          notes: dto.notes?.trim() || null,
          recordedById: actorId,
          companyId,
        },
        select: REFUND_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.refund-recorded',
          entityType: 'Contract',
          entityId: contractId,
          after: {
            refundId: created.id,
            amount: amount.toString(),
            paymentMethod: dto.paymentMethod,
            outstandingAfter: outstanding.minus(amount).toString(),
          },
          companyId,
        },
      });
      return created;
    });

    try {
      await this.notifications.sendToUser(
        contract.customerId,
        'contract_refund_paid',
        {
          contractId,
          contractNumber: contract.contractNumber ?? '',
          amount: amount.toString(),
          entityType: 'contract',
          entityId: contractId,
        },
        { except: actorId },
      );
    } catch (err) {
      reportFailure(this.logger, 'notification', `contract_refund_paid for ${contractId} failed`, err);
    }
    return refund;
  }

  /** Cancelled contracts whose customer is still owed part of the refund. */
  async outstanding() {
    const rows = await this.prisma.contractCancellation.findMany({
      where: { refundAmount: { gt: 0 } },
      orderBy: { cancellationDate: 'asc' },
      select: {
        contractId: true,
        cancellationDate: true,
        refundAmount: true,
        refunds: { select: { amount: true } },
        contract: {
          select: {
            contractNumber: true,
            customer: { select: { id: true, fullName: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });
    const zero = new Prisma.Decimal(0);
    const data = rows
      .map((r) => {
        const refunded = r.refunds.reduce((sum, x) => sum.plus(x.amount), zero);
        return {
          contractId: r.contractId,
          contractNumber: r.contract.contractNumber,
          customer: r.contract.customer,
          unitCode: r.contract.unit?.code ?? null,
          cancellationDate: r.cancellationDate,
          refundAmount: r.refundAmount.toString(),
          refunded: refunded.toString(),
          outstanding: r.refundAmount.minus(refunded),
        };
      })
      .filter((r) => r.outstanding.greaterThan(0));
    const total = data.reduce((sum, r) => sum.plus(r.outstanding), zero);
    return {
      data: data.map((r) => ({ ...r, outstanding: r.outstanding.toString() })),
      totalOutstanding: total.toString(),
    };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
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
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepositType, Prisma, PlanPaymentType, InstallmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { takeSkip } from '../../common/utils/pagination';

class RecordDepositDto {
  @IsUUID() contractId!: string;
  @IsUUID() installmentId!: string;
  @IsNumber() @IsPositive() amount!: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() receiptUrl?: string;
}

class VerifyDepositDto {
  @IsBoolean() verified!: boolean;
}

interface ListDepositsOpts {
  page: number;
  pageSize: number;
  // legacy
  contractId?: string;
  customerId?: string;
  // new filters
  type?: DepositType;
  projectId?: string;
  unitId?: string;
  q?: string;          // customer name search
  ref?: string;        // contract/reservation number search
  paidAtFrom?: string;
  paidAtTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  verified?: boolean;
}

const DEPOSIT_INCLUDE = {
  contract: {
    select: {
      id: true,
      contractNumber: true,
      customer: { select: { id: true, fullName: true } },
      unit: { select: { id: true, code: true } },
    },
  },
  installment: { select: { id: true, dueDate: true, amount: true, type: true } },
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
} as const;

@Injectable()
class DepositsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Duplicate guard
    if (installment.status === InstallmentStatus.PAID) {
      throw new BadRequestException('تم دفع هذا القسط مسبقاً');
    }

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

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.create({
        data: {
          type: depositType,
          contractId: dto.contractId,
          installmentId: dto.installmentId,
          amount: new Prisma.Decimal(dto.amount),
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          receiptUrl: dto.receiptUrl ?? null,
          recordedById,
        },
      });
      await tx.installment.update({
        where: { id: dto.installmentId },
        data: { status: InstallmentStatus.PAID, paidAt: deposit.paidAt },
      });
      return deposit;
    });
  }

  async list(opts: ListDepositsOpts) {
    const and: Prisma.DepositWhereInput[] = [];

    // Legacy filters (kept for backward compatibility with customer portal)
    if (opts.contractId) and.push({ contractId: opts.contractId });
    if (opts.customerId) and.push({ contract: { customerId: opts.customerId } });

    // Type filter
    if (opts.type) and.push({ type: opts.type });

    // Verified filter
    if (opts.verified !== undefined) and.push({ verified: opts.verified });

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

    const where: Prisma.DepositWhereInput = and.length > 0 ? { AND: and } : {};

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
        where,
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

  verify(id: string, dto: VerifyDepositDto) {
    return this.prisma.deposit.update({
      where: { id },
      data: { verified: dto.verified },
    });
  }
}

class ListDepositsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsUUID() contractId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsEnum(DepositType) type?: DepositType;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsDateString() paidAtFrom?: string;
  @IsOptional() @IsDateString() paidAtTo?: string;
  @IsOptional() @IsDateString() dueDateFrom?: string;
  @IsOptional() @IsDateString() dueDateTo?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
}

@ApiTags('deposits')
@Controller()
class DepositsController {
  constructor(private readonly svc: DepositsService) {}

  // Admin-only recording per scope §5
  @Roles(UserRole.ADMIN)
  @Post('deposits')
  record(@CurrentUser() user: AuthUser, @Body() dto: RecordDepositDto) {
    return this.svc.record(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('deposits')
  list(@Query() q: ListDepositsQueryDto) {
    return this.svc.list({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      contractId: q.contractId,
      customerId: q.customerId,
      type: q.type,
      projectId: q.projectId,
      unitId: q.unitId,
      q: q.q,
      ref: q.ref,
      paidAtFrom: q.paidAtFrom,
      paidAtTo: q.paidAtTo,
      dueDateFrom: q.dueDateFrom,
      dueDateTo: q.dueDateTo,
      verified: q.verified,
    });
  }

  @Roles(UserRole.ADMIN)
  @Patch('deposits/:id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDepositDto) {
    return this.svc.verify(id, dto);
  }

  // Customer read-only view
  @Roles(UserRole.CUSTOMER)
  @Get('me/deposits')
  myDeposits(@CurrentUser() user: AuthUser) {
    return this.svc.list({ page: 1, pageSize: 100, customerId: user.sub });
  }
}

@Module({
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}

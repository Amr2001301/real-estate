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
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { DepositType, Prisma, PlanPaymentType, InstallmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

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

  async list(opts: { page: number; pageSize: number; contractId?: string; customerId?: string }) {
    const where: Prisma.DepositWhereInput = {
      ...(opts.contractId ? { contractId: opts.contractId } : {}),
      ...(opts.customerId ? { contract: { customerId: opts.customerId } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.deposit.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { paidAt: 'desc' },
        include: {
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
        },
      }),
      this.prisma.deposit.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  verify(id: string, dto: VerifyDepositDto) {
    return this.prisma.deposit.update({
      where: { id },
      data: { verified: dto.verified },
    });
  }
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
  list(
    @Query('contractId') contractId?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      contractId,
      customerId,
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

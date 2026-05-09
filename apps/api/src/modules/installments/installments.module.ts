import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsPositive,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Prisma, InstallmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';

class CreatePlanDto {
  @IsUUID() contractId!: string;
  @IsInt() @Min(1) @Max(360) totalMonths!: number;
  @IsNumber() @IsPositive() monthlyAmount!: number;
  @IsDateString() startsAt!: string;
}

@Injectable()
class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(dto: CreatePlanDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: { installmentPlan: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.installmentPlan) throw new ConflictException('Plan already exists');

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Invalid startsAt');

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.create({
        data: {
          contractId: dto.contractId,
          totalMonths: dto.totalMonths,
          monthlyAmount: new Prisma.Decimal(dto.monthlyAmount),
          startsAt,
        },
      });
      const rows: Prisma.InstallmentCreateManyInput[] = [];
      for (let i = 0; i < dto.totalMonths; i++) {
        const due = new Date(startsAt);
        due.setMonth(due.getMonth() + i);
        rows.push({
          planId: plan.id,
          dueDate: due,
          amount: new Prisma.Decimal(dto.monthlyAmount),
        });
      }
      await tx.installment.createMany({ data: rows });
      return tx.installmentPlan.findUnique({
        where: { id: plan.id },
        include: { installments: { orderBy: { dueDate: 'asc' } } },
      });
    });
  }

  async findByContract(contractId: string) {
    return this.prisma.installmentPlan.findUnique({
      where: { contractId },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });
  }

  // Daily cron: mark overdue
  async markOverdue() {
    const result = await this.prisma.installment.updateMany({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lt: new Date() },
      },
      data: { status: InstallmentStatus.OVERDUE },
    });
    return { marked: result.count };
  }
}

@Injectable()
class InstallmentsCron {
  constructor(private readonly svc: InstallmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async daily() {
    await this.svc.markOverdue();
  }
}

@ApiTags('installments')
@Controller()
class InstallmentsController {
  constructor(private readonly svc: InstallmentsService) {}

  // Per scope: visible to Sales/Admin only — NOT exposed to Client/Customer endpoints
  @Roles(UserRole.ADMIN)
  @Post('installment-plans')
  create(@Body() dto: CreatePlanDto) {
    return this.svc.createPlan(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('contracts/:contractId/installment-plan')
  byContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.svc.findByContract(contractId);
  }
}

@Module({
  controllers: [InstallmentsController],
  providers: [InstallmentsService, InstallmentsCron],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}

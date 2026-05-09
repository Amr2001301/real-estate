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
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Prisma, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

class CreateContractDto {
  @IsUUID() customerId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() @IsPositive() totalAmount!: number;
  @IsOptional() @IsNumber() @Min(0) downPayment?: number;
  @IsOptional() @IsString() pdfUrl?: string;
  @IsOptional() @IsDateString() signedAt?: string;
}

class UpdateContractDto {
  @IsOptional() @IsString() pdfUrl?: string;
  @IsOptional() @IsDateString() signedAt?: string;
}

@Injectable()
class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContractDto, actorId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === UnitStatus.SOLD) {
      throw new BadRequestException('Unit already sold');
    }

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          customerId: dto.customerId,
          unitId: dto.unitId,
          totalAmount: new Prisma.Decimal(dto.totalAmount),
          downPayment: new Prisma.Decimal(dto.downPayment ?? 0),
          pdfUrl: dto.pdfUrl ?? null,
          signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
        },
      });
      // Promote customer role if currently CLIENT
      await tx.user.updateMany({
        where: { id: dto.customerId, role: 'CLIENT' },
        data: { role: 'CUSTOMER' },
      });
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
          reason: `Contract ${contract.id}`,
        },
      });
      return contract;
    });
  }

  async list(opts: { page: number; pageSize: number; customerId?: string }) {
    const where: Prisma.ContractWhereInput = opts.customerId ? { customerId: opts.customerId } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          unit: { include: { building: { include: { phase: { include: { project: true } } } } } },
          installmentPlan: true,
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
        customer: true,
        unit: { include: { building: { include: { phase: { include: { project: true } } } } } },
        installmentPlan: { include: { installments: { orderBy: { dueDate: 'asc' } } } },
        deposits: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: UpdateContractDto) {
    return this.prisma.contract.update({
      where: { id },
      data: {
        pdfUrl: dto.pdfUrl ?? undefined,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
      },
    });
  }
}

@ApiTags('contracts')
@Controller('contracts')
class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.svc.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(
    @Query('customerId') customerId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({ page: Number(page), pageSize: Number(pageSize), customerId });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Customer view of their own contracts
  @Roles(UserRole.CUSTOMER)
  @Get('me/contracts')
  myContracts(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId: user.sub,
    });
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.svc.update(id, dto);
  }
}

@Module({
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}

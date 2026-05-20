import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
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
import { NotificationChannel, Prisma, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { BrokerCommissionsModule } from '../broker-commissions/broker-commissions.module';
import { BrokerCommissionsService } from '../broker-commissions/broker-commissions.service';

class CreateContractDto {
  // `signedAt` is intentionally NOT accepted here. Creation produces an
  // unsigned contract; signing is a separate action (POST /contracts/:id/sign)
  // that requires the strict `contracts:sign` permission and fires broker
  // activity, notification, and commission materialisation side effects.
  // The global ValidationPipe is configured with `forbidNonWhitelisted: true`
  // so any inbound `signedAt` on POST /contracts is rejected with 400 rather
  // than silently bypassing the strict permission.
  @IsUUID() customerId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() @IsPositive() totalAmount!: number;
  @IsOptional() @IsNumber() @Min(0) downPayment?: number;
  @IsOptional() @IsString() pdfUrl?: string;
}

class UpdateContractDto {
  // `signedAt` is intentionally NOT accepted here. Signing has substantial
  // side effects (broker activity log, notification fan-out, broker
  // commission materialization) and a distinct permission code; it is
  // performed via POST /contracts/:id/sign. The global ValidationPipe is
  // configured with forbidNonWhitelisted=true so an inbound `signedAt` will
  // be rejected with 400 rather than silently signing.
  @IsOptional() @IsString() pdfUrl?: string;
}

class SignContractDto {
  @IsDateString() signedAt!: string;
}

@Injectable()
class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brokerCommissions: BrokerCommissionsService,
  ) {}

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
          // Contracts are created unsigned. Signing goes through sign().
          signedAt: null,
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

  async list(opts: {
    page: number;
    pageSize: number;
    customerId?: string;
    q?: string;
    signed?: 'yes' | 'no';
    hasReservation?: 'yes' | 'no';
    brokerId?: string;
    brokerAgentId?: string;
  }) {
    const where: Prisma.ContractWhereInput = {
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.brokerId ? { brokerId: opts.brokerId } : {}),
      ...(opts.brokerAgentId ? { brokerAgentId: opts.brokerAgentId } : {}),
      ...(opts.signed === 'yes'
        ? { signedAt: { not: null } }
        : opts.signed === 'no'
          ? { signedAt: null }
          : {}),
      ...(opts.hasReservation === 'yes'
        ? { reservationId: { not: null } }
        : opts.hasReservation === 'no'
          ? { reservationId: null }
          : {}),
      ...(opts.q
        ? {
            OR: [
              { contractNumber: { contains: opts.q, mode: Prisma.QueryMode.insensitive } },
              { customer: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { customer: { phone: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { unit: { code: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          unit: {
            select: {
              id: true, code: true, type: true,
              building: { select: { phase: { select: { project: { select: { id: true, name: true } } } } } },
            },
          },
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              commissionLockedPct: true,
              commissionLockedAmount: true,
            },
          },
          installmentPlan: { select: { id: true, totalMonths: true, monthlyAmount: true, startsAt: true, frequency: true } },
          broker: {
            select: {
              id: true,
              companyName: true,
              commercialName: true,
              code: true,
              status: true,
            },
          },
          brokerAgent: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
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
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        unit: { include: { building: { include: { phase: { include: { project: true } } } } } },
        reservation: {
          select: {
            id: true,
            reservationNumber: true,
            commissionLockedPct: true,
            commissionLockedAmount: true,
            sales: { select: { id: true, fullName: true, email: true, phone: true } },
            lead: { select: { id: true, fullName: true, phone: true } },
          },
        },
        installmentPlan: { include: { installments: { orderBy: { dueDate: 'asc' } } } },
        deposits: { orderBy: { paidAt: 'desc' } },
        broker: {
          select: {
            id: true,
            companyName: true,
            commercialName: true,
            code: true,
            status: true,
          },
        },
        brokerAgent: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: UpdateContractDto) {
    // Generic update path — pdfUrl only. Signing is performed via sign().
    const exists = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Contract not found');

    return this.prisma.contract.update({
      where: { id },
      data: {
        pdfUrl: dto.pdfUrl ?? undefined,
      },
    });
  }

  /**
   * Transition a contract from unsigned to signed. Runs the broker activity
   * log, the notification fan-out, and the broker commission materialisation
   * exactly as the previous PATCH-path did.
   *
   * Idempotent: signing an already-signed contract is a no-op and does NOT
   * re-fire side effects. The current contract state is returned.
   */
  async sign(id: string, dto: SignContractDto) {
    const before = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        signedAt: true,
        brokerId: true,
        brokerAgentId: true,
        reservationId: true,
        reservation: {
          select: {
            reservationNumber: true,
            leadId: true,
            salesId: true,
          },
        },
      },
    });
    if (!before) throw new NotFoundException('Contract not found');

    // Idempotent: already signed → return current state, no side effects.
    if (before.signedAt !== null) {
      return this.prisma.contract.findUnique({ where: { id } });
    }

    const signedAtDate = new Date(dto.signedAt);
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { signedAt: signedAtDate },
    });

    if (before.brokerId) {
      // Broker portal activity timeline. Best-effort: failures are logged
      // but never thrown — the contract is already signed.
      try {
        if (before.reservation?.leadId) {
          await this.prisma.leadActivity.create({
            data: {
              leadId: before.reservation.leadId,
              type: 'broker_contract_signed',
              payload: {
                brokerId: before.brokerId,
                brokerAgentId: before.brokerAgentId,
                contractId: before.id,
                contractNumber: before.contractNumber,
                reservationId: before.reservationId,
                reservationNumber: before.reservation.reservationNumber,
                signedAt: dto.signedAt,
              },
            },
          });
        }

        const recipients = await this.prisma.brokerUser.findMany({
          where: { brokerId: before.brokerId, status: 'ACTIVE' },
          select: { userId: true },
        });
        const userIds = new Set<string>(recipients.map((r) => r.userId));
        if (before.reservation?.salesId) userIds.add(before.reservation.salesId);

        if (userIds.size > 0) {
          await this.prisma.notification.createMany({
            data: Array.from(userIds).map((userId) => ({
              userId,
              templateCode: 'broker_contract_signed',
              payload: {
                contractId: before.id,
                contractNumber: before.contractNumber,
                signedAt: dto.signedAt,
              } as Prisma.InputJsonValue,
              channel: NotificationChannel.IN_APP,
              sentAt: new Date(),
            })),
          });
        }
      } catch (e) {
        this.logger.warn(
          `Broker contract sign notify failed for ${id}: ${(e as Error).message}`,
        );
      }

      // Materialize the broker commission. Idempotent: a contract that
      // already has a BrokerCommission returns `already_exists`.
      try {
        await this.brokerCommissions.materializeFromContract(id);
      } catch (e) {
        this.logger.warn(
          `materializeFromContract(${id}) failed on sign: ${(e as Error).message}`,
        );
      }
    }

    return updated;
  }
}

@ApiTags('contracts')
@Controller('contracts')
class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('contracts:upload')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.svc.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('contracts:read')
  @Get()
  list(
    @Query('customerId') customerId?: string,
    @Query('q') q?: string,
    @Query('signed') signed?: string,
    @Query('hasReservation') hasReservation?: string,
    @Query('brokerId') brokerId?: string,
    @Query('brokerAgentId') brokerAgentId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId,
      q,
      signed: signed === 'yes' ? 'yes' : signed === 'no' ? 'no' : undefined,
      hasReservation:
        hasReservation === 'yes' ? 'yes' : hasReservation === 'no' ? 'no' : undefined,
      brokerId,
      brokerAgentId,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('contracts:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Customer view of their own contracts — intentionally NOT permission-gated.
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
  @Permissions('contracts:update')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.svc.update(id, dto);
  }

  // Strict: even an ADMIN must hold contracts:sign explicitly. Signing
  // triggers broker activity log, notification fan-out, and broker commission
  // materialisation. Segregation of duties — see PermissionsGuard tests.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('contracts:sign')
  @Post(':id/sign')
  sign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SignContractDto) {
    return this.svc.sign(id, dto);
  }
}

@Module({
  imports: [BrokerCommissionsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}

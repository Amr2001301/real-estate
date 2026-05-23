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
import {
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  Prisma,
  PlanPaymentType,
  InstallmentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocumentsModule, DocumentsService } from '../documents/documents.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
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

// Attach (or replace) the payment proof for an existing deposit. Updates the
// legacy receiptUrl AND links a first-class RECEIPT document.
class AttachReceiptDto {
  @IsString() receiptUrl!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
  @IsOptional() @IsString() title?: string;
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
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  // Link a payment proof as a first-class RECEIPT document. Idempotent: skips
  // when a matching (deposit, RECEIPT, fileUrl) document already exists.
  private async linkReceiptDocument(
    depositId: string,
    receiptUrl: string,
    uploadedById: string,
    meta?: { fileName?: string; mimeType?: string; sizeBytes?: number; title?: string },
  ) {
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: DocumentOwnerType.DEPOSIT,
        ownerId: depositId,
        category: DocumentCategory.RECEIPT,
        fileUrl: receiptUrl,
        deletedAt: null,
      },
    });
    if (existing) return existing;
    return this.documents.create(uploadedById, {
      ownerType: DocumentOwnerType.DEPOSIT,
      ownerId: depositId,
      category: DocumentCategory.RECEIPT,
      title: meta?.title?.trim() || 'إيصال دفعة',
      fileUrl: receiptUrl,
      fileName: meta?.fileName,
      mimeType: meta?.mimeType,
      sizeBytes: meta?.sizeBytes,
      visibility: DocumentVisibility.ADMIN_ONLY,
    });
  }

  // Best-effort linking — a document failure must never fail deposit recording.
  private async tryLinkReceiptDocument(depositId: string, receiptUrl: string, uploadedById: string) {
    try {
      await this.linkReceiptDocument(depositId, receiptUrl, uploadedById);
    } catch (e) {
      this.logger.warn(`linkReceiptDocument(${depositId}) failed: ${(e as Error).message}`);
    }
  }

  async findOne(id: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id }, include: DEPOSIT_INCLUDE });
    if (!deposit) throw new NotFoundException('Deposit not found');
    return deposit;
  }

  // Attach/replace proof after creation. Updates legacy receiptUrl and links a
  // RECEIPT document; document errors here ARE surfaced (it's the route's job).
  async attachReceipt(id: string, dto: AttachReceiptDto, uploadedById: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id } });
    if (!deposit) throw new NotFoundException('Deposit not found');
    await this.prisma.deposit.update({ where: { id }, data: { receiptUrl: dto.receiptUrl } });
    const document = await this.linkReceiptDocument(id, dto.receiptUrl, uploadedById, {
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      title: dto.title,
    });
    return { deposit: await this.findOne(id), document };
  }

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

    const deposit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deposit.create({
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
        data: { status: InstallmentStatus.PAID, paidAt: created.paidAt },
      });
      return created;
    });
    // Mirror the receipt as a first-class document (best-effort; legacy
    // receiptUrl is already persisted on the deposit).
    if (dto.receiptUrl) {
      await this.tryLinkReceiptDocument(deposit.id, dto.receiptUrl, recordedById);
    }
    return deposit;
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
  @Permissions('deposits:register')
  @Post('deposits')
  record(@CurrentUser() user: AuthUser, @Body() dto: RecordDepositDto) {
    return this.svc.record(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('deposits:read')
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

  // Single deposit detail (with contract/reservation/installment context).
  // Declared before the parametric write routes; ADMIN read.
  @Roles(UserRole.ADMIN)
  @Permissions('deposits:read')
  @Get('deposits/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Attach/replace the payment proof after creation — links a RECEIPT document
  // and mirrors the legacy receiptUrl. Uses the same write permission as record.
  @Roles(UserRole.ADMIN)
  @Permissions('deposits:register')
  @Post('deposits/:id/receipt')
  attachReceipt(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachReceiptDto,
  ) {
    return this.svc.attachReceipt(id, dto, user.sub);
  }

  // Strict: even an ADMIN must hold deposits:verify explicitly. Segregation
  // of duties — financial verification is a two-person-rule action.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('deposits:verify')
  @Patch('deposits/:id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDepositDto) {
    return this.svc.verify(id, dto);
  }

  // Customer read-only view — intentionally NOT permission-gated.
  @Roles(UserRole.CUSTOMER)
  @Get('me/deposits')
  myDeposits(@CurrentUser() user: AuthUser) {
    return this.svc.list({ page: 1, pageSize: 100, customerId: user.sub });
  }
}

@Module({
  imports: [DocumentsModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}

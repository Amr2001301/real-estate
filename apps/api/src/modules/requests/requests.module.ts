import {
  Body,
  Controller,
  ForbiddenException,
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
import { Throttle } from '@nestjs/throttler';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { Prisma } from '@prisma/client';
import { UserRole, VisitRequestSource, VisitRequestStatus, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveSalesScope } from '../../common/utils/sales-scope';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

class CreateInfoRequestDto {
  @IsString() @MinLength(2) message!: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

class CreateVisitRequestDto {
  @IsUUID() projectId!: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsDateString() preferredDate!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
}

class UpdateVisitStatusDto {
  @IsEnum(VisitStatus) status!: VisitStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
}

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find-or-create the "Website" LeadSource so leads originating from the
   * public site are attributed correctly. The JSON `name` column has no unique
   * index, so we match on the English label (mirrors the seed).
   */
  private async websiteLeadSourceId(): Promise<string> {
    const existing = await this.prisma.leadSource.findFirst({
      where: { name: { path: ['en'], equals: 'Website' } },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.leadSource.create({
      data: { name: { ar: 'موقع الويب', en: 'Website' } },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Find-or-create the Client (User) that a Lead must point to. Used by the
   * public request endpoints when an unauthenticated visitor leaves their
   * phone — we want a single canonical contact record per phone, never
   * duplicates.
   */
  private async findOrCreateClient(
    fullName: string,
    phone: string,
    email: string | null,
  ): Promise<{ id: string; fullName: string; phone: string | null; email: string | null }> {
    const byPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (byPhone) return byPhone;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) return byEmail;
    }
    return this.prisma.user.create({
      data: {
        role: 'CLIENT',
        fullName: fullName || 'New Lead',
        phone,
        email,
        locale: 'ar',
      },
    });
  }

  // ---- Info requests ----
  async createInfoRequest(
    dto: CreateInfoRequestDto,
    actor: { userId?: string },
  ) {
    let leadId: string | null = null;
    if (!actor.userId && dto.phone && dto.name) {
      const existing = await this.prisma.lead.findFirst({ where: { phone: dto.phone } });
      if (existing) {
        leadId = existing.id;
      } else {
        const client = await this.findOrCreateClient(dto.name, dto.phone, dto.email ?? null);
        const lead = await this.prisma.lead.create({
          data: {
            clientId: client.id,
            fullName: client.fullName,
            phone: client.phone ?? dto.phone,
            email: client.email ?? dto.email ?? null,
            projectInterestId: dto.projectId ?? null,
            unitInterestId: dto.unitId ?? null,
            sourceId: await this.websiteLeadSourceId(),
          },
        });
        leadId = lead.id;
      }
    }
    return this.prisma.infoRequest.create({
      data: {
        userId: actor.userId ?? null,
        leadId,
        projectId: dto.projectId ?? null,
        unitId: dto.unitId ?? null,
        message: dto.message,
      },
    });
  }

  listInfoRequests(opts: { page: number; pageSize: number }) {
    return this.prisma.infoRequest.findMany({
      ...takeSkip(opts),
      orderBy: { createdAt: 'desc' },
      include: { project: true, unit: true, user: { select: { id: true, fullName: true } } },
    });
  }

  /**
   * A user's OWN info requests, paginated — mirrors listVisitRequests. Scoped
   * strictly by userId so a CLIENT/CUSTOMER never sees others' inquiries (unlike
   * the admin listInfoRequests, which is global).
   */
  async listMyInfoRequests(opts: { userId: string; page: number; pageSize: number }) {
    const where: Prisma.InfoRequestWhereInput = { userId: opts.userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.infoRequest.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: { project: true, unit: true },
      }),
      this.prisma.infoRequest.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  // ---- Visit requests ----
  async createVisitRequest(
    dto: CreateVisitRequestDto,
    actor: { userId?: string },
  ) {
    let leadId: string | null = null;
    if (!actor.userId && dto.phone && dto.name) {
      const existing = await this.prisma.lead.findFirst({ where: { phone: dto.phone } });
      if (existing) {
        leadId = existing.id;
      } else {
        const client = await this.findOrCreateClient(dto.name, dto.phone, null);
        const lead = await this.prisma.lead.create({
          data: {
            clientId: client.id,
            fullName: client.fullName,
            phone: client.phone ?? dto.phone,
            projectInterestId: dto.projectId,
            unitInterestId: dto.unitId ?? null,
            sourceId: await this.websiteLeadSourceId(),
          },
        });
        leadId = lead.id;
      }
    }
    return this.prisma.visitRequest.create({
      data: {
        userId: actor.userId ?? null,
        leadId,
        projectId: dto.projectId,
        unitId: dto.unitId ?? null,
        preferredDate: new Date(dto.preferredDate),
        notes: dto.notes ?? null,
        requestStatus: VisitRequestStatus.NEW,
        source: VisitRequestSource.WEBSITE,
        customerName: dto.name ?? null,
        customerPhone: dto.phone ?? null,
      },
    });
  }

  async listVisitRequests(opts: {
    page: number;
    pageSize: number;
    status?: VisitStatus;
    salesId?: string;
    salesIds?: string[];
    userId?: string;
  }) {
    const where: Prisma.VisitRequestWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.salesIds
        ? { assignedSalesId: { in: opts.salesIds } }
        : opts.salesId
          ? { assignedSalesId: opts.salesId }
          : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.visitRequest.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          project: true,
          unit: true,
          assignedSales: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.visitRequest.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  async updateVisitStatus(id: string, dto: UpdateVisitStatusDto, _actor: AuthUser) {
    const exists = await this.prisma.visitRequest.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Visit request not found');
    return this.prisma.visitRequest.update({
      where: { id },
      data: {
        status: dto.status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        assignedSalesId: dto.assignedSalesId ?? undefined,
      },
    });
  }
}

@ApiTags('requests')
@Controller()
class RequestsController {
  constructor(
    private readonly svc: RequestsService,
    private readonly prisma: PrismaService,
  ) {}

  // Public submission (guest or logged-in)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('public/info-request')
  publicInfo(@Body() dto: CreateInfoRequestDto) {
    return this.svc.createInfoRequest(dto, {});
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('public/visit-request')
  publicVisit(@Body() dto: CreateVisitRequestDto) {
    return this.svc.createVisitRequest(dto, {});
  }

  // Logged-in clients
  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Post('me/info-requests')
  meInfo(@CurrentUser() user: AuthUser, @Body() dto: CreateInfoRequestDto) {
    return this.svc.createInfoRequest(dto, { userId: user.sub });
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Post('me/visit-requests')
  meVisit(@CurrentUser() user: AuthUser, @Body() dto: CreateVisitRequestDto) {
    return this.svc.createVisitRequest(dto, { userId: user.sub });
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get('me/visit-requests')
  myVisits(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.listVisitRequests({
      page: Number(page),
      pageSize: Number(pageSize),
      userId: user.sub,
    });
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get('me/info-requests')
  myInfoRequests(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.listMyInfoRequests({
      userId: user.sub,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  // Admin/Sales
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Get('info-requests')
  listInfo(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.svc.listInfoRequests({ page: Number(page), pageSize: Number(pageSize) });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visit-requests')
  async listVisits(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: VisitStatus,
    @Query('salesId') salesId?: string,
    @Query('mine') mine?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    // SALES self / "mine" → self; ADMIN → requested or all; SALES_MANAGER → team.
    const scope =
      mine === '1' && user.role === UserRole.SALES
        ? { salesId: user.sub }
        : await resolveSalesScope(this.prisma, user, salesId);
    return this.svc.listVisitRequests({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      ...scope,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:approve')
  @Patch('visit-requests/:id')
  updateVisit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.SALES && dto.assignedSalesId && dto.assignedSalesId !== user.sub) {
      throw new ForbiddenException('Sales cannot reassign to others');
    }
    return this.svc.updateVisitStatus(id, dto, user);
  }
}

@Module({
  controllers: [RequestsController],
  providers: [RequestsService],
  // Exported so ChatModule's conversion flow can create info/visit requests
  // through the same authoritative service the public endpoints use.
  exports: [RequestsService],
})
export class RequestsModule {}

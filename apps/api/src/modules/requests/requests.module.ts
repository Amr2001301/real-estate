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
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { getTenantContext } from '../../common/tenant/tenant-context';
import {
  NotificationsModule,
  NotificationsService,
} from '../notifications/notifications.module';

/** Format a Date's local hours+minutes as HH:mm — used to mirror a customer's
 *  submitted datetime into the `preferredTime` column so admin tooling renders
 *  date and time as separate cells. */
function formatHourMinute(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Return the userId for the `actor.userId` field when the optionally-resolved
 * Bearer token belongs to a customer-side role (CLIENT or CUSTOMER). Any other
 * role (ADMIN, SALES, SALES_MANAGER, BROKER, MAINTENANCE_SUPERVISOR) — or no
 * user at all — yields `undefined` so the row stays guest-attributed. This
 * guards against an admin or sales rep accidentally creating an
 * `actor=admin@…` row when they hit the public endpoint while logged in.
 */
function portalUserId(user: AuthUser | undefined): string | undefined {
  if (!user) return undefined;
  if (user.role === UserRole.CLIENT || user.role === UserRole.CUSTOMER) {
    return user.sub;
  }
  return undefined;
}

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
  // Optional HH:mm. When omitted the service derives it from preferredDate so
  // admin tooling that renders date + time as separate cells stays populated.
  @IsOptional() @IsString() preferredTime?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

class UpdateVisitStatusDto {
  @IsEnum(VisitStatus) status!: VisitStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
        companyId: getTenantContext()?.companyId ?? null,
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
    const created = await this.prisma.infoRequest.create({
      data: {
        userId: actor.userId ?? null,
        leadId,
        projectId: dto.projectId ?? null,
        unitId: dto.unitId ?? null,
        message: dto.message,
      },
    });

    // P13 — event: a new info request (Guest, Client, or Customer) needs admin
    // visibility. Fan out to ADMIN + SALES_MANAGER (NOT all SALES — there's no
    // assignment/routing rule for inquiries). Safe placeholders only: identity +
    // project/unit context. NO phone/email/message in the payload. The helper
    // swallows errors and never throws past this call, and the DB row is written
    // without Firebase (push is best-effort/no-op).
    await this.notifications.sendToRoles(
      [UserRole.ADMIN, UserRole.SALES_MANAGER],
      'info_request_created',
      await this.buildInfoRequestPayload(created.id, dto, actor.userId ?? null),
    );

    return created;
  }

  /**
   * Build a safe payload for info_request_created. Whitelist: requestId
   * (routing), customerName, projectName, unitCode. Deliberately NO phone,
   * email, or message body. Errors are swallowed so payload composition never
   * blocks the InfoRequest write or the notification fan-out.
   */
  private async buildInfoRequestPayload(
    requestId: string,
    dto: CreateInfoRequestDto,
    userId: string | null,
  ): Promise<Record<string, unknown>> {
    try {
      const project = dto.projectId
        ? await this.prisma.project.findUnique({
            where: { id: dto.projectId },
            select: { name: true },
          })
        : null;
      const unit = dto.unitId
        ? await this.prisma.unit.findUnique({
            where: { id: dto.unitId },
            select: { code: true },
          })
        : null;
      let customerName = dto.name?.trim() ?? '';
      if (!customerName && userId) {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        });
        customerName = u?.fullName ?? '';
      }
      const name = (project?.name ?? {}) as { ar?: string; en?: string };
      return {
        requestId,
        customerName,
        projectName: name.ar || name.en || '',
        unitCode: unit?.code ?? '',
      };
    } catch {
      return { requestId, customerName: dto.name?.trim() ?? '' };
    }
  }

  /**
   * Admin/Sales list of ALL info requests — Guest (no userId), Client, and
   * Customer alike. Global (never filtered by userId) so guest inquiries stay
   * visible. Paginated. Includes the submitter's contact (user OR guest lead)
   * so the admin can call / WhatsApp / email them — this is an ADMIN-facing
   * surface, so phone/email ARE included here (unlike the notification payload).
   */
  async listInfoRequests(opts: { page: number; pageSize: number }) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.infoRequest.findMany({
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          project: true,
          unit: true,
          user: { select: { id: true, fullName: true, phone: true, email: true, role: true } },
          lead: { select: { id: true, fullName: true, phone: true, email: true } },
        },
      }),
      this.prisma.infoRequest.count(),
    ]);
    return paginate(data, total, opts);
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
    const preferredDate = new Date(dto.preferredDate);
    // Derive HH:mm from the submitted datetime when the client didn't send a
    // separate preferredTime — keeps the existing single `datetime-local` form
    // working AND populates the column that admin tooling renders.
    const preferredTime = dto.preferredTime?.trim() || formatHourMinute(preferredDate);
    // Customer's message is mirrored to both `notes` (legacy, read by the
    // customer-facing /me responses) and `requestNotes` (read by the admin
    // dashboard request detail). Mirroring keeps both surfaces accurate
    // without a data backfill.
    const customerMessage = dto.notes?.trim() || null;
    const created = await this.prisma.visitRequest.create({
      data: {
        userId: actor.userId ?? null,
        leadId,
        projectId: dto.projectId,
        unitId: dto.unitId ?? null,
        preferredDate,
        preferredTime,
        notes: customerMessage,
        requestNotes: customerMessage,
        requestStatus: VisitRequestStatus.NEW,
        source: VisitRequestSource.WEBSITE,
        customerName: dto.name ?? null,
        customerPhone: dto.phone ?? null,
        customerEmail: dto.email ?? null,
      },
    });

    // P3 — event A: fan out to admins + sales managers. Safe placeholders
    // only: identity, project/unit context, preferred date/time. No phone,
    // email, address, or reservation amounts. The helper swallows errors
    // and never throws past this call.
    await this.notifications.sendToRoles(
      [UserRole.ADMIN, UserRole.SALES_MANAGER],
      'visit_request_created',
      await this.buildVisitRequestPayload(created.id, dto),
    );

    return created;
  }

  /**
   * Build a safe payload for visit_request_created. Project name is resolved
   * from the translatable JSON column; missing pieces fall back to ''. Errors
   * are silently swallowed so failure to compose a payload never blocks the
   * actual VisitRequest write or business action.
   */
  private async buildVisitRequestPayload(
    requestId: string,
    dto: CreateVisitRequestDto,
  ): Promise<Record<string, unknown>> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { name: true },
      });
      const unit = dto.unitId
        ? await this.prisma.unit.findUnique({
            where: { id: dto.unitId },
            select: { code: true },
          })
        : null;
      const name = (project?.name ?? {}) as { ar?: string; en?: string };
      return {
        requestId,
        customerName: dto.name ?? '',
        projectName: name.ar || name.en || '',
        unitCode: unit?.code ?? '',
        preferredDate: new Date(dto.preferredDate).toISOString(),
        preferredTime: dto.preferredTime ?? '',
      };
    } catch {
      // Don't let payload composition take down the notification fan-out.
      return { requestId, customerName: dto.name ?? '' };
    }
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
          // P2 — the customer-side card needs the latest appointment so it can
          // render confirm / request-reschedule buttons against it. Limit to
          // the most recent appointment (RESCHEDULED rows get superseded by
          // their replacement, so the front edge is what matters).
          appointments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              durationMinutes: true,
              location: true,
              meetingPoint: true,
              customerFeedback: true,
              // Gap 7 — customer's own visit rating (so the card can show the
              // form vs. read-only feedback). Sales feedback is NOT exposed.
              customerRating: true,
              customerRatingText: true,
              customerRatingSubmittedAt: true,
            },
          },
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

  // Public submission. `@OptionalAuth()` means the route stays open to
  // anonymous visitors but, when the browser happens to send a valid Bearer,
  // the resulting row is attributed to that user — so a logged-in customer
  // whose ContactForm mis-routed (cookie race, third-party cookie block,
  // intermediary stripping headers) still gets the submission linked instead
  // of orphaned. CLIENT and CUSTOMER are the only roles whose submissions
  // should auto-attribute; staff / admin / broker submissions are explicit
  // back-office flows and stay anonymous-on-public.
  @Public()
  @OptionalAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('public/info-request')
  publicInfo(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateInfoRequestDto,
  ) {
    return this.svc.createInfoRequest(dto, { userId: portalUserId(user) });
  }

  @Public()
  @OptionalAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('public/visit-request')
  publicVisit(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateVisitRequestDto,
  ) {
    return this.svc.createVisitRequest(dto, { userId: portalUserId(user) });
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
  imports: [NotificationsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  // Exported so ChatModule's conversion flow can create info/visit requests
  // through the same authoritative service the public endpoints use.
  exports: [RequestsService],
})
export class RequestsModule {}

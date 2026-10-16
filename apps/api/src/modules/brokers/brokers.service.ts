import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, BrokerStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId, runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { NotificationsService } from '../notifications/notifications.module';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { OPTIONS_LIMIT, optionsResult } from '../../common/utils/options';
import {
  CreateBrokerDto,
  UpdateBrokerDto,
  UpdateBrokerStatusDto,
} from './dto/broker.dto';

const COUNTS_SELECT = {
  _count: {
    select: {
      brokerUsers: true,
      projectAccess: true,
      unitAccess: true,
    },
  },
} as const;

@Injectable()
export class BrokersService {
  private readonly logger = new Logger(BrokersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateBrokerDto) {
    const code = dto.code
      ? await this.ensureCodeAvailable(dto.code)
      : await this.generateUniqueCode(dto.companyName);

    if (dto.taxId) await this.ensureTaxIdAvailable(dto.taxId);

    return this.prisma.broker.create({
      data: {
        companyName: dto.companyName,
        commercialName: dto.commercialName ?? null,
        code,
        logoUrl: dto.logoUrl ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        taxId: dto.taxId ?? null,
        commercialRegistration: dto.commercialRegistration ?? null,
        bankName: dto.bankName ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        bankIban: dto.bankIban ?? null,
        defaultCommissionPct:
          dto.defaultCommissionPct !== undefined
            ? new Prisma.Decimal(dto.defaultCommissionPct)
            : new Prisma.Decimal(0),
        commissionModel: dto.commissionModel ?? 'PERCENT_OF_SALE',
        contractStartAt: dto.contractStartAt ? new Date(dto.contractStartAt) : null,
        contractEndAt: dto.contractEndAt ? new Date(dto.contractEndAt) : null,
        contractPdfUrl: dto.contractPdfUrl ?? null,
        notes: dto.notes ?? null,
      },
      include: COUNTS_SELECT,
    });
  }

  /** Every broker of the company, id + display fields — see common/utils/options.ts. */
  async options(status?: BrokerStatus) {
    const rows = await this.prisma.broker.findMany({
      where: { companyId: getRequiredCompanyId(), ...(status ? { status } : {}) },
      select: {
        id: true,
        companyName: true,
        commercialName: true,
        code: true,
        city: true,
        status: true,
        defaultCommissionPct: true,
      },
      orderBy: { companyName: 'asc' },
      take: OPTIONS_LIMIT + 1,
    });
    return optionsResult(rows);
  }

  async findAll(params: {
    status?: BrokerStatus;
    city?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const trimmed = params.q?.trim();
    const where: Prisma.BrokerWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.city ? { city: { equals: params.city, mode: 'insensitive' } } : {}),
      ...(trimmed
        ? {
            OR: [
              { companyName: { contains: trimmed, mode: 'insensitive' } },
              { commercialName: { contains: trimmed, mode: 'insensitive' } },
              { code: { contains: trimmed.toUpperCase() } },
              { email: { contains: trimmed, mode: 'insensitive' } },
              { phone: { contains: trimmed } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.broker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: COUNTS_SELECT,
      }),
      this.prisma.broker.count({ where }),
    ]);

    // FG-23 — the admin KPI strip used to count these client-side from
    // ?pageSize=200, so they were wrong for any company with more brokers
    // than that. Computed over the same `where`, outside the transaction
    // because Prisma's groupBy inference degrades inside a $transaction
    // tuple.
    const statusGroups = await this.prisma.broker.groupBy({
      by: ['status'],
      where,
      _count: true,
    });
    const facets = {
      counts: {
        status: toCounts(statusGroups.map((g) => [String(g.status), g._count] as const)),
      },
    };

    return paginate(data, total, { page, pageSize }, facets);
  }

  async findOne(id: string) {
    const broker = await this.prisma.broker.findUnique({
      where: { id },
      include: COUNTS_SELECT,
    });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  async update(id: string, dto: UpdateBrokerDto) {
    const existing = await this.assertExists(id);

    if (dto.code !== undefined && dto.code !== existing.code) {
      await this.ensureCodeAvailable(dto.code);
    }
    if (dto.taxId !== undefined && dto.taxId !== existing.taxId) {
      if (dto.taxId) await this.ensureTaxIdAvailable(dto.taxId);
    }

    const data: Prisma.BrokerUpdateInput = {};
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.commercialName !== undefined) data.commercialName = dto.commercialName;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.taxId !== undefined) data.taxId = dto.taxId;
    if (dto.commercialRegistration !== undefined) {
      data.commercialRegistration = dto.commercialRegistration;
    }
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.bankAccountName !== undefined) data.bankAccountName = dto.bankAccountName;
    if (dto.bankIban !== undefined) data.bankIban = dto.bankIban;
    if (dto.defaultCommissionPct !== undefined) {
      data.defaultCommissionPct = new Prisma.Decimal(dto.defaultCommissionPct);
    }
    if (dto.commissionModel !== undefined) data.commissionModel = dto.commissionModel;
    if (dto.contractStartAt !== undefined) {
      data.contractStartAt = dto.contractStartAt ? new Date(dto.contractStartAt) : null;
    }
    if (dto.contractEndAt !== undefined) {
      data.contractEndAt = dto.contractEndAt ? new Date(dto.contractEndAt) : null;
    }
    if (dto.contractPdfUrl !== undefined) data.contractPdfUrl = dto.contractPdfUrl;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.broker.update({
      where: { id },
      data,
      include: COUNTS_SELECT,
    });
  }

  async updateStatus(id: string, dto: UpdateBrokerStatusDto) {
    return this.applyStatus(id, dto.status, dto.reason);
  }

  /** Suspend a firm. Dedicated route so it carries the brokers:suspend code. */
  async suspend(id: string, reason?: string) {
    return this.applyStatus(id, BrokerStatus.SUSPENDED, reason);
  }

  /** Terminate a firm. Dedicated route so it carries the brokers:terminate code. */
  async terminate(id: string, reason?: string) {
    return this.applyStatus(id, BrokerStatus.TERMINATED, reason);
  }

  /**
   * Hold (or release) every payout of a broker — for a dispute or an
   * investigation. Earned commissions stay earned; they just are not paid.
   */
  async setPayoutHold(id: string, hold: boolean, reason?: string) {
    const existing = await this.assertExists(id);
    const stamp = new Date().toISOString();
    const line = `[${stamp}] payout ${hold ? 'held' : 'released'}${reason?.trim() ? `: ${reason.trim()}` : ''}`;
    return this.prisma.broker.update({
      where: { id },
      data: { payoutHold: hold, notes: existing.notes ? `${existing.notes}\n${line}` : line },
      include: COUNTS_SELECT,
    });
  }

  /**
   * A broker whose agreement end date has passed is terminated: the date was
   * stored but nothing read it, so the firm kept its portal and grants. One
   * failing broker never stops the rest of the sweep.
   */
  async terminateExpiredAgreements(now = new Date()): Promise<{ terminated: number; failed: number }> {
    const due = await this.prisma.broker.findMany({
      where: {
        status: { in: [BrokerStatus.ACTIVE, BrokerStatus.PENDING, BrokerStatus.SUSPENDED] },
        contractEndAt: { lt: now },
      },
      select: { id: true, companyId: true },
    });
    let terminated = 0;
    let failed = 0;
    for (const b of due) {
      try {
        const run = () => this.applyStatus(b.id, BrokerStatus.TERMINATED, 'Agreement ended (contract end date passed)');
        await (b.companyId ? runInCompany(b.companyId, run) : run());
        terminated++;
      } catch (err) {
        failed++;
        reportFailure(this.logger, 'broker-agreement', `terminating broker ${b.id} failed`, err);
      }
    }
    return { terminated, failed };
  }

  /**
   * Shared status-change logic. All status transitions (the generic
   * reactivate/pending route plus the dedicated suspend/terminate routes)
   * funnel through here so business behavior and response shape stay
   * identical regardless of entry point.
   */
  private async applyStatus(
    id: string,
    status: BrokerStatus,
    reason?: string,
  ) {
    const existing = await this.assertExists(id);

    // Append the reason to notes for auditability (the global AuditInterceptor
    // also captures the request body, so this is just a soft trail.)
    const data: Prisma.BrokerUpdateInput = { status };
    if (reason && reason.trim().length > 0) {
      const stamp = new Date().toISOString();
      const line = `[${stamp}] ${existing.status} → ${status}: ${reason.trim()}`;
      data.notes = existing.notes ? `${existing.notes}\n${line}` : line;
    }

    const updated = await this.prisma.broker.update({
      where: { id },
      data,
      include: COUNTS_SELECT,
    });

    // Notify all active broker users about the status change.
    const brokerUsers = await this.prisma.brokerUser.findMany({
      where: { brokerId: id, status: 'ACTIVE' },
      select: { userId: true },
    });
    const userIds = brokerUsers.map((u) => u.userId);
    const notifPayload = {
      entityType: 'broker',
      entityId: id,
      companyName: existing.companyName,
    };
    if (status === BrokerStatus.ACTIVE) {
      await this.notifications.sendToUsers(userIds, 'broker_approved', notifPayload);
    } else if (status === BrokerStatus.SUSPENDED || status === BrokerStatus.TERMINATED) {
      await this.notifications.sendToUsers(userIds, 'broker_suspended', notifPayload);
    }

    return updated;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const broker = await this.prisma.broker.findUnique({ where: { id } });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  private async ensureCodeAvailable(code: string) {
    const companyId = getRequiredCompanyId();
    const exists = await this.prisma.broker.findFirst({
      where: { code, companyId },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Broker code "${code}" is already in use in this company`);
    return code;
  }

  private async ensureTaxIdAvailable(taxId: string) {
    const companyId = getRequiredCompanyId();
    const exists = await this.prisma.broker.findFirst({
      where: { taxId, companyId },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Broker tax ID "${taxId}" is already in use in this company`);
    return taxId;
  }

  // Generate a safe URL-friendly code from companyName, ensuring uniqueness
  // within the current tenant. Falls back to "BROKER" for Arabic-only names.
  private async generateUniqueCode(companyName: string): Promise<string> {
    const companyId = getRequiredCompanyId();
    const ascii = companyName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = (ascii.toUpperCase() || 'BROKER').slice(0, 16);

    for (let i = 0; i < 1000; i++) {
      const candidate = i === 0 ? base : `${base}-${i.toString().padStart(3, '0')}`;
      const exists = await this.prisma.broker.findFirst({
        where: { code: candidate, companyId },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new ConflictException('Could not generate a unique broker code');
  }
}

/** Daily: brokers whose agreement end date has passed are terminated. */
@Injectable()
export class BrokerAgreementCron {
  private readonly logger = new Logger(BrokerAgreementCron.name);

  constructor(
    private readonly brokers: BrokersService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const result = this.lock
          ? await this.lock.withLock('broker-agreement-end', 10 * 60_000, () => this.brokers.terminateExpiredAgreements())
          : await this.brokers.terminateExpiredAgreements();
        if (result && result.terminated + result.failed > 0) {
          this.logger.log(`Broker agreement sweep: terminated=${result.terminated} failed=${result.failed}`);
        }
      } catch (err) {
        reportFailure(this.logger, 'broker-agreement', 'broker agreement sweep failed', err);
      }
    });
  }
}

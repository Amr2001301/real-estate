import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addMonths } from '../../common/utils/add-months';
import { runInCompany } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import type { AiPeriodDto, AiTopUpDto, CreateAiPackageDto, UpdateAiPackageDto } from './ai.dto';

const DAY = 24 * 60 * 60 * 1000;
/** Share of the questions used that sends the first warning. */
export const AI_WARN_SHARE = 0.8;
/** Days before the period ends that the "ending soon" notice goes out. */
export const AI_ENDING_DAYS = 3;

export const AI_NOT_ACTIVE = 'AI_NOT_ACTIVE';
export const AI_QUOTA_EXHAUSTED = 'AI_QUOTA_EXHAUSTED';

type PlanRow = {
  id: string;
  companyId: string;
  packageId: string | null;
  periodStart: Date;
  periodEnd: Date;
  quota: number;
  used: number;
  status: string;
};

/** The questions at which the 80% warning goes out (at least one question). */
export function warnAt(quota: number): number {
  return Math.max(1, Math.ceil(quota * AI_WARN_SHARE));
}

/**
 * The AI assistant's account with each company — sold apart from the
 * subscription plans, by agreement:
 *  - the platform owner keeps a list of question packages;
 *  - activating one opens a period of one month from that day;
 *  - a top-up adds questions to the current period and ends with it;
 *  - a renewal starts a new month from now (unused questions do not carry over);
 *  - when the month ends the assistant stops until the owner renews by hand.
 * Every activation, renewal and top-up is written to the company's ledger with
 * the price agreed. Payment happens outside the platform.
 */
@Injectable()
export class AiPlansService {
  private readonly logger = new Logger(AiPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Packages (platform owner) ─────────────────────────────────────────────

  listPackages() {
    return this.prisma.aiPackage.findMany({ orderBy: [{ sortOrder: 'asc' }, { questions: 'asc' }] });
  }

  createPackage(dto: CreateAiPackageDto) {
    return this.prisma.aiPackage.create({
      data: {
        name: dto.name.trim(),
        questions: dto.questions,
        price: new Prisma.Decimal(dto.price),
        currency: (dto.currency ?? 'EGP').toUpperCase(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePackage(id: string, dto: UpdateAiPackageDto) {
    const pkg = await this.prisma.aiPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    return this.prisma.aiPackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.questions !== undefined && { questions: dto.questions }),
        ...(dto.price !== undefined && { price: new Prisma.Decimal(dto.price) }),
        ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── A company's account (platform owner) ──────────────────────────────────

  /** The company's current period (if any) and its ledger, newest first. */
  async companyAccount(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException('الشركة غير موجودة');
    const [plan, ledger] = await Promise.all([
      this.prisma.companyAiPlan.findFirst({
        where: { companyId },
        include: { package: { select: { id: true, name: true } } },
      }),
      this.prisma.aiLedgerEntry.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        include: { package: { select: { id: true, name: true } } },
      }),
    ]);
    return { plan: plan ? this.view(plan) : null, ledger };
  }

  /**
   * Opens the assistant for a company — or renews it: a new month starts now
   * with the package's questions, whatever was left of the old one ends.
   */
  async startPeriod(companyId: string, dto: AiPeriodDto, actorId: string, kind: 'ACTIVATE' | 'RENEW') {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException('الشركة غير موجودة');
    const pkg = await this.prisma.aiPackage.findUnique({ where: { id: dto.packageId } });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    if (!pkg.isActive) throw new BadRequestException('هذه الباقة موقوفة');

    const now = new Date();
    const periodEnd = addMonths(now, 1);
    const price = new Prisma.Decimal(dto.price ?? pkg.price);
    const period = {
      packageId: pkg.id,
      periodStart: now,
      periodEnd,
      quota: pkg.questions,
      used: 0,
      status: 'ACTIVE',
      alerted80At: null,
      alertedFullAt: null,
      alertedEndingAt: null,
    };
    return this.prisma.$transaction(async (tx) => {
      // One period change at a time per company: two clicks on "enable"
      // would otherwise both pass the check below and both be billed.
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "Company" WHERE "id" = ${companyId}::uuid FOR UPDATE`);
      const current = await tx.companyAiPlan.findFirst({ where: { companyId } });
      if (kind === 'ACTIVATE' && current && this.isLive(current, now)) {
        throw new ConflictException('المساعد مفعّل لهذه الشركة — استخدم التجديد أو إضافة أسئلة');
      }
      if (kind === 'RENEW' && !current) {
        throw new BadRequestException('المساعد غير مفعّل لهذه الشركة بعد — استخدم التفعيل');
      }
      const plan = await tx.companyAiPlan.upsert({
        where: { companyId },
        create: { companyId, ...period },
        update: period,
      });
      await tx.aiLedgerEntry.create({
        data: {
          companyId,
          type: kind,
          packageId: pkg.id,
          questions: pkg.questions,
          price,
          currency: pkg.currency,
          periodStart: now,
          periodEnd,
          note: dto.note?.trim() || null,
          createdById: actorId,
        },
      });
      return this.view(plan);
    });
  }

  /** Extra questions for the current period; they end with it. */
  async topUp(companyId: string, dto: AiTopUpDto, actorId: string) {
    const now = new Date();
    const current = await this.prisma.companyAiPlan.findFirst({
      where: { companyId },
      include: { package: { select: { currency: true } } },
    });
    if (!current || !this.isLive(current, now)) {
      throw new BadRequestException('لا توجد فترة سارية للمساعد — جدّد الباقة أولاً');
    }
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.companyAiPlan.updateMany({
        where: { id: current.id, status: 'ACTIVE', periodEnd: { gt: now } },
        data: { quota: { increment: dto.questions } },
      });
      if (moved.count === 0) throw new ConflictException('انتهت الفترة أثناء التنفيذ — جدّد الباقة');
      const plan = await tx.companyAiPlan.findUniqueOrThrow({ where: { id: current.id } });
      // Below a threshold again → that warning may go out again this period.
      await tx.companyAiPlan.update({
        where: { id: plan.id },
        data: {
          ...(plan.used < warnAt(plan.quota) && { alerted80At: null }),
          ...(plan.used < plan.quota && { alertedFullAt: null }),
        },
      });
      await tx.aiLedgerEntry.create({
        data: {
          companyId,
          type: 'TOP_UP',
          packageId: plan.packageId,
          questions: dto.questions,
          price: new Prisma.Decimal(dto.price),
          currency: current.package?.currency ?? 'EGP',
          periodStart: plan.periodStart,
          periodEnd: plan.periodEnd,
          note: dto.note?.trim() || null,
          createdById: actorId,
        },
      });
      return this.view(plan);
    });
  }

  // ── The company's side ────────────────────────────────────────────────────

  /** What the company's admin sees: questions left and when the month ends. */
  async usage(companyId: string) {
    const plan = await this.prisma.companyAiPlan.findFirst({
      where: { companyId },
      include: { package: { select: { name: true } } },
    });
    if (!plan) return { enabled: false as const };
    return { enabled: true as const, ...this.view(plan) };
  }

  /**
   * One question asked: counted atomically, refused when the month has ended
   * or the questions are used up. Sends the 80% and 100% notices once.
   */
  async consume(companyId: string): Promise<{ used: number; quota: number; remaining: number }> {
    const now = new Date();
    const rows = await this.prisma.$queryRaw<Array<{ used: number; quota: number; id: string }>>(Prisma.sql`
      UPDATE "CompanyAiPlan" SET "used" = "used" + 1, "updatedAt" = NOW()
      WHERE "companyId" = ${companyId}::uuid AND "status" = 'ACTIVE'
        AND "periodEnd" > ${now} AND "used" < "quota"
      RETURNING "id", "used", "quota"`);
    const row = rows[0];
    if (!row) {
      const plan = await this.prisma.companyAiPlan.findFirst({ where: { companyId } });
      if (!plan || !this.isLive(plan, now)) {
        throw new ForbiddenException({ code: AI_NOT_ACTIVE, message: 'المساعد الذكي غير مفعّل أو انتهت مدة الباقة' });
      }
      throw new ForbiddenException({ code: AI_QUOTA_EXHAUSTED, message: 'تم استهلاك كل أسئلة الباقة لهذا الشهر' });
    }
    if (row.used >= row.quota) await this.alertOnce(row.id, companyId, 'alertedFullAt', 'subscription_ai_quota_exhausted', row);
    else if (row.used >= warnAt(row.quota)) await this.alertOnce(row.id, companyId, 'alerted80At', 'subscription_ai_quota_80', row);
    return { used: row.used, quota: row.quota, remaining: row.quota - row.used };
  }

  /** Gives back a question the assistant could not answer (the model was unreachable). */
  async refund(companyId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; used: number; quota: number }>>(Prisma.sql`
      UPDATE "CompanyAiPlan" SET "used" = "used" - 1, "updatedAt" = NOW()
      WHERE "companyId" = ${companyId}::uuid AND "used" > 0
      RETURNING "id", "used", "quota"`);
    const row = rows[0];
    if (!row) return;
    // Back under a threshold: its notice may go out again when it is reached
    // for real (the given-back question may have been the one that sent it).
    await this.prisma.companyAiPlan.update({
      where: { id: row.id },
      data: {
        ...(row.used < warnAt(row.quota) && { alerted80At: null }),
        ...(row.used < row.quota && { alertedFullAt: null }),
      },
    });
  }

  // ── Daily sweep ───────────────────────────────────────────────────────────

  /** Ending soon → one notice; ended → stopped, with a notice. */
  async sweep(now = new Date()) {
    const ending = await this.prisma.companyAiPlan.findMany({
      where: {
        status: 'ACTIVE',
        alertedEndingAt: null,
        periodEnd: { gt: now, lte: new Date(now.getTime() + AI_ENDING_DAYS * DAY) },
      },
    });
    for (const p of ending) {
      const claimed = await this.prisma.companyAiPlan.updateMany({
        where: { id: p.id, alertedEndingAt: null },
        data: { alertedEndingAt: now },
      });
      if (claimed.count) await this.notify(p.companyId, 'subscription_ai_ending', this.payload(p));
    }
    const ended = await this.prisma.companyAiPlan.findMany({ where: { status: 'ACTIVE', periodEnd: { lte: now } } });
    for (const p of ended) {
      const moved = await this.prisma.companyAiPlan.updateMany({
        where: { id: p.id, status: 'ACTIVE', periodEnd: { lte: now } },
        data: { status: 'ENDED' },
      });
      if (moved.count) await this.notify(p.companyId, 'subscription_ai_ended', this.payload(p));
    }
    return { endingSoon: ending.length, ended: ended.length };
  }

  /** For the platform owner's dashboard: companies near or past their limit. */
  async attention(now = new Date()) {
    const plans = await this.prisma.companyAiPlan.findMany({
      include: { company: { select: { id: true, name: true, slug: true } }, package: { select: { name: true } } },
      orderBy: { periodEnd: 'asc' },
    });
    return plans
      .map((p) => {
        const live = this.isLive(p, now);
        const reason = !live
          ? 'ENDED'
          : p.used >= p.quota
            ? 'EXHAUSTED'
            : p.used >= warnAt(p.quota)
              ? 'NEAR_LIMIT'
              : p.periodEnd.getTime() - now.getTime() <= AI_ENDING_DAYS * DAY
                ? 'ENDING_SOON'
                : null;
        return reason ? { reason, company: p.company, ...this.view(p) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private isLive(p: { status: string; periodEnd: Date }, now: Date) {
    return p.status === 'ACTIVE' && p.periodEnd > now;
  }

  private view(p: PlanRow & { package?: { name: string } | null }) {
    const now = new Date();
    const live = this.isLive(p, now);
    return {
      packageId: p.packageId,
      packageName: p.package?.name ?? null,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      quota: p.quota,
      used: p.used,
      remaining: Math.max(0, p.quota - p.used),
      usedPct: p.quota > 0 ? Math.min(100, Math.round((p.used / p.quota) * 100)) : 0,
      active: live && p.used < p.quota,
      status: live ? (p.used >= p.quota ? 'EXHAUSTED' : 'ACTIVE') : 'ENDED',
    };
  }

  private payload(p: PlanRow) {
    return {
      used: p.used,
      quota: p.quota,
      remaining: Math.max(0, p.quota - p.used),
      endDate: p.periodEnd.toISOString().slice(0, 10),
    };
  }

  private async alertOnce(
    planId: string,
    companyId: string,
    flag: 'alerted80At' | 'alertedFullAt',
    code: string,
    row: { used: number; quota: number },
  ) {
    const claimed = await this.prisma.companyAiPlan.updateMany({
      where: { id: planId, [flag]: null },
      data: { [flag]: new Date() },
    });
    if (!claimed.count) return;
    const plan = await this.prisma.companyAiPlan.findUnique({ where: { id: planId } });
    await this.notify(companyId, code, {
      used: row.used,
      quota: row.quota,
      remaining: Math.max(0, row.quota - row.used),
      endDate: plan?.periodEnd.toISOString().slice(0, 10) ?? '',
    });
  }

  private async notify(companyId: string, code: string, payload: Record<string, unknown>) {
    if (!this.notifications) return;
    try {
      await runInCompany(companyId, () => this.notifications!.sendToRoles([UserRole.ADMIN], code, payload));
    } catch (err) {
      reportFailure(this.logger, 'notification', `ai notice ${code} failed`, err);
    }
  }
}

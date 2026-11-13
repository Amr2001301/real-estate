import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingKind, ListingStatus, Prisma, TenancyStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { CreateMandateDto, CreateTenancyDto, RecordRentPaymentDto } from './dto/listing.dto';
import {
  MANDATE_EXPIRY_NOTICE_DAYS,
  TENANCY_ENDING_NOTICE_DAYS,
  day,
  daysUntil,
  mandateState,
  rentSchedule,
} from './brokerage-terms';

type MandateRow = Prisma.ListingMandateGetPayload<object>;
type TenancyRow = Prisma.TenancyGetPayload<{ include: { payments: true } }>;

/**
 * BRK-2 — a listing's terms: the owner's mandates (resale and rent) and, for
 * a rent, its tenancies with their monthly rent. Every query runs in the
 * tenant context (the three models are TENANT_OWNED).
 */
@Injectable()
export class ListingTermsService {
  constructor(private readonly prisma: PrismaService) {}

  private async today(): Promise<Date> {
    return startOfLocalToday(await currentCompanyTimeZone(this.prisma, getRequiredCompanyId()));
  }

  private async listing(id: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id }, select: { id: true, kind: true, status: true } });
    if (!listing) throw new NotFoundException('الوحدة غير موجودة');
    return listing;
  }

  private mandateView(m: MandateRow, today: Date) {
    const state = mandateState(m, today);
    const daysLeft = daysUntil(m.endDate, today);
    return { ...m, state, daysLeft, expiringSoon: state === 'ACTIVE' && daysLeft <= MANDATE_EXPIRY_NOTICE_DAYS };
  }

  private tenancyView(t: TenancyRow, today: Date) {
    const schedule = rentSchedule(
      { startDate: t.startDate, endDate: t.endDate, paymentDay: t.paymentDay, monthlyRent: Number(t.monthlyRent) },
      t.payments.map((p) => ({ period: p.period, amount: Number(p.amount), paidOn: p.paidOn })),
      today,
    );
    const active = t.status === TenancyStatus.ACTIVE;
    const overdue = active ? schedule.filter((r) => r.state === 'OVERDUE') : [];
    const daysLeft = daysUntil(t.endDate, today);
    return {
      ...t,
      schedule,
      summary: {
        paid: schedule.filter((r) => r.state === 'PAID').length,
        months: schedule.length,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((a, r) => a + r.amount, 0),
        next: active ? schedule.find((r) => r.state !== 'PAID' && r.state !== 'OVERDUE') ?? null : null,
        daysLeft,
        endingSoon: active && daysLeft >= 0 && daysLeft <= TENANCY_ENDING_NOTICE_DAYS,
      },
    };
  }

  /** The listing's mandates (newest first) and tenancies (newest first). */
  async terms(listingId: string) {
    await this.listing(listingId);
    const today = await this.today();
    const [mandates, tenancies] = await Promise.all([
      this.prisma.listingMandate.findMany({ where: { listingId }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.tenancy.findMany({ where: { listingId }, orderBy: [{ startDate: 'desc' }], include: { payments: { orderBy: { period: 'asc' } } } }),
    ]);
    return {
      mandates: mandates.map((m) => this.mandateView(m, today)),
      tenancies: tenancies.map((t) => this.tenancyView(t, today)),
    };
  }

  async createMandate(listingId: string, dto: CreateMandateDto, userId: string) {
    const listing = await this.listing(listingId);
    if (listing.kind === ListingKind.PRIMARY) throw new BadRequestException('التفويض لعقار المالك فقط (إعادة بيع أو إيجار)');
    if ((dto.commissionPct === undefined) === (dto.commissionAmount === undefined)) {
      throw new BadRequestException('حدّد العمولة كنسبة أو كمبلغ ثابت');
    }
    const start = day(dto.startDate);
    const end = day(dto.endDate);
    if (end.getTime() < start.getTime()) throw new BadRequestException('نهاية التفويض قبل بدايته');
    // Two mandates in force on the same days would contradict each other.
    const overlap = await this.prisma.listingMandate.findFirst({
      where: { listingId, cancelledAt: null, startDate: { lte: end }, endDate: { gte: start } },
      select: { id: true },
    });
    if (overlap) throw new ConflictException('يوجد تفويض آخر في نفس الفترة — ألغه أو اختر فترة بعده');
    const m = await this.prisma.listingMandate.create({
      data: {
        listingId,
        kind: dto.kind,
        commissionPct: dto.commissionPct !== undefined ? new Prisma.Decimal(dto.commissionPct) : null,
        commissionAmount: dto.commissionAmount !== undefined ? new Prisma.Decimal(dto.commissionAmount) : null,
        startDate: start,
        endDate: end,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
    });
    return this.mandateView(m, await this.today());
  }

  async cancelMandate(id: string) {
    const { count } = await this.prisma.listingMandate.updateMany({ where: { id, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (count === 0) throw new NotFoundException('التفويض غير موجود أو أُلغي');
    return { id };
  }

  /** Let a rent listing: one tenancy at a time; the listing reads as rented. */
  async createTenancy(listingId: string, dto: CreateTenancyDto, userId: string) {
    const listing = await this.listing(listingId);
    if (listing.kind !== ListingKind.RENT) throw new BadRequestException('عقد الإيجار لوحدة إيجار فقط');
    const start = day(dto.startDate);
    const end = day(dto.endDate);
    if (end.getTime() <= start.getTime()) throw new BadRequestException('نهاية العقد يجب أن تكون بعد بدايته');
    const active = await this.prisma.tenancy.findFirst({ where: { listingId, status: TenancyStatus.ACTIVE }, select: { id: true } });
    if (active) throw new ConflictException('للوحدة عقد إيجار ساري — أنهِه أولًا');
    const t = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenancy.create({
        data: {
          listingId,
          tenantName: dto.tenantName.trim(),
          tenantPhone: dto.tenantPhone.trim(),
          startDate: start,
          endDate: end,
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
          paymentDay: dto.paymentDay,
          deposit: dto.deposit !== undefined ? new Prisma.Decimal(dto.deposit) : null,
          notes: dto.notes?.trim() || null,
          createdById: userId,
        },
        include: { payments: true },
      });
      await tx.listing.updateMany({ where: { id: listingId }, data: { status: ListingStatus.CLOSED } });
      return created;
    });
    return this.tenancyView(t, await this.today());
  }

  /** End a tenancy: the listing is back on the market. */
  async endTenancy(id: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id, status: TenancyStatus.ACTIVE }, select: { id: true, listingId: true } });
    if (!t) throw new NotFoundException('العقد غير موجود أو منتهٍ');
    await this.prisma.$transaction([
      this.prisma.tenancy.updateMany({ where: { id }, data: { status: TenancyStatus.ENDED, endedAt: new Date() } }),
      this.prisma.listing.updateMany({ where: { id: t.listingId, status: ListingStatus.CLOSED }, data: { status: ListingStatus.AVAILABLE } }),
    ]);
    return { id };
  }

  async recordPayment(tenancyId: string, dto: RecordRentPaymentDto, userId: string) {
    const t = await this.prisma.tenancy.findFirst({ where: { id: tenancyId }, include: { payments: true } });
    if (!t) throw new NotFoundException('العقد غير موجود');
    const today = await this.today();
    const row = this.tenancyView(t, today).schedule.find((r) => r.period === dto.period);
    if (!row) throw new BadRequestException('هذا الشهر خارج مدة العقد');
    if (row.paid) throw new ConflictException('إيجار هذا الشهر مسجّل بالفعل');
    try {
      await this.prisma.rentPayment.create({
        data: { tenancyId, period: dto.period, amount: new Prisma.Decimal(dto.amount), paidOn: day(dto.paidOn), note: dto.note?.trim() || null, createdById: userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException('إيجار هذا الشهر مسجّل بالفعل');
      throw err;
    }
    const fresh = await this.prisma.tenancy.findFirstOrThrow({ where: { id: tenancyId }, include: { payments: { orderBy: { period: 'asc' } } } });
    return this.tenancyView(fresh, today);
  }

  async removePayment(paymentId: string) {
    const { count } = await this.prisma.rentPayment.deleteMany({ where: { id: paymentId } });
    if (count === 0) throw new NotFoundException('الدفعة غير موجودة');
    return { id: paymentId };
  }

  /**
   * What needs the team across the company's listings: mandates ending
   * soon, tenancies with unpaid rent past its day, tenancies ending soon.
   */
  async alerts() {
    const today = await this.today();
    const soon = new Date(today.getTime() + MANDATE_EXPIRY_NOTICE_DAYS * 86_400_000);
    const [mandates, tenancies] = await Promise.all([
      this.prisma.listingMandate.findMany({
        where: { cancelledAt: null, startDate: { lte: today }, endDate: { gte: today, lte: soon } },
        select: { id: true },
      }),
      this.prisma.tenancy.findMany({ where: { status: TenancyStatus.ACTIVE }, include: { payments: true } }),
    ]);
    const views = tenancies.map((t) => this.tenancyView(t, today));
    return {
      mandatesExpiring: mandates.length,
      rentOverdue: views.filter((v) => v.summary.overdueCount > 0).length,
      rentOverdueAmount: views.reduce((a, v) => a + v.summary.overdueAmount, 0),
      tenanciesEnding: views.filter((v) => v.summary.endingSoon).length,
    };
  }
}

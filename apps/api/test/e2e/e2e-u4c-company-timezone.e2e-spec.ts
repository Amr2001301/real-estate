/**
 * U4c — reports in the company's time zone (Africa/Cairo here), not UTC.
 *
 * Half an hour into the company's month is still the previous month in UTC:
 * the dashboards' "this month", the monthly trends and a "YYYY-MM" period
 * used to put such a payment or sale in the wrong month.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, DepositType, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
const TZ = 'Africa/Cairo';

/** Today's Cairo year and month, and the instant Cairo's month began. */
function cairoMonth(): { year: number; month: number; key: string; start: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  // Cairo is UTC+2 or +3: the month begins at 21:00 or 22:00 UTC the day before.
  const utcMidnight = Date.UTC(year, month - 1, 1);
  const offsetHours = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(utcMidnight)),
  );
  return { year, month, key: `${year}-${String(month).padStart(2, '0')}`, start: new Date(utcMidnight - offsetHours * 3_600_000) };
}

describe('U4c — reports in the company time zone (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let unit: { id: string; status: UnitStatus };
  let contractId: string;
  // Half an hour into this month in Cairo — the previous month in UTC.
  let earlyThisMonth: Date;
  let period: string;
  let year: number;
  const stamp = Date.now().toString().slice(-8);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    const month = cairoMonth();
    earlyThisMonth = new Date(month.start.getTime() + 30 * 60_000);
    expect(earlyThisMonth.getUTCMonth()).not.toBe(month.month - 1); // really the previous UTC month
    period = month.key;
    year = month.year;

    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U4c Customer', phone: `+2022${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    unit = await raw.unit.findFirstOrThrow({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
    });
    await raw.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: unit.id, totalAmount: 123_456, status: ContractStatus.ACTIVE,
          // Signed well before; Z-2 moves it to half an hour into this month.
          signedAt: new Date(Date.now() - 40 * 86_400_000), contractNumber: `U4C-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { contractId } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.unit.update({ where: { id: unit.id }, data: { status: unit.status } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('Z-1: a payment half an hour into the month counts in this month', async () => {
    const summary = async () => (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.financial;
    const dashboard = async () => (await asAdmin(http().get('/v1/reports/financial-dashboard')).expect(200)).body;
    const [s0, d0] = [await summary(), await dashboard()];
    await testApp.rawPrisma.deposit.create({
      data: {
        companyId, contractId, type: DepositType.DOWN_PAYMENT, amount: 4321, paidAt: earlyThisMonth,
        recordedById: fixtures.userIds.adminId,
      },
    });
    const [s1, d1] = [await summary(), await dashboard()];
    expect(s1.collectedThisMonth - s0.collectedThisMonth).toBe(4321);
    expect(Number(d1.summary.collectedThisMonth) - Number(d0.summary.collectedThisMonth)).toBe(4321);
    const slot = (d: { cashflowTrend: Array<{ month: string; collected: number }> }) =>
      d.cashflowTrend.find((t) => t.month === period)!.collected;
    expect(slot(d1) - slot(d0)).toBe(4321);
  });

  it('Z-2: a sale signed half an hour into the month is this month’s (period and trend)', async () => {
    const thisMonth = Number(period.slice(5, 7));
    const figures = async () => {
      const sales = (await asAdmin(http().get('/v1/reports/sales').query({ period })).expect(200)).body;
      const trend = (await asAdmin(http().get('/v1/reports/sales-trend').query({ year })).expect(200)).body as Array<{
        month: number;
        total: number;
      }>;
      return { period: Number(sales.total), trend: Number(trend.find((t) => t.month === thisMonth)!.total) };
    };
    const before = await figures();
    await testApp.rawPrisma.contract.update({ where: { id: contractId }, data: { signedAt: earlyThisMonth } });
    const after = await figures();
    expect(after.period - before.period).toBe(123_456);
    expect(after.trend - before.trend).toBe(123_456);
  });
});

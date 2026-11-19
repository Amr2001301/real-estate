import { UserRole } from '@prisma/client';
import { VisitsService } from '../visits.service';

jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

/**
 * Each figure on the visits page opens a list; the list's query must be the
 * figure's count query, so the number on the card is the number of rows.
 */
const SALES = { sub: 'a2222222-2222-4222-8222-222222222222', role: UserRole.SALES } as never;
const ADMIN = { sub: 'a3333333-3333-4333-8333-333333333333', role: UserRole.ADMIN } as never;

function make() {
  const reqCount = jest.fn().mockResolvedValue(0);
  const apptCount = jest.fn().mockResolvedValue(0);
  const prisma = {
    visitRequest: { count: reqCount, findMany: jest.fn().mockResolvedValue([]) },
    visitAppointment: { count: apptCount, findMany: jest.fn().mockResolvedValue([]) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const svc = new VisitsService(prisma as never, {} as never);
  return { svc, reqCount, apptCount };
}

/** The `where` of the count calls made by stats(): requests then appointments. */
async function statsWheres(user: never) {
  const m = make();
  await m.svc.stats(user);
  const req = m.reqCount.mock.calls.map((c) => c[0]?.where);
  const appt = m.apptCount.mock.calls.map((c) => c[0]?.where);
  return { newRequests: req[0], todayVisits: appt[0], weekVisits: appt[1], scheduledVisits: appt[2], pendingConfirmation: appt[3] };
}

async function listRequestsWhere(dto: object, user: never) {
  const m = make();
  await m.svc.listRequests(dto as never, user);
  return m.reqCount.mock.calls[0][0].where;
}

async function listAppointmentsWhere(dto: object, user: never) {
  const m = make();
  await m.svc.listAppointments(dto as never, user);
  return m.apptCount.mock.calls[0][0].where;
}

describe('visits figures open the rows they count', () => {
  beforeAll(() => jest.useFakeTimers({ now: new Date(2031, 0, 5, 14, 30), doNotFake: ['nextTick', 'setImmediate'] }));
  afterAll(() => jest.useRealTimers());

  it.each([ADMIN, SALES])('«طلبات جديدة» = requests open=true (%#)', async (user) => {
    const s = await statsWheres(user);
    expect(await listRequestsWhere({ open: 'true' }, user)).toEqual(s.newRequests);
  });

  it('«اليوم» = appointments today=1&booked=true', async () => {
    const s = await statsWheres(SALES);
    expect(await listAppointmentsWhere({ today: '1', booked: 'true' }, SALES)).toEqual(s.todayVisits);
  });

  it('«هذا الأسبوع» = appointments week=true&booked=true', async () => {
    const s = await statsWheres(SALES);
    expect(await listAppointmentsWhere({ week: 'true', booked: 'true' }, SALES)).toEqual(s.weekVisits);
  });

  it('«مجدولة» = appointments booked=true', async () => {
    const s = await statsWheres(ADMIN);
    expect(await listAppointmentsWhere({ booked: 'true' }, ADMIN)).toEqual(s.scheduledVisits);
  });

  it('«بحاجة لتأكيد» = appointments status=SCHEDULED', async () => {
    const s = await statsWheres(SALES);
    expect(await listAppointmentsWhere({ status: 'SCHEDULED' }, SALES)).toEqual(s.pendingConfirmation);
  });
});

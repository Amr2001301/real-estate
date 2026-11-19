import { ReservationsService } from '../reservations.module';

/**
 * The figures over the reservations page open filtered lists; each figure's
 * count must use the list's own query, so the card's number is the row total.
 */
const REP = 'a2222222-2222-4222-8222-222222222222';

function make() {
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    reservation: { count, findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const svc = new ReservationsService(prisma as never, {} as never, {} as never);
  return { svc, count };
}

async function statsWheres(scope: { salesId?: string; salesIds?: string[] }) {
  const m = make();
  await m.svc.stats(scope);
  const w = m.count.mock.calls.map((c) => c[0]?.where);
  return { total: w[0], pending: w[1], approved: w[2], rejected: w[3] };
}

async function listWhere(opts: object) {
  const m = make();
  await m.svc.list({ page: 1, pageSize: 10, ...opts } as never);
  return m.count.mock.calls[0][0].where;
}

describe('reservation figures open the rows they count', () => {
  it.each([[{ salesId: REP }], [{ salesIds: [REP] }], [{}]])('scope %j', async (scope) => {
    const s = await statsWheres(scope);
    expect(await listWhere({ ...scope })).toEqual(s.total);
    expect(await listWhere({ ...scope, status: 'PENDING' })).toEqual(s.pending);
    expect(await listWhere({ ...scope, status: 'APPROVED' })).toEqual(s.approved);
    expect(await listWhere({ ...scope, status: 'REJECTED' })).toEqual(s.rejected);
  });
});

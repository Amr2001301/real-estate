/**
 * F-079 — the name in a reservation's notifications comes from the client, and
 * falls back to the lead's name while the reservation has no client yet (a
 * reservation made from a lead has none until it converts). It used to be blank.
 */
import { ReservationsService } from '../reservations.module';

function serviceWith(reservation: Record<string, unknown>): {
  buildReservationPayload(id: string): Promise<Record<string, unknown>>;
} {
  const svc = Object.create(ReservationsService.prototype);
  svc.prisma = { reservation: { findUnique: jest.fn().mockResolvedValue(reservation) } };
  return svc;
}

const base = {
  reservationNumber: 'RES-2026-0001',
  status: 'APPROVED',
  unit: { code: 'AFQ-301', building: { phase: { project: { name: { ar: 'أفق' } } } } },
};

describe('reservation notification payload — customerName', () => {
  it('uses the lead name when the reservation has no client yet', async () => {
    const p = await serviceWith({ ...base, client: null, lead: { fullName: 'عمر السيد' } })
      .buildReservationPayload('r1');
    expect(p.customerName).toBe('عمر السيد');
  });

  it('prefers the client name when there is one', async () => {
    const p = await serviceWith({
      ...base,
      client: { fullName: 'منى الشاذلي' },
      lead: { fullName: 'اسم قديم' },
    }).buildReservationPayload('r1');
    expect(p.customerName).toBe('منى الشاذلي');
  });

  it('is empty only when neither exists', async () => {
    const p = await serviceWith({ ...base, client: null, lead: null }).buildReservationPayload('r1');
    expect(p.customerName).toBe('');
  });
});

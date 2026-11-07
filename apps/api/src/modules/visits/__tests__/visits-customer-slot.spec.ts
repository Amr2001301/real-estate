import { ConflictException } from '@nestjs/common';
import { VisitsService } from '../visits.service';

jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

/** F-050: one customer cannot be booked for two visits at the same time (a rep already could not). */
const LEAD = 'a1111111-1111-4111-8111-111111111111';
const at = (h: number) => new Date(Date.UTC(2031, 0, 5, h, 0, 0));

function make(existing: Array<{ scheduledAt: Date; durationMinutes: number | null; visitNumber: string }>) {
  const findMany = jest.fn().mockResolvedValue(existing);
  const prisma = { visitAppointment: { findMany }, unit: { findFirst: jest.fn().mockResolvedValue(null) } };
  const svc = new VisitsService(prisma as never, {} as never);
  const check = (slot: Record<string, unknown>) =>
    (svc as unknown as { assertVisitSlot(s: Record<string, unknown>): Promise<void> }).assertVisitSlot({
      assignedSalesId: null,
      unitId: null,
      durationMinutes: 60,
      ...slot,
    });
  return { check, findMany };
}

describe('assertVisitSlot · the same customer', () => {
  it('refuses a second visit for the same lead at the same time', async () => {
    const { check } = make([{ scheduledAt: at(10), durationMinutes: 60, visitNumber: 'VA-2031-0001' }]);
    await expect(check({ scheduledAt: at(10), leadId: LEAD })).rejects.toThrow(ConflictException);
    await expect(check({ scheduledAt: at(10), leadId: LEAD })).rejects.toThrow(/للعميل زيارة أخرى/);
  });

  it('refuses an overlap, allows the next slot', async () => {
    const { check } = make([{ scheduledAt: at(10), durationMinutes: 60, visitNumber: 'VA-2031-0001' }]);
    await expect(check({ scheduledAt: at(10.5 as number), leadId: LEAD })).rejects.toThrow(ConflictException);
    await expect(check({ scheduledAt: at(11), leadId: LEAD })).resolves.toBeUndefined();
  });

  it('looks up the customer by lead or client, and does nothing when there is none', async () => {
    const { check, findMany } = make([]);
    await check({ scheduledAt: at(10), clientId: 'b2222222-2222-4222-8222-222222222222' });
    expect(JSON.stringify(findMany.mock.calls[0]![0].where.OR)).toContain('clientId');
    findMany.mockClear();
    await check({ scheduledAt: at(10) });
    expect(findMany).not.toHaveBeenCalled();
  });
});

import { runInCompany } from '../../../common/tenant/tenant-context';
import { UnitsService } from '../units.service';

/**
 * The units list export: who holds each unit (the buyer on its live
 * contract, else the open reservation's customer) and the columns the list
 * was missing (type name, finishing, view, price per meter, handover).
 */
const COMPANY = '00000000-0000-0000-0000-0000000000aa';

function setup() {
  const contractFind = jest.fn().mockResolvedValue([
    { unitId: 'u1', contractNumber: 'CON-1', customer: { fullName: 'سارة' } },
  ]);
  const reservationFind = jest.fn().mockResolvedValue([
    // u1 also has a reservation: the contract wins.
    { unitId: 'u1', reservationNumber: 'RES-0', client: { fullName: 'قديم' }, lead: null },
    { unitId: 'u2', reservationNumber: 'RES-2', client: null, lead: { fullName: 'منى' } },
  ]);
  const prisma = { contract: { findMany: contractFind }, reservation: { findMany: reservationFind } };
  const svc = new UnitsService(prisma as never, {} as never);
  return { svc, contractFind, reservationFind };
}

type Col = { header: string; value: (r: unknown) => unknown };
const columns = (UnitsService as unknown as { EXPORT_COLUMNS: Col[] }).EXPORT_COLUMNS;
const cell = (row: unknown, header: string) => columns.find((c) => c.header === header)!.value(row);

describe('units list export', () => {
  it('holders: the contract buyer, else the open reservation; company-scoped', async () => {
    const { svc, contractFind, reservationFind } = setup();
    const holders = await runInCompany(COMPANY, () =>
      (svc as unknown as { holders(ids: string[]): Promise<Map<string, { name: string; ref: string }>> }).holders([
        'u1',
        'u2',
        'u3',
      ]),
    );
    expect(holders.get('u1')).toEqual({ name: 'سارة', ref: 'CON-1' });
    expect(holders.get('u2')).toEqual({ name: 'منى', ref: 'RES-2' });
    expect(holders.has('u3')).toBe(false);
    expect(contractFind.mock.calls[0][0].where.companyId).toBe(COMPANY);
    expect(reservationFind.mock.calls[0][0].where.companyId).toBe(COMPANY);
  });

  it('columns: Arabic type and specs, price per meter, handover, holder', () => {
    const row = {
      id: 'u1',
      code: 'A-1',
      type: '2BR',
      typeName: { ar: 'شقة غرفتين', en: '2 bedrooms' },
      floor: 2,
      area: 120,
      bedrooms: 2,
      bathrooms: 2,
      price: 3_000_000,
      pricePerMeter: null,
      finishing: 'SEMI_FINISHED',
      view: 'LAGOON',
      orientation: 'NORTH',
      effectiveDeliveryDate: '2027-07-01',
      status: 'SOLD',
      createdAt: new Date('2026-11-01T00:00:00Z'),
      holder: { name: 'سارة', ref: 'CON-1' },
    };
    expect(cell(row, 'النوع')).toBe('شقة غرفتين');
    expect(cell(row, 'التشطيب')).toBe('نصف تشطيب');
    expect(cell(row, 'الفيو')).toBe('لاجون');
    expect(cell(row, 'الاتجاه')).toBe('بحري');
    // Not priced by the meter: the price over the area.
    expect(cell(row, 'سعر المتر')).toBe(25_000);
    expect(cell({ ...row, pricePerMeter: 26_000 }, 'سعر المتر')).toBe(26_000);
    expect(cell(row, 'التسليم')).toBe('2027-07-01');
    expect(cell(row, 'الحالة')).toBe('مباعة');
    expect(cell(row, 'المشتري / الحاجز')).toBe('سارة');
    expect(cell(row, 'العقد / الحجز')).toBe('CON-1');
  });
});

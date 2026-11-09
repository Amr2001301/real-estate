import {
  DEFAULT_MAINTENANCE_CATEGORIES,
  seedMaintenanceCategoriesForCompany,
} from '../maintenance-category-defaults';

// QA run 1, F-032: a new company had no maintenance category, so no customer
// could send a request.
describe('seedMaintenanceCategoriesForCompany', () => {
  const mk = (existing: number) => ({
    maintenanceCategory: {
      count: jest.fn().mockResolvedValue(existing),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  });

  it('gives a company with none the six defaults, each with a code, both names and an SLA', async () => {
    const prisma = mk(0);
    await seedMaintenanceCategoriesForCompany(prisma, 'co-1');
    const { data } = prisma.maintenanceCategory.createMany.mock.calls[0]![0] as {
      data: Array<{ companyId: string; code: string; name: { ar: string; en: string }; slaDurationMinutes: number }>;
    };
    expect(data).toHaveLength(6);
    expect(new Set(data.map((d) => d.code)).size).toBe(6);
    for (const d of data) {
      expect(d.companyId).toBe('co-1');
      expect(d.name.ar.length).toBeGreaterThan(1);
      expect(d.name.en.length).toBeGreaterThan(1);
      expect(d.slaDurationMinutes).toBeGreaterThan(0);
    }
  });

  it('leaves a company that already has a category alone', async () => {
    const prisma = mk(1);
    await seedMaintenanceCategoriesForCompany(prisma, 'co-2');
    expect(prisma.maintenanceCategory.createMany).not.toHaveBeenCalled();
  });

  it('the list matches the migration (same codes)', () => {
    expect(DEFAULT_MAINTENANCE_CATEGORIES.map((c) => c.code)).toEqual([
      'plumbing', 'electrical', 'hvac', 'carpentry', 'painting', 'general',
    ]);
  });
});

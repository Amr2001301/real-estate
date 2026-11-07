/**
 * The maintenance categories every company starts with. A new company had none,
 * so no customer could send a maintenance request until the admin found the
 * form at the bottom of the maintenance page (QA run 1, F-032). The admin
 * renames, adds, orders or switches them off; warranty periods are left for the
 * company to set (they are a commercial term).
 *
 * `slaDurationMinutes` is the handling window the admin sees as hours.
 */
export const DEFAULT_MAINTENANCE_CATEGORIES: ReadonlyArray<{
  code: string;
  name: { ar: string; en: string };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  slaDurationMinutes: number;
}> = [
  { code: 'plumbing', name: { ar: 'سباكة', en: 'Plumbing' }, priority: 'HIGH', slaDurationMinutes: 24 * 60 },
  { code: 'electrical', name: { ar: 'كهرباء', en: 'Electrical' }, priority: 'HIGH', slaDurationMinutes: 24 * 60 },
  { code: 'hvac', name: { ar: 'تكييف', en: 'HVAC' }, priority: 'MEDIUM', slaDurationMinutes: 48 * 60 },
  { code: 'carpentry', name: { ar: 'نجارة', en: 'Carpentry' }, priority: 'LOW', slaDurationMinutes: 72 * 60 },
  { code: 'painting', name: { ar: 'دهانات وتشطيبات', en: 'Painting & finishing' }, priority: 'LOW', slaDurationMinutes: 120 * 60 },
  { code: 'general', name: { ar: 'أعمال عامة', en: 'General' }, priority: 'MEDIUM', slaDurationMinutes: 72 * 60 },
];

/**
 * Give a new company the default categories. Runs in the platform (bypass)
 * context, so the explicit companyId on each row is kept. Idempotent: a
 * company that has any category is left alone.
 */
export async function seedMaintenanceCategoriesForCompany(
  prisma: {
    maintenanceCategory: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: (...args: any[]) => Promise<number>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMany: (...args: any[]) => Promise<{ count: number }>;
    };
  },
  companyId: string,
): Promise<void> {
  if ((await prisma.maintenanceCategory.count({ where: { companyId } })) > 0) return;
  await prisma.maintenanceCategory.createMany({
    data: DEFAULT_MAINTENANCE_CATEGORIES.map((c) => ({
      companyId,
      code: c.code,
      name: c.name,
      priority: c.priority,
      slaDurationMinutes: c.slaDurationMinutes,
    })),
    skipDuplicates: true,
  });
}

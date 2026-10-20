import { UnitUsage } from '@prisma/client';

/**
 * The unit types every company starts with (F10). Units used to be typed
 * from a fixed residential list (Studio … Penthouse), so a shop, an office,
 * a clinic or a garage could not be entered at all. The admin renames, adds
 * or switches them off from the dashboard. The codes are what Unit.type
 * holds; the 20261020090000_unit_types migration seeds the same list.
 */
export const DEFAULT_UNIT_TYPES: ReadonlyArray<{
  code: string;
  ar: string;
  en: string;
  usage: UnitUsage;
}> = [
  { code: 'Studio', ar: 'استوديو', en: 'Studio', usage: UnitUsage.RESIDENTIAL },
  { code: '1BR', ar: 'شقة غرفة نوم', en: '1-bedroom apartment', usage: UnitUsage.RESIDENTIAL },
  { code: '2BR', ar: 'شقة غرفتين نوم', en: '2-bedroom apartment', usage: UnitUsage.RESIDENTIAL },
  { code: '3BR', ar: 'شقة 3 غرف نوم', en: '3-bedroom apartment', usage: UnitUsage.RESIDENTIAL },
  { code: '4BR', ar: 'شقة 4 غرف نوم', en: '4-bedroom apartment', usage: UnitUsage.RESIDENTIAL },
  { code: 'Duplex', ar: 'دوبلكس', en: 'Duplex', usage: UnitUsage.RESIDENTIAL },
  { code: 'Penthouse', ar: 'بنتهاوس', en: 'Penthouse', usage: UnitUsage.RESIDENTIAL },
  { code: 'Villa', ar: 'فيلا', en: 'Villa', usage: UnitUsage.RESIDENTIAL },
  { code: 'Townhouse', ar: 'تاون هاوس', en: 'Townhouse', usage: UnitUsage.RESIDENTIAL },
  { code: 'Twin house', ar: 'توين هاوس', en: 'Twin house', usage: UnitUsage.RESIDENTIAL },
  { code: 'Chalet', ar: 'شاليه', en: 'Chalet', usage: UnitUsage.RESIDENTIAL },
  { code: 'Shop', ar: 'محل تجاري', en: 'Shop', usage: UnitUsage.COMMERCIAL },
  { code: 'Office', ar: 'مكتب إداري', en: 'Office', usage: UnitUsage.ADMINISTRATIVE },
  { code: 'Clinic', ar: 'عيادة', en: 'Clinic', usage: UnitUsage.MEDICAL },
  { code: 'Garage', ar: 'جراج', en: 'Garage', usage: UnitUsage.PARKING },
];

/**
 * Give a company the default types. Runs in the platform (bypass) context,
 * so the explicit companyId on each row is kept. Idempotent: a code the
 * company already has (any case) is skipped.
 */
export async function seedUnitTypesForCompany(
  prisma: {
    unitType: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: (...args: any[]) => Promise<Array<{ code: string }>>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMany: (...args: any[]) => Promise<{ count: number }>;
    };
  },
  companyId: string,
): Promise<void> {
  const existing = await prisma.unitType.findMany({ where: { companyId }, select: { code: true } });
  const have = new Set(existing.map((t) => t.code.toLowerCase()));
  const data = DEFAULT_UNIT_TYPES.map((t, order) => ({ ...t, order }))
    .filter((t) => !have.has(t.code.toLowerCase()))
    .map((t) => ({ companyId, code: t.code, name: { ar: t.ar, en: t.en }, usage: t.usage, order: t.order }));
  if (data.length) await prisma.unitType.createMany({ data, skipDuplicates: true });
}

/** Each of the company's units takes the usage of its type (seeds write units directly). */
export async function syncUnitUsageForCompany(
  prisma: {
    unitType: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: (...args: any[]) => Promise<Array<{ code: string; usage: UnitUsage }>>;
    };
    unit: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateMany: (...args: any[]) => Promise<{ count: number }>;
    };
  },
  companyId: string,
): Promise<void> {
  const types = await prisma.unitType.findMany({ where: { companyId }, select: { code: true, usage: true } });
  for (const t of types) {
    if (t.usage === UnitUsage.RESIDENTIAL) continue;
    await prisma.unit.updateMany({
      where: { companyId, type: t.code, usage: { not: t.usage } },
      data: { usage: t.usage, bedrooms: 0 },
    });
  }
}

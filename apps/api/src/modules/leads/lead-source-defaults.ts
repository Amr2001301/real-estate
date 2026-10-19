/**
 * The lead sources every company starts with. A company created from the
 * platform had none, and the dashboard had no screen to add them, so every
 * lead was saved without a source and the "lead sources" report stayed empty.
 * The admin renames, adds or switches them off from the dashboard.
 *
 * "Website" must stay: leads from the public site are filed under the source
 * whose English name is "Website" (RequestsService.websiteLeadSourceId).
 */
export const DEFAULT_LEAD_SOURCES: ReadonlyArray<{ ar: string; en: string }> = [
  { ar: 'فيسبوك', en: 'Facebook' },
  { ar: 'انستغرام', en: 'Instagram' },
  { ar: 'واتساب', en: 'WhatsApp' },
  { ar: 'موقع الويب', en: 'Website' },
  { ar: 'إحالة', en: 'Referral' },
  { ar: 'زيارة مباشرة', en: 'Walk-in' },
  { ar: 'اتصال هاتفي', en: 'Phone call' },
];

/**
 * Give a new company the default sources. Runs in the platform (bypass)
 * context, so the explicit companyId on each row is kept. Idempotent: a
 * source whose English name the company already has is skipped.
 */
export async function seedLeadSourcesForCompany(
  prisma: {
    leadSource: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: (...args: any[]) => Promise<Array<{ name: unknown }>>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMany: (...args: any[]) => Promise<{ count: number }>;
    };
  },
  companyId: string,
): Promise<void> {
  const existing = await prisma.leadSource.findMany({
    where: { companyId },
    select: { name: true },
  });
  const have = new Set(
    existing.map((s) => String((s.name as { en?: string } | null)?.en ?? '').toLowerCase()),
  );
  const data = DEFAULT_LEAD_SOURCES.filter((n) => !have.has(n.en.toLowerCase())).map((name) => ({
    companyId,
    name,
  }));
  if (data.length) await prisma.leadSource.createMany({ data });
}

/**
 * The lost reasons every company starts with (migration 20261027150000 gave
 * them to the companies that existed then). The admin renames, adds, orders
 * or switches them off from the dashboard.
 */
export const DEFAULT_LOST_REASONS: ReadonlyArray<{ ar: string; en: string }> = [
  { ar: 'السعر مرتفع', en: 'Price too high' },
  { ar: 'اشترى من منافس', en: 'Bought from a competitor' },
  { ar: 'الموقع غير مناسب', en: 'Location not suitable' },
  { ar: 'المساحة أو التصميم غير مناسب', en: 'Size or layout not suitable' },
  { ar: 'نظام السداد غير مناسب', en: 'Payment plan not suitable' },
  { ar: 'موعد التسليم بعيد', en: 'Delivery too far' },
  { ar: 'أجّل قرار الشراء', en: 'Postponed the purchase' },
  { ar: 'لا يرد / تعذّر التواصل', en: 'Unreachable' },
  { ar: 'غير جاد', en: 'Not serious' },
  { ar: 'أخرى', en: 'Other' },
];

/**
 * Give a new company the default reasons. Runs in the platform (bypass)
 * context, so the explicit companyId on each row is kept. Idempotent: a
 * company that has any reason is left alone.
 */
export async function seedLostReasonsForCompany(
  prisma: {
    lostReason: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: (...args: any[]) => Promise<number>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMany: (...args: any[]) => Promise<{ count: number }>;
    };
  },
  companyId: string,
): Promise<void> {
  if ((await prisma.lostReason.count({ where: { companyId } })) > 0) return;
  await prisma.lostReason.createMany({
    data: DEFAULT_LOST_REASONS.map((name, i) => ({ companyId, name, sortOrder: i + 1 })),
  });
}

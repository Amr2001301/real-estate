// Shared label for internal sales actors (SALES + SALES_MANAGER) in rep
// dropdowns. A SALES_MANAGER acts as a sales rep too, so the role is suffixed
// to distinguish the two. `role` is optional: when absent we default to the
// SALES label.
export type SalesActorRole = 'SALES' | 'SALES_MANAGER';

export function salesActorLabel(u: { fullName: string; role?: SalesActorRole | string }): string {
  return u.role === 'SALES_MANAGER' ? `${u.fullName} — مدير مبيعات` : `${u.fullName} — مبيعات`;
}

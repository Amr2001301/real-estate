/**
 * Frontend helpers for the structured 403 body the API emits when a request
 * is blocked by the PermissionsGuard:
 *
 *   { message: "Missing permission: contracts:sign",
 *     code: "missing_permission",
 *     permissions: ["contracts:sign"] }
 *
 * The shape is documented in apps/api/src/common/guards/permissions.guard.ts.
 * This file is the single source of truth for how the dashboard renders it.
 */

export interface MissingPermissionPayload {
  code: 'missing_permission';
  permissions: string[];
  message?: string;
  status: 403;
}

/** Narrow type-guard against unknown thrown values. */
export function isMissingPermissionError(
  err: unknown,
): err is { status: 403; code: 'missing_permission'; permissions: string[]; message?: string } {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; code?: unknown; permissions?: unknown };
  return (
    e.status === 403 &&
    e.code === 'missing_permission' &&
    Array.isArray(e.permissions)
  );
}

/** Hand-curated Arabic labels for the most user-visible permission codes.
 *  Missing entries fall back to the raw code; nobody is rewriting all 87. */
export const PERMISSION_LABELS: Record<string, string> = {
  // Contracts
  'contracts:read': 'عرض العقود',
  'contracts:create': 'إنشاء العقود',
  'contracts:update': 'تعديل العقود',
  'contracts:delete': 'حذف العقود',
  'contracts:sign': 'توقيع العقود',
  // Reservations
  'reservations:read': 'عرض الحجوزات',
  'reservations:create': 'إنشاء الحجوزات',
  'reservations:approve': 'اعتماد الحجوزات',
  'reservations:reject': 'رفض الحجوزات',
  'reservations:cancel': 'إلغاء الحجوزات',
  'reservations:convert': 'تحويل الحجز إلى عقد',
  // Deposits
  'deposits:read': 'عرض الدفعات',
  'deposits:create': 'تسجيل دفعة',
  'deposits:verify': 'اعتماد الدفعات',
  // Installments
  'installments:read': 'عرض خطط التقسيط',
  'installments:manage': 'إدارة خطط التقسيط',
  'installments:activate': 'تفعيل خطط التقسيط',
  // Maintenance
  'maintenance:read': 'عرض طلبات الصيانة',
  'maintenance:assign': 'إسناد الصيانة',
  'maintenance:resolve': 'إنهاء طلبات الصيانة',
  // Leads + Visits
  'leads:read': 'عرض فرص المبيعات',
  'leads:assign': 'إسناد فرص المبيعات',
  'visits:read': 'عرض الزيارات',
  'visits:schedule': 'جدولة الزيارات',
  // Projects / Units / Inventory
  'projects:read': 'عرض المشاريع',
  'projects:create': 'إنشاء المشاريع',
  'projects:publish': 'نشر المشاريع',
  'units:read': 'عرض الوحدات',
  'units:change-status': 'تغيير حالة الوحدة',
  // Admin
  'users:manage': 'إدارة المستخدمين',
  'permissions:manage': 'إدارة الصلاحيات',
  'settings:manage': 'إدارة الإعدادات',
  'reports:read': 'عرض التقارير',
  'audit-logs:read': 'عرض سجلات التدقيق',
  // CMS / Documents / Notifications
  'cms:pages:manage': 'إدارة صفحات المحتوى',
  'cms:banners:manage': 'إدارة الإعلانات',
  'cms:articles:manage': 'إدارة المقالات',
  'documents:manage': 'إدارة المستندات',
  'notifications:send': 'إرسال الإشعارات',
  // Broker leads
  'broker_leads:read': 'عرض فرص الوسطاء',
  'broker_leads:approve': 'اعتماد فرص الوسطاء',
  'broker_leads:reject': 'رفض فرص الوسطاء',
  // Broker payouts
  'broker_payouts:read': 'عرض مدفوعات الوسطاء',
  'broker_payouts:create': 'إنشاء مدفوعات الوسطاء',
  'broker_payouts:update': 'تعديل مدفوعات الوسطاء',
  'broker_payouts:approve': 'اعتماد مدفوعات الوسطاء',
  'broker_payouts:process': 'بدء معالجة مدفوعات الوسطاء',
  'broker_payouts:pay': 'تعليم مدفوعات الوسطاء كمدفوعة',
  'broker_payouts:cancel': 'إلغاء مدفوعات الوسطاء',
  // Bonus / commissions
  'bonus:rules:manage': 'إدارة قواعد المكافآت',
  'bonus:entries:read': 'عرض المكافآت',
  'bonus:entries:create': 'إنشاء المكافآت',
  'bonus:entries:approve': 'اعتماد المكافآت',
  'bonus:entries:pay': 'تعليم المكافآت كمدفوعة',
};

/** Returns the Arabic label if known, else the raw code (e.g. for unknown codes). */
export function getPermissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code;
}

/**
 * Produce a friendly Arabic message from anything thrown by the api helpers.
 *
 * - For a structured missing_permission payload → lists the required codes.
 * - For any other 403                            → generic forbidden text.
 * - For everything else                          → returns the original
 *   error message verbatim, so non-403 failures aren't masked.
 */
export function formatMissingPermissionMessage(err: unknown): string {
  if (isMissingPermissionError(err)) {
    const codes = err.permissions;
    if (codes.length === 0) {
      return 'ليست لديك الصلاحية المطلوبة لتنفيذ هذا الإجراء.';
    }
    const labelled = codes.map((c) => {
      const label = PERMISSION_LABELS[c];
      return label ? `${label} (${c})` : c;
    });
    return `ليست لديك الصلاحية المطلوبة لتنفيذ هذا الإجراء. الصلاحيات المطلوبة: ${labelled.join('، ')}`;
  }
  if (
    err &&
    typeof err === 'object' &&
    'status' in err &&
    (err as { status: unknown }).status === 403
  ) {
    return 'ليست لديك صلاحية الوصول إلى هذا المورد.';
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'حدث خطأ غير متوقع.';
}

/**
 * Business-friendly display metadata for permission codes (Batch 1 — UX only).
 *
 * This is FRONTEND PRESENTATION ONLY. It never changes enforcement, code names,
 * grants, or the API. Each entry maps a technical code → an Arabic label,
 * a plain-language description, a business category, and a type/risk badge.
 *
 * Unmapped codes fall back gracefully: category by module prefix, type by the
 * action segment, label from the legacy label map / raw code, and the API's own
 * description when present. The technical code is always still shown.
 */
import { getPermissionLabel } from './permission-error';

export type PermissionType = 'قراءة' | 'تعديل' | 'اعتماد' | 'مالي' | 'حذف' | 'إداري';

// Display order for category sections on the permissions page.
export const PERMISSION_CATEGORIES = [
  'المبيعات',
  'الزيارات',
  'الحجوزات',
  'العقود',
  'الدفعات',
  'الصيانة',
  'المستندات',
  'الوسطاء',
  'عمولات الوسطاء',
  'عمولات المبيعات',
  'التقارير',
  'المستخدمون والصلاحيات',
  'النظام والأمان',
  'أخرى',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export interface PermissionMeta {
  label: string;
  description: string;
  category: PermissionCategory;
  type: PermissionType;
}

// Fallback category by module prefix (first ":"-segment).
const MODULE_CATEGORY: Record<string, PermissionCategory> = {
  leads: 'المبيعات',
  lead_sources: 'المبيعات',
  projects: 'المبيعات',
  units: 'المبيعات',
  buildings: 'المبيعات',
  phases: 'المبيعات',
  project_media: 'المبيعات',
  visits: 'الزيارات',
  reservations: 'الحجوزات',
  contracts: 'العقود',
  deposits: 'الدفعات',
  installments: 'الدفعات',
  maintenance: 'الصيانة',
  documents: 'المستندات',
  brokers: 'الوسطاء',
  broker_users: 'الوسطاء',
  broker_access: 'الوسطاء',
  broker_leads: 'الوسطاء',
  broker_contracts: 'الوسطاء',
  broker_reservations: 'الوسطاء',
  broker_reports: 'الوسطاء',
  broker_commissions: 'عمولات الوسطاء',
  broker_payouts: 'عمولات الوسطاء',
  bonus: 'عمولات المبيعات',
  targets: 'عمولات المبيعات',
  reports: 'التقارير',
  users: 'المستخدمون والصلاحيات',
  permissions: 'المستخدمون والصلاحيات',
  settings: 'النظام والأمان',
  audit: 'النظام والأمان',
  'audit-logs': 'النظام والأمان',
  cms: 'أخرى',
  notifications: 'أخرى',
};

function moduleKey(code: string): string {
  return code.split(':')[0] ?? code;
}

// Fallback type from the trailing action segment.
function fallbackType(code: string): PermissionType {
  const action = code.split(':').pop() ?? '';
  if (action === 'read') return 'قراءة';
  if (['approve', 'reject', 'convert', 'confirm', 'complete'].includes(action)) return 'اعتماد';
  if (['pay', 'verify', 'register', 'booking-payment', 'process'].includes(action)) return 'مالي';
  if (['delete', 'remove', 'terminate'].includes(action)) return 'حذف';
  if (['manage', 'invite', 'activate', 'deactivate', 'suspend', 'write', 'send'].includes(action))
    return 'إداري';
  return 'تعديل';
}

// Explicit, hand-curated metadata for the real permission codes.
const META: Record<string, PermissionMeta> = {
  // ── المبيعات (leads / sources / inventory) ──────────────────────────────
  'leads:read': { label: 'عرض فرص المبيعات', description: 'الاطلاع على قائمة العملاء المحتملين وتفاصيلهم.', category: 'المبيعات', type: 'قراءة' },
  'leads:create': { label: 'إضافة فرصة مبيعات', description: 'تسجيل عميل محتمل جديد في النظام.', category: 'المبيعات', type: 'تعديل' },
  'leads:update': { label: 'تعديل فرص المبيعات', description: 'تحديث بيانات العميل المحتمل.', category: 'المبيعات', type: 'تعديل' },
  'leads:note': { label: 'إضافة ملاحظات للفرص', description: 'كتابة ملاحظات على فرصة المبيعات.', category: 'المبيعات', type: 'تعديل' },
  'leads:assign': { label: 'إسناد فرص المبيعات', description: 'إسناد الفرصة إلى مندوب مبيعات.', category: 'المبيعات', type: 'تعديل' },
  'leads:advance-stage': { label: 'تغيير مرحلة الفرصة', description: 'نقل الفرصة بين مراحل مسار البيع.', category: 'المبيعات', type: 'تعديل' },
  'lead_sources:manage': { label: 'إدارة مصادر الفرص', description: 'إضافة وتعديل مصادر العملاء المحتملين.', category: 'المبيعات', type: 'إداري' },
  'projects:read': { label: 'عرض المشاريع', description: 'الاطلاع على المشاريع العقارية.', category: 'المبيعات', type: 'قراءة' },
  'projects:create': { label: 'إنشاء المشاريع', description: 'إضافة مشروع عقاري جديد.', category: 'المبيعات', type: 'تعديل' },
  'projects:update': { label: 'تعديل المشاريع', description: 'تحديث بيانات المشاريع.', category: 'المبيعات', type: 'تعديل' },
  'projects:publish': { label: 'نشر المشاريع', description: 'إظهار المشروع للعملاء.', category: 'المبيعات', type: 'إداري' },
  'projects:delete': { label: 'حذف المشاريع', description: 'إزالة مشروع من النظام.', category: 'المبيعات', type: 'حذف' },
  'project_media:manage': { label: 'إدارة وسائط المشاريع', description: 'إدارة صور ومرفقات المشاريع.', category: 'المبيعات', type: 'إداري' },
  'phases:manage': { label: 'إدارة مراحل المشاريع', description: 'إضافة وتعديل مراحل المشروع.', category: 'المبيعات', type: 'إداري' },
  'buildings:manage': { label: 'إدارة المباني', description: 'إضافة وتعديل مباني المشروع.', category: 'المبيعات', type: 'إداري' },
  'units:read': { label: 'عرض الوحدات', description: 'الاطلاع على الوحدات العقارية وحالتها.', category: 'المبيعات', type: 'قراءة' },
  'units:create': { label: 'إنشاء الوحدات', description: 'إضافة وحدات عقارية جديدة.', category: 'المبيعات', type: 'تعديل' },
  'units:update': { label: 'تعديل الوحدات', description: 'تحديث بيانات الوحدات.', category: 'المبيعات', type: 'تعديل' },
  'units:change-status': { label: 'تغيير حالة الوحدة', description: 'تعديل حالة الوحدة (متاحة/محجوزة/مباعة).', category: 'المبيعات', type: 'تعديل' },
  'units:delete': { label: 'حذف الوحدات', description: 'إزالة وحدة من النظام.', category: 'المبيعات', type: 'حذف' },

  // ── الزيارات ─────────────────────────────────────────────────────────────
  'visits:read': { label: 'عرض الزيارات', description: 'الاطلاع على طلبات ومواعيد الزيارات.', category: 'الزيارات', type: 'قراءة' },
  'visits:create': { label: 'إنشاء زيارة', description: 'تسجيل موعد زيارة مباشرة.', category: 'الزيارات', type: 'تعديل' },
  'visits:schedule': { label: 'جدولة الزيارات', description: 'تحويل طلب زيارة إلى موعد محدد.', category: 'الزيارات', type: 'تعديل' },
  'visits:confirm': { label: 'تأكيد الزيارات', description: 'تأكيد موعد الزيارة.', category: 'الزيارات', type: 'تعديل' },
  'visits:complete': { label: 'إكمال الزيارات', description: 'تسجيل تنفيذ الزيارة.', category: 'الزيارات', type: 'تعديل' },
  'visits:reschedule': { label: 'إعادة جدولة الزيارات', description: 'تغيير موعد الزيارة.', category: 'الزيارات', type: 'تعديل' },
  'visits:cancel': { label: 'إلغاء الزيارات', description: 'إلغاء موعد زيارة.', category: 'الزيارات', type: 'تعديل' },
  'visits:no-show': { label: 'تسجيل عدم الحضور', description: 'تعليم الزيارة كعدم حضور.', category: 'الزيارات', type: 'تعديل' },
  'visits:assign': { label: 'إسناد الزيارات', description: 'إسناد الزيارة إلى مندوب مبيعات.', category: 'الزيارات', type: 'تعديل' },
  'visits:approve': { label: 'اعتماد طلبات الزيارة', description: 'اعتماد أو رفض طلب الزيارة.', category: 'الزيارات', type: 'اعتماد' },

  // ── الحجوزات ─────────────────────────────────────────────────────────────
  'reservations:read': { label: 'عرض الحجوزات', description: 'الاطلاع على حجوزات الوحدات.', category: 'الحجوزات', type: 'قراءة' },
  'reservations:create': { label: 'إنشاء الحجوزات', description: 'تسجيل حجز جديد على وحدة.', category: 'الحجوزات', type: 'تعديل' },
  'reservations:update': { label: 'تعديل الحجوزات', description: 'تحديث بيانات الحجز.', category: 'الحجوزات', type: 'تعديل' },
  'reservations:approve': { label: 'اعتماد الحجوزات', description: 'الموافقة على الحجز.', category: 'الحجوزات', type: 'اعتماد' },
  'reservations:reject': { label: 'رفض الحجوزات', description: 'رفض طلب الحجز.', category: 'الحجوزات', type: 'اعتماد' },
  'reservations:cancel': { label: 'إلغاء الحجوزات', description: 'إلغاء حجز قائم.', category: 'الحجوزات', type: 'اعتماد' },
  'reservations:convert': { label: 'تحويل الحجز إلى عقد', description: 'إنشاء عقد من الحجز المعتمد.', category: 'الحجوزات', type: 'اعتماد' },
  'reservations:booking-payment': { label: 'تأكيد مبلغ الحجز', description: 'تأكيد أو إلغاء تأكيد دفع مبلغ الحجز.', category: 'الحجوزات', type: 'مالي' },

  // ── العقود ───────────────────────────────────────────────────────────────
  'contracts:read': { label: 'عرض العقود', description: 'الاطلاع على العقود وتفاصيلها.', category: 'العقود', type: 'قراءة' },
  'contracts:upload': { label: 'إنشاء العقود وإرفاق الملفات', description: 'إنشاء عقد وإرفاق ملف PDF.', category: 'العقود', type: 'تعديل' },
  'contracts:update': { label: 'تعديل العقود', description: 'تحديث الحقول القابلة للتعديل في العقد.', category: 'العقود', type: 'تعديل' },
  'contracts:sign': { label: 'توقيع العقود', description: 'اعتماد توقيع العقد رسمياً.', category: 'العقود', type: 'اعتماد' },

  // ── الدفعات ──────────────────────────────────────────────────────────────
  'deposits:read': { label: 'عرض الدفعات', description: 'الاطلاع على سجل الدفعات المالية.', category: 'الدفعات', type: 'قراءة' },
  'deposits:register': { label: 'تسجيل دفعة', description: 'تسجيل دفعة مالية جديدة.', category: 'الدفعات', type: 'مالي' },
  'deposits:verify': { label: 'اعتماد الدفعات', description: 'التحقق من الدفعة واعتمادها.', category: 'الدفعات', type: 'مالي' },
  'installments:read': { label: 'عرض خطط التقسيط', description: 'الاطلاع على خطط وأقساط التقسيط.', category: 'الدفعات', type: 'قراءة' },
  'installments:manage': { label: 'إدارة خطط التقسيط', description: 'إنشاء وتعديل خطط التقسيط.', category: 'الدفعات', type: 'إداري' },
  'installments:activate': { label: 'تفعيل خطط التقسيط', description: 'تفعيل خطة تقسيط للعقد.', category: 'الدفعات', type: 'إداري' },

  // ── الصيانة ──────────────────────────────────────────────────────────────
  'maintenance:read': { label: 'عرض طلبات الصيانة', description: 'الاطلاع على طلبات الصيانة.', category: 'الصيانة', type: 'قراءة' },
  'maintenance:create': { label: 'إنشاء طلب صيانة', description: 'تسجيل طلب صيانة جديد.', category: 'الصيانة', type: 'تعديل' },
  'maintenance:assign': { label: 'إسناد الصيانة', description: 'إسناد طلب الصيانة لمسؤول.', category: 'الصيانة', type: 'تعديل' },
  'maintenance:resolve': { label: 'إنهاء طلبات الصيانة', description: 'إغلاق أو حل طلب الصيانة.', category: 'الصيانة', type: 'تعديل' },
  'maintenance:categories:manage': { label: 'إدارة فئات الصيانة', description: 'إضافة وتعديل فئات الصيانة.', category: 'الصيانة', type: 'إداري' },

  // ── المستندات ────────────────────────────────────────────────────────────
  'documents:read': { label: 'عرض المستندات', description: 'الاطلاع على مستندات النظام.', category: 'المستندات', type: 'قراءة' },
  'documents:upload': { label: 'رفع المستندات', description: 'إضافة مستند جديد.', category: 'المستندات', type: 'تعديل' },
  'documents:update': { label: 'تعديل المستندات', description: 'تحديث بيانات المستند.', category: 'المستندات', type: 'تعديل' },
  'documents:delete': { label: 'حذف المستندات', description: 'إزالة مستند من النظام.', category: 'المستندات', type: 'حذف' },

  // ── الوسطاء ──────────────────────────────────────────────────────────────
  'brokers:read': { label: 'عرض الوسطاء', description: 'الاطلاع على شركات الوساطة.', category: 'الوسطاء', type: 'قراءة' },
  'brokers:create': { label: 'إضافة وسيط', description: 'تسجيل شركة وساطة جديدة.', category: 'الوسطاء', type: 'تعديل' },
  'brokers:update': { label: 'تعديل الوسطاء', description: 'تحديث بيانات شركة الوساطة.', category: 'الوسطاء', type: 'تعديل' },
  'brokers:suspend': { label: 'تعليق وسيط', description: 'تعليق نشاط شركة الوساطة مؤقتاً.', category: 'الوسطاء', type: 'إداري' },
  'brokers:terminate': { label: 'إنهاء التعامل مع وسيط', description: 'إنهاء التعاقد مع شركة الوساطة.', category: 'الوسطاء', type: 'حذف' },
  'broker_users:read': { label: 'عرض موظفي الوسطاء', description: 'الاطلاع على حسابات موظفي الوسيط.', category: 'الوسطاء', type: 'قراءة' },
  'broker_users:invite': { label: 'دعوة موظف وسيط', description: 'دعوة موظف جديد لشركة الوساطة.', category: 'الوسطاء', type: 'إداري' },
  'broker_users:update': { label: 'تعديل موظفي الوسطاء', description: 'تحديث بيانات وصلاحيات موظف الوسيط.', category: 'الوسطاء', type: 'تعديل' },
  'broker_users:remove': { label: 'إزالة موظف وسيط', description: 'إزالة حساب موظف الوسيط.', category: 'الوسطاء', type: 'حذف' },
  'broker_access:read': { label: 'عرض صلاحيات وصول الوسطاء', description: 'الاطلاع على إعدادات وصول الوسطاء.', category: 'الوسطاء', type: 'قراءة' },
  'broker_access:manage': { label: 'إدارة صلاحيات وصول الوسطاء', description: 'ضبط ما يمكن للوسطاء الوصول إليه.', category: 'الوسطاء', type: 'إداري' },
  'broker_leads:read': { label: 'عرض فرص الوسطاء', description: 'الاطلاع على الفرص المقدّمة من الوسطاء.', category: 'الوسطاء', type: 'قراءة' },
  'broker_leads:approve': { label: 'اعتماد فرص الوسطاء', description: 'الموافقة على فرصة مقدّمة من وسيط.', category: 'الوسطاء', type: 'اعتماد' },
  'broker_leads:reject': { label: 'رفض فرص الوسطاء', description: 'رفض فرصة مقدّمة من وسيط.', category: 'الوسطاء', type: 'اعتماد' },
  'broker_contracts:read': { label: 'عرض عقود الوسطاء', description: 'الاطلاع على العقود المنسوبة للوسطاء.', category: 'الوسطاء', type: 'قراءة' },
  'broker_reservations:read': { label: 'عرض حجوزات الوسطاء', description: 'الاطلاع على الحجوزات المنسوبة للوسطاء.', category: 'الوسطاء', type: 'قراءة' },
  'broker_reservations:create': { label: 'إنشاء حجوزات الوسطاء', description: 'تسجيل حجز منسوب لوسيط.', category: 'الوسطاء', type: 'تعديل' },
  'broker_reports:read': { label: 'عرض تقارير الوسطاء', description: 'الاطلاع على تقارير أداء الوسطاء.', category: 'الوسطاء', type: 'قراءة' },

  // ── عمولات الوسطاء ───────────────────────────────────────────────────────
  'broker_commissions:read': { label: 'عرض عمولات الوسطاء', description: 'الاطلاع على عمولات الوسطاء.', category: 'عمولات الوسطاء', type: 'قراءة' },
  'broker_commissions:approve': { label: 'اعتماد عمولات الوسطاء', description: 'اعتماد عمولة الوسيط لتصبح مستحقة.', category: 'عمولات الوسطاء', type: 'اعتماد' },
  'broker_commissions:reject': { label: 'رفض عمولات الوسطاء', description: 'رفض عمولة الوسيط.', category: 'عمولات الوسطاء', type: 'اعتماد' },
  'broker_commissions:cancel': { label: 'إلغاء عمولات الوسطاء', description: 'إلغاء عمولة وسيط.', category: 'عمولات الوسطاء', type: 'اعتماد' },
  'broker_payouts:read': { label: 'عرض مدفوعات الوسطاء', description: 'الاطلاع على دفعات الوسطاء.', category: 'عمولات الوسطاء', type: 'قراءة' },
  'broker_payouts:create': { label: 'إنشاء مدفوعات الوسطاء', description: 'إنشاء دفعة للوسيط.', category: 'عمولات الوسطاء', type: 'مالي' },
  'broker_payouts:update': { label: 'تعديل مدفوعات الوسطاء', description: 'تحديث بيانات دفعة الوسيط.', category: 'عمولات الوسطاء', type: 'مالي' },
  'broker_payouts:approve': { label: 'اعتماد مدفوعات الوسطاء', description: 'اعتماد دفعة الوسيط.', category: 'عمولات الوسطاء', type: 'مالي' },
  'broker_payouts:process': { label: 'بدء معالجة مدفوعات الوسطاء', description: 'بدء تنفيذ دفعة الوسيط.', category: 'عمولات الوسطاء', type: 'مالي' },
  'broker_payouts:pay': { label: 'تعليم مدفوعات الوسطاء كمدفوعة', description: 'تأكيد صرف دفعة الوسيط.', category: 'عمولات الوسطاء', type: 'مالي' },
  'broker_payouts:cancel': { label: 'إلغاء مدفوعات الوسطاء', description: 'إلغاء دفعة وسيط.', category: 'عمولات الوسطاء', type: 'اعتماد' },

  // ── عمولات المبيعات ──────────────────────────────────────────────────────
  'bonus:rules:manage': { label: 'إدارة قواعد العمولات', description: 'إنشاء وتعديل قواعد عمولات المبيعات.', category: 'عمولات المبيعات', type: 'إداري' },
  'bonus:entries:read': { label: 'عرض مستحقات المبيعات', description: 'الاطلاع على عمولات ومكافآت المبيعات.', category: 'عمولات المبيعات', type: 'قراءة' },
  'bonus:entries:create': { label: 'إنشاء مستحقات المبيعات', description: 'تسجيل مستحق عمولة يدوياً.', category: 'عمولات المبيعات', type: 'تعديل' },
  'bonus:entries:approve': { label: 'اعتماد مستحقات المبيعات', description: 'اعتماد مستحقات أو عمولات مندوبي المبيعات.', category: 'عمولات المبيعات', type: 'اعتماد' },
  'bonus:entries:pay': { label: 'صرف مستحقات المبيعات', description: 'تعليم مستحق العمولة كمدفوع.', category: 'عمولات المبيعات', type: 'مالي' },
  'targets:read': { label: 'عرض أهداف المبيعات', description: 'الاطلاع على أهداف وأداء المبيعات.', category: 'عمولات المبيعات', type: 'قراءة' },
  'targets:manage': { label: 'إدارة أهداف المبيعات', description: 'تحديد وتعديل أهداف المبيعات.', category: 'عمولات المبيعات', type: 'إداري' },

  // ── التقارير ─────────────────────────────────────────────────────────────
  'reports:sales:read': { label: 'عرض تقارير المبيعات', description: 'الاطلاع على تقارير المبيعات.', category: 'التقارير', type: 'قراءة' },
  'reports:operational:read': { label: 'عرض التقارير التشغيلية', description: 'الاطلاع على مؤشرات الأداء التشغيلي.', category: 'التقارير', type: 'قراءة' },
  'reports:financial:read': { label: 'عرض التقارير المالية', description: 'الاطلاع على التقارير المالية.', category: 'التقارير', type: 'مالي' },

  // ── المستخدمون والصلاحيات ────────────────────────────────────────────────
  'users:read': { label: 'عرض المستخدمين', description: 'الاطلاع على حسابات المستخدمين.', category: 'المستخدمون والصلاحيات', type: 'قراءة' },
  'users:create': { label: 'إنشاء مستخدم', description: 'إضافة حساب مستخدم جديد.', category: 'المستخدمون والصلاحيات', type: 'إداري' },
  'users:update': { label: 'تعديل المستخدمين', description: 'تحديث بيانات المستخدم.', category: 'المستخدمون والصلاحيات', type: 'إداري' },
  'users:activate': { label: 'تفعيل المستخدمين', description: 'تفعيل حساب مستخدم.', category: 'المستخدمون والصلاحيات', type: 'إداري' },
  'users:deactivate': { label: 'إيقاف المستخدمين', description: 'تعطيل حساب مستخدم.', category: 'المستخدمون والصلاحيات', type: 'إداري' },
  'permissions:manage': { label: 'إدارة الصلاحيات', description: 'منح وسحب الصلاحيات للمستخدمين.', category: 'المستخدمون والصلاحيات', type: 'إداري' },

  // ── النظام والأمان ───────────────────────────────────────────────────────
  'audit:read': { label: 'عرض سجلات التدقيق', description: 'يسمح بمراجعة عمليات المستخدمين والتغييرات المهمة في النظام.', category: 'النظام والأمان', type: 'قراءة' },
  'settings:read': { label: 'عرض الإعدادات', description: 'الاطلاع على إعدادات النظام.', category: 'النظام والأمان', type: 'قراءة' },
  'settings:write': { label: 'تعديل الإعدادات', description: 'تغيير إعدادات النظام.', category: 'النظام والأمان', type: 'إداري' },

  // ── أخرى (محتوى/إشعارات) ─────────────────────────────────────────────────
  'cms:pages:manage': { label: 'إدارة صفحات المحتوى', description: 'إنشاء وتعديل صفحات الموقع.', category: 'أخرى', type: 'إداري' },
  'cms:banners:manage': { label: 'إدارة الإعلانات', description: 'إدارة لافتات وإعلانات الموقع.', category: 'أخرى', type: 'إداري' },
  'cms:articles:manage': { label: 'إدارة المقالات', description: 'إنشاء وتعديل المقالات.', category: 'أخرى', type: 'إداري' },
  'notifications:send': { label: 'إرسال الإشعارات', description: 'إرسال إشعارات للمستخدمين.', category: 'أخرى', type: 'إداري' },
  'notifications:templates:manage': { label: 'إدارة قوالب الإشعارات', description: 'إنشاء وتعديل قوالب الإشعارات.', category: 'أخرى', type: 'إداري' },
};

/**
 * Resolve display metadata for a code. Explicit entry first; otherwise a
 * graceful fallback. `apiDescription` (from the API/seed) is used when there is
 * no curated description.
 */
export function getPermissionMeta(code: string, apiDescription?: string | null): PermissionMeta {
  const explicit = META[code];
  if (explicit) return explicit;
  return {
    label: getPermissionLabel(code), // legacy label map, else the raw code
    description: apiDescription?.trim() || 'صلاحية في النظام.',
    category: MODULE_CATEGORY[moduleKey(code)] ?? 'أخرى',
    type: fallbackType(code),
  };
}

// Tailwind classes per type badge.
export const PERMISSION_TYPE_CLS: Record<PermissionType, string> = {
  قراءة: 'bg-slate-100 text-slate-600',
  تعديل: 'bg-info-50 text-info-700',
  اعتماد: 'bg-amber-100 text-amber-700',
  مالي: 'bg-success-50 text-success-700',
  حذف: 'bg-danger-50 text-danger-700',
  إداري: 'bg-purple-100 text-purple-700',
};

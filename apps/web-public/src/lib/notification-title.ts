/**
 * templateCode → Arabic label: the fallback for a notification the server did
 * not title (it renders `title` / `body` itself). Unknown codes fall back to
 * "إشعار جديد".
 */
const NOTIFICATION_LABELS: Record<string, string> = {
  visit_approved: 'تمت الموافقة على طلب الزيارة',
  // P3 — visit lifecycle (customer-facing). Server resolves title/body when
  // a template row exists; these client-side strings are the fallback for
  // legacy rows or when title is missing.
  visit_request_created: 'تم استلام طلب الزيارة',
  visit_scheduled: 'تم جدولة زيارتك',
  visit_rescheduled: 'تم تغيير موعد زيارتك',
  visit_completed: 'اكتملت زيارتك',
  visit_cancelled: 'تم إلغاء الزيارة',
  visit_no_show: 'تسجيل عدم الحضور',
  visit_day_reminder: 'تذكير بزيارتك اليوم',
  maintenance_request_created: 'تم إنشاء طلب الصيانة',
  maintenance_request_assigned: 'تم إسناد طلب الصيانة',
  maintenance_request_status_changed: 'تحديث حالة طلب الصيانة',
  maintenance_request_resolved: 'تم حل طلب الصيانة',
  maintenance_request_closed: 'تم إغلاق طلب الصيانة',
  // P4 — customer-facing labels for the new event codes.
  reservation_status_changed: 'تحديث حالة الحجز',
  reservation_booking_paid: 'تم تأكيد دفعة الحجز',
  contract_created_customer: 'تم إنشاء عقدك',
  contract_signed_customer: 'تم توقيع عقدك',
  // P12 — a downloadable contract document is now available.
  contract_document_available: 'عقدك جاهز للتحميل',
  deposit_verified: 'تم اعتماد دفعتك',
  // P11.7 — installment due-soon reminder.
  installment_due_soon: 'تذكير بقسط مستحق قريباً',
};

export function notificationTitle(code: string, serverTitle?: string): string {
  // The server's title is in the reader's language and names the unit,
  // contract or amount; the label map is only a fallback.
  if (serverTitle && serverTitle !== code) return serverTitle;
  return NOTIFICATION_LABELS[code] ?? 'إشعار جديد';
}

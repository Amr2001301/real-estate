import type { Locale } from '@/lib/locale';

/** The customer account area: statuses, notification titles and the cards. */
const ACCOUNT = {
  ar: {
    status: {
      NEW: 'جديد', UNDER_REVIEW: 'قيد المراجعة', CONVERTED: 'تم التحويل', REJECTED: 'مرفوض',
      PENDING: 'قيد الانتظار', APPROVED: 'تمت الموافقة', SCHEDULED: 'محدد', COMPLETED: 'مكتمل',
      OPEN: 'مفتوح', ASSIGNED: 'تم الإسناد', IN_PROGRESS: 'قيد التنفيذ', RESOLVED: 'تم الحل', CLOSED: 'مغلق',
      LOW: 'أولوية منخفضة', MEDIUM: 'أولوية متوسطة', HIGH: 'أولوية عالية', URGENT: 'عاجلة',
      CANCELLED: 'ملغى', EXPIRED: 'منتهي الصلاحية',
      PENDING_REVIEW: 'بانتظار المراجعة',
    } as Record<string, string>,
    bookingPayment: { UNPAID: 'غير مدفوع', PENDING: 'بانتظار المراجعة', PAID: 'مدفوع — تم التحقق', WAIVED: 'مُعفى' } as Record<string, string>,
    appointment: {
      SCHEDULED: 'بانتظار تأكيدك', CONFIRMED: 'مؤكدة', PENDING_RESCHEDULE: 'طلبت إعادة الجدولة',
      COMPLETED: 'مكتملة', CANCELLED: 'ملغاة', NO_SHOW: 'لم تحضر', RESCHEDULED: 'أُعيدت جدولتها',
    } as Record<string, string>,
    notificationTitles: {
      visit_approved: 'تمت الموافقة على طلب الزيارة', visit_request_created: 'تم استلام طلب الزيارة',
      visit_scheduled: 'تم جدولة زيارتك', visit_rescheduled: 'تم تغيير موعد زيارتك', visit_completed: 'اكتملت زيارتك',
      visit_cancelled: 'تم إلغاء الزيارة', visit_no_show: 'تسجيل عدم الحضور', visit_day_reminder: 'تذكير بزيارتك اليوم',
      maintenance_request_created: 'تم إنشاء طلب الصيانة', maintenance_request_assigned: 'تم إسناد طلب الصيانة',
      maintenance_request_status_changed: 'تحديث حالة طلب الصيانة', maintenance_request_resolved: 'تم حل طلب الصيانة',
      maintenance_request_closed: 'تم إغلاق طلب الصيانة', reservation_status_changed: 'تحديث حالة الحجز',
      reservation_booking_paid: 'تم تأكيد دفعة الحجز', contract_created_customer: 'تم إنشاء عقدك',
      contract_signed_customer: 'تم توقيع عقدك', contract_document_available: 'عقدك جاهز للتحميل',
      deposit_verified: 'تم اعتماد دفعتك', installment_due_soon: 'تذكير بقسط مستحق قريباً',
    } as Record<string, string>,
    installmentStatus: { PENDING: 'قيد الاستحقاق', PAID: 'مدفوع', OVERDUE: 'متأخر' } as Record<string, string>,
    newNotification: 'إشعار جديد',
    markRead: 'تحديد كمقروء',
    viewAll: 'عرض الكل',
    viewSection: 'عرض القسم',
    loading: 'جارٍ التحميل…',
    unit: 'وحدة',
    property: {
      contractNo: 'رقم العقد', signedAt: 'تاريخ التوقيع', unsigned: 'غير موقّع', plan: 'خطة التقسيط',
      months: (n: string) => `${n} شهرًا`, maintenance: 'طلب صيانة', viewContract: 'عرض العقد PDF', contractMissing: 'العقد غير متاح بعد',
    },
    reservation: {
      number: (n: string) => `حجز رقم ${n}`, bookingAmount: 'مبلغ الحجز', paymentStatus: 'حالة الدفع', expiresAt: 'ينتهي في',
      specialist: 'المسؤول المختص:', paidAt: 'تاريخ السداد:', createdAt: (d: string) => `أُنشئ في ${d}`,
    },
    visit: {
      title: 'طلب زيارة', suggested: 'الموعد المقترح', fixed: 'موعد محدد', preferred: 'الموعد المفضل', advisor: 'المستشار',
      viewDetails: (t: string) => `عرض تفاصيل ${t}`, rescheduleReason: 'سبب طلب إعادة الجدولة:',
    },
    info: { general: 'استفسار عام', unit: 'وحدة', project: 'مشروع', generic: 'عام', sentAt: 'تاريخ الإرسال', viewDetails: (t: string) => `عرض تفاصيل ${t}` },
    maintenanceCard: { request: 'طلب صيانة' },
    docs: { openFailed: 'تعذر الفتح — حاول مرة أخرى', preparing: 'جارٍ التحضير...', failedShort: 'تعذر الفتح' },
    unitFilter: { label: 'الوحدة:', aria: 'تصفية حسب الوحدة', all: 'كل الوحدات' },
    unreadNotifications: 'إشعار غير مقروء',
  },
  en: {
    status: {
      NEW: 'New', UNDER_REVIEW: 'Under review', CONVERTED: 'Converted', REJECTED: 'Rejected',
      PENDING: 'Pending', APPROVED: 'Approved', SCHEDULED: 'Scheduled', COMPLETED: 'Completed',
      OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed',
      LOW: 'Low priority', MEDIUM: 'Medium priority', HIGH: 'High priority', URGENT: 'Urgent',
      CANCELLED: 'Cancelled', EXPIRED: 'Expired',
      PENDING_REVIEW: 'Awaiting review',
    } as Record<string, string>,
    bookingPayment: { UNPAID: 'Unpaid', PENDING: 'Awaiting review', PAID: 'Paid — verified', WAIVED: 'Waived' } as Record<string, string>,
    appointment: {
      SCHEDULED: 'Awaiting your confirmation', CONFIRMED: 'Confirmed', PENDING_RESCHEDULE: 'Reschedule requested',
      COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'Not attended', RESCHEDULED: 'Rescheduled',
    } as Record<string, string>,
    notificationTitles: {
      visit_approved: 'Your visit request was approved', visit_request_created: 'Your visit request was received',
      visit_scheduled: 'Your visit was scheduled', visit_rescheduled: 'Your visit was rescheduled', visit_completed: 'Your visit is complete',
      visit_cancelled: 'The visit was cancelled', visit_no_show: 'Recorded as not attended', visit_day_reminder: 'Reminder: your visit is today',
      maintenance_request_created: 'Your maintenance request was created', maintenance_request_assigned: 'Your maintenance request was assigned',
      maintenance_request_status_changed: 'Your maintenance request was updated', maintenance_request_resolved: 'Your maintenance request was resolved',
      maintenance_request_closed: 'Your maintenance request was closed', reservation_status_changed: 'Your reservation was updated',
      reservation_booking_paid: 'Your booking payment was confirmed', contract_created_customer: 'Your contract was created',
      contract_signed_customer: 'Your contract was signed', contract_document_available: 'Your contract is ready to download',
      deposit_verified: 'Your payment was verified', installment_due_soon: 'Reminder: an instalment is due soon',
    } as Record<string, string>,
    installmentStatus: { PENDING: 'Due', PAID: 'Paid', OVERDUE: 'Overdue' } as Record<string, string>,
    newNotification: 'New notification',
    markRead: 'Mark as read',
    viewAll: 'View all',
    viewSection: 'View section',
    loading: 'Loading…',
    unit: 'Unit',
    property: {
      contractNo: 'Contract no.', signedAt: 'Signed on', unsigned: 'Not signed', plan: 'Instalment plan',
      months: (n: string) => `${n} months`, maintenance: 'Maintenance request', viewContract: 'View contract PDF', contractMissing: 'The contract is not available yet',
    },
    reservation: {
      number: (n: string) => `Reservation ${n}`, bookingAmount: 'Booking amount', paymentStatus: 'Payment status', expiresAt: 'Expires on',
      specialist: 'Your specialist:', paidAt: 'Paid on:', createdAt: (d: string) => `Created ${d}`,
    },
    visit: {
      title: 'Visit request', suggested: 'Suggested time', fixed: 'Scheduled time', preferred: 'Preferred time', advisor: 'Advisor',
      viewDetails: (t: string) => `View details of ${t}`, rescheduleReason: 'Reason for the reschedule request:',
    },
    info: { general: 'General inquiry', unit: 'Unit', project: 'Project', generic: 'General', sentAt: 'Sent on', viewDetails: (t: string) => `View details of ${t}` },
    maintenanceCard: { request: 'Maintenance request' },
    docs: { openFailed: 'Could not open — try again', preparing: 'Preparing...', failedShort: 'Could not open' },
    unitFilter: { label: 'Unit:', aria: 'Filter by unit', all: 'All units' },
    unreadNotifications: 'unread notifications',
  },
} as const;

export function accountT(locale: Locale) {
  return ACCOUNT[locale];
}

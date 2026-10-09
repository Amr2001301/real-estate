import type { Locale } from '@/lib/locale';

// Strings for shared components rendered by the broker portal (and, with the
// default 'ar' locale, by the admin dashboard): filter bars, funnel, charts,
// export menu, notification list, submit button and the premium form layout.

const ar = {
  // Shared by every filter bar.
  filters: {
    apply: 'تصفية',
    clear: 'مسح التصفية',
    allStatuses: 'كل الحالات',
    allProjects: 'كل المشاريع',
  },

  commissionsFilter: {
    searchPlaceholder: 'ابحث برقم العمولة أو العقد أو الوحدة…',
    status: {
      PENDING: 'قيد الاعتماد',
      APPROVED: 'معتمدة',
      REJECTED: 'مرفوضة',
      CANCELLED: 'ملغاة',
    },
  },

  payoutsFilter: {
    searchPlaceholder: 'ابحث برقم الدفعة أو مرجع التحويل…',
    periodPlaceholder: 'الفترة (2026-05)',
    status: {
      DRAFT: 'مسودة',
      APPROVED: 'موافق عليها',
      PROCESSING: 'قيد التنفيذ',
      PAID: 'مدفوعة',
      CANCELLED: 'ملغاة',
    },
  },

  reservationsFilter: {
    searchPlaceholder: 'ابحث باسم العميل أو رقم الجوال أو الوحدة…',
    status: {
      PENDING: 'قيد المراجعة',
      APPROVED: 'تمت الموافقة',
      REJECTED: 'مرفوض',
      CANCELLED: 'ملغى',
      EXPIRED: 'منتهي',
      CONVERTED: 'محوّل إلى عقد',
    },
    advanced: 'فلاتر متقدمة',
    reservationDate: 'تاريخ الحجز:',
  },

  unitsFilter: {
    searchPlaceholder: 'ابحث برمز الوحدة أو المشروع…',
    status: {
      AVAILABLE: 'متاحة',
      RESERVED: 'محجوزة',
      SOLD: 'مباعة',
    },
    allTypes: 'كل الأنواع',
    advanced: 'فلاتر متقدمة',
    priceAndSpecs: 'السعر والمواصفات:',
    minPrice: 'سعر من',
    maxPrice: 'سعر إلى',
    bedrooms: 'عدد الغرف',
    bathrooms: 'عدد الحمامات',
    bedroomsOption: (n: number) => `${n} غرف`,
    bathroomsOption: (n: number) => `${n} حمام`,
  },

  funnel: {
    numberLocale: 'ar-EG',
    defaultTitle: 'قمع التحويل',
    stagesCount: (n: number) => `${n} مراحل`,
    stages: {
      leadsSubmitted: 'فرص مُرسلة',
      leadsApproved: 'فرص معتمدة',
      reservationsCreated: 'حجوزات',
      contractsCreated: 'عقود',
      contractsSigned: 'عقود موقّعة',
      payoutsPaid: 'دفعات مدفوعة',
    } as Record<string, string>,
    footnote: 'نسبة التحويل محسوبة بالنسبة للمرحلة السابقة مباشرة.',
  },

  trend: {
    numberLocale: 'ar-EG',
    currencyLocale: 'ar-SA',
    axisMillion: 'م',
    axisThousand: 'ك',
    tabFinancial: 'المالية',
    tabActivity: 'النشاط',
    emptyTitle: 'لا توجد بيانات شهرية في هذا النطاق.',
    emptyHint: 'جرّب توسيع نطاق التاريخ.',
    commissionsNet: 'صافي العمولات',
    payoutsNet: 'صافي المدفوعات',
    reservations: 'حجوزات',
    contractsSigned: 'عقود موقّعة',
  },

  projectsPanel: {
    sortLocale: 'ar',
    emptyTitle: 'لا توجد مشاريع متاحة بعد',
    emptyDescription: 'بمجرد منحك صلاحيات على أي مشروع، ستظهر تفاصيله هنا.',
    kpiTotal: 'إجمالي المشاريع',
    kpiPublished: 'منشور',
    kpiReady: 'جاهز للتسويق',
    kpiFeatured: 'مميز',
    searchPlaceholder: 'ابحث باسم المشروع أو المدينة…',
    allStatuses: 'كل الحالات',
    published: 'منشور',
    unpublished: 'غير منشور',
    allCities: 'كل المدن',
    allProjects: 'كل المشاريع',
    readyForMarketing: 'جاهز للتسويق',
    featured: 'مميز',
    apply: 'تصفية',
    clear: 'مسح',
    searchResults: 'نتائج البحث',
    availableProjects: 'المشاريع المتاحة',
    countOfTotal: (shown: number, total: number) => `${shown} من ${total}`,
    noMatchTitle: 'لا توجد مشاريع تطابق البحث',
    noMatchDescription: 'جرّب تعديل كلمة البحث أو مسح الفلاتر النشطة.',
    clearFilters: 'مسح التصفية',
  },

  exportMenu: {
    label: 'تصدير',
    optionsAria: 'خيارات التصدير',
    preparing: 'جارٍ تجهيز الملف…',
    single: { xlsx: 'تصدير Excel', pdf: 'تصدير PDF', csv: 'تصدير CSV' },
    formats: { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' },
    hints: {
      xlsx: 'تقرير منسّق للتحليل والفرز',
      pdf: 'بهوية الشركة — للطباعة والمشاركة',
      csv: 'بيانات خام للأنظمة الأخرى',
    },
    error: 'تعذّر تجهيز الملف، حاول مرة أخرى.',
  },

  submitButton: {
    saving: 'جاري الحفظ…',
  },

  formLayout: {
    sidebarTitle: 'ملخص الإنشاء',
    sidebarBadge: 'جديد',
    sectionsAria: 'أقسام النموذج',
    stepsHeading: 'خطوات الإعداد',
  },

  projectCard: {
    featured: 'مميز',
    brokerCommission: 'عمولة الوسيط',
    defaultLabel: 'الافتراضية',
    browseUnits: 'تصفح الوحدات',
    active: 'جاهز للتسويق',
    paused: 'موقوف',
  },
  notifications: {
    markRead: 'تعليم كمقروء',
    dateLocale: 'ar-EG',
    emptyTitle: 'لا توجد إشعارات',
    emptyDescription: 'عند وصول إشعارات جديدة ستظهر هنا.',
    unread: 'غير مقروء',
    markAllRead: 'تعليم الكل كمقروء',
    fallbackTitle: 'إشعار جديد',
    openFn: (label: string) => `فتح ${label}`,
    channel: {
      IN_APP: 'تطبيق',
      PUSH: 'فوري',
      EMAIL: 'بريد',
      SMS: 'رسالة',
    },
    related: {
      maintenance: 'طلب الصيانة',
      visit: 'الزيارة',
      lead: 'الفرصة',
      broker: 'الوسيط',
      user: 'المستخدم',
      payment: 'الدفعة',
      commission: 'العمولة',
      contract: 'العقد',
      reservation: 'الحجز',
      inquiry: 'الاستفسار',
    },
    // Fallback titles by template code. Preferred over the API `title` so old
    // rows whose title is still a raw code remain readable.
    templates: {
      // Broker
      broker_lead_submitted: 'فرصة جديدة مرسلة',
      broker_lead_approved: 'تم اعتماد فرصة',
      broker_lead_rejected: 'تم رفض فرصة',
      broker_lead_marked_duplicate: 'تصنيف فرصة مكررة',
      broker_visit_requested: 'طلب زيارة جديد',
      broker_reservation_created: 'حجز جديد',
      broker_contract_created: 'تم إنشاء عقد',
      broker_contract_signed: 'تم توقيع عقد',
      broker_commission_earned: 'عمولة جديدة',
      broker_commission_approved: 'اعتماد عمولة',
      broker_commission_rejected: 'رفض عمولة',
      broker_commission_cancelled: 'إلغاء عمولة',
      broker_commission_paid: 'صرف عمولة',
      broker_payout_created: 'دفعة جديدة',
      broker_payout_approved: 'اعتماد دفعة',
      broker_payout_processing: 'دفعة قيد المعالجة',
      broker_payout_paid: 'دفعة مدفوعة',
      broker_payout_cancelled: 'إلغاء دفعة',
      // Visits
      visit_request_created: 'طلب زيارة جديد',
      visit_scheduled: 'تم جدولة زيارة',
      visit_sales_assigned: 'تم إسناد زيارة إليك',
      visit_customer_confirmed: 'العميل أكد الزيارة',
      visit_confirmed: 'تم تأكيد الزيارة',
      visit_customer_reschedule_requested: 'طلب العميل إعادة الجدولة',
      visit_rescheduled: 'تم إعادة جدولة الزيارة',
      visit_completed: 'اكتملت الزيارة',
      visit_cancelled: 'تم إلغاء الزيارة',
      visit_no_show: 'تسجيل عدم حضور',
      visit_day_reminder: 'تذكير بزيارة اليوم',
      visit_feedback_requested: 'مطلوب تقييم الزيارة',
      visit_feedback_received: 'تقييم زيارة جديد',
      // Inquiries
      info_request_created: 'استفسار جديد',
      // Reservations
      reservation_submitted_admin: 'حجز جديد بانتظار الموافقة',
      reservation_status_changed: 'تحديث حالة حجز',
      reservation_booking_paid: 'تم تأكيد دفعة حجز',
      reservation_payment_requested: 'مطلوب دفع مبلغ الحجز',
      // Contracts
      contract_created_customer: 'تم إنشاء عقد',
      contract_signed_customer: 'تم توقيع عقد',
      // Deposits / payment proofs
      deposit_recorded: 'تم تسجيل دفعة',
      deposit_verified: 'تم اعتماد دفعة',
      payment_proof_submitted: 'إثبات دفع جديد',
      booking_payment_proof_submitted: 'إثبات دفع حجز جديد',
      payment_proof_resubmitted: 'إعادة إرسال إثبات الدفع',
      payment_proof_approved: 'تم قبول إثبات الدفع',
      payment_proof_rejected: 'تم رفض إثبات الدفع',
      // Installments
      installment_plan_created: 'خطة تقسيط جديدة',
      installment_due_soon: 'قسط مستحق قريبًا',
      // Maintenance
      maintenance_request_created: 'طلب صيانة جديد',
      maintenance_request_assigned: 'تم تعيين طلب صيانة',
      maintenance_request_status_changed: 'تحديث حالة طلب الصيانة',
      maintenance_request_resolved: 'تم حل طلب الصيانة',
      maintenance_request_closed: 'تم إغلاق طلب الصيانة',
      maintenance_request_complaint_submitted: 'شكوى صيانة جديدة',
      maintenance_request_unresolved: 'طلب صيانة لم يُحل',
      maintenance_request_resolution_confirmed: 'تأكيد حل طلب الصيانة',
      maintenance_sla_warning: 'تحذير: اقتراب موعد الصيانة',
      maintenance_sla_breached: 'تجاوز موعد الصيانة',
      // Leads / CRM
      lead_created: 'فرصة جديدة في CRM',
      lead_assigned_sales: 'تم إسناد فرصة',
      lead_stage_changed: 'تحديث مرحلة الفرصة',
      lead_note_added: 'ملاحظة جديدة على الفرصة',
      // Broker status
      broker_approved: 'تم تفعيل حساب الوسيط',
      broker_suspended: 'تم تعليق حساب الوسيط',
      // Broker unit access
      broker_unit_access_requested: 'طلب وصول وسيط للوحدة',
      broker_unit_access_approved: 'تم اعتماد وصول الوسيط',
      broker_unit_access_rejected: 'تم رفض وصول الوسيط',
      // User account lifecycle
      user_account_approved: 'تم تفعيل الحساب',
      user_account_suspended: 'تم تعليق الحساب',
    } as Record<string, string>,
  },
};

const en: typeof ar = {
  filters: {
    apply: 'Filter',
    clear: 'Clear filters',
    allStatuses: 'All statuses',
    allProjects: 'All projects',
  },

  commissionsFilter: {
    searchPlaceholder: 'Search by commission, contract or unit number…',
    status: {
      PENDING: 'Pending approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
    },
  },

  payoutsFilter: {
    searchPlaceholder: 'Search by payout number or transfer reference…',
    periodPlaceholder: 'Period (2026-05)',
    status: {
      DRAFT: 'Draft',
      APPROVED: 'Approved',
      PROCESSING: 'Processing',
      PAID: 'Paid',
      CANCELLED: 'Cancelled',
    },
  },

  reservationsFilter: {
    searchPlaceholder: 'Search by client name, phone number or unit…',
    status: {
      PENDING: 'Under review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
      EXPIRED: 'Expired',
      CONVERTED: 'Converted to contract',
    },
    advanced: 'Advanced filters',
    reservationDate: 'Reservation date:',
  },

  unitsFilter: {
    searchPlaceholder: 'Search by unit code or project…',
    status: {
      AVAILABLE: 'Available',
      RESERVED: 'Reserved',
      SOLD: 'Sold',
    },
    allTypes: 'All types',
    advanced: 'Advanced filters',
    priceAndSpecs: 'Price and specs:',
    minPrice: 'Min price',
    maxPrice: 'Max price',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    bedroomsOption: (n: number) => `${n} ${n === 1 ? 'bedroom' : 'bedrooms'}`,
    bathroomsOption: (n: number) => `${n} ${n === 1 ? 'bathroom' : 'bathrooms'}`,
  },

  funnel: {
    numberLocale: 'en-US',
    defaultTitle: 'Conversion funnel',
    stagesCount: (n: number) => `${n} stages`,
    stages: {
      leadsSubmitted: 'Leads submitted',
      leadsApproved: 'Leads approved',
      reservationsCreated: 'Reservations',
      contractsCreated: 'Contracts',
      contractsSigned: 'Contracts signed',
      payoutsPaid: 'Payouts paid',
    },
    footnote: 'Conversion rate is calculated against the immediately preceding stage.',
  },

  trend: {
    numberLocale: 'en-US',
    currencyLocale: 'en-US',
    axisMillion: 'M',
    axisThousand: 'K',
    tabFinancial: 'Financial',
    tabActivity: 'Activity',
    emptyTitle: 'No monthly data in this range.',
    emptyHint: 'Try widening the date range.',
    commissionsNet: 'Net commissions',
    payoutsNet: 'Net payouts',
    reservations: 'Reservations',
    contractsSigned: 'Contracts signed',
  },

  projectsPanel: {
    sortLocale: 'en',
    emptyTitle: 'No projects available yet',
    emptyDescription: 'Once you are granted access to a project, its details will appear here.',
    kpiTotal: 'Total projects',
    kpiPublished: 'Published',
    kpiReady: 'Ready to market',
    kpiFeatured: 'Featured',
    searchPlaceholder: 'Search by project name or city…',
    allStatuses: 'All statuses',
    published: 'Published',
    unpublished: 'Unpublished',
    allCities: 'All cities',
    allProjects: 'All projects',
    readyForMarketing: 'Ready to market',
    featured: 'Featured',
    apply: 'Filter',
    clear: 'Clear',
    searchResults: 'Search results',
    availableProjects: 'Available projects',
    countOfTotal: (shown: number, total: number) => `${shown} of ${total}`,
    noMatchTitle: 'No projects match your search',
    noMatchDescription: 'Try changing the search term or clearing the active filters.',
    clearFilters: 'Clear filters',
  },

  exportMenu: {
    label: 'Export',
    optionsAria: 'Export options',
    preparing: 'Preparing file…',
    single: { xlsx: 'Export Excel', pdf: 'Export PDF', csv: 'Export CSV' },
    formats: { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' },
    hints: {
      xlsx: 'Formatted report to analyse and sort',
      pdf: 'Company-branded — to print or share',
      csv: 'Raw data for other systems',
    },
    error: 'Could not prepare the file. Please try again.',
  },

  submitButton: {
    saving: 'Saving…',
  },

  formLayout: {
    sidebarTitle: 'Creation summary',
    sidebarBadge: 'New',
    sectionsAria: 'Form sections',
    stepsHeading: 'Setup steps',
  },

  projectCard: {
    featured: 'Featured',
    brokerCommission: 'Broker commission',
    defaultLabel: 'Default',
    browseUnits: 'Browse units',
    active: 'Ready to market',
    paused: 'Paused',
  },
  notifications: {
    markRead: 'Mark as read',
    dateLocale: 'en-US',
    emptyTitle: 'No notifications',
    emptyDescription: 'New notifications will appear here when they arrive.',
    unread: 'unread',
    markAllRead: 'Mark all as read',
    fallbackTitle: 'New notification',
    openFn: (label: string) => `Open ${label}`,
    channel: {
      IN_APP: 'In-app',
      PUSH: 'Push',
      EMAIL: 'Email',
      SMS: 'SMS',
    },
    related: {
      maintenance: 'maintenance request',
      visit: 'visit',
      lead: 'lead',
      broker: 'broker',
      user: 'user',
      payment: 'payment',
      commission: 'commission',
      contract: 'contract',
      reservation: 'reservation',
      inquiry: 'inquiry',
    },
    templates: {
      // Broker
      broker_lead_submitted: 'New lead submitted',
      broker_lead_approved: 'Lead approved',
      broker_lead_rejected: 'Lead rejected',
      broker_lead_marked_duplicate: 'Lead marked as duplicate',
      broker_visit_requested: 'New visit request',
      broker_reservation_created: 'New reservation',
      broker_contract_created: 'Contract created',
      broker_contract_signed: 'Contract signed',
      broker_commission_earned: 'New commission',
      broker_commission_approved: 'Commission approved',
      broker_commission_rejected: 'Commission rejected',
      broker_commission_cancelled: 'Commission cancelled',
      broker_commission_paid: 'Commission paid',
      broker_payout_created: 'New payout',
      broker_payout_approved: 'Payout approved',
      broker_payout_processing: 'Payout processing',
      broker_payout_paid: 'Payout paid',
      broker_payout_cancelled: 'Payout cancelled',
      // Visits
      visit_request_created: 'New visit request',
      visit_scheduled: 'Visit scheduled',
      visit_sales_assigned: 'Visit assigned to you',
      visit_customer_confirmed: 'Client confirmed the visit',
      visit_confirmed: 'Visit confirmed',
      visit_customer_reschedule_requested: 'Client requested a reschedule',
      visit_rescheduled: 'Visit rescheduled',
      visit_completed: 'Visit completed',
      visit_cancelled: 'Visit cancelled',
      visit_no_show: 'No-show recorded',
      visit_day_reminder: 'Visit reminder for today',
      visit_feedback_requested: 'Visit feedback requested',
      visit_feedback_received: 'New visit feedback',
      // Inquiries
      info_request_created: 'New inquiry',
      // Reservations
      reservation_submitted_admin: 'New reservation awaiting approval',
      reservation_status_changed: 'Reservation status updated',
      reservation_booking_paid: 'Booking payment confirmed',
      reservation_payment_requested: 'Booking payment required',
      // Contracts
      contract_created_customer: 'Contract created',
      contract_signed_customer: 'Contract signed',
      // Deposits / payment proofs
      deposit_recorded: 'Payment recorded',
      deposit_verified: 'Payment approved',
      payment_proof_submitted: 'New payment proof',
      booking_payment_proof_submitted: 'New booking payment proof',
      payment_proof_resubmitted: 'Payment proof resubmitted',
      payment_proof_approved: 'Payment proof accepted',
      payment_proof_rejected: 'Payment proof rejected',
      // Installments
      installment_plan_created: 'New installment plan',
      installment_due_soon: 'Installment due soon',
      // Maintenance
      maintenance_request_created: 'New maintenance request',
      maintenance_request_assigned: 'Maintenance request assigned',
      maintenance_request_status_changed: 'Maintenance request status updated',
      maintenance_request_resolved: 'Maintenance request resolved',
      maintenance_request_closed: 'Maintenance request closed',
      maintenance_request_complaint_submitted: 'New maintenance complaint',
      maintenance_request_unresolved: 'Maintenance request unresolved',
      maintenance_request_resolution_confirmed: 'Maintenance resolution confirmed',
      maintenance_sla_warning: 'Warning: maintenance deadline approaching',
      maintenance_sla_breached: 'Maintenance deadline missed',
      // Leads / CRM
      lead_created: 'New lead in CRM',
      lead_assigned_sales: 'Lead assigned',
      lead_stage_changed: 'Lead stage updated',
      lead_note_added: 'New note on lead',
      // Broker status
      broker_approved: 'Broker account activated',
      broker_suspended: 'Broker account suspended',
      // Broker unit access
      broker_unit_access_requested: 'Broker unit access requested',
      broker_unit_access_approved: 'Broker access approved',
      broker_unit_access_rejected: 'Broker access rejected',
      // User account lifecycle
      user_account_approved: 'Account activated',
      user_account_suspended: 'Account suspended',
    },
  },
};

export function portalSharedT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

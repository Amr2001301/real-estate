/// Human labels for the audit log: the API records the HTTP verb and the
/// route (`POST` · `v1/contracts`) or a named event (`contract.cancelled`).
/// The page shows them as «إضافة عقد» / «Add contract».
library;

const _verbs = {
  'POST': ('إضافة', 'Add'),
  'PUT': ('تعديل', 'Edit'),
  'PATCH': ('تعديل', 'Edit'),
  'DELETE': ('حذف', 'Delete'),
};

const _things = {
  'reservations': ('حجز', 'reservation'),
  'leads': ('فرصة بيع', 'lead'),
  'deposits': ('دفعة', 'payment'),
  'bonus-entries': ('مكافأة', 'bonus'),
  'bonus-rules': ('قاعدة مكافآت', 'bonus rule'),
  'units': ('وحدة', 'unit'),
  'contracts': ('عقد', 'contract'),
  'visits': ('زيارة', 'visit'),
  'installment-plan-templates': ('خطة تقسيط', 'installment plan'),
  'maintenance-requests': ('طلب صيانة', 'maintenance request'),
  'notifications': ('إشعار', 'notification'),
  'notification-templates': ('قالب إشعار', 'notification template'),
  'cms': ('محتوى الموقع', 'website content'),
  'broker-payouts': ('كشف صرف وسيط', 'broker payout'),
  'brokers': ('شركة وسيط', 'broker company'),
  'broker-commissions': ('عمولة وسيط', 'broker commission'),
  'broker-leads': ('فرصة وسيط', 'broker lead'),
  'broker-reservations': ('حجز وسيط', 'broker reservation'),
  'public': ('طلب من الموقع', 'website request'),
  'sales-targets': ('هدف مبيعات', 'sales target'),
  'me': ('الحساب الشخصي', 'my account'),
  'payment-instruments': ('شيك', 'cheque'),
  'portal': ('بوابة الوسيط', 'broker portal'),
  'users': ('مستخدم', 'user'),
  'company': ('بيانات الشركة', 'company profile'),
  'campaigns': ('حملة', 'campaign'),
  'buildings': ('مبنى', 'building'),
  'phases': ('مرحلة', 'phase'),
  'projects': ('مشروع', 'project'),
  'documents': ('مستند', 'document'),
  'info-requests': ('استفسار', 'inquiry'),
  'lead-intake': ('استقبال فرص', 'lead intake'),
  'auth': ('الدخول', 'sign-in'),
  'super-admin': ('إدارة المنصة', 'platform admin'),
};

const _events = {
  'commission.clawback.collected': ('استرداد عمولة', 'Commission clawback collected'),
  'contract.cancelled': ('إلغاء عقد', 'Contract cancelled'),
  'contract.late-fee-clause': ('بند غرامة التأخير', 'Late-fee clause'),
  'contract.price-changed': ('تغيير سعر العقد', 'Contract price changed'),
  'contract.refund-recorded': ('تسجيل استرداد', 'Refund recorded'),
  'contract.sign_followup_ok': ('متابعة التوقيع', 'Signing follow-up'),
  'contract.unit-handed-over': ('تسليم الوحدة', 'Unit handed over'),
  'contract.unit-released': ('تحرير الوحدة', 'Unit released'),
  'payment-instrument.bounced': ('ارتداد شيك', 'Cheque bounced'),
  'pricing.discount-given': ('خصم ممنوح', 'Discount given'),
};

String _route(String s) => s.startsWith('v1/') ? s.substring(3) : s;

/// «إضافة عقد» for `POST` + `v1/contracts`; the named event's label for an event.
String auditTitle(String action, String entityType, String lang) {
  final ar = lang == 'ar';
  final e = _events[action];
  if (e != null) return ar ? e.$1 : e.$2;
  final v = _verbs[action.toUpperCase()];
  final t = _things[_route(entityType)];
  if (v == null) return action;
  final verb = ar ? v.$1 : v.$2;
  if (t == null) return '$verb ${_route(entityType)}';
  return '$verb ${ar ? t.$1 : t.$2}';
}

/// What the entry is about, for the line under the title.
String auditThing(String entityType, String lang) {
  final t = _things[_route(entityType)];
  if (t != null) return lang == 'ar' ? t.$1 : t.$2;
  return switch (entityType) {
    'Contract' => lang == 'ar' ? 'عقد' : 'Contract',
    'BrokerCommission' => lang == 'ar' ? 'عمولة وسيط' : 'Broker commission',
    'PaymentInstrument' => lang == 'ar' ? 'شيك' : 'Cheque',
    'InstallmentPlanTemplate' => lang == 'ar' ? 'خطة تقسيط' : 'Installment plan',
    _ => entityType,
  };
}


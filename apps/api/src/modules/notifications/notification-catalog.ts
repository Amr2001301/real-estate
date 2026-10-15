import { NotificationChannel } from '@prisma/client';

/**
 * Every notification the platform sends, with its default Arabic/English
 * text. The single source of truth: NotificationsService inserts any missing
 * platform default (companyId NULL) at boot, so a new event never ships
 * without its template (a missing template used to fail silently), and the
 * seed reads the same list. A company's edits live in its own override row
 * and are never overwritten.
 *
 * `{{var}}` placeholders are filled from the send payload; money keys
 * (amount, bookingAmount, penaltyAmount) are formatted in the company
 * currency. `emailEnabled` also e-mails the recipient.
 */
export interface NotificationTemplateDef {
  code: string;
  channel: NotificationChannel;
  emailEnabled?: boolean;
  ar_subject: string;
  en_subject: string;
  ar_body: string;
  en_body: string;
}

/** A user's role as the account notifications say it. */
export const USER_ROLE_AR: Record<string, string> = {
  SUPER_ADMIN: 'مدير المنصة',
  ADMIN: 'مدير النظام',
  SALES: 'مندوب مبيعات',
  SALES_MANAGER: 'مدير مبيعات',
  MAINTENANCE_SUPERVISOR: 'مشرف صيانة',
  BROKER: 'وسيط',
  CLIENT: 'عميل',
  CUSTOMER: 'عميل',
};

export const NOTIFICATION_CATALOG: NotificationTemplateDef[] = [
  {
    code: 'visit_approved',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تمت الموافقة على زيارتك',
    en_subject: 'Your visit was approved',
    ar_body: 'تم تأكيد زيارتك للمشروع {{projectName}} في {{date}}',
    en_body: 'Your visit to {{projectName}} on {{date}} is confirmed',
  },
  {
    code: 'deposit_recorded',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تسجيل دفعة',
    en_subject: 'Deposit recorded',
    ar_body: 'تم تسجيل دفعة بقيمة {{amount}} لعقدك',
    en_body: 'A deposit of {{amount}} has been recorded for your contract',
  },
  {
    code: 'reservation_expired',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'انتهت صلاحية الحجز',
    en_subject: 'Reservation expired',
    ar_body: 'انتهت صلاحية حجز الوحدة {{unitCode}}',
    en_body: 'Reservation for unit {{unitCode}} has expired',
  },
  {
    code: 'maintenance_request_created',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'طلب صيانة جديد',
    en_subject: 'New maintenance request',
    ar_body: 'تم إنشاء طلب صيانة جديد للوحدة {{unitCode}}.',
    en_body: 'A new maintenance request was created for unit {{unitCode}}.',
  },
  {
    code: 'maintenance_request_assigned',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تم إسناد طلب صيانة',
    en_subject: 'Maintenance request assigned',
    ar_body: 'تم إسناد طلب الصيانة للوحدة {{unitCode}} إليك.',
    en_body: 'The maintenance request for unit {{unitCode}} was assigned to you.',
  },
  {
    code: 'maintenance_request_status_changed',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تحديث حالة طلب الصيانة',
    en_subject: 'Maintenance status updated',
    ar_body: 'تم تحديث حالة طلب الصيانة للوحدة {{unitCode}} إلى {{statusLabel}}.',
    en_body: 'The maintenance request for unit {{unitCode}} is now {{statusLabel}}.',
  },
  {
    code: 'maintenance_request_resolved',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تم حل طلب الصيانة',
    en_subject: 'Maintenance request resolved',
    ar_body: 'تم وضع طلب الصيانة للوحدة {{unitCode}} كتم حله.',
    en_body: 'The maintenance request for unit {{unitCode}} was marked resolved.',
  },
  {
    code: 'maintenance_request_closed',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تم إغلاق طلب الصيانة',
    en_subject: 'Maintenance request closed',
    ar_body: 'تم إغلاق طلب الصيانة للوحدة {{unitCode}}.',
    en_body: 'The maintenance request for unit {{unitCode}} was closed.',
  },
  // Resolution loop (Phase A). complaint → staff; unresolved → staff +
  // customer; resolution_confirmed → staff. Payloads carry deep-link
  // metadata (entityType/entityId/requestId/action).
  {
    code: 'maintenance_request_complaint_submitted',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'شكوى على طلب صيانة متأخر',
    en_subject: 'Complaint on overdue maintenance',
    ar_body: 'قدّم العميل شكوى بشأن تأخر طلب الصيانة للوحدة {{unitCode}}.',
    en_body:
      'The customer filed a complaint about the overdue maintenance request for unit {{unitCode}}.',
  },
  {
    code: 'maintenance_request_unresolved',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'طلب صيانة لم يُحل',
    en_subject: 'Maintenance request unresolved',
    ar_body: 'تم تصنيف طلب الصيانة للوحدة {{unitCode}} كغير مُنجز بعد تجاوز المهلة.',
    en_body:
      'The maintenance request for unit {{unitCode}} was marked unresolved after the deadline passed.',
  },
  {
    code: 'maintenance_request_resolution_confirmed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم تأكيد حل طلب الصيانة',
    en_subject: 'Maintenance resolution confirmed',
    ar_body: 'تم تأكيد حل طلب الصيانة للوحدة {{unitCode}}.',
    en_body: 'Resolution of the maintenance request for unit {{unitCode}} was confirmed.',
  },
  // ─── Visit lifecycle (P3) ────────────────────────────────────────────
  // Placeholders are restricted to identity / scheduling context only —
  // no phone, email, address, reservation amounts, or internal ids leak
  // into notification bodies. `requestId` / `visitId` are surfaced for
  // routing purposes only and never read by the rendered body.
  {
    code: 'visit_request_created',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'طلب زيارة جديد',
    en_subject: 'New visit request',
    ar_body: 'طلب زيارة جديد من {{customerName}} لمشروع {{projectName}}.',
    en_body: 'New visit request from {{customerName}} for {{projectName}}.',
  },
  // P13 — fired to ADMIN + SALES_MANAGER when an info/general inquiry is
  // submitted (Guest, Client, or Customer). Safe placeholders only:
  // identity + project/unit context. NO phone, email, or message body.
  {
    code: 'info_request_created',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'استفسار جديد',
    en_subject: 'New info request',
    ar_body: 'تم استلام استفسار جديد من {{customerName}}.',
    en_body: 'A new info request was received from {{customerName}}.',
  },
  {
    code: 'visit_scheduled',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم جدولة زيارتك',
    en_subject: 'Your visit was scheduled',
    ar_body: 'تم جدولة زيارة {{projectName}} في {{scheduledAt}}. يرجى التأكيد.',
    en_body: 'Your visit to {{projectName}} is scheduled for {{scheduledAt}}. Please confirm.',
  },
  {
    code: 'visit_sales_assigned',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم إسناد زيارة إليك',
    en_subject: 'A visit was assigned to you',
    ar_body: 'تم إسناد زيارة {{projectName}} لـ {{customerName}} في {{scheduledAt}}.',
    en_body:
      "You are now assigned to {{customerName}}'s visit to {{projectName}} on {{scheduledAt}}.",
  },
  {
    code: 'visit_customer_confirmed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'العميل أكد الزيارة',
    en_subject: 'Customer confirmed the visit',
    ar_body: '{{customerName}} أكد زيارة {{projectName}} في {{scheduledAt}}.',
    en_body: '{{customerName}} confirmed the visit to {{projectName}} on {{scheduledAt}}.',
  },
  {
    code: 'visit_customer_reschedule_requested',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'طلب العميل إعادة الجدولة',
    en_subject: 'Customer requested reschedule',
    ar_body: '{{customerName}} طلب إعادة جدولة زيارة {{projectName}}. السبب: {{reason}}',
    en_body:
      '{{customerName}} asked to reschedule the visit to {{projectName}}. Reason: {{reason}}',
  },
  {
    code: 'visit_rescheduled',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم تغيير موعد زيارتك',
    en_subject: 'Your visit was rescheduled',
    ar_body: 'تم نقل زيارة {{projectName}} إلى {{scheduledAt}}.',
    en_body: 'Your visit to {{projectName}} was moved to {{scheduledAt}}.',
  },
  {
    code: 'visit_completed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'اكتملت زيارتك',
    en_subject: 'Visit completed',
    ar_body: 'شكراً لزيارتك مشروع {{projectName}}.',
    en_body: 'Thank you for visiting {{projectName}}.',
  },
  {
    code: 'visit_cancelled',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم إلغاء الزيارة',
    en_subject: 'Visit cancelled',
    ar_body: 'تم إلغاء زيارة {{projectName}}.',
    en_body: 'The visit to {{projectName}} was cancelled.',
  },
  {
    code: 'visit_no_show',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'لم تتم الزيارة',
    en_subject: 'Visit marked no-show',
    ar_body: 'تم تسجيل عدم حضور للزيارة في {{projectName}} بتاريخ {{scheduledAt}}.',
    en_body: 'A no-show was recorded for the {{projectName}} visit on {{scheduledAt}}.',
  },
  {
    code: 'visit_day_reminder',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تذكير بزيارة اليوم',
    en_subject: 'Reminder: visit today',
    ar_body: 'لديك زيارة لمشروع {{projectName}} اليوم في {{scheduledAt}}.',
    en_body: 'You have a visit to {{projectName}} today at {{scheduledAt}}.',
  },
  // Gap 7 — post-visit feedback. Request → customer (PUSH, actionable);
  // received → assigned sales (IN_APP, informational).
  {
    code: 'visit_feedback_requested',
    channel: NotificationChannel.PUSH,
    ar_subject: 'قيّم زيارتك',
    en_subject: 'Rate your visit',
    ar_body: 'اكتملت زيارتك لمشروع {{projectName}} — يسعدنا تقييمك لها.',
    en_body: 'Your visit to {{projectName}} is complete — we’d love your rating.',
  },
  {
    code: 'visit_feedback_received',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تقييم جديد لزيارة',
    en_subject: 'New visit rating',
    ar_body: 'قام العميل بتقييم زيارة {{projectName}} بـ {{rating}}/5.',
    en_body: 'The customer rated the {{projectName}} visit {{rating}}/5.',
  },
  // ─── Reservations (P4) ────────────────────────────────────────────────
  {
    code: 'reservation_submitted_admin',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'حجز جديد بانتظار الموافقة',
    en_subject: 'New reservation pending approval',
    ar_body: 'حجز جديد للوحدة {{unitCode}} في {{projectName}} بانتظار المراجعة.',
    en_body: 'A new reservation for unit {{unitCode}} in {{projectName}} is pending review.',
  },
  {
    code: 'reservation_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث حالة حجزك',
    en_subject: 'Reservation status updated',
    ar_body: 'تم تحديث حالة حجز الوحدة {{unitCode}} إلى {{status}}.',
    en_body: 'Reservation for unit {{unitCode}} is now {{status}}.',
  },
  {
    code: 'reservation_booking_paid',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تأكيد دفعة الحجز',
    en_subject: 'Booking payment confirmed',
    ar_body: 'تم تأكيد استلام دفعة الحجز للوحدة {{unitCode}}.',
    en_body: 'We confirmed the booking payment for unit {{unitCode}}.',
  },
  // Gap 3 — customer is asked to pay the booking amount right after the
  // reservation is created (fired only when a booking amount is due).
  {
    code: 'reservation_payment_requested',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'مطلوب سداد مبلغ الحجز',
    en_subject: 'Booking payment required',
    ar_body:
      'تم إنشاء حجز للوحدة {{unitCode}} بمبلغ حجز {{bookingAmount}}. يُرجى رفع إثبات الدفع من صفحة الحجوزات.',
    en_body:
      'A reservation for unit {{unitCode}} was created with a booking amount of {{bookingAmount}}. Please upload your payment proof from the reservations page.',
  },
  // ─── Contracts (P4) ──────────────────────────────────────────────────
  {
    code: 'contract_created_customer',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إنشاء عقدك',
    en_subject: 'Your contract is ready',
    ar_body: 'تم إنشاء عقد للوحدة {{unitCode}} في {{projectName}}.',
    en_body: 'A contract for unit {{unitCode}} in {{projectName}} was created.',
  },
  // FG-14 — first contract: CLIENT → CUSTOMER, sessions revoked. Also in
  // migration 20261008100000 so existing databases get it.
  {
    code: 'account_promoted_customer',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تمت ترقية حسابك إلى حساب عميل',
    en_subject: 'Your account is now a customer account',
    ar_body:
      'بعد إنشاء عقد الوحدة {{unitCode}} أصبح حسابك حساب عميل. سجّل الدخول مرة أخرى لتظهر لك العقود والأقساط.',
    en_body:
      'With the contract for unit {{unitCode}}, your account is now a customer account. Sign in again to see your contracts and installments.',
  },
  {
    code: 'contract_signed_customer',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم توقيع عقدك',
    en_subject: 'Your contract was signed',
    ar_body: 'تم توقيع العقد رقم {{contractNumber}} للوحدة {{unitCode}}.',
    en_body: 'Contract {{contractNumber}} for unit {{unitCode}} was signed.',
  },
  // P12 — fired when a downloadable contract document is registered for
  // the customer (during reservation→contract conversion or a later admin
  // upload). Safe payload only: contractNumber / unitCode / projectName /
  // contractId — never a file URL, signed URL, storage key, or raw path.
  {
    code: 'contract_document_available',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'عقدك جاهز للتحميل',
    en_subject: 'Your contract is ready to download',
    ar_body: 'أصبح ملف العقد رقم {{contractNumber}} للوحدة {{unitCode}} متاحًا للتحميل.',
    en_body:
      'The contract document {{contractNumber}} for unit {{unitCode}} is now available to download.',
  },
  // Broker variant — only fires when the contract has brokerId set.
  {
    code: 'broker_contract_signed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم توقيع عقد من إحالتك',
    en_subject: 'A contract from your referral was signed',
    ar_body: 'تم توقيع العقد رقم {{contractNumber}} للوحدة {{unitCode}}.',
    en_body: 'Contract {{contractNumber}} for unit {{unitCode}} was signed.',
  },
  {
    code: 'broker_contract_created',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إنشاء عقد من إحالتك',
    en_subject: 'A contract from your referral was created',
    ar_body: 'تم إنشاء العقد للوحدة {{unitCode}} في {{projectName}}.',
    en_body: 'A contract for unit {{unitCode}} in {{projectName}} was created.',
  },
  // ─── Deposits (P4) ───────────────────────────────────────────────────
  {
    code: 'deposit_verified',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تم اعتماد دفعتك',
    en_subject: 'Deposit verified',
    ar_body: 'تم اعتماد دفعة بقيمة {{amount}} لعقدك.',
    en_body: 'A deposit of {{amount}} on your contract was verified.',
  },
  // ─── Payment proof workflow (P11) ────────────────────────────────────
  // Recipients differ per template:
  //   *_submitted, *_resubmitted → ADMIN + SALES_MANAGER
  //   *_approved, *_rejected     → the contract's customer
  // Payloads carry only safe scalars: depositId, dueDate, amount, and a
  // truncated reasonShort. NO receiptUrl, NO card data, NO internal notes.
  {
    code: 'payment_proof_submitted',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'إثبات دفع جديد قيد المراجعة',
    en_subject: 'New payment proof pending review',
    ar_body: 'تم استلام إثبات دفع بقيمة {{amount}} لقسط مستحق بتاريخ {{installmentDueDate}}.',
    en_body:
      'A payment proof of {{amount}} was submitted for an installment due {{installmentDueDate}}.',
  },
  {
    code: 'payment_proof_resubmitted',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إعادة إرسال إثبات الدفع',
    en_subject: 'Payment proof resubmitted',
    ar_body: 'تم إعادة إرسال إثبات دفع بقيمة {{amount}} لقسط مستحق بتاريخ {{installmentDueDate}}.',
    en_body:
      'A payment proof of {{amount}} was resubmitted for an installment due {{installmentDueDate}}.',
  },
  // Gap 3 — booking-amount proof submitted by a customer (staff recipients).
  // Distinct from the installment template so the copy reads correctly
  // ("booking amount" not "installment").
  {
    code: 'booking_payment_proof_submitted',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'إثبات دفع مبلغ حجز قيد المراجعة',
    en_subject: 'Booking payment proof pending review',
    ar_body: 'تم استلام إثبات دفع بقيمة {{amount}} لمبلغ حجز رقم {{reference}}.',
    en_body: 'A payment proof of {{amount}} was submitted for booking {{reference}}.',
  },
  {
    code: 'payment_proof_approved',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم التحقق من دفعتك',
    en_subject: 'Your payment was verified',
    ar_body: 'تم التحقق من دفعة بقيمة {{amount}} للقسط المستحق بتاريخ {{installmentDueDate}}.',
    en_body: 'A payment of {{amount}} for the installment due {{installmentDueDate}} was verified.',
  },
  {
    code: 'payment_proof_rejected',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم رفض إثبات الدفع',
    en_subject: 'Payment proof rejected',
    ar_body:
      'تم رفض إثبات دفعة بقيمة {{amount}} للقسط المستحق بتاريخ {{installmentDueDate}}. السبب: {{reasonShort}}',
    en_body:
      'A payment proof of {{amount}} for the installment due {{installmentDueDate}} was rejected. Reason: {{reasonShort}}',
  },
  // ─── Installments (P4) ───────────────────────────────────────────────
  {
    code: 'installment_plan_created',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'خطة تقسيط جديدة',
    en_subject: 'New installment plan',
    ar_body: 'تمت إضافة خطة تقسيط جديدة لمشروع {{projectName}}.',
    en_body: 'A new installment plan was added for {{projectName}}.',
  },
  // P11.7 — daily due-soon reminder. Safe placeholders only: amount, due
  // date, project/unit/contract context. NO phone, email, URLs, or bank
  // details.
  {
    code: 'installment_due_soon',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تذكير بقسط مستحق قريباً',
    en_subject: 'Upcoming installment due',
    ar_body: 'تذكير: قسط بقيمة {{amount}} مستحق بتاريخ {{dueDate}} لمشروع {{projectName}}.',
    en_body: 'Reminder: an installment of {{amount}} is due on {{dueDate}} for {{projectName}}.',
  },
  // ─── Broker leads (P4) ───────────────────────────────────────────────
  {
    code: 'broker_lead_approved',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم اعتماد فرصتك',
    en_subject: 'Your lead was approved',
    ar_body: 'تم اعتماد الفرصة {{leadReference}}.',
    en_body: 'Lead {{leadReference}} was approved.',
  },
  {
    code: 'broker_lead_rejected',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم رفض فرصتك',
    en_subject: 'Your lead was rejected',
    ar_body: 'تم رفض الفرصة {{leadReference}}.',
    en_body: 'Lead {{leadReference}} was rejected.',
  },
  {
    code: 'broker_lead_marked_duplicate',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'فرصتك مكررة',
    en_subject: 'Your lead is a duplicate',
    ar_body: 'تم تصنيف الفرصة {{leadReference}} كفرصة مكررة.',
    en_body: 'Lead {{leadReference}} was marked as a duplicate.',
  },
  // ─── Broker commissions (P4) — only delivered to brokerUsers with
  //     canViewCommissions = true. Service-side filter.
  {
    code: 'broker_commission_earned',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'عمولة جديدة',
    en_subject: 'Commission earned',
    ar_body: 'تم تسجيل عمولة جديدة برقم مرجعي {{reference}}.',
    en_body: 'A new commission {{reference}} was earned.',
  },
  {
    code: 'broker_commission_approved',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم اعتماد عمولتك',
    en_subject: 'Commission approved',
    ar_body: 'تم اعتماد العمولة {{reference}}.',
    en_body: 'Commission {{reference}} was approved.',
  },
  {
    code: 'broker_commission_rejected',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم رفض عمولتك',
    en_subject: 'Commission rejected',
    ar_body: 'تم رفض العمولة {{reference}}.',
    en_body: 'Commission {{reference}} was rejected.',
  },
  {
    code: 'broker_commission_cancelled',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إلغاء عمولتك',
    en_subject: 'Commission cancelled',
    ar_body: 'تم إلغاء العمولة {{reference}}.',
    en_body: 'Commission {{reference}} was cancelled.',
  },
  {
    code: 'broker_commission_paid',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم صرف عمولتك',
    en_subject: 'Commission paid',
    ar_body: 'تم صرف العمولة {{reference}}.',
    en_body: 'Commission {{reference}} was paid.',
  },
  // ─── Broker payouts (P4) ─────────────────────────────────────────────
  {
    code: 'broker_payout_created',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إنشاء دفعة',
    en_subject: 'A payout was drafted',
    ar_body: 'تم إنشاء دفعة برقم مرجعي {{reference}}.',
    en_body: 'Payout {{reference}} was drafted.',
  },
  {
    code: 'broker_payout_approved',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم اعتماد دفعة',
    en_subject: 'A payout was approved',
    ar_body: 'تم اعتماد الدفعة {{reference}}.',
    en_body: 'Payout {{reference}} was approved.',
  },
  {
    code: 'broker_payout_processing',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'الدفعة قيد المعالجة',
    en_subject: 'Payout processing',
    ar_body: 'الدفعة {{reference}} قيد المعالجة.',
    en_body: 'Payout {{reference}} is being processed.',
  },
  {
    code: 'broker_payout_paid',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم صرف الدفعة',
    en_subject: 'Payout paid',
    ar_body: 'تم صرف الدفعة {{reference}}.',
    en_body: 'Payout {{reference}} was paid.',
  },
  {
    code: 'broker_payout_cancelled',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إلغاء الدفعة',
    en_subject: 'Payout cancelled',
    ar_body: 'تم إلغاء الدفعة {{reference}}.',
    en_body: 'Payout {{reference}} was cancelled.',
  },
  // ─── Leads / CRM ─────────────────────────────────────────────────────
  {
    code: 'lead_created',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'فرصة جديدة في CRM',
    en_subject: 'New lead in CRM',
    ar_body: 'تم إنشاء فرصة جديدة لـ {{customerName}} — {{projectName}}.',
    en_body: 'A new lead was created for {{customerName}} — {{projectName}}.',
  },
  {
    code: 'lead_assigned_sales',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم إسناد فرصة إليك',
    en_subject: 'A lead was assigned to you',
    ar_body: 'تم إسناد فرصة {{customerName}} في {{projectName}} إليك.',
    en_body: 'Lead for {{customerName}} in {{projectName}} was assigned to you.',
  },
  {
    code: 'lead_stage_changed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تحديث مرحلة الفرصة',
    en_subject: 'Lead stage updated',
    ar_body: 'تحولت فرصة {{customerName}} من {{fromStage}} إلى {{toStage}}.',
    en_body: 'Lead for {{customerName}} moved from {{fromStage}} to {{toStage}}.',
  },
  {
    code: 'lead_note_added',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'ملاحظة جديدة على الفرصة',
    en_subject: 'New note on lead',
    ar_body: 'تمت إضافة ملاحظة جديدة على فرصة {{customerName}}.',
    en_body: 'A new note was added to lead for {{customerName}}.',
  },
  // ─── Broker status ────────────────────────────────────────────────────
  {
    code: 'broker_approved',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تفعيل حساب الوسيط',
    en_subject: 'Broker account activated',
    ar_body: 'تم تفعيل حساب شركة {{companyName}} والسماح بالوصول إلى المنصة.',
    en_body:
      'The broker account for {{companyName}} has been activated and platform access granted.',
  },
  {
    code: 'broker_suspended',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تعليق حساب الوسيط',
    en_subject: 'Broker account suspended',
    ar_body: 'تم تعليق حساب شركة {{companyName}} مؤقتاً.',
    en_body: 'The broker account for {{companyName}} has been suspended.',
  },
  // ─── Broker unit access ───────────────────────────────────────────────
  {
    code: 'broker_unit_access_requested',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'طلب وصول وسيط لوحدة',
    en_subject: 'Broker unit access request',
    ar_body: 'طلب الوسيط {{companyName}} الوصول إلى الوحدة {{unitCode}}.',
    en_body: 'Broker {{companyName}} requested access to unit {{unitCode}}.',
  },
  {
    code: 'broker_unit_access_approved',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم الموافقة على طلب الوصول للوحدة',
    en_subject: 'Unit access approved',
    ar_body: 'تمت الموافقة على وصولك إلى الوحدة {{unitCode}} في {{projectName}}.',
    en_body: 'Your access to unit {{unitCode}} in {{projectName}} has been approved.',
  },
  {
    code: 'broker_unit_access_rejected',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم رفض طلب الوصول للوحدة',
    en_subject: 'Unit access rejected',
    ar_body: 'تم رفض طلب الوصول إلى الوحدة {{unitCode}} في {{projectName}}.',
    en_body: 'Your access request for unit {{unitCode}} in {{projectName}} was rejected.',
  },
  // ─── Maintenance SLA ─────────────────────────────────────────────────
  {
    code: 'maintenance_sla_warning',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تحذير: اقتراب انتهاء مهلة الصيانة',
    en_subject: 'Maintenance SLA warning',
    ar_body: 'طلب الصيانة للوحدة {{unitCode}} سيتجاوز المهلة المقررة خلال {{hoursLeft}} ساعة.',
    en_body: 'Maintenance request for unit {{unitCode}} will breach SLA in {{hoursLeft}} hours.',
  },
  {
    code: 'maintenance_sla_breached',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تنبيه: تجاوز مهلة الصيانة',
    en_subject: 'Maintenance SLA breached',
    ar_body: 'تجاوز طلب الصيانة للوحدة {{unitCode}} المهلة المقررة. يرجى التصرف الفوري.',
    en_body:
      'Maintenance request for unit {{unitCode}} has breached SLA. Immediate action required.',
  },
  // ─── Visit appointment reminders (AppointmentReminderCron) ───────────
  // The cron always sent these codes; without the rows every reminder
  // failed with "Template not found".
  {
    code: 'appointment_day_before_reminder',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تذكير: معاينتك غداً',
    en_subject: 'Reminder: your visit is tomorrow',
    ar_body: 'لديك معاينة رقم {{visitNumber}} في {{projectName}} غداً.',
    en_body: 'You have visit {{visitNumber}} at {{projectName}} tomorrow.',
  },
  {
    code: 'appointment_hour_before_reminder',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تذكير: معاينتك بعد ساعة',
    en_subject: 'Reminder: your visit is in an hour',
    ar_body: 'معاينتك رقم {{visitNumber}} في {{projectName}} تبدأ خلال ساعة.',
    en_body: 'Your visit {{visitNumber}} at {{projectName}} starts in about an hour.',
  },
  // ─── Payment reversal (09-reversal-design.md) ─────────────────────────
  // Sent by PaymentInstrumentsService and ContractCancellationService but
  // never seeded, so both failed with "Template not found" (FG-26).
  {
    code: 'cheque_bounced',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم ارتداد شيك',
    en_subject: 'A cheque has bounced',
    ar_body:
      'تم ارتداد الشيك {{chequeNumber}} بتاريخ {{bounceDate}}. غرامة الارتداد: {{penaltyAmount}}. يرجى التواصل معنا لتسوية المبلغ.',
    en_body:
      'Cheque {{chequeNumber}} bounced on {{bounceDate}}. Bounce penalty: {{penaltyAmount}}. Please contact us to settle the amount.',
  },
  {
    code: 'contract_cancelled_customer',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إلغاء عقدك',
    en_subject: 'Your contract has been cancelled',
    ar_body: 'تم إلغاء عقدك. سيتواصل معك فريق المبيعات بخصوص الخطوات التالية.',
    en_body:
      'Your contract has been cancelled. Our sales team will contact you about the next steps.',
  },
  // ─── User account lifecycle ───────────────────────────────────────────
  {
    code: 'user_account_approved',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تفعيل حسابك',
    en_subject: 'Your account is active',
    ar_body: 'مرحباً {{name}}! تم تفعيل حسابك ويمكنك الآن تسجيل الدخول.',
    en_body: 'Welcome {{name}}! Your account is now active. You can log in.',
  },
  {
    code: 'user_account_suspended',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'تم تعليق حسابك',
    en_subject: 'Your account has been suspended',
    ar_body: 'تم تعليق حسابك مؤقتاً. يرجى التواصل مع الإدارة للاستفسار.',
    en_body: 'Your account has been suspended. Please contact administration.',
  },
  // A broker made a reservation (portal, or an admin on the broker's behalf).
  {
    code: 'broker_reservation_created',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'حجز جديد من وسيط',
    en_subject: 'New broker reservation',
    ar_body: 'تم إنشاء الحجز {{reservationNumber}} للوحدة {{unitCode}} للعميل {{leadName}}.',
    en_body:
      'Reservation {{reservationNumber}} was created for unit {{unitCode}} for {{leadName}}.',
  },
  // ── Sales pipeline: leads, visits, requests, reservations, contracts ──
  {
    code: 'broker_lead_submitted',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'عميل محتمل جديد من وسيط',
    en_subject: 'New broker lead',
    ar_body: 'أرسل الوسيط {{brokerName}} العميل {{leadName}} للمراجعة.',
    en_body: '{{brokerName}} submitted {{leadName}} for review.',
  },
  {
    code: 'broker_visit_requested',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'طلب زيارة من وسيط',
    en_subject: 'Broker visit request',
    ar_body: 'طلب الوسيط {{brokerName}} زيارة للعميل {{customerName}} يوم {{date}}.',
    en_body: '{{brokerName}} requested a visit for {{customerName}} on {{date}}.',
  },
  {
    code: 'lead_updated',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم تحديث بيانات عميل محتمل',
    en_subject: 'Lead updated',
    ar_body: 'تم تعديل بيانات العميل {{customerName}}.',
    en_body: 'The details of {{customerName}} were updated.',
  },
  {
    code: 'lead_unassigned',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم نقل عميل محتمل',
    en_subject: 'Lead reassigned',
    ar_body: 'لم يعد العميل {{customerName}} مسنداً إليك.',
    en_body: '{{customerName}} is no longer assigned to you.',
  },
  {
    code: 'leads_imported',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم استيراد عملاء محتملين',
    en_subject: 'Leads imported',
    ar_body: 'تم استيراد {{count}} عميل محتمل ({{skipped}} تم تخطيهم).',
    en_body: '{{count}} leads were imported ({{skipped}} skipped).',
  },
  {
    code: 'visit_request_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث على طلب الزيارة',
    en_subject: 'Visit request update',
    ar_body: 'طلب الزيارة للعميل {{customerName}} بتاريخ {{date}}: {{status}}.',
    en_body: 'The visit request for {{customerName}} on {{date}}: {{status}}.',
  },
  {
    code: 'visit_request_assigned',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم إسناد طلب زيارة إليك',
    en_subject: 'Visit request assigned',
    ar_body: 'تم إسناد طلب زيارة العميل {{customerName}} بتاريخ {{date}} إليك.',
    en_body: 'The visit request for {{customerName}} on {{date}} was assigned to you.',
  },
  {
    code: 'info_request_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث على استفسارك',
    en_subject: 'Your inquiry was updated',
    ar_body: 'حالة استفسارك عن {{projectName}}: {{status}}.',
    en_body: 'Your inquiry about {{projectName}}: {{status}}.',
  },
  {
    code: 'reservation_updated',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم تعديل الحجز',
    en_subject: 'Reservation updated',
    ar_body: 'تم تعديل الحجز {{reference}} للوحدة {{unitCode}}: {{changes}}.',
    en_body: 'Reservation {{reference}} for unit {{unitCode}} was updated: {{changes}}.',
  },
  {
    code: 'reservation_assigned_sales',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تم إسناد حجز إليك',
    en_subject: 'Reservation assigned to you',
    ar_body: 'أصبح الحجز {{reference}} للوحدة {{unitCode}} ({{customerName}}) مسنداً إليك.',
    en_body: 'Reservation {{reference}} for unit {{unitCode}} ({{customerName}}) is now yours.',
  },
  {
    code: 'reservation_unassigned_sales',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم نقل حجز',
    en_subject: 'Reservation reassigned',
    ar_body: 'لم يعد الحجز {{reference}} للوحدة {{unitCode}} مسنداً إليك.',
    en_body: 'Reservation {{reference}} for unit {{unitCode}} is no longer assigned to you.',
  },
  {
    code: 'reservation_note_added',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'ملاحظة جديدة على حجز',
    en_subject: 'New note on a reservation',
    ar_body: 'أُضيفت ملاحظة على الحجز {{reference}} للوحدة {{unitCode}}.',
    en_body: 'A note was added to reservation {{reference}} for unit {{unitCode}}.',
  },
  {
    code: 'reservation_booking_unconfirmed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إلغاء تأكيد مبلغ الحجز',
    en_subject: 'Booking payment unconfirmed',
    ar_body: 'لم يعد مبلغ حجز الوحدة {{unitCode}} محسوباً كمستلم. تواصل مع فريق المبيعات.',
    en_body:
      'The booking payment for unit {{unitCode}} is no longer counted as received. Please contact sales.',
  },
  {
    code: 'contract_signed_staff',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم توقيع عقد',
    en_subject: 'Contract signed',
    ar_body: 'تم توقيع العقد {{contractNumber}} للوحدة {{unitCode}}.',
    en_body: 'Contract {{contractNumber}} for unit {{unitCode}} was signed.',
  },
  {
    code: 'contract_cancelled_staff',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إلغاء عقد',
    en_subject: 'Contract cancelled',
    ar_body: 'تم إلغاء العقد {{contractNumber}} للوحدة {{unitCode}} ({{customerName}}).',
    en_body: 'Contract {{contractNumber}} for unit {{unitCode}} ({{customerName}}) was cancelled.',
  },
  {
    code: 'contract_number_assigned',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إصدار رقم عقدك',
    en_subject: 'Your contract number',
    ar_body: 'أصبح رقم عقدك للوحدة {{unitCode}}: {{contractNumber}}.',
    en_body: 'Your contract for unit {{unitCode}} is now number {{contractNumber}}.',
  },
  // ─── Finance (N3) ─────────────────────────────────────────────────────
  {
    code: 'installment_overdue',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'قسط متأخر',
    en_subject: 'Installment overdue',
    ar_body:
      'قسط بقيمة {{amount}} كان مستحقاً بتاريخ {{dueDate}} للوحدة {{unitCode}} ولم يُسدَّد بعد. يرجى السداد أو التواصل معنا.',
    en_body:
      'An installment of {{amount}} for unit {{unitCode}} was due on {{dueDate}} and is still unpaid. Please pay or contact us.',
  },
  {
    code: 'installment_overdue_staff',
    channel: NotificationChannel.PUSH,
    ar_subject: 'قسط متأخر على عميل',
    en_subject: 'Customer installment overdue',
    ar_body:
      'قسط {{customerName}} بقيمة {{amount}} على العقد {{contractNumber}} (الوحدة {{unitCode}}) تأخر عن {{dueDate}}.',
    en_body:
      '{{customerName}}’s installment of {{amount}} on contract {{contractNumber}} (unit {{unitCode}}) is overdue since {{dueDate}}.',
  },
  {
    code: 'installment_schedule_ready',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'جدول أقساطك جاهز',
    en_subject: 'Your installment schedule is ready',
    ar_body:
      'تم إعداد جدول أقساط العقد {{contractNumber}}: {{totalMonths}} قسط بقيمة {{monthlyAmount}} يبدأ {{startsAt}}.',
    en_body:
      'The installment schedule for contract {{contractNumber}} is ready: {{totalMonths}} installments of {{monthlyAmount}} starting {{startsAt}}.',
  },
  {
    code: 'installment_schedule_ready_staff',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم إعداد جدول أقساط',
    en_subject: 'Installment schedule created',
    ar_body:
      'تم إعداد جدول أقساط العقد {{contractNumber}} للوحدة {{unitCode}} ({{totalMonths}} قسط).',
    en_body:
      'An installment schedule was created for contract {{contractNumber}}, unit {{unitCode}} ({{totalMonths}} installments).',
  },
  {
    code: 'deposit_status_staff',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'حركة على دفعة',
    en_subject: 'Payment update',
    ar_body: 'دفعة بقيمة {{amount}} للوحدة {{unitCode}}: {{status}}.',
    en_body: 'A payment of {{amount}} for unit {{unitCode}}: {{status}}.',
  },
  {
    code: 'deposit_reversed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم عكس دفعة',
    en_subject: 'A payment was reversed',
    ar_body:
      'تم عكس دفعة بقيمة {{amount}} على العقد {{contractNumber}} وأصبح القسط المرتبط بها مستحقاً من جديد. يرجى التواصل معنا لأي استفسار.',
    en_body:
      'A payment of {{amount}} on contract {{contractNumber}} was reversed, so its installment is due again. Please contact us with any questions.',
  },
  {
    code: 'cheque_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث على {{kind}}',
    en_subject: 'Payment instrument update',
    ar_body: '{{kind}} رقم {{chequeNumber}} على العقد {{contractNumber}}: {{status}}.',
    en_body: 'Payment {{chequeNumber}} on contract {{contractNumber}} was updated.',
  },
  {
    code: 'cheque_status_staff',
    channel: NotificationChannel.PUSH,
    ar_subject: 'تحديث على {{kind}}',
    en_subject: 'Payment instrument update',
    ar_body:
      '{{kind}} {{chequeNumber}} للعميل {{customerName}} (العقد {{contractNumber}}): {{status}}.',
    en_body:
      'Payment {{chequeNumber}} from {{customerName}} (contract {{contractNumber}}) was updated.',
  },
  {
    code: 'contract_refund_due',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'مبلغ مسترد لك',
    en_subject: 'Your refund',
    ar_body:
      'بعد إلغاء العقد {{contractNumber}} سيُرد لك مبلغ {{refundAmount}}. سيتواصل معك فريقنا لترتيب الاسترداد.',
    en_body:
      'Following the cancellation of contract {{contractNumber}}, {{refundAmount}} will be refunded to you. Our team will contact you to arrange it.',
  },
  {
    code: 'bonus_entry_created',
    channel: NotificationChannel.PUSH,
    ar_subject: 'مكافأة جديدة',
    en_subject: 'New bonus',
    ar_body: 'أُضيفت لك مكافأة بقيمة {{amount}} عن فترة {{period}}.',
    en_body: 'A bonus of {{amount}} was added for you for {{period}}.',
  },
  {
    code: 'bonus_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث على مكافأتك',
    en_subject: 'Bonus update',
    ar_body: 'مكافأتك بقيمة {{amount}} عن فترة {{period}}: {{status}}.',
    en_body: 'Your bonus of {{amount}} for {{period}}: {{status}}.',
  },
  // ─── Maintenance, accounts, subscription, broker teams (N4) ────────────
  {
    code: 'maintenance_request_received',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم فتح طلب صيانة لك',
    en_subject: 'A maintenance request was opened for you',
    ar_body: 'تم فتح طلب صيانة للوحدة {{unitCode}} باسمك، وسيتابعه فريق الصيانة.',
    en_body:
      'A maintenance request was opened for unit {{unitCode}} on your behalf; our maintenance team will follow up.',
  },
  {
    code: 'maintenance_request_unassigned',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تم سحب طلب صيانة منك',
    en_subject: 'Maintenance request reassigned',
    ar_body: 'لم يعد طلب الصيانة للوحدة {{unitCode}} مسنداً إليك.',
    en_body: 'The maintenance request for unit {{unitCode}} is no longer assigned to you.',
  },
  {
    code: 'maintenance_request_approved_staff',
    channel: NotificationChannel.PUSH,
    ar_subject: 'طلب صيانة جاهز للتنفيذ',
    en_subject: 'Maintenance request approved',
    ar_body: 'تمت الموافقة على طلب الصيانة للوحدة {{unitCode}} وبدأت مدة المعالجة.',
    en_body:
      'The maintenance request for unit {{unitCode}} was approved; its handling time has started.',
  },
  {
    code: 'maintenance_attachment_added',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'مرفق جديد على طلب صيانة',
    en_subject: 'New attachment on a maintenance request',
    ar_body: 'أُضيفت صور أو ملفات جديدة لطلب الصيانة للوحدة {{unitCode}}.',
    en_body: 'New photos or files were added to the maintenance request for unit {{unitCode}}.',
  },
  {
    code: 'user_account_created',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'مرحباً بك',
    en_subject: 'Welcome',
    ar_body: 'مرحباً {{name}}! تم إنشاء حسابك بصفة {{roleLabel}}.',
    en_body: 'Welcome {{name}}! Your account ({{roleLabel}}) has been created.',
  },
  {
    code: 'manager_assigned',
    channel: NotificationChannel.IN_APP,
    emailEnabled: true,
    ar_subject: 'مديرك المباشر',
    en_subject: 'Your manager',
    ar_body: 'أصبح {{managerName}} مديرك المباشر.',
    en_body: '{{managerName}} is now your manager.',
  },
  {
    code: 'team_member_added',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'عضو جديد في فريقك',
    en_subject: 'New team member',
    ar_body: 'انضم {{name}} إلى فريقك.',
    en_body: '{{name}} joined your team.',
  },
  {
    code: 'team_member_removed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'عضو غادر فريقك',
    en_subject: 'Team member moved',
    ar_body: 'لم يعد {{name}} ضمن فريقك.',
    en_body: '{{name}} is no longer on your team.',
  },
  {
    code: 'subscription_expiring_soon',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'اشتراككم ينتهي قريباً',
    en_subject: 'Your subscription ends soon',
    ar_body:
      'ينتهي اشتراك شركتكم في المنصة بعد {{daysLeft}} يوم ({{endDate}}). جدّدوا الاشتراك لتجنّب توقف الخدمة.',
    en_body:
      'Your company subscription ends in {{daysLeft}} day(s) ({{endDate}}). Renew it to avoid an interruption.',
  },
  {
    code: 'subscription_expired',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'انتهى اشتراككم',
    en_subject: 'Your subscription has expired',
    ar_body: 'انتهى اشتراك شركتكم في المنصة. يرجى التجديد لاستعادة الخدمة كاملة.',
    en_body: 'Your company subscription has expired. Please renew to restore full service.',
  },
  {
    code: 'subscription_cancelled',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إلغاء اشتراككم',
    en_subject: 'Your subscription was cancelled',
    ar_body: 'تم إلغاء اشتراك شركتكم في المنصة، ويظل متاحاً حتى {{endDate}}.',
    en_body: 'Your company subscription was cancelled; it stays available until {{endDate}}.',
  },
  {
    code: 'subscription_ended',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'انتهى اشتراككم الملغى',
    en_subject: 'Your cancelled subscription has ended',
    ar_body: 'انتهت مدة اشتراك شركتكم الملغى في المنصة.',
    en_body: 'Your cancelled company subscription has now ended.',
  },
  {
    code: 'company_suspended',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم إيقاف حساب الشركة',
    en_subject: 'Company account suspended',
    ar_body: 'تم إيقاف حساب شركتكم على المنصة مؤقتاً. يرجى التواصل مع إدارة المنصة.',
    en_body: 'Your company account was suspended. Please contact the platform team.',
  },
  {
    code: 'company_activated',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تم تفعيل حساب الشركة',
    en_subject: 'Company account active',
    ar_body: 'تم تفعيل حساب شركتكم على المنصة.',
    en_body: 'Your company account is active.',
  },
  {
    code: 'broker_user_invited',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تمت إضافتك لفريق وسيط',
    en_subject: 'You were added to a broker team',
    ar_body: 'مرحباً {{name}}! تمت إضافتك إلى فريق {{brokerName}} على بوابة الوسطاء.',
    en_body: 'Welcome {{name}}! You were added to the {{brokerName}} team on the broker portal.',
  },
  {
    code: 'broker_team_member_added',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'عضو جديد في فريق الوسيط',
    en_subject: 'New broker team member',
    ar_body: 'انضم {{name}} إلى فريق {{brokerName}}.',
    en_body: '{{name}} joined the {{brokerName}} team.',
  },
  {
    code: 'broker_user_status_changed',
    channel: NotificationChannel.PUSH,
    emailEnabled: true,
    ar_subject: 'تحديث على حسابك في بوابة الوسطاء',
    en_subject: 'Your broker portal account',
    ar_body: 'حالة حسابك في فريق {{brokerName}}: {{statusLabel}}.',
    en_body: 'Your account on the {{brokerName}} team was updated.',
  },
  {
    code: 'broker_team_member_status_changed',
    channel: NotificationChannel.IN_APP,
    ar_subject: 'تحديث على عضو في الفريق',
    en_subject: 'Broker team member update',
    ar_body: 'حالة {{name}} في فريق {{brokerName}}: {{statusLabel}}.',
    en_body: '{{name}} on the {{brokerName}} team was updated.',
  },
  // Admin manual broadcast — content is supplied at send-time via payload vars.
  {
    code: 'admin_broadcast',
    channel: NotificationChannel.IN_APP,
    ar_subject: '{{title_ar}}',
    en_subject: '{{title_en}}',
    ar_body: '{{body_ar}}',
    en_body: '{{body_en}}',
  },
];

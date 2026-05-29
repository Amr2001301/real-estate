import type {
  ProjectStatus,
  UnitStatus,
  LeadStage,
  VisitStatus,
  VisitRequestStatus,
  AppointmentStatus,
  ReservationStatus,
  ReservationBookingPaymentStatus,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceReviewStatus,
  WarrantyStatus,
  PlanTemplateStatus,
  BrokerStatus,
  BrokerUserStatus,
  BrokerLeadStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
} from '@/lib/types';

const PILL = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium';

const PROJECT: Record<ProjectStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-gray-100 text-gray-700', l: 'مسودة' },
  PUBLISHED: { c: 'bg-green-100 text-green-700', l: 'منشور' },
  ARCHIVED: { c: 'bg-amber-100 text-amber-700', l: 'مؤرشف' },
};
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const x = PROJECT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const UNIT: Record<UnitStatus, { c: string; l: string }> = {
  AVAILABLE: { c: 'bg-green-100 text-green-700', l: 'متاحة' },
  RESERVED: { c: 'bg-amber-100 text-amber-700', l: 'محجوزة' },
  SOLD: { c: 'bg-blue-100 text-blue-700', l: 'مباعة' },
};
export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const x = UNIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const LEAD: Record<LeadStage, { c: string; l: string }> = {
  NEW: { c: 'bg-gray-100 text-gray-700', l: 'جديد' },
  INTERESTED: { c: 'bg-blue-100 text-blue-700', l: 'مهتم' },
  VISIT: { c: 'bg-purple-100 text-purple-700', l: 'زيارة' },
  NEGOTIATION: { c: 'bg-amber-100 text-amber-700', l: 'تفاوض' },
  WON: { c: 'bg-green-100 text-green-700', l: 'فوز' },
  LOST: { c: 'bg-red-100 text-red-700', l: 'خسارة' },
};
export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const x = LEAD[stage];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const VISIT: Record<VisitStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-gray-100 text-gray-700', l: 'قيد الانتظار' },
  APPROVED: { c: 'bg-blue-100 text-blue-700', l: 'موافق' },
  SCHEDULED: { c: 'bg-purple-100 text-purple-700', l: 'مجدولة' },
  COMPLETED: { c: 'bg-green-100 text-green-700', l: 'مكتملة' },
  CANCELLED: { c: 'bg-red-100 text-red-700', l: 'ملغاة' },
};
export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const x = VISIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const RESERVATION: Record<ReservationStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-green-100 text-green-700', l: 'تمت الموافقة' },
  REJECTED: { c: 'bg-red-100 text-red-700', l: 'مرفوض' },
  CANCELLED: { c: 'bg-red-100 text-red-700', l: 'ملغى' },
  EXPIRED: { c: 'bg-amber-100 text-amber-700', l: 'منتهي' },
  CONVERTED: { c: 'bg-indigo-100 text-indigo-700', l: 'محوّل إلى عقد' },
};
export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const x = RESERVATION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT: Record<MaintenanceStatus, { c: string; l: string }> = {
  OPEN: { c: 'bg-gray-100 text-gray-700', l: 'مفتوح' },
  ASSIGNED: { c: 'bg-blue-100 text-blue-700', l: 'مسند' },
  IN_PROGRESS: { c: 'bg-amber-100 text-amber-700', l: 'قيد التنفيذ' },
  RESOLVED: { c: 'bg-green-100 text-green-700', l: 'تم الحل' },
  CLOSED: { c: 'bg-gray-200 text-gray-600', l: 'مغلق' },
};
export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const x = MAINT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT_PRIORITY: Record<MaintenancePriority, { c: string; l: string }> = {
  LOW: { c: 'bg-gray-100 text-gray-600', l: 'منخفضة' },
  MEDIUM: { c: 'bg-blue-100 text-blue-700', l: 'متوسطة' },
  HIGH: { c: 'bg-amber-100 text-amber-700', l: 'عالية' },
  URGENT: { c: 'bg-red-100 text-red-700', l: 'عاجلة' },
};
export function MaintenancePriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const x = MAINT_PRIORITY[priority];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT_REVIEW: Record<MaintenanceReviewStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-green-100 text-green-700', l: 'معتمد' },
  REJECTED: { c: 'bg-red-100 text-red-700', l: 'مرفوض' },
};
export function MaintenanceReviewStatusBadge({ status }: { status: MaintenanceReviewStatus }) {
  const x = MAINT_REVIEW[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const WARRANTY: Record<WarrantyStatus, { c: string; l: string }> = {
  IN_WARRANTY: { c: 'bg-green-100 text-green-700', l: 'تحت الضمان' },
  OUT_OF_WARRANTY: { c: 'bg-red-100 text-red-700', l: 'خارج الضمان' },
  UNKNOWN: { c: 'bg-gray-100 text-gray-600', l: 'غير معروف' },
};
export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  const x = WARRANTY[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const VISIT_REQUEST: Record<VisitRequestStatus, { c: string; l: string }> = {
  NEW: { c: 'bg-gray-100 text-gray-700', l: 'جديد' },
  UNDER_REVIEW: { c: 'bg-blue-100 text-blue-700', l: 'قيد المراجعة' },
  CONVERTED: { c: 'bg-green-100 text-green-700', l: 'تم التحويل' },
  REJECTED: { c: 'bg-red-100 text-red-700', l: 'مرفوض' },
  CANCELLED: { c: 'bg-gray-200 text-gray-500', l: 'ملغى' },
};
export function VisitRequestStatusBadge({ status }: { status: VisitRequestStatus }) {
  const x = VISIT_REQUEST[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const APPOINTMENT: Record<AppointmentStatus, { c: string; l: string }> = {
  SCHEDULED: { c: 'bg-blue-100 text-blue-700', l: 'مجدولة — بانتظار تأكيد العميل' },
  CONFIRMED: { c: 'bg-purple-100 text-purple-700', l: 'أكدها العميل' },
  PENDING_RESCHEDULE: { c: 'bg-amber-100 text-amber-700', l: 'طلب العميل إعادة جدولة' },
  COMPLETED: { c: 'bg-green-100 text-green-700', l: 'مكتملة' },
  CANCELLED: { c: 'bg-red-100 text-red-700', l: 'ملغاة' },
  NO_SHOW: { c: 'bg-amber-100 text-amber-700', l: 'لم يحضر' },
  RESCHEDULED: { c: 'bg-gray-100 text-gray-600', l: 'معاد جدولتها' },
};
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const x = APPOINTMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const PLAN_TEMPLATE: Record<PlanTemplateStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-gray-100 text-gray-700', l: 'مسودة' },
  ACTIVE: { c: 'bg-green-100 text-green-700', l: 'نشطة' },
  INACTIVE: { c: 'bg-red-100 text-red-700', l: 'غير نشطة' },
};
export function PlanTemplateStatusBadge({ status }: { status: PlanTemplateStatus }) {
  const x = PLAN_TEMPLATE[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER: Record<BrokerStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'قيد الانضمام' },
  ACTIVE: { c: 'bg-green-100 text-green-700', l: 'نشط' },
  SUSPENDED: { c: 'bg-red-100 text-red-700', l: 'موقوف' },
  TERMINATED: { c: 'bg-gray-200 text-gray-600', l: 'منتهي' },
};
export function BrokerStatusBadge({ status }: { status: BrokerStatus }) {
  const x = BROKER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_LEAD: Record<BrokerLeadStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-green-100 text-green-700', l: 'موافق عليه' },
  REJECTED: { c: 'bg-red-100 text-red-700', l: 'مرفوض' },
  DUPLICATE: { c: 'bg-purple-100 text-purple-700', l: 'مكرر' },
  EXPIRED: { c: 'bg-gray-200 text-gray-600', l: 'منتهي' },
};
export function BrokerLeadStatusBadge({ status }: { status: BrokerLeadStatus }) {
  const x = BROKER_LEAD[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_PAYOUT: Record<BrokerPayoutStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-gray-100 text-gray-700', l: 'مسودة' },
  APPROVED: { c: 'bg-blue-100 text-blue-700', l: 'موافق عليها' },
  PROCESSING: { c: 'bg-amber-100 text-amber-700', l: 'قيد التنفيذ' },
  PAID: { c: 'bg-green-100 text-green-700', l: 'مدفوعة' },
  CANCELLED: { c: 'bg-gray-200 text-gray-600', l: 'ملغاة' },
};
export function BrokerPayoutStatusBadge({ status }: { status: BrokerPayoutStatus }) {
  const x = BROKER_PAYOUT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_COMMISSION: Record<BrokerCommissionStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-green-100 text-green-700', l: 'موافق عليها' },
  REJECTED: { c: 'bg-red-100 text-red-700', l: 'مرفوضة' },
  CANCELLED: { c: 'bg-gray-200 text-gray-600', l: 'ملغاة' },
};
export function BrokerCommissionStatusBadge({ status }: { status: BrokerCommissionStatus }) {
  const x = BROKER_COMMISSION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_USER: Record<BrokerUserStatus, { c: string; l: string }> = {
  INVITED: { c: 'bg-blue-100 text-blue-700', l: 'مدعو' },
  ACTIVE: { c: 'bg-green-100 text-green-700', l: 'نشط' },
  SUSPENDED: { c: 'bg-amber-100 text-amber-700', l: 'موقوف' },
  REMOVED: { c: 'bg-gray-200 text-gray-600', l: 'محذوف' },
};
export function BrokerUserStatusBadge({ status }: { status: BrokerUserStatus }) {
  const x = BROKER_USER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BOOKING_PAYMENT: Record<ReservationBookingPaymentStatus, { c: string; l: string }> = {
  UNPAID: { c: 'bg-red-100 text-red-700', l: 'غير مدفوع' },
  PENDING: { c: 'bg-amber-100 text-amber-700', l: 'بانتظار التأكيد' },
  PAID: { c: 'bg-green-100 text-green-700', l: 'مدفوع' },
  WAIVED: { c: 'bg-gray-200 text-gray-600', l: 'معفى' },
};
export function ReservationBookingPaymentBadge({
  status,
}: {
  status: ReservationBookingPaymentStatus;
}) {
  const x = BOOKING_PAYMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

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

const PILL = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

const PROJECT: Record<ProjectStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-surface-muted text-slate-600', l: 'مسودة' },
  PUBLISHED: { c: 'bg-success-50 text-success-700', l: 'منشور' },
  ARCHIVED: { c: 'bg-warning-50 text-warning-700', l: 'مؤرشف' },
};
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const x = PROJECT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const UNIT: Record<UnitStatus, { c: string; l: string }> = {
  AVAILABLE: { c: 'bg-success-50 text-success-700', l: 'متاحة' },
  RESERVED: { c: 'bg-warning-50 text-warning-700', l: 'محجوزة' },
  SOLD: { c: 'bg-info-50 text-info-700', l: 'مباعة' },
};
export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  const x = UNIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const LEAD: Record<LeadStage, { c: string; l: string }> = {
  NEW: { c: 'bg-slate-100 text-slate-600', l: 'جديد' },
  INTERESTED: { c: 'bg-info-50 text-info-700', l: 'مهتم' },
  VISIT: { c: 'bg-purple-50 text-purple-700', l: 'زيارة' },
  NEGOTIATION: { c: 'bg-warning-50 text-warning-700', l: 'تفاوض' },
  WON: { c: 'bg-success-50 text-success-700', l: 'فوز' },
  LOST: { c: 'bg-danger-50 text-danger-700', l: 'خسارة' },
};
export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const x = LEAD[stage];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const VISIT: Record<VisitStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-slate-100 text-slate-600', l: 'قيد الانتظار' },
  APPROVED: { c: 'bg-info-50 text-info-700', l: 'موافق' },
  SCHEDULED: { c: 'bg-purple-50 text-purple-700', l: 'مجدولة' },
  COMPLETED: { c: 'bg-success-50 text-success-700', l: 'مكتملة' },
  CANCELLED: { c: 'bg-danger-50 text-danger-700', l: 'ملغاة' },
};
export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const x = VISIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const RESERVATION: Record<ReservationStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-success-50 text-success-700', l: 'تمت الموافقة' },
  REJECTED: { c: 'bg-danger-50 text-danger-700', l: 'مرفوض' },
  CANCELLED: { c: 'bg-danger-50 text-danger-700', l: 'ملغى' },
  EXPIRED: { c: 'bg-warning-50 text-warning-700', l: 'منتهي' },
  CONVERTED: { c: 'bg-info-50 text-info-700', l: 'محوّل إلى عقد' },
};
export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const x = RESERVATION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT: Record<MaintenanceStatus, { c: string; l: string }> = {
  OPEN: { c: 'bg-slate-100 text-slate-600', l: 'مفتوح' },
  ASSIGNED: { c: 'bg-info-50 text-info-700', l: 'مسند' },
  IN_PROGRESS: { c: 'bg-warning-50 text-warning-700', l: 'قيد التنفيذ' },
  RESOLVED: { c: 'bg-success-50 text-success-700', l: 'تم الحل' },
  CLOSED: { c: 'bg-surface-muted text-slate-500', l: 'مغلق' },
};
export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const x = MAINT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT_PRIORITY: Record<MaintenancePriority, { c: string; l: string }> = {
  LOW: { c: 'bg-slate-100 text-slate-500', l: 'منخفضة' },
  MEDIUM: { c: 'bg-info-50 text-info-700', l: 'متوسطة' },
  HIGH: { c: 'bg-warning-50 text-warning-700', l: 'عالية' },
  URGENT: { c: 'bg-danger-50 text-danger-700', l: 'عاجلة' },
};
export function MaintenancePriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const x = MAINT_PRIORITY[priority];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const MAINT_REVIEW: Record<MaintenanceReviewStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-success-50 text-success-700', l: 'معتمد' },
  REJECTED: { c: 'bg-danger-50 text-danger-700', l: 'مرفوض' },
};
export function MaintenanceReviewStatusBadge({ status }: { status: MaintenanceReviewStatus }) {
  const x = MAINT_REVIEW[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const WARRANTY: Record<WarrantyStatus, { c: string; l: string }> = {
  IN_WARRANTY: { c: 'bg-success-50 text-success-700', l: 'تحت الضمان' },
  OUT_OF_WARRANTY: { c: 'bg-danger-50 text-danger-700', l: 'خارج الضمان' },
  UNKNOWN: { c: 'bg-slate-100 text-slate-500', l: 'غير معروف' },
};
export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  const x = WARRANTY[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const VISIT_REQUEST: Record<VisitRequestStatus, { c: string; l: string }> = {
  NEW: { c: 'bg-slate-100 text-slate-600', l: 'جديد' },
  UNDER_REVIEW: { c: 'bg-info-50 text-info-700', l: 'قيد المراجعة' },
  CONVERTED: { c: 'bg-success-50 text-success-700', l: 'تم التحويل' },
  REJECTED: { c: 'bg-danger-50 text-danger-700', l: 'مرفوض' },
  CANCELLED: { c: 'bg-surface-muted text-slate-500', l: 'ملغى' },
};
export function VisitRequestStatusBadge({ status }: { status: VisitRequestStatus }) {
  const x = VISIT_REQUEST[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const APPOINTMENT: Record<AppointmentStatus, { c: string; l: string }> = {
  SCHEDULED: { c: 'bg-info-50 text-info-700', l: 'مجدولة — بانتظار تأكيد العميل' },
  CONFIRMED: { c: 'bg-purple-50 text-purple-700', l: 'أكدها العميل' },
  PENDING_RESCHEDULE: { c: 'bg-warning-50 text-warning-700', l: 'طلب العميل إعادة جدولة' },
  COMPLETED: { c: 'bg-success-50 text-success-700', l: 'مكتملة' },
  CANCELLED: { c: 'bg-danger-50 text-danger-700', l: 'ملغاة' },
  NO_SHOW: { c: 'bg-warning-50 text-warning-700', l: 'لم يحضر' },
  RESCHEDULED: { c: 'bg-slate-100 text-slate-600', l: 'معاد جدولتها' },
};
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const x = APPOINTMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const PLAN_TEMPLATE: Record<PlanTemplateStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-surface-muted text-slate-600', l: 'مسودة' },
  ACTIVE: { c: 'bg-success-50 text-success-700', l: 'نشطة' },
  INACTIVE: { c: 'bg-danger-50 text-danger-700', l: 'غير نشطة' },
};
export function PlanTemplateStatusBadge({ status }: { status: PlanTemplateStatus }) {
  const x = PLAN_TEMPLATE[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER: Record<BrokerStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'قيد الانضمام' },
  ACTIVE: { c: 'bg-success-50 text-success-700', l: 'نشط' },
  SUSPENDED: { c: 'bg-danger-50 text-danger-700', l: 'موقوف' },
  TERMINATED: { c: 'bg-surface-muted text-slate-500', l: 'منتهي' },
};
export function BrokerStatusBadge({ status }: { status: BrokerStatus }) {
  const x = BROKER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_LEAD: Record<BrokerLeadStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-success-50 text-success-700', l: 'موافق عليه' },
  REJECTED: { c: 'bg-danger-50 text-danger-700', l: 'مرفوض' },
  DUPLICATE: { c: 'bg-purple-50 text-purple-700', l: 'مكرر' },
  EXPIRED: { c: 'bg-surface-muted text-slate-500', l: 'منتهي' },
};
export function BrokerLeadStatusBadge({ status }: { status: BrokerLeadStatus }) {
  const x = BROKER_LEAD[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_PAYOUT: Record<BrokerPayoutStatus, { c: string; l: string }> = {
  DRAFT: { c: 'bg-surface-muted text-slate-600', l: 'مسودة' },
  APPROVED: { c: 'bg-info-50 text-info-700', l: 'موافق عليها' },
  PROCESSING: { c: 'bg-warning-50 text-warning-700', l: 'قيد التنفيذ' },
  PAID: { c: 'bg-success-50 text-success-700', l: 'مدفوعة' },
  CANCELLED: { c: 'bg-surface-muted text-slate-500', l: 'ملغاة' },
};
export function BrokerPayoutStatusBadge({ status }: { status: BrokerPayoutStatus }) {
  const x = BROKER_PAYOUT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_COMMISSION: Record<BrokerCommissionStatus, { c: string; l: string }> = {
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'قيد المراجعة' },
  APPROVED: { c: 'bg-success-50 text-success-700', l: 'موافق عليها' },
  REJECTED: { c: 'bg-danger-50 text-danger-700', l: 'مرفوضة' },
  CANCELLED: { c: 'bg-surface-muted text-slate-500', l: 'ملغاة' },
};
export function BrokerCommissionStatusBadge({ status }: { status: BrokerCommissionStatus }) {
  const x = BROKER_COMMISSION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BROKER_USER: Record<BrokerUserStatus, { c: string; l: string }> = {
  INVITED: { c: 'bg-info-50 text-info-700', l: 'مدعو' },
  ACTIVE: { c: 'bg-success-50 text-success-700', l: 'نشط' },
  SUSPENDED: { c: 'bg-warning-50 text-warning-700', l: 'موقوف' },
  REMOVED: { c: 'bg-surface-muted text-slate-500', l: 'محذوف' },
};
export function BrokerUserStatusBadge({ status }: { status: BrokerUserStatus }) {
  const x = BROKER_USER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

const BOOKING_PAYMENT: Record<ReservationBookingPaymentStatus, { c: string; l: string }> = {
  UNPAID: { c: 'bg-danger-50 text-danger-700', l: 'غير مدفوع' },
  PENDING: { c: 'bg-warning-50 text-warning-700', l: 'بانتظار التأكيد' },
  PAID: { c: 'bg-success-50 text-success-700', l: 'مدفوع' },
  WAIVED: { c: 'bg-slate-100 text-slate-500', l: 'معفى' },
};
export function ReservationBookingPaymentBadge({
  status,
}: {
  status: ReservationBookingPaymentStatus;
}) {
  const x = BOOKING_PAYMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l}</span>;
}

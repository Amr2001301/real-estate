import type { Locale } from '@/lib/locale';
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

type L = { ar: string; en: string };
function l(ar: string, en: string): L { return { ar, en }; }

const PROJECT: Record<ProjectStatus, { c: string; l: L }> = {
  DRAFT:     { c: 'bg-surface-muted text-slate-600',  l: l('مسودة', 'Draft') },
  PUBLISHED: { c: 'bg-success-50 text-success-700',   l: l('منشور', 'Published') },
  ARCHIVED:  { c: 'bg-warning-50 text-warning-700',   l: l('مؤرشف', 'Archived') },
};
export function ProjectStatusBadge({ status, locale = 'ar' }: { status: ProjectStatus; locale?: Locale }) {
  const x = PROJECT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const UNIT: Record<UnitStatus, { c: string; l: L }> = {
  AVAILABLE: { c: 'bg-success-50 text-success-700',  l: l('متاحة', 'Available') },
  RESERVED:  { c: 'bg-warning-50 text-warning-700',  l: l('محجوزة', 'Reserved') },
  SOLD:      { c: 'bg-info-50 text-info-700',        l: l('مباعة', 'Sold') },
};
export function UnitStatusBadge({ status, locale = 'ar' }: { status: UnitStatus; locale?: Locale }) {
  const x = UNIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const LEAD: Record<LeadStage, { c: string; l: L }> = {
  NEW:         { c: 'bg-slate-100 text-slate-600',   l: l('جديد', 'New') },
  INTERESTED:  { c: 'bg-info-50 text-info-700',      l: l('مهتم', 'Interested') },
  VISIT:       { c: 'bg-purple-50 text-purple-700',  l: l('زيارة', 'Visit') },
  NEGOTIATION: { c: 'bg-warning-50 text-warning-700',l: l('تفاوض', 'Negotiation') },
  WON:         { c: 'bg-success-50 text-success-700',l: l('فوز', 'Won') },
  LOST:        { c: 'bg-danger-50 text-danger-700',  l: l('خسارة', 'Lost') },
};
export function LeadStageBadge({ stage, locale = 'ar' }: { stage: LeadStage; locale?: Locale }) {
  const x = LEAD[stage];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const VISIT: Record<VisitStatus, { c: string; l: L }> = {
  PENDING:   { c: 'bg-slate-100 text-slate-600',   l: l('قيد الانتظار', 'Pending') },
  APPROVED:  { c: 'bg-info-50 text-info-700',      l: l('موافق', 'Approved') },
  SCHEDULED: { c: 'bg-purple-50 text-purple-700',  l: l('مجدولة', 'Scheduled') },
  COMPLETED: { c: 'bg-success-50 text-success-700',l: l('مكتملة', 'Completed') },
  CANCELLED: { c: 'bg-danger-50 text-danger-700',  l: l('ملغاة', 'Cancelled') },
};
export function VisitStatusBadge({ status, locale = 'ar' }: { status: VisitStatus; locale?: Locale }) {
  const x = VISIT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const RESERVATION: Record<ReservationStatus, { c: string; l: L }> = {
  PENDING:   { c: 'bg-warning-50 text-warning-700', l: l('قيد المراجعة', 'Under Review') },
  APPROVED:  { c: 'bg-success-50 text-success-700', l: l('تمت الموافقة', 'Approved') },
  REJECTED:  { c: 'bg-danger-50 text-danger-700',   l: l('مرفوض', 'Rejected') },
  CANCELLED: { c: 'bg-danger-50 text-danger-700',   l: l('ملغى', 'Cancelled') },
  EXPIRED:   { c: 'bg-warning-50 text-warning-700', l: l('منتهي', 'Expired') },
  CONVERTED: { c: 'bg-info-50 text-info-700',       l: l('محوّل إلى عقد', 'Converted') },
};
export function ReservationStatusBadge({ status, locale = 'ar' }: { status: ReservationStatus; locale?: Locale }) {
  const x = RESERVATION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const MAINT: Record<MaintenanceStatus, { c: string; l: L }> = {
  OPEN:        { c: 'bg-slate-100 text-slate-600',    l: l('مفتوح', 'Open') },
  ASSIGNED:    { c: 'bg-info-50 text-info-700',       l: l('مسند', 'Assigned') },
  IN_PROGRESS: { c: 'bg-warning-50 text-warning-700', l: l('قيد التنفيذ', 'In Progress') },
  RESOLVED:    { c: 'bg-success-50 text-success-700', l: l('تم الحل', 'Resolved') },
  CLOSED:      { c: 'bg-surface-muted text-slate-500',l: l('مغلق', 'Closed') },
};
export function MaintenanceStatusBadge({ status, locale = 'ar' }: { status: MaintenanceStatus; locale?: Locale }) {
  const x = MAINT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const MAINT_PRIORITY: Record<MaintenancePriority, { c: string; l: L }> = {
  LOW:    { c: 'bg-slate-100 text-slate-500',    l: l('منخفضة', 'Low') },
  MEDIUM: { c: 'bg-info-50 text-info-700',       l: l('متوسطة', 'Medium') },
  HIGH:   { c: 'bg-warning-50 text-warning-700', l: l('عالية', 'High') },
  URGENT: { c: 'bg-danger-50 text-danger-700',   l: l('عاجلة', 'Urgent') },
};
export function MaintenancePriorityBadge({ priority, locale = 'ar' }: { priority: MaintenancePriority; locale?: Locale }) {
  const x = MAINT_PRIORITY[priority];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const MAINT_REVIEW: Record<MaintenanceReviewStatus, { c: string; l: L }> = {
  PENDING:  { c: 'bg-warning-50 text-warning-700', l: l('قيد المراجعة', 'Under Review') },
  APPROVED: { c: 'bg-success-50 text-success-700', l: l('معتمد', 'Approved') },
  REJECTED: { c: 'bg-danger-50 text-danger-700',   l: l('مرفوض', 'Rejected') },
};
export function MaintenanceReviewStatusBadge({ status, locale = 'ar' }: { status: MaintenanceReviewStatus; locale?: Locale }) {
  const x = MAINT_REVIEW[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const WARRANTY: Record<WarrantyStatus, { c: string; l: L }> = {
  IN_WARRANTY:     { c: 'bg-success-50 text-success-700', l: l('تحت الضمان', 'Under Warranty') },
  OUT_OF_WARRANTY: { c: 'bg-danger-50 text-danger-700',   l: l('خارج الضمان', 'Out of Warranty') },
  UNKNOWN:         { c: 'bg-slate-100 text-slate-500',    l: l('غير معروف', 'Unknown') },
};
export function WarrantyStatusBadge({ status, locale = 'ar' }: { status: WarrantyStatus; locale?: Locale }) {
  const x = WARRANTY[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const VISIT_REQUEST: Record<VisitRequestStatus, { c: string; l: L }> = {
  NEW:          { c: 'bg-slate-100 text-slate-600',    l: l('جديد', 'New') },
  UNDER_REVIEW: { c: 'bg-info-50 text-info-700',       l: l('قيد المراجعة', 'Under Review') },
  CONVERTED:    { c: 'bg-success-50 text-success-700', l: l('تم التحويل', 'Converted') },
  REJECTED:     { c: 'bg-danger-50 text-danger-700',   l: l('مرفوض', 'Rejected') },
  CANCELLED:    { c: 'bg-surface-muted text-slate-500',l: l('ملغى', 'Cancelled') },
};
export function VisitRequestStatusBadge({ status, locale = 'ar' }: { status: VisitRequestStatus; locale?: Locale }) {
  const x = VISIT_REQUEST[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const APPOINTMENT: Record<AppointmentStatus, { c: string; l: L }> = {
  SCHEDULED:         { c: 'bg-info-50 text-info-700',       l: l('مجدولة — بانتظار تأكيد العميل', 'Scheduled — awaiting client confirmation') },
  CONFIRMED:         { c: 'bg-purple-50 text-purple-700',   l: l('أكدها العميل', 'Confirmed by client') },
  PENDING_RESCHEDULE:{ c: 'bg-warning-50 text-warning-700', l: l('طلب العميل إعادة جدولة', 'Client requested reschedule') },
  COMPLETED:         { c: 'bg-success-50 text-success-700', l: l('مكتملة', 'Completed') },
  CANCELLED:         { c: 'bg-danger-50 text-danger-700',   l: l('ملغاة', 'Cancelled') },
  NO_SHOW:           { c: 'bg-warning-50 text-warning-700', l: l('لم يحضر', 'No-show') },
  RESCHEDULED:       { c: 'bg-slate-100 text-slate-600',    l: l('معاد جدولتها', 'Rescheduled') },
};
export function AppointmentStatusBadge({ status, locale = 'ar' }: { status: AppointmentStatus; locale?: Locale }) {
  const x = APPOINTMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const PLAN_TEMPLATE: Record<PlanTemplateStatus, { c: string; l: L }> = {
  DRAFT:    { c: 'bg-surface-muted text-slate-600',  l: l('مسودة', 'Draft') },
  ACTIVE:   { c: 'bg-success-50 text-success-700',   l: l('نشطة', 'Active') },
  INACTIVE: { c: 'bg-danger-50 text-danger-700',     l: l('غير نشطة', 'Inactive') },
};
export function PlanTemplateStatusBadge({ status, locale = 'ar' }: { status: PlanTemplateStatus; locale?: Locale }) {
  const x = PLAN_TEMPLATE[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BROKER: Record<BrokerStatus, { c: string; l: L }> = {
  PENDING:    { c: 'bg-warning-50 text-warning-700',  l: l('قيد الانضمام', 'Pending') },
  ACTIVE:     { c: 'bg-success-50 text-success-700',  l: l('نشط', 'Active') },
  SUSPENDED:  { c: 'bg-danger-50 text-danger-700',    l: l('موقوف', 'Suspended') },
  TERMINATED: { c: 'bg-surface-muted text-slate-500', l: l('منتهي', 'Terminated') },
};
export function BrokerStatusBadge({ status, locale = 'ar' }: { status: BrokerStatus; locale?: Locale }) {
  const x = BROKER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BROKER_LEAD: Record<BrokerLeadStatus, { c: string; l: L }> = {
  PENDING:   { c: 'bg-warning-50 text-warning-700',  l: l('قيد المراجعة', 'Under Review') },
  APPROVED:  { c: 'bg-success-50 text-success-700',  l: l('موافق عليه', 'Approved') },
  REJECTED:  { c: 'bg-danger-50 text-danger-700',    l: l('مرفوض', 'Rejected') },
  DUPLICATE: { c: 'bg-purple-50 text-purple-700',    l: l('مكرر', 'Duplicate') },
  EXPIRED:   { c: 'bg-surface-muted text-slate-500', l: l('منتهي', 'Expired') },
};
export function BrokerLeadStatusBadge({ status, locale = 'ar' }: { status: BrokerLeadStatus; locale?: Locale }) {
  const x = BROKER_LEAD[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BROKER_PAYOUT: Record<BrokerPayoutStatus, { c: string; l: L }> = {
  DRAFT:      { c: 'bg-surface-muted text-slate-600',  l: l('مسودة', 'Draft') },
  APPROVED:   { c: 'bg-info-50 text-info-700',         l: l('موافق عليها', 'Approved') },
  PROCESSING: { c: 'bg-warning-50 text-warning-700',   l: l('قيد التنفيذ', 'Processing') },
  PAID:       { c: 'bg-success-50 text-success-700',   l: l('مدفوعة', 'Paid') },
  CANCELLED:  { c: 'bg-surface-muted text-slate-500',  l: l('ملغاة', 'Cancelled') },
};
export function BrokerPayoutStatusBadge({ status, locale = 'ar' }: { status: BrokerPayoutStatus; locale?: Locale }) {
  const x = BROKER_PAYOUT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BROKER_COMMISSION: Record<BrokerCommissionStatus, { c: string; l: L }> = {
  PENDING:   { c: 'bg-warning-50 text-warning-700',  l: l('قيد المراجعة', 'Under Review') },
  APPROVED:  { c: 'bg-success-50 text-success-700',  l: l('موافق عليها', 'Approved') },
  REJECTED:  { c: 'bg-danger-50 text-danger-700',    l: l('مرفوضة', 'Rejected') },
  CANCELLED: { c: 'bg-surface-muted text-slate-500', l: l('ملغاة', 'Cancelled') },
};
export function BrokerCommissionStatusBadge({ status, locale = 'ar' }: { status: BrokerCommissionStatus; locale?: Locale }) {
  const x = BROKER_COMMISSION[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BROKER_USER: Record<BrokerUserStatus, { c: string; l: L }> = {
  INVITED:   { c: 'bg-info-50 text-info-700',        l: l('مدعو', 'Invited') },
  ACTIVE:    { c: 'bg-success-50 text-success-700',  l: l('نشط', 'Active') },
  SUSPENDED: { c: 'bg-warning-50 text-warning-700',  l: l('موقوف', 'Suspended') },
  REMOVED:   { c: 'bg-surface-muted text-slate-500', l: l('محذوف', 'Removed') },
};
export function BrokerUserStatusBadge({ status, locale = 'ar' }: { status: BrokerUserStatus; locale?: Locale }) {
  const x = BROKER_USER[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

const BOOKING_PAYMENT: Record<ReservationBookingPaymentStatus, { c: string; l: L }> = {
  UNPAID:  { c: 'bg-danger-50 text-danger-700',   l: l('غير مدفوع', 'Unpaid') },
  PENDING: { c: 'bg-warning-50 text-warning-700', l: l('بانتظار التأكيد', 'Pending Confirmation') },
  PAID:    { c: 'bg-success-50 text-success-700', l: l('مدفوع', 'Paid') },
  WAIVED:  { c: 'bg-slate-100 text-slate-500',    l: l('معفى', 'Waived') },
};
export function ReservationBookingPaymentBadge({
  status,
  locale = 'ar',
}: {
  status: ReservationBookingPaymentStatus;
  locale?: Locale;
}) {
  const x = BOOKING_PAYMENT[status];
  return <span className={`${PILL} ${x.c}`}>{x.l[locale]}</span>;
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Briefcase,
  Building2,
  UserCircle,
  CalendarRange,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Mail,
  Phone,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerLead, Paged, User } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  BrokerLeadStatusBadge,
  BrokerStatusBadge,
  LeadStageBadge,
} from '@/components/badges';
import {
  PremiumPageHero,
  PremiumSectionCard,
  PremiumDetailLayout,
} from '@/components/premium';
import {
  ApproveBrokerLeadForm,
  RejectBrokerLeadForm,
  MarkDuplicateBrokerLeadForm,
} from './_review-forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Activity helpers ────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  broker_submitted: 'تقديم الفرصة من الوسيط',
  broker_visit_requested: 'طلب زيارة ميدانية',
  broker_lead_approved: 'اعتماد الفرصة',
  broker_lead_rejected: 'رفض الفرصة',
  broker_lead_duplicate: 'تعليم الفرصة كمكررة',
  broker_commission_earned: 'عمولة مكتسبة للوسيط',
  broker_contract_created: 'إنشاء عقد من الفرصة',
  broker_contract_signed: 'توقيع عقد',
  visit: 'زيارة ميدانية',
  visit_scheduled: 'جدولة زيارة',
  visit_completed: 'إتمام زيارة',
  reservation: 'حجز وحدة',
  contract_created: 'إنشاء عقد',
  contract_signed: 'توقيع عقد',
  payment_received: 'استلام دفعة',
};

function activityLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type.replace(/_/g, ' ');
}

function activitySub(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.contractNumber) return `عقد: ${p.contractNumber}`;
  if (p.commissionNumber) return `عمولة: ${p.commissionNumber}`;
  if (p.clientName) return `العميل: ${p.clientName}`;
  if (p.salesName) return `المبيعات: ${p.salesName}`;
  if (p.status) return `الحالة: ${p.status}`;
  return null;
}

function activityDot(type: string): string {
  if (/approved|commission|contract|earned|signed/.test(type)) return 'bg-success-500';
  if (/rejected/.test(type)) return 'bg-danger-500';
  if (/duplicate/.test(type)) return 'bg-amber-500';
  if (/visit/.test(type)) return 'bg-sky-400';
  return 'bg-brand-400';
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function SideRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-[12px] font-medium text-slate-500 shrink-0">{label}</span>
      <span
        className="text-[13px] font-semibold text-slate-900 text-end truncate max-w-[55%]"
        dir={ltr ? 'ltr' : undefined}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

const TILE_BASE =
  'flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline min-w-0';
const TILE_ICON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AdminBrokerLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadRes, salesRes] = await Promise.all([
    safe(api.get<AdminBrokerLead>(`/broker-leads/${id}`)),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);
  if (leadRes.error || !leadRes.data) notFound();
  const lead = leadRes.data;
  const salesUsers = salesRes.data?.data ?? [];

  const canReview =
    lead.brokerApprovalStatus !== 'APPROVED' &&
    lead.brokerApprovalStatus !== 'REJECTED';

  const activities = lead.activities ?? [];

  return (
    <div className="space-y-5">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={lead.fullName}
        description={
          lead.broker
            ? `فرصة من وسيط: ${lead.broker.companyName}`
            : 'فرصة موجودة بدون انتماء لوسيط'
        }
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'فرص الوسطاء', href: '/dashboard/broker-leads' },
          { label: lead.fullName },
        ]}
        meta={
          <>
            {lead.brokerApprovalStatus && (
              <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
            )}
            <LeadStageBadge stage={lead.stage} />
            {lead.broker && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                {lead.broker.companyName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              {formatDate(lead.brokerSubmittedAt ?? lead.createdAt)}
            </span>
          </>
        }
        actions={
          <Link href="/dashboard/broker-leads">
            <Button variant="outline" size="md">العودة للقائمة</Button>
          </Link>
        }
      />

      {/* ── Detail layout ─────────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* معلومات العميل */}
            <PremiumSectionCard title="معلومات العميل" icon={<UserCircle />} padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow label="الاسم" value={lead.fullName} />
                <SideRow
                  label="تاريخ الإرسال"
                  value={formatDate(lead.brokerSubmittedAt ?? lead.createdAt)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 p-5 border-t border-hairline">
                <div className={TILE_BASE}>
                  <span className={`${TILE_ICON} bg-emerald-50 text-emerald-600`}><Phone /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">الجوال</p>
                    <p className="text-[12px] font-semibold text-slate-900 truncate" dir="ltr">
                      {lead.phone ?? '—'}
                    </p>
                  </div>
                </div>
                <div className={TILE_BASE}>
                  <span className={`${TILE_ICON} bg-brand-50 text-brand-600`}><Mail /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">البريد</p>
                    <p className="text-[12px] font-semibold text-slate-900 truncate" dir="ltr">
                      {lead.email ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* الوسيط */}
            <PremiumSectionCard title="الوسيط" icon={<Briefcase />} padded={false}>
              {lead.broker ? (
                <div className="divide-y divide-hairline">
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Link
                        href={`/dashboard/brokers/${lead.broker.id}` as never}
                        className="text-[14px] font-bold text-slate-900 hover:text-brand-700 transition-colors"
                      >
                        {lead.broker.companyName}
                      </Link>
                      <BrokerStatusBadge status={lead.broker.status} />
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 tracking-wide" dir="ltr">
                      {lead.broker.code}
                    </p>
                  </div>
                  {lead.brokerAgent && (
                    <>
                      <SideRow label="جهة الاتصال" value={lead.brokerAgent.fullName} />
                      {(lead.brokerAgent.email || lead.brokerAgent.phone) && (
                        <div className="px-5 py-3">
                          <div className={TILE_BASE}>
                            <span className={`${TILE_ICON} bg-brand-50 text-brand-600`}><Mail /></span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">التواصل</p>
                              <p className="text-[12px] font-semibold text-slate-900 truncate" dir="ltr">
                                {lead.brokerAgent.email ?? lead.brokerAgent.phone}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="px-5 py-4 text-[13px] text-slate-400">—</div>
              )}
            </PremiumSectionCard>

          </div>
        }
        side={
          <div className="space-y-5">

            {/* الاهتمام */}
            <PremiumSectionCard title="الاهتمام" icon={<Building2 />} padded={false}>
              <div className="divide-y divide-hairline">
                <SideRow
                  label="المشروع"
                  value={lead.projectInterest ? tx(lead.projectInterest.name) : '—'}
                />
                <SideRow
                  label="الوحدة"
                  value={
                    lead.unitInterest ? (
                      <span className="font-mono text-[12px]" dir="ltr">
                        {lead.unitInterest.code} • {lead.unitInterest.type}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <SideRow
                  label="المبيعات المعيّن"
                  value={lead.assignedSales?.fullName ?? '—'}
                />
              </div>
            </PremiumSectionCard>

            {/* السجل — in side column, fills the empty gap */}
            {activities.length > 0 && (
              <PremiumSectionCard
                title="السجل"
                icon={<Activity />}
                trailing={
                  <span className="text-xs text-slate-400 tabular-nums">{activities.length} حدث</span>
                }
                padded={false}
              >
                <ul className="divide-y divide-hairline">
                  {activities.slice(0, 15).map((a) => {
                    const label = activityLabel(a.type);
                    const sub = activitySub(a.payload);
                    return (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 px-5 py-3 hover:bg-canvas/40 transition-colors duration-100"
                      >
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${activityDot(a.type)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-slate-700 leading-snug">{label}</p>
                          {sub && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                            {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </PremiumSectionCard>
            )}

          </div>
        }
      />

      {/* ── Status banners ───────────────────────────────────────────── */}
      {lead.brokerApprovalStatus === 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-success-700">تم اعتماد هذه الفرصة</p>
            <p className="text-[12px] text-slate-600 mt-0.5">
              {lead.brokerApprovedAt
                ? `بتاريخ ${formatDate(lead.brokerApprovedAt)}`
                : 'الفرصة معتمدة وأصبحت ضمن مسار المبيعات.'}
              {lead.assignedSales?.fullName ? ` • المندوب: ${lead.assignedSales.fullName}` : ''}
            </p>
          </div>
        </div>
      )}

      {lead.brokerApprovalStatus === 'REJECTED' && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 px-5 py-4">
          <XCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-danger-700">تم رفض هذه الفرصة</p>
            {lead.brokerRejectionReason ? (
              <p className="text-[12px] text-slate-600 mt-0.5 whitespace-pre-wrap leading-relaxed">
                {lead.brokerRejectionReason}
              </p>
            ) : (
              <p className="text-[12px] text-slate-500 mt-0.5">لم يُسجَّل سبب للرفض.</p>
            )}
          </div>
        </div>
      )}

      {lead.brokerApprovalStatus === 'DUPLICATE' && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-700">تم تعليم هذه الفرصة كمكررة</p>
            <p className="text-[12px] text-slate-600 mt-0.5 whitespace-pre-wrap leading-relaxed">
              {lead.brokerRejectionReason ?? 'رقم الجوال موجود مسبقاً في النظام.'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              ما زال بإمكانك اعتماد أو رفض الفرصة من الأسفل إذا لزم الأمر.
            </p>
          </div>
        </div>
      )}

      {/* ── Review actions ───────────────────────────────────────────── */}
      {canReview && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3.5">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <p className="text-[12px] text-blue-800 leading-relaxed">
              اعتماد أو رفض الفرصة إجراءات حسّاسة تتطلب صلاحية مخصّصة
              (broker_leads:approve / broker_leads:reject). إذا لم تكن لديك
              الصلاحية، ستظهر رسالة توضيحية بدلاً من تنفيذ الإجراء.
            </p>
          </div>

          {/* Unified review card — equal-height columns, buttons pinned to bottom */}
          <PremiumSectionCard title="مراجعة الفرصة" icon={<ShieldCheck />} padded={false}>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-x-reverse divide-hairline">

              {/* اعتماد */}
              <div className="p-5 flex flex-col">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-success-600 mb-4 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  اعتماد
                </p>
                <ApproveBrokerLeadForm leadId={lead.id} salesUsers={salesUsers} />
              </div>

              {/* رفض */}
              <div className="p-5 flex flex-col">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-danger-600 mb-4 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  رفض
                </p>
                <RejectBrokerLeadForm leadId={lead.id} />
              </div>

              {/* تعليم كمكرر */}
              <div className="p-5 flex flex-col">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4 flex items-center gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  تعليم كمكرر
                </p>
                <MarkDuplicateBrokerLeadForm leadId={lead.id} />
              </div>

            </div>
          </PremiumSectionCard>
        </div>
      )}

    </div>
  );
}

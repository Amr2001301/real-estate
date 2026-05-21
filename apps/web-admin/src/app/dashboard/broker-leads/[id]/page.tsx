import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Briefcase,
  Mail,
  Phone,
  Building2,
  Home,
  UserCircle,
  CalendarRange,
  ChevronLeft,
  Info,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerLead, Paged, User } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BrokerLeadStatusBadge,
  BrokerStatusBadge,
  LeadStageBadge,
} from '@/components/badges';
import {
  ApproveBrokerLeadForm,
  RejectBrokerLeadForm,
  MarkDuplicateBrokerLeadForm,
} from './_review-forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5" dir={dir}>
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-5">
      <PageHeader
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
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                {lead.broker.companyName}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              {formatDate(lead.brokerSubmittedAt ?? lead.createdAt)}
            </span>
          </>
        }
        actions={
          <Link href="/dashboard/broker-leads">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">معلومات العميل</h2>
          <InfoRow icon={<UserCircle />} label="الاسم" value={lead.fullName} />
          <InfoRow icon={<Phone />} label="الجوال" value={lead.phone} dir="ltr" />
          <InfoRow icon={<Mail />} label="البريد" value={lead.email} dir="ltr" />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الإرسال"
            value={formatDate(lead.brokerSubmittedAt ?? lead.createdAt)}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            الوسيط
          </h2>
          {lead.broker ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/dashboard/brokers/${lead.broker.id}` as never}
                  className="font-semibold text-slate-900 hover:text-brand-700"
                >
                  {lead.broker.companyName}
                </Link>
                <BrokerStatusBadge status={lead.broker.status} />
              </div>
              <p className="text-2xs text-slate-500 font-mono mb-3" dir="ltr">
                {lead.broker.code}
              </p>
              {lead.brokerAgent && (
                <>
                  <p className="text-xs text-slate-500">جهة الاتصال</p>
                  <p className="text-sm text-slate-800 mt-0.5">
                    {lead.brokerAgent.fullName}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                    {lead.brokerAgent.email ?? lead.brokerAgent.phone ?? '—'}
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">الاهتمام</h2>
          <InfoRow
            icon={<Building2 />}
            label="المشروع"
            value={lead.projectInterest ? tx(lead.projectInterest.name) : '—'}
          />
          <InfoRow
            icon={<Home />}
            label="الوحدة"
            value={
              lead.unitInterest ? (
                <span className="font-mono" dir="ltr">
                  {lead.unitInterest.code} • {lead.unitInterest.type}
                </span>
              ) : (
                '—'
              )
            }
          />
          <InfoRow
            icon={<UserCircle />}
            label="المبيعات المعيّن"
            value={lead.assignedSales?.fullName ?? '—'}
          />
        </Card>
      </div>

      {/* Current review state — always shown so the admin sees where the
          lead stands before (or instead of) acting on it. */}
      {lead.brokerApprovalStatus === 'APPROVED' && (
        <Card className="p-5 bg-success-50/40 border-success-100">
          <h3 className="text-sm font-semibold text-success-700 mb-1">
            تم اعتماد هذه الفرصة
          </h3>
          <p className="text-sm text-slate-700">
            {lead.brokerApprovedAt
              ? `بتاريخ ${formatDate(lead.brokerApprovedAt)}`
              : 'الفرصة معتمدة وأصبحت ضمن مسار المبيعات.'}
            {lead.assignedSales?.fullName
              ? ` • المندوب: ${lead.assignedSales.fullName}`
              : ''}
          </p>
        </Card>
      )}

      {lead.brokerApprovalStatus === 'REJECTED' && (
        <Card className="p-5 bg-danger-50/40 border-danger-100">
          <h3 className="text-sm font-semibold text-danger-700 mb-2">
            تم رفض هذه الفرصة
          </h3>
          {lead.brokerRejectionReason ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {lead.brokerRejectionReason}
            </p>
          ) : (
            <p className="text-sm text-slate-500">لم يُسجَّل سبب للرفض.</p>
          )}
        </Card>
      )}

      {lead.brokerApprovalStatus === 'DUPLICATE' && (
        <Card className="p-5 bg-warning-50/40 border-warning-100">
          <h3 className="text-sm font-semibold text-warning-700 mb-1">
            تم تعليم هذه الفرصة كمكررة
          </h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {lead.brokerRejectionReason ?? 'رقم الجوال موجود مسبقاً في النظام.'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ما زال بإمكانك اعتماد أو رفض الفرصة من الأسفل إذا لزم الأمر.
          </p>
        </Card>
      )}

      {canReview && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-info-50/60 border border-info-100 text-info-700 p-3 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              اعتماد أو رفض الفرصة إجراءات حسّاسة تتطلب صلاحية مخصّصة
              (broker_leads:approve / broker_leads:reject). إذا لم تكن لديك
              الصلاحية، ستظهر رسالة توضيحية بدلاً من تنفيذ الإجراء.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">اعتماد</h3>
              <ApproveBrokerLeadForm leadId={lead.id} salesUsers={salesUsers} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">رفض</h3>
              <RejectBrokerLeadForm leadId={lead.id} />
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">تعليم كمكرر</h3>
              <MarkDuplicateBrokerLeadForm leadId={lead.id} />
            </Card>
          </div>
        </div>
      )}

      {lead.activities && lead.activities.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">السجل</h2>
          <ul className="divide-y divide-hairline">
            {lead.activities.slice(0, 20).map((a) => (
              <li key={a.id} className="py-2 text-xs flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-slate-700">{a.type}</p>
                  {a.payload && typeof a.payload === 'object' && Object.keys(a.payload).length > 0 && (
                    <p
                      className="mt-0.5 text-2xs text-slate-500 truncate max-w-xl"
                      dir="ltr"
                    >
                      {JSON.stringify(a.payload)}
                    </p>
                  )}
                </div>
                <span className="text-2xs text-slate-400 shrink-0">
                  {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Mail,
  Phone,
  Building2,
  Home,
  CalendarRange,
  CalendarClock,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalLead } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BrokerLeadStatusBadge,
  LeadStageBadge,
  AppointmentStatusBadge,
} from '@/components/badges';

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

export default async function PortalLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalLead>(`/portal/leads/${id}`));
  if (r.error || !r.data) notFound();
  const lead = r.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={lead.fullName}
        description={lead.brokerApprovalStatus === 'REJECTED' ? 'الفرصة مرفوضة من الإدارة.' : undefined}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص', href: '/portal/leads' },
          { label: lead.fullName },
        ]}
        meta={
          <>
            {lead.brokerApprovalStatus && (
              <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
            )}
            <LeadStageBadge stage={lead.stage} />
          </>
        }
        actions={
          <Link href="/portal/leads">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      {lead.brokerApprovalStatus === 'REJECTED' && lead.brokerRejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{lead.brokerRejectionReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">معلومات العميل</h2>
          <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={lead.email} dir="ltr" />
          <InfoRow icon={<Phone />} label="رقم الجوال" value={lead.phone} dir="ltr" />
          <InfoRow
            icon={<CalendarRange />}
            label="تاريخ الإرسال"
            value={formatDate(lead.brokerSubmittedAt ?? lead.createdAt)}
          />
          {lead.brokerApprovedAt && (
            <InfoRow
              icon={<CalendarRange />}
              label="تاريخ الموافقة"
              value={formatDate(lead.brokerApprovedAt)}
            />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">الاهتمام</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-hairline">
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
          </div>
        </Card>
      </div>

      {lead.appointments && lead.appointments.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            الزيارات المرتبطة
          </h2>
          <ul className="divide-y divide-hairline">
            {lead.appointments.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-700" dir="ltr">
                    {a.visitNumber}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateTime(a.scheduledAt)}
                  </p>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

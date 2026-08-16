import Link from 'next/link';
import { Phone, Mail, Building2, User, ExternalLink, AlertCircle, Activity } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, VisitRequest, VisitActivity, User as UserType } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { DataTable } from '@/components/table';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { VisitTimelineCard } from '../../_components/visit-timeline';
import { RequestDetailActions } from './_components/request-detail-actions';
import {
  PremiumPageHero,
  PremiumSectionCard,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';

interface VisitRequestDetail extends VisitRequest {
  visitActivities?: VisitActivity[];
}

export default async function VisitRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.visitsRequestDetail;

  const [reqRes, salesRes] = await Promise.all([
    safe(api.get<VisitRequestDetail>(`/visits/requests/${id}`)),
    safe(api.get<Paged<UserType>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
  ]);

  if (reqRes.error || !reqRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{m.loadError}{reqRes.error ?? m.notFound}</p>
      </div>
    );
  }

  const req          = reqRes.data;
  const salesOptions = salesRes.data?.data ?? [];
  const customerName  = req.customerName  ?? req.user?.fullName  ?? req.lead?.fullName  ?? '—';
  const customerPhone = req.customerPhone ?? req.user?.phone     ?? req.lead?.phone     ?? null;
  const customerEmail = req.customerEmail ?? req.user?.email     ?? req.lead?.email     ?? null;
  const activities: VisitActivity[] = req.visitActivities ?? [];

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={`${m.requestLabel} — ${req.requestNumber ?? req.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbVisits, href: '/dashboard/visits?tab=requests' },
          { label: req.requestNumber ?? m.requestLabel },
        ]}
        meta={
          req.requestStatus ? <VisitRequestStatusBadge status={req.requestStatus} /> : undefined
        }
        actions={
          <RequestDetailActions request={req} salesOptions={salesOptions} locale={locale} />
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: main content */}
        <div className="xl:col-span-2 space-y-5">

          {/* Request info */}
          <PremiumSectionCard title={m.cardRequestTitle}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">{m.fieldPreferredDate}</p>
                <p className="font-medium">{formatDate(req.preferredDate)}</p>
              </div>
              {req.preferredTime && (
                <div>
                  <p className="text-slate-500 mb-0.5">{m.fieldPreferredTime}</p>
                  <p className="font-medium">{req.preferredTime}</p>
                </div>
              )}
              {req.source && (
                <div>
                  <p className="text-slate-500 mb-0.5">{m.fieldSource}</p>
                  <p className="font-medium">{m.sourceLabels[req.source] ?? req.source}</p>
                </div>
              )}
              {req.preferredContactMethod && (
                <div>
                  <p className="text-slate-500 mb-0.5">{m.fieldPreferredContact}</p>
                  <p className="font-medium">{req.preferredContactMethod}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 mb-0.5">{m.fieldCreatedAt}</p>
                <p className="font-medium">{formatDateTime(req.createdAt)}</p>
              </div>
              {req.convertedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">{m.fieldConvertedAt}</p>
                  <p className="font-medium">{formatDateTime(req.convertedAt)}</p>
                </div>
              )}
              {(req.requestNotes ?? req.notes) && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">{m.fieldCustomerNotes}</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{req.requestNotes ?? req.notes}</p>
                </div>
              )}
              {req.adminNotes && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">{m.fieldAdminNotes}</p>
                  <p className="text-slate-700">{req.adminNotes}</p>
                </div>
              )}
            </div>
          </PremiumSectionCard>

          {/* Linked appointments */}
          {req.appointments && req.appointments.length > 0 && (
            <PremiumSectionCard title={m.cardAppointmentsTitle} padded={false}>
              <DataTable
                rowKey={(a) => a.id}
                rows={req.appointments}
                emptyMessage={m.appointmentsEmpty}
                columns={[
                  {
                    key: 'number',
                    header: m.colVisitNumber,
                    cell: (a) => (
                      <Link
                        href={`/dashboard/visits/appointments/${a.id}` as never}
                        className="font-mono text-xs text-brand-700 hover:underline"
                      >
                        {a.visitNumber}
                      </Link>
                    ),
                  },
                  { key: 'date',   header: m.colAppointment, cell: (a) => formatDateTime(a.scheduledAt) },
                  { key: 'sales',  header: m.colSalesRep,    cell: (a) => a.assignedSales?.fullName ?? '—' },
                  { key: 'status', header: m.colStatus,      cell: (a) => <AppointmentStatusBadge status={a.status} /> },
                ]}
              />
            </PremiumSectionCard>
          )}

          {/* Timeline */}
          <PremiumSectionCard icon={<Activity />} title={m.cardTimelineTitle}>
            <VisitTimelineCard activities={activities} locale={locale} />
          </PremiumSectionCard>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Customer card */}
          <PremiumSectionCard icon={<User />} title={m.cardCustomerTitle}>
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-slate-900 text-base">{customerName}</p>
              {customerPhone && (
                <a href={`tel:${customerPhone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{customerPhone}</span>
                </a>
              )}
              {customerEmail && (
                <a href={`mailto:${customerEmail}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                  <Mail className="h-4 w-4" />
                  <span dir="ltr">{customerEmail}</span>
                </a>
              )}
            </div>
          </PremiumSectionCard>

          {/* Lead/Client link */}
          {(req.lead || req.user) && (
            <PremiumSectionCard title={m.cardCrmTitle}>
              <div className="space-y-2 text-sm">
                {req.lead && (
                  <Link href={`/dashboard/leads/${req.leadId}` as never} className="flex items-center gap-2 text-brand-700 hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    {m.leadLinkPrefix}{req.lead.fullName}
                  </Link>
                )}
                {req.user && !req.lead && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {req.user.fullName}
                  </p>
                )}
              </div>
            </PremiumSectionCard>
          )}

          {/* Project/Unit card */}
          <PremiumSectionCard icon={<Building2 />} title={m.cardProjectTitle}>
            <div className="space-y-2 text-sm">
              <Link
                href={`/dashboard/projects/${req.projectId}` as never}
                className="font-medium text-brand-700 hover:underline"
              >
                {tx(req.project?.name)}
              </Link>
              {req.unit && (
                <p className="text-slate-600">
                  {m.unitLabel}: {req.unit.code} — {req.unit.type}
                </p>
              )}
            </div>
          </PremiumSectionCard>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Home, Clock, RefreshCw, Wrench, type LucideIcon } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { MeMaintenanceRequestDetail } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/states/ErrorState';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { MaintenanceTag } from '@/components/account/MaintenanceRequestCard';
import { MaintenanceResolution } from '@/components/account/MaintenanceResolution';
import { DocumentDownloadById } from '@/components/account/DocumentDownloadById';

/** Pristine micro-card stat: gold icon + label/value stack. */
function InfoCard({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-soft/50 p-4">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col text-right">
        <span className="text-[11px] font-bold text-ink-muted">{label}</span>
        <span
          className={`mt-0.5 text-xs font-extrabold text-ink-strong ${mono ? 'font-mono text-ink' : ''}`}
          dir="auto"
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export const metadata = buildMetadata({
  title: 'تفاصيل طلب الصيانة',
  description: 'تفاصيل طلب الصيانة في ديفورا.',
  robots: { index: false, follow: false },
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default async function AccountMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const locale = await getLocale();
  const m = siteT(locale).accountPages.maintenanceDetail;

  const backLink = (
    <Link
      href={routes.accountMaintenance}
      className="group inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-strong"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-surface transition-colors group-hover:border-gold-200 group-hover:bg-gold-50 group-hover:text-gold-600">
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
      {m.backLabel}
    </Link>
  );

  let req: MeMaintenanceRequestDetail;
  try {
    req = await authFetch<MeMaintenanceRequestDetail>(`/me/maintenance-requests/${id}`);
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        {backLink}
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
        <div className="flex justify-center">
          <ButtonLink href={routes.accountMaintenance} variant="outline" size="md">
            {m.backFromError}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const categoryName = req.category ? pickAr(req.category.name) : '';
  const unitLabel = req.unit ? `${unitTypeLabel(req.unit.type)} · ${req.unit.code}` : '—';

  return (
    <div className="space-y-6">
      {backLink}

      <PremiumCard className="p-6 sm:p-8">
        {/* Header — ticket meta (start) ⟷ status pills (end) */}
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <span className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-warning/10 p-3.5 text-warning ring-1 ring-warning/20">
              <Wrench className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-ink-strong">{m.requestPrefix} {categoryName || '—'}</h1>
              {req.description && <p className="mt-1 text-sm font-semibold text-ink-muted">{req.description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <MaintenanceTag status={req.status} />
            <MaintenanceTag status={req.reviewStatus} />
            {req.priority && <MaintenanceTag status={req.priority} />}
          </div>
        </div>

        {/* Details — architectural micro-card grid */}
        <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-3">
          <InfoCard icon={Home} label={m.unitLabel} value={unitLabel} />
          <InfoCard icon={Clock} label={m.createdLabel} value={formatDate(req.createdAt)} mono />
          <InfoCard icon={RefreshCw} label={m.updatedLabel} value={formatDate(req.updatedAt)} mono />
        </div>
      </PremiumCard>

      {/* Resolution loop — SLA/overdue, complaint, confirm + rating. */}
      <MaintenanceResolution request={req} />

      {/* Customer-visible documents — read/download only (upload is a later chunk) */}
      <PremiumCard className="p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink-strong">{m.attachmentsTitle}</h2>
        {req.documents.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{m.noAttachments}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {req.documents.map((doc) => (
              <li key={doc.id}>
                {/* Signed-download — Phase 7E. The customer-facing detail
                    endpoint no longer embeds `fileUrl`; the client mints a
                    short-lived signed URL just-in-time on click. */}
                <DocumentDownloadById documentId={doc.id} title={doc.title || doc.fileName || m.attachmentLabel} />
              </li>
            ))}
          </ul>
        )}
      </PremiumCard>
    </div>
  );
}

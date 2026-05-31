import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Home, Tag } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { MeMaintenanceRequestDetail } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/states/ErrorState';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { StatusBadge } from '@/components/account/StatusBadge';
import { DocumentDownloadById } from '@/components/account/DocumentDownloadById';

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

function BackLink() {
  return (
    <Link href={routes.accountMaintenance} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-500" >
      <ArrowRight className="h-4 w-4" aria-hidden />
      العودة إلى الصيانة
    </Link>
  );
}

export default async function AccountMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let req: MeMaintenanceRequestDetail;
  try {
    req = await authFetch<MeMaintenanceRequestDetail>(`/me/maintenance-requests/${id}`);
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState
          title="تعذّر العثور على طلب الصيانة"
          message="قد يكون الطلب غير موجود أو لا يخصّك. عُد إلى قائمة الصيانة وحاول مجددًا."
          className="mx-auto max-w-2xl"
        />
        <div className="flex justify-center">
          <ButtonLink href={routes.accountMaintenance} variant="outline" size="md">
            العودة إلى الصيانة
          </ButtonLink>
        </div>
      </div>
    );
  }

  const categoryName = req.category ? pickAr(req.category.name) : '';
  const unitLabel = req.unit ? `${unitTypeLabel(req.unit.type)} · ${req.unit.code}` : '—';

  return (
    <div className="space-y-6">
      <BackLink />

      <PremiumCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={req.status} />
          <StatusBadge status={req.reviewStatus} />
          {req.priority && <StatusBadge status={req.priority} />}
        </div>

        <h1 className="mt-4 text-2xl text-ink-strong">{categoryName || 'طلب صيانة'}</h1>
        <p className="mt-3 leading-relaxed text-ink-muted">{req.description}</p>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-hairline pt-5 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Home className="h-3.5 w-3.5 text-gold-500" aria-hidden /> الوحدة
            </div>
            <div className="mt-0.5 text-sm font-semibold text-ink-strong">{unitLabel}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Tag className="h-3.5 w-3.5 text-gold-500" aria-hidden /> الفئة
            </div>
            <div className="mt-0.5 text-sm font-semibold text-ink-strong">{categoryName || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">تاريخ الإنشاء</div>
            <div className="mt-0.5 text-sm font-semibold text-ink-strong">{formatDate(req.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">آخر تحديث</div>
            <div className="mt-0.5 text-sm font-semibold text-ink-strong">{formatDate(req.updatedAt)}</div>
          </div>
        </div>
      </PremiumCard>

      {/* Customer-visible documents — read/download only (upload is a later chunk) */}
      <PremiumCard className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink-strong">المرفقات</h2>
        {req.documents.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">لا توجد مرفقات متاحة لهذا الطلب.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {req.documents.map((doc) => (
              <li key={doc.id}>
                {/* Signed-download — Phase 7E. The customer-facing detail
                    endpoint no longer embeds `fileUrl`; the client mints a
                    short-lived signed URL just-in-time on click. */}
                <DocumentDownloadById documentId={doc.id} title={doc.title || doc.fileName || 'مرفق'} />
              </li>
            ))}
          </ul>
        )}
      </PremiumCard>
    </div>
  );
}

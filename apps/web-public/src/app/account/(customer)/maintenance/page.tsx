import { redirect } from 'next/navigation';
import { Wrench, Plus } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeMaintenanceRequest } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { MaintenanceRequestCard } from '@/components/account/MaintenanceRequestCard';

export const metadata = buildMetadata({
  title: 'الصيانة',
  description: 'طلبات الصيانة الخاصة بك في ديفورا.',
  robots: { index: false, follow: false },
});

const PAGE_SIZE = 10;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function Header() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl text-ink-strong">الصيانة</h1>
        <p className="mt-1.5 text-sm text-ink-muted">تابع حالة طلبات الصيانة الخاصة بوحداتك.</p>
      </div>
      <ButtonLink href={routes.accountMaintenanceNew} variant="primary" size="md">
        <Plus className="h-5 w-5" aria-hidden />
        طلب صيانة جديد
      </ButtonLink>
    </div>
  );
}

export default async function AccountMaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  let result: Paginated<MeMaintenanceRequest>;
  try {
    result = await authFetch<Paginated<MeMaintenanceRequest>>(
      `/me/maintenance-requests?page=${page}&pageSize=${PAGE_SIZE}`,
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <Header />
        <ErrorState
          title="تعذّر تحميل طلبات الصيانة حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const requests = result.data;
  const meta = result.meta;

  const buildHref = (nextPage: number): string =>
    nextPage > 1 ? `${routes.accountMaintenance}?page=${nextPage}` : routes.accountMaintenance;

  return (
    <div className="space-y-6">
      <Header />

      {requests.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات صيانة بعد"
          message="أنشئ طلب صيانة لإحدى وحداتك وسيتابعه فريقنا."
          icon={<Wrench className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountMaintenanceNew} variant="primary" size="md">
              <Plus className="h-5 w-5" aria-hidden />
              طلب صيانة جديد
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((request) => (
              <MaintenanceRequestCard key={request.id} request={request} />
            ))}
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

import { redirect } from 'next/navigation';
import { Wrench, Plus } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeMaintenanceRequest } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { MaintenanceRequestCard } from '@/components/account/MaintenanceRequestCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

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

export default async function AccountMaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const locale = await getLocale();
  const m = siteT(locale).accountPages.maintenance;

  const header = (
    <AccountPageHeader
      title={m.title}
      description={m.description}
      actions={
        <ButtonLink
          href={routes.accountMaintenanceNew}
          variant="primary"
          size="sm"
          className="h-auto rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {m.newRequest}
        </ButtonLink>
      }
    />
  );

  let result: Paginated<MeMaintenanceRequest>;
  try {
    result = await authFetch<Paginated<MeMaintenanceRequest>>(
      `/me/maintenance-requests?page=${page}&pageSize=${PAGE_SIZE}`,
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        {header}
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
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
    <div className="space-y-8">
      {header}

      {requests.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<Wrench className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountMaintenanceNew} variant="primary" size="md">
              <Plus className="h-5 w-5" aria-hidden />
              {m.newRequest}
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

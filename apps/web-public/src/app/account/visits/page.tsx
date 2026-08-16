import { redirect } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeVisitRequest } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { VisitRequestCard } from '@/components/account/VisitRequestCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'الزيارات',
  description: 'طلبات الزيارة الخاصة بك في ديفورا.',
  robots: { index: false, follow: false },
});

const PAGE_SIZE = 10;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AccountVisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const locale = await getLocale();
  const m = siteT(locale).accountPages.visits;

  const header = (
    <AccountPageHeader
      title={m.title}
      description={m.description}
    />
  );

  let result: Paginated<MeVisitRequest>;
  try {
    result = await authFetch<Paginated<MeVisitRequest>>(
      `/me/visit-requests?page=${page}&pageSize=${PAGE_SIZE}`,
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

  const visits = result.data;
  const meta = result.meta;

  const buildHref = (nextPage: number): string =>
    nextPage > 1 ? `${routes.accountVisits}?page=${nextPage}` : routes.accountVisits;

  return (
    <div className="space-y-8">
      {header}

      {visits.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.projects} variant="primary" size="md">
                {m.browseProjects}
              </ButtonLink>
              <ButtonLink href={routes.units} variant="outline" size="md">
                {m.exploreUnits}
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {visits.map((visit) => (
              <VisitRequestCard key={visit.id} visit={visit} />
            ))}
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeContract } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { PropertyCard } from '@/components/account/PropertyCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { OwnedProjectsProgress } from '@/components/account/OwnedProjectsProgress';
import { UnitValueCard, type UnitValueItem } from '@/components/account/UnitValueCard';
import { getSiteCurrency } from '@/lib/site-currency';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import type { PublicProjectDetail } from '@/lib/api-types';

export async function generateMetadata() {
  return pageMeta('property', { robots: { index: false, follow: false } });
}

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AccountPropertyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const locale = await getLocale();
  const m = siteT(locale).accountPages.property;

  const header = (
    <AccountPageHeader
      title={m.title}
      description={m.description}
    />
  );

  // "My property" is derived from contracts (each contract = an owned unit);
  // there is no dedicated /me/property endpoint.
  let result: Paginated<MeContract>;
  try {
    result = await authFetch<Paginated<MeContract>>(
      `/contracts/me/contracts?page=${page}&pageSize=${PAGE_SIZE}`,
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

  const contracts = result.data;
  const meta = result.meta;

  // The construction progress of the projects these units are in, from each
  // project's public page data (a project that is not published is skipped).
  const projectIds = [...new Set(contracts.map((c) => c.unit?.building?.phase?.project?.id).filter((id): id is string => !!id))];
  // «قيمة وحدتك» — only what the company chose to show (off by default).
  const [unitValues, currency] = await Promise.all([
    authFetch<{ enabled: boolean; items: UnitValueItem[] }>('/me/unit-values').catch(() => ({ enabled: false, items: [] })),
    getSiteCurrency(),
  ]);
  const tenant = projectIds.length > 0 ? await getResolvedTenant() : null;
  const ownedProjects = tenant
    ? (
        await Promise.all(
          projectIds.map((id) => apiFetch<PublicProjectDetail>(`/public/projects/${id}`, { revalidate: 60, tenantSlug: tenant.slug })),
        )
      ).flatMap((r) => (r.ok ? [r.data] : []))
    : [];

  const buildHref = (nextPage: number): string =>
    nextPage > 1 ? `${routes.accountProperty}?page=${nextPage}` : routes.accountProperty;

  return (
    <div className="space-y-8">
      {header}

      {contracts.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<Building2 className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              {m.backToDashboard}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <UnitValueCard items={unitValues.items} currency={currency} locale={locale} />
          <OwnedProjectsProgress projects={ownedProjects} locale={locale} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {contracts.map((contract) => (
              <PropertyCard key={contract.id} contract={contract} />
            ))}
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

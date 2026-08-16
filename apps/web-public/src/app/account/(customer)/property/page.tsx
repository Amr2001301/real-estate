import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
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

export const metadata = buildMetadata({
  title: 'عقاراتي',
  description: 'الوحدات التي تملكها في ديفورا.',
  robots: { index: false, follow: false },
});

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

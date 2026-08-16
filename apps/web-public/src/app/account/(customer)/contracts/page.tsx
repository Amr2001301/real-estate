import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
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
import { ContractCard } from '@/components/account/ContractCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'العقود',
  description: 'عقودك في ديفورا.',
  robots: { index: false, follow: false },
});

const PAGE_SIZE = 10;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AccountContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const locale = await getLocale();
  const m = siteT(locale).accountPages.contracts;

  const header = (
    <AccountPageHeader
      title={m.title}
      description={m.description}
    />
  );

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
    nextPage > 1 ? `${routes.accountContracts}?page=${nextPage}` : routes.accountContracts;

  return (
    <div className="space-y-8">
      {header}

      {contracts.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<FileText className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              {m.backToDashboard}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {contracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

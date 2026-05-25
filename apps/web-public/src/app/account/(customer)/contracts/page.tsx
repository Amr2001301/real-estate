import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeContract } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { ContractCard } from '@/components/account/ContractCard';

export const metadata = buildMetadata({
  title: 'العقود',
  description: 'عقودك في دار الفخامة.',
  robots: { index: false, follow: false },
});

const PAGE_SIZE = 10;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl text-ink-strong">العقود</h1>
      <p className="mt-1.5 text-sm text-ink-muted">عقودك المسجّلة، مع إمكانية تحميل نسخة PDF عند توفرها.</p>
    </div>
  );
}

export default async function AccountContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  let result: Paginated<MeContract>;
  try {
    result = await authFetch<Paginated<MeContract>>(
      `/contracts/me/contracts?page=${page}&pageSize=${PAGE_SIZE}`,
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-6">
        <Header />
        <ErrorState
          title="تعذّر تحميل العقود حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
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
    <div className="space-y-6">
      <Header />

      {contracts.length === 0 ? (
        <EmptyState
          title="لا توجد عقود بعد"
          message="ستظهر هنا العقود التي يرفعها فريقنا بعد إتمام إجراءات الشراء."
          icon={<FileText className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              العودة إلى لوحة الحساب
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

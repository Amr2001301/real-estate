import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeContract } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { PropertyCard } from '@/components/account/PropertyCard';

export const metadata = buildMetadata({
  title: 'عقاراتي',
  description: 'الوحدات التي تملكها في دار الفخامة.',
  robots: { index: false, follow: false },
});

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl text-ink-strong">عقاراتي</h1>
      <p className="mt-1.5 text-sm text-ink-muted">الوحدات التي تملكها، مع روابط العقد وطلب الصيانة.</p>
    </div>
  );
}

export default async function AccountPropertyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

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
      <div className="space-y-6">
        <Header />
        <ErrorState
          title="تعذّر تحميل عقاراتك حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
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
    <div className="space-y-6">
      <Header />

      {contracts.length === 0 ? (
        <EmptyState
          title="لا توجد عقارات مسجّلة بعد"
          message="ستظهر هنا وحداتك بعد إتمام إجراءات الشراء وتسجيل العقد من فريقنا."
          icon={<Building2 className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              العودة إلى لوحة الحساب
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

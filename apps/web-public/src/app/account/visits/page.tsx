import { redirect } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
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

function Header() {
  return (
    <AccountPageHeader
      eyebrow="متابعة"
      title="الزيارات"
      description="تابع حالة طلبات الزيارة الخاصة بك ومواعيدها."
    />
  );
}

export default async function AccountVisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  let result: Paginated<MeVisitRequest>;
  try {
    result = await authFetch<Paginated<MeVisitRequest>>(
      `/me/visit-requests?page=${page}&pageSize=${PAGE_SIZE}`,
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل الزيارات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
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
      <Header />

      {visits.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات زيارة بعد"
          message="تصفّح المشاريع والوحدات واطلب زيارة لما يهمّك، وستظهر هنا لمتابعتها."
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.projects} variant="primary" size="md">
                تصفّح المشاريع
              </ButtonLink>
              <ButtonLink href={routes.units} variant="outline" size="md">
                استكشف الوحدات
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
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

import { redirect } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { Paginated, MeInfoRequest } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Pagination } from '@/components/projects/Pagination';
import { InfoRequestCard } from '@/components/account/InfoRequestCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'الطلبات',
  description: 'استفساراتك وطلبات المعلومات في ديفورا.',
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
      title="طلبات الاستفسار"
      description={
        <>
          رسائل الاستفسار التي أرسلتها فقط — طلبات الزيارة تظهر في{' '}
          <a
            href={routes.accountVisits}
            className="font-medium text-gold-600 underline decoration-gold-300 underline-offset-2 hover:text-gold-500"
          >
            صفحة الزيارات
          </a>
          .
        </>
      }
    />
  );
}

export default async function AccountRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  let result: Paginated<MeInfoRequest>;
  try {
    result = await authFetch<Paginated<MeInfoRequest>>(
      `/me/info-requests?page=${page}&pageSize=${PAGE_SIZE}`,
    );
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل الطلبات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const requests = result.data;
  const meta = result.meta;

  const buildHref = (nextPage: number): string =>
    nextPage > 1 ? `${routes.accountRequests}?page=${nextPage}` : routes.accountRequests;

  return (
    <div className="space-y-8">
      <Header />

      {requests.length === 0 ? (
        <EmptyState
          title="لا توجد رسائل استفسار بعد"
          message="تصفّح المشاريع والوحدات وأرسل استفسارك، وستظهر هنا. إن كنت تبحث عن طلبات زيارة، انتقل إلى صفحة الزيارات."
          icon={<MessageSquareText className="h-6 w-6" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={routes.accountVisits} variant="primary" size="md">
                عرض طلبات الزيارة
              </ButtonLink>
              <ButtonLink href={routes.projects} variant="outline" size="md">
                تصفّح المشاريع
              </ButtonLink>
              <ButtonLink href={routes.contact} variant="ghost" size="md">
                تواصل معنا
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((req) => (
              <InfoRequestCard key={req.id} request={req} />
            ))}
          </div>
          <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

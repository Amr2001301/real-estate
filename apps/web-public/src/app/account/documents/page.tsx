import { redirect } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import type { MeDocument } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { DocumentList } from '@/components/account/DocumentList';

export const metadata = buildMetadata({
  title: 'مستنداتي',
  description: 'جميع مستنداتك وملفاتك في ديفورا.',
  robots: { index: false, follow: false },
});

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AccountDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = firstStr(sp.type) || 'all';

  let documents: MeDocument[];
  try {
    documents = await authFetch<MeDocument[]>('/me/documents/all');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader
          title="مستنداتي"
          description="جميع مستنداتك وملفاتك في مكان واحد."
        />
        <ErrorState
          title="تعذّر تحميل المستندات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const filtered =
    filter === 'all'
      ? documents
      : documents.filter((d) => d.ownerType === filter);

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title="مستنداتي"
        description="جميع عقودك وإيصالات الدفع وملفاتك في مكان واحد."
      />

      {documents.length === 0 ? (
        <EmptyState
          title="لا توجد مستندات بعد"
          message="ستظهر هنا مستنداتك (العقود، الإيصالات، تقارير الصيانة) بمجرد رفعها من قِبل فريقنا."
          icon={<FolderOpen className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              العودة إلى لوحة الحساب
            </ButtonLink>
          }
        />
      ) : (
        <DocumentList documents={filtered} all={documents} activeFilter={filter} />
      )}
    </div>
  );
}

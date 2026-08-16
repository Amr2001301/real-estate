import { redirect } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
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

  const locale = await getLocale();
  const m = siteT(locale).accountPages.documents;

  let documents: MeDocument[];
  try {
    documents = await authFetch<MeDocument[]>('/me/documents/all');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <AccountPageHeader
          title={m.title}
          description={m.description}
        />
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
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
        title={m.title}
        description={m.sectionTitle}
      />

      {documents.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<FolderOpen className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              {m.backToDashboard}
            </ButtonLink>
          }
        />
      ) : (
        <DocumentList documents={filtered} all={documents} activeFilter={filter} locale={locale} />
      )}
    </div>
  );
}

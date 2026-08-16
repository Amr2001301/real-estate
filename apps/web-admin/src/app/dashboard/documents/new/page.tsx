import Link from 'next/link';
import { ChevronLeft, FileText } from 'lucide-react';
import type { DocumentCategory, DocumentOwnerType } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { PremiumPageHero } from '@/components/premium';
import { NewDocumentForm } from './_form';

interface Search {
  ownerType?: string;
  ownerId?: string;
  category?: string;
}

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [sp, locale] = await Promise.all([searchParams, getLocale()]);
  const m = uiT(locale);
  const n = m.pages.documentsNew;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={n.title}
        description={n.description}
        breadcrumbs={[
          { label: m.common.breadcrumbHome, href: '/dashboard' },
          { label: m.nav.items.documents, href: '/dashboard/documents' },
          { label: n.breadcrumb },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <FileText className="h-3.5 w-3.5" />
            {n.badge}
          </span>
        }
        actions={
          <Link href="/dashboard/documents">
            <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              {n.backBtn}
            </Button>
          </Link>
        }
      />

      <NewDocumentForm
        initialOwnerType={(sp.ownerType as DocumentOwnerType) ?? ''}
        initialOwnerId={sp.ownerId ?? ''}
        initialCategory={(sp.category as DocumentCategory) ?? 'OTHER'}
        locale={locale}
      />
    </div>
  );
}

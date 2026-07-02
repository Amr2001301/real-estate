import Link from 'next/link';
import { ChevronLeft, FileText } from 'lucide-react';
import type { DocumentCategory, DocumentOwnerType } from '@/lib/types';
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
  const sp = await searchParams;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="إضافة مستند جديد"
        description="ارفع ملفًا مباشرة، أو ألصق رابطًا لملف موجود على الإنترنت. الرفع يتم عبر تخزين آمن بصلاحية مؤقتة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستندات', href: '/dashboard/documents' },
          { label: 'إضافة مستند' },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <FileText className="h-3.5 w-3.5" />
            مستند جديد
          </span>
        }
        actions={
          <Link href="/dashboard/documents">
            <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <NewDocumentForm
        initialOwnerType={(sp.ownerType as DocumentOwnerType) ?? ''}
        initialOwnerId={sp.ownerId ?? ''}
        initialCategory={(sp.category as DocumentCategory) ?? 'OTHER'}
      />
    </div>
  );
}

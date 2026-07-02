import Link from 'next/link';
import { ExternalLink, FileText, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { DocumentItem, DocumentOwnerType, Paged } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABEL, formatFileSize } from './labels';

interface Props {
  ownerType: DocumentOwnerType;
  ownerId: string;
  /** Legacy URL fields surfaced as "existing linked documents". */
  legacy?: Array<{
    label: string;
    href: string;
    /** Optional sub-label for context, e.g. "PDF". */
    hint?: string;
  }>;
  /** Heading override; defaults to "المستندات". */
  title?: string;
  /** How many recent docs to show; defaults to 5. */
  limit?: number;
}

/**
 * Compact documents widget used on entity detail pages (broker, contract,
 * payout, etc.). Lists up to `limit` documents tied to (ownerType, ownerId)
 * and offers an "add document" button prefilled with the owner.
 */
export async function OwnerDocumentsCard({ ownerType, ownerId, legacy, title = 'المستندات', limit = 5 }: Props) {
  const qs = new URLSearchParams({
    ownerType,
    ownerId,
    pageSize: String(limit),
  });
  const res = await safe(api.get<Paged<DocumentItem>>(`/documents?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const total = res.data?.meta.total ?? items.length;

  const newDocHref = `/dashboard/documents/new?ownerType=${ownerType}&ownerId=${ownerId}`;
  const listHref = `/dashboard/documents?ownerType=${ownerType}&ownerId=${ownerId}`;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-2xs text-slate-500 ms-auto">{total} مستند</span>
      </div>

      {legacy && legacy.length > 0 && (
        <ul className="border-t border-hairline divide-y divide-hairline">
          {legacy.map((l) => (
            <li key={l.href} className="px-5 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{l.label}</p>
                {l.hint && <p className="text-2xs text-slate-500 mt-0.5">{l.hint}</p>}
              </div>
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                  فتح
                </Button>
              </a>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <div className="px-5 py-4 text-2xs text-slate-500">
          {legacy && legacy.length > 0
            ? 'لا توجد مستندات إضافية محفوظة في مركز المستندات.'
            : 'لا توجد مستندات بعد. استخدم زر «إضافة مستند» أدناه.'}
        </div>
      ) : (
        <ul className="border-t border-hairline divide-y divide-hairline">
          {items.map((d) => (
            <li key={d.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate max-w-xs">
                  {d.title}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  {CATEGORY_LABEL[d.category]} • {formatFileSize(d.sizeBytes)} • {formatDateTime(d.createdAt)}
                </p>
              </div>
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                  فتح
                </Button>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="px-5 py-3 border-t border-hairline flex items-center gap-2 justify-end bg-surface-muted/30">
        {total > items.length && (
          <Link href={listHref}>
            <Button variant="ghost" size="sm">عرض كل المستندات</Button>
          </Link>
        )}
        <Link href={newDocHref}>
          <Button variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
            إضافة مستند
          </Button>
        </Link>
      </div>
    </Card>
  );
}

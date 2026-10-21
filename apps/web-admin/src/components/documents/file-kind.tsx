import { cn } from '@/lib/cn';

/** The kind of a stored file, from its MIME type or, failing that, its extension. */
export type FileKind = 'pdf' | 'image' | 'doc' | 'sheet' | 'file';

export function fileKind(mimeType: string | null | undefined, fileName: string | null | undefined): FileKind {
  const mime = (mimeType ?? '').toLowerCase();
  const ext = (fileName ?? '').toLowerCase().split('.').pop() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (mime.includes('word') || ['doc', 'docx'].includes(ext)) return 'doc';
  if (mime.includes('sheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  return 'file';
}

const KIND: Record<FileKind, { label: string; tone: string }> = {
  pdf:   { label: 'PDF', tone: 'bg-rose-500/12 text-rose-500 ring-rose-500/25' },
  image: { label: 'IMG', tone: 'bg-sky-500/12 text-sky-600 ring-sky-500/25' },
  doc:   { label: 'DOC', tone: 'bg-indigo-500/12 text-indigo-500 ring-indigo-500/25' },
  sheet: { label: 'XLS', tone: 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/25' },
  file:  { label: 'FILE', tone: 'bg-slate-500/12 text-slate-500 ring-slate-500/25' },
};

/** A small folded-corner tile naming the file's kind (PDF, IMG, …). */
export function FileKindTile({ kind, size = 'md' }: { kind: FileKind; size?: 'md' | 'lg' }) {
  const k = KIND[kind];
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-end justify-center rounded-xl pb-1.5 font-bold tracking-wide ring-1 ring-inset',
        k.tone,
        size === 'md' ? 'h-11 w-9 text-[9.5px]' : 'h-20 w-16 pb-3 text-[13px]',
      )}
    >
      <span className={cn('absolute end-0 top-0 rounded-bl-lg rounded-tr-xl bg-current opacity-25', size === 'md' ? 'h-2.5 w-2.5' : 'h-4 w-4')} />
      {k.label}
    </span>
  );
}

'use client';

import Link from 'next/link';
import {
  UserPlus,
  BookmarkCheck,
  FileText,
  CalendarCheck2,
  Wrench,
  Banknote,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { CodeText } from '@/components/ui/code-text';

export interface ActivityRow {
  id:      string;
  user:    string;
  action:  string;
  entity:  string;
  time:    string;
  href?:   string;
  type?:   string;
}

interface Props {
  rows:       ActivityRow[];
  className?: string;
  compact?:   boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

type TypeMeta = { icon: React.ReactNode; bg: string; badge: string; border: string };

const TYPE_META: Record<string, TypeMeta> = {
  lead:         { icon: <UserPlus />,       bg: 'bg-purple-50 text-purple-600',   badge: 'bg-purple-50 text-purple-700',   border: 'border-purple-100'  },
  reservation:  { icon: <BookmarkCheck />,  bg: 'bg-success-50 text-success-600', badge: 'bg-success-50 text-success-700', border: 'border-success-100' },
  contract:     { icon: <FileText />,       bg: 'bg-brand-50 text-brand-600',     badge: 'bg-brand-50 text-brand-700',     border: 'border-brand-100'   },
  visit:        { icon: <CalendarCheck2 />, bg: 'bg-info-50 text-info-600',       badge: 'bg-info-50 text-info-700',       border: 'border-info-100'    },
  maintenance:  { icon: <Wrench />,         bg: 'bg-danger-50 text-danger-600',   badge: 'bg-danger-50 text-danger-700',   border: 'border-danger-100'  },
  deposit:      { icon: <Banknote />,       bg: 'bg-amber-50 text-amber-600',     badge: 'bg-amber-50 text-amber-700',     border: 'border-amber-100'   },
  info_request: { icon: <MessageSquare />,  bg: 'bg-slate-100 text-slate-500',    badge: 'bg-slate-100 text-slate-600',    border: 'border-slate-200'   },
};
const FALLBACK_META: TypeMeta = {
  icon:   <MessageSquare />,
  bg:     'bg-slate-100 text-slate-500',
  badge:  'bg-slate-100 text-slate-600',
  border: 'border-slate-200',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

function paletteFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function isCode(s: string): boolean {
  return /^[A-Z0-9#\-\/]{3,}$/.test(s.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityTable({ rows, className, compact = false }: Props) {
  const router = useRouter();

  /* ── Compact mode: premium activity feed ── */
  if (compact) {
    return (
      <div className={cn('divide-y divide-hairline', className)}>
        {rows.map((r) => {
          const meta         = TYPE_META[r.type ?? ''] ?? FALLBACK_META;
          const hasEntity    = r.entity !== '—';
          const entityIsCode = hasEntity && isCode(r.entity);

          const rowContent = (
            <>
              {/* Type icon — colored, h-8 w-8 */}
              <span
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
                  meta.bg,
                )}
              >
                {meta.icon}
              </span>

              {/* Actor avatar */}
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] shrink-0',
                  paletteFor(r.user),
                )}
              >
                {firstLetter(r.user)}
              </span>

              {/* Sentence: actor + action badge + entity */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 shrink-0 leading-none">
                  {r.user}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center h-[17px] px-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0',
                    meta.badge,
                  )}
                >
                  {r.action}
                </span>
                {hasEntity && (
                  entityIsCode
                    ? <CodeText className="text-[10px] text-slate-500 shrink-0">{r.entity}</CodeText>
                    : <span className="text-2xs text-slate-500 truncate">{r.entity}</span>
                )}
              </div>

              {/* Relative time */}
              <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                {r.time}
              </span>
            </>
          );

          const rowCn = cn(
            'flex items-center gap-2.5 px-4 py-3 transition-colors border-s-2',
            meta.border,
          );

          if (r.href) {
            return (
              <Link
                key={r.id}
                href={r.href as never}
                className={cn(rowCn, 'hover:bg-slate-50/80 group')}
              >
                {rowContent}
                <ChevronLeft className="h-3 w-3 text-slate-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            );
          }
          return (
            <div key={r.id} className={rowCn}>
              {rowContent}
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Default mode: full table ── */
  return (
    <div className={cn('w-full overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-slate-400 border-b border-hairline">
            <th className="text-start font-semibold py-2 pe-4">المستخدم</th>
            <th className="text-start font-semibold py-2 pe-4">الإجراء</th>
            <th className="text-start font-semibold py-2 pe-4">المرجع</th>
            <th className="text-start font-semibold py-2">الوقت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = TYPE_META[r.type ?? ''] ?? FALLBACK_META;
            return (
              <tr
                key={r.id}
                className={cn(
                  'border-t border-hairline transition-colors duration-100',
                  r.href && 'cursor-pointer hover:bg-brand-50/40',
                )}
                onClick={r.href ? () => router.push(r.href!) : undefined}
                tabIndex={r.href ? 0 : undefined}
                onKeyDown={r.href ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(r.href!);
                  }
                } : undefined}
              >
                <td className="py-3 pe-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs shrink-0',
                        paletteFor(r.user),
                      )}
                    >
                      {firstLetter(r.user)}
                    </span>
                    <span className="font-medium text-slate-900 text-xs">{r.user}</span>
                  </div>
                </td>
                <td className="py-3 pe-4">
                  <span
                    className={cn(
                      'inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold whitespace-nowrap',
                      meta.badge,
                    )}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="py-3 pe-4 text-slate-500 text-xs font-medium tabular-nums">
                  {r.entity !== '—' && isCode(r.entity)
                    ? <CodeText>{r.entity}</CodeText>
                    : r.entity
                  }
                </td>
                <td className="py-3 text-slate-400 text-2xs whitespace-nowrap">{r.time}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

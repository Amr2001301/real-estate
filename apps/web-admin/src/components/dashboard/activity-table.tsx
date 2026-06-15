'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface ActivityRow {
  id: string;
  user: string;
  action: string;
  entity: string;
  time: string;
  href?: string;
  type?: string;
}

interface Props {
  rows: ActivityRow[];
  className?: string;
  compact?: boolean;
}

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

const TYPE_BADGE: Record<string, string> = {
  reservation: 'bg-emerald-50 text-emerald-700',
  deposit:     'bg-amber-50 text-amber-700',
  contract:    'bg-brand-50 text-brand-700',
  lead:        'bg-purple-50 text-purple-700',
  maintenance: 'bg-danger-50 text-danger-700',
};

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

function paletteFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function ActivityTable({ rows, className, compact = false }: Props) {
  const router = useRouter();

  /* ── Compact mode: feed list (no stretched table columns) ── */
  if (compact) {
    return (
      <div className={cn('divide-y divide-hairline', className)}>
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn(
              'flex items-center gap-3 py-2 transition-colors duration-100 -mx-5 px-5',
              r.href && 'cursor-pointer hover:bg-brand-50/40',
            )}
            onClick={r.href ? () => router.push(r.href!) : undefined}
            role={r.href ? 'button' : undefined}
            tabIndex={r.href ? 0 : undefined}
            onKeyDown={r.href ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(r.href!);
              }
            } : undefined}
          >
            {/* Avatar */}
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] shrink-0',
                paletteFor(r.user),
              )}
            >
              {firstLetter(r.user)}
            </span>

            {/* Name + badge + reference */}
            <div className="flex flex-1 min-w-0 items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-900 shrink-0 leading-none">
                {r.user}
              </span>
              <span
                className={cn(
                  'inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0',
                  TYPE_BADGE[r.type ?? ''] ?? 'bg-slate-100 text-slate-600',
                )}
              >
                {r.action}
              </span>
              {r.entity !== '—' && (
                <span className="text-[10px] text-slate-400 font-medium tabular-nums truncate">
                  {r.entity}
                </span>
              )}
            </div>

            {/* Time */}
            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
              {r.time}
            </span>
          </div>
        ))}
      </div>
    );
  }

  /* ── Default mode: full table ── */
  const rowPy = 'py-3';
  const avSize = 'h-8 w-8 text-xs';

  return (
    <div className={cn('w-full overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="text-start font-semibold py-2 pe-4">المستخدم</th>
            <th className="text-start font-semibold py-2 pe-4">الإجراء</th>
            <th className="text-start font-semibold py-2 pe-4">المرجع</th>
            <th className="text-start font-semibold py-2">الوقت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
              <td className={cn(rowPy, 'pe-4')}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-full font-bold shrink-0',
                      avSize,
                      paletteFor(r.user),
                    )}
                  >
                    {firstLetter(r.user)}
                  </span>
                  <span className="font-medium text-slate-900 text-xs leading-snug">{r.user}</span>
                </div>
              </td>
              <td className={cn(rowPy, 'pe-4')}>
                <span
                  className={cn(
                    'inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold whitespace-nowrap',
                    TYPE_BADGE[r.type ?? ''] ?? 'bg-slate-100 text-slate-600',
                  )}
                >
                  {r.action}
                </span>
              </td>
              <td className={cn(rowPy, 'pe-4 text-slate-500 text-xs font-medium tabular-nums')}>{r.entity}</td>
              <td className={cn(rowPy, 'text-slate-400 text-2xs whitespace-nowrap')}>{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

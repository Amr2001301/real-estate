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
}

interface Props {
  rows: ActivityRow[];
  className?: string;
}

const PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-purple-50 text-purple-700',
  'bg-accent-50 text-accent-700',
  'bg-warning-50 text-warning-700',
];

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

function paletteFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function ActivityTable({ rows, className }: Props) {
  const router = useRouter();

  return (
    <div className={cn('w-full overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="text-start font-semibold py-2 pe-4">المستخدم</th>
            <th className="text-start font-semibold py-2 pe-4">الإجراء</th>
            <th className="text-start font-semibold py-2 pe-4">العقار</th>
            <th className="text-start font-semibold py-2">التاريخ</th>
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
              <td className="py-3 pe-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0',
                      paletteFor(r.user),
                    )}
                  >
                    {firstLetter(r.user)}
                  </span>
                  <span className="font-medium text-slate-900">{r.user}</span>
                </div>
              </td>
              <td className="py-3 pe-4 text-slate-700">{r.action}</td>
              <td className="py-3 pe-4 text-slate-600">{r.entity}</td>
              <td className="py-3 text-slate-500 text-xs">{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

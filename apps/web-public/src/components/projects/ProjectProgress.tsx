import { Check, Clock3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateShort, formatNumber, pickAr } from '@/lib/format';
import type { PublicProjectDetail } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';
import { DetailHead } from '@/components/detail/DetailStats';

/**
 * «تقدم الإنشاءات»: the overall completion (the stages' average) on a bar,
 * then each stage with its own bar — done, in progress or not started — and
 * when it was last updated. Null when the project lists no stages.
 */
export function ProjectProgress({ progress, locale = 'ar', compact = false }: { progress: PublicProjectDetail['progress']; locale?: Locale; compact?: boolean }) {
  if (!progress || progress.stages.length === 0) return null;
  const t = extraT(locale).projectContent;
  const pct = (n: number) => `${formatNumber(n, locale)}%`;
  const done = progress.overall >= 100;

  return (
    <div data-testid="project-progress">
      {!compact && <DetailHead eyebrow={t.progressEyebrow} title={t.progressTitle} />}
      <div className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface">
        <div className="border-b border-hairline bg-surface-soft/60 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-ink-strong">{t.overall}</p>
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', done ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gold-400/15 text-gold-700 dark:text-gold-300')}>
              {done ? t.status.done : t.status.building}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-valuenow={progress.overall} aria-valuemin={0} aria-valuemax={100} aria-label={t.overall}>
              <span className="block h-full rounded-full bg-navy dark:bg-gold-400" style={{ width: `${progress.overall}%` }} />
            </div>
            <span className="font-display text-2xl font-semibold text-ink-strong">{pct(progress.overall)}</span>
          </div>
          {progress.updatedAt && <p className="mt-3 text-xs text-ink-muted">{t.updatedAt(formatDateShort(progress.updatedAt, locale))}</p>}
        </div>

        <ol className="px-6 py-6 sm:px-8">
          {progress.stages.map((s, i) => {
            const state = s.percent >= 100 ? 'done' : s.percent > 0 ? 'active' : 'next';
            const last = i === progress.stages.length - 1;
            return (
              <li key={i} className={cn('relative flex gap-4', !last && 'pb-6')}>
                {!last && <span className="absolute bottom-0 start-[17px] top-10 w-0.5 bg-hairline" aria-hidden />}
                <span
                  className={cn(
                    'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    state === 'done' && 'bg-emerald-600 text-white',
                    state === 'active' && 'bg-navy text-white dark:bg-gold-400 dark:text-[#1B1206]',
                    state === 'next' && 'bg-surface-soft text-ink-muted ring-1 ring-hairline',
                  )}
                  aria-label={t.stage[state]}
                >
                  {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : <Clock3 className="h-4 w-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold text-ink-strong">{pickAr(s.name, '', locale)}</p>
                    <span className={cn('text-sm font-bold', state === 'done' ? 'text-emerald-700 dark:text-emerald-400' : state === 'active' ? 'text-ink-strong' : 'text-ink-muted')}>
                      {pct(s.percent)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline">
                    <span
                      className={cn('block h-full rounded-full', state === 'done' ? 'bg-emerald-600' : 'bg-navy dark:bg-gold-400')}
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

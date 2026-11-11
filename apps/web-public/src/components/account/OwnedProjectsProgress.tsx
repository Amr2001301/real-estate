import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, HardHat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateShort, formatNumber, pickAr } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicProjectDetail } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';

/**
 * «تقدم إنشاءات مشاريعك» in the account: one row per project the customer
 * owns a unit in that lists construction stages — its overall completion on
 * a bar and a link to the stages on the project page. Nothing when none does.
 */
export function OwnedProjectsProgress({ projects, locale = 'ar' }: { projects: PublicProjectDetail[]; locale?: Locale }) {
  const rows = projects.filter((p) => p.progress && p.progress.stages.length > 0);
  if (rows.length === 0) return null;
  const t = extraT(locale).projectContent;
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <section data-testid="owned-projects-progress" className="rounded-[1.5rem] border border-hairline bg-surface p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700 dark:text-gold-300">
          <HardHat className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-strong">{t.accountTitle}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.accountSub}</p>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-hairline">
        {rows.map((p) => {
          const progress = p.progress!;
          const done = progress.overall >= 100;
          return (
            <li key={p.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-ink-strong">{pickAr(p.name, '', locale)}</p>
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', done ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gold-400/15 text-gold-700 dark:text-gold-300')}>
                  {done ? t.status.done : t.status.building}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-valuenow={progress.overall} aria-valuemin={0} aria-valuemax={100} aria-label={t.overall}>
                  <span className={cn('block h-full rounded-full', done ? 'bg-emerald-600' : 'bg-navy dark:bg-gold-400')} style={{ width: `${progress.overall}%` }} />
                </div>
                <span className="font-display text-lg font-semibold text-ink-strong">{formatNumber(progress.overall, locale)}%</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>{progress.updatedAt ? t.updatedAt(formatDateShort(progress.updatedAt, locale)) : ''}</span>
                <Link href={`${routes.project(p.id)}#progress` as Route} className="inline-flex items-center gap-1 font-semibold text-gold-700 hover:underline dark:text-gold-300">
                  {t.viewStages}
                  <Arrow className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

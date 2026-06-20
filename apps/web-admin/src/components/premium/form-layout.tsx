import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FormNavSection {
  /** Must match the `id` prop on the corresponding PremiumFormPanel */
  id: string;
  /** Short ordinal: '01', '02', … */
  num: string;
  label: string;
  /** One-line subtitle shown under the label in the sidebar */
  sub: string;
}

export interface PremiumFormLayoutProps {
  /** Section list used to render both mobile chips and the desktop sidebar nav */
  navSections: FormNavSection[];
  /** Sidebar card title. Default: "ملخص الإنشاء" */
  sidebarTitle?: string;
  /** Small pill beside the sidebar title. Default: "جديد" */
  sidebarBadge?: string;
  /** Info box text at the bottom of the sidebar card */
  sidebarInfo?: string;
  /** The stacked PremiumFormPanel children */
  children: ReactNode;
  className?: string;
}

export function PremiumFormLayout({
  navSections,
  sidebarTitle = 'ملخص الإنشاء',
  sidebarBadge = 'جديد',
  sidebarInfo,
  children,
  className,
}: PremiumFormLayoutProps) {
  return (
    <div className={cn('flex flex-col gap-4 lg:gap-5', className)}>

      {/* ── Mobile: horizontal scrollable section chips ── */}
      <nav
        className="lg:hidden flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin"
        aria-label="أقسام النموذج"
      >
        {navSections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-hairline shadow-xs text-xs font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700 transition-colors"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 border border-brand-200 text-brand-700 text-[9px] font-bold leading-none shrink-0">
              {s.num}
            </span>
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── Desktop: sidebar (right in RTL) + panel stack (left) ── */}
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

        {/* Summary sidebar — first in DOM = right side in RTL flex-row */}
        <aside className="hidden lg:flex flex-col gap-3 w-[272px] shrink-0 sticky top-6 self-start">
          <div className="bg-surface border border-hairline rounded-2xl shadow-soft overflow-hidden">
            {/* Gold accent stripe */}
            <div className="h-[2px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />

            {/* Sidebar header */}
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-navy">{sidebarTitle}</p>
              {sidebarBadge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700 select-none leading-none">
                  <span className="h-1 w-1 rounded-full bg-brand-400 shrink-0" />
                  {sidebarBadge}
                </span>
              )}
            </div>

            {/* Steps nav */}
            <div className="p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 px-2 pb-2 select-none">
                خطوات الإعداد
              </p>
              <nav className="flex flex-col gap-0.5" aria-label="أقسام النموذج">
                {navSections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50/70 transition-colors"
                  >
                    <span className="mt-px inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold shrink-0 leading-none group-hover:bg-brand-100 group-hover:border-brand-300 transition-colors">
                      {s.num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-navy group-hover:text-brand-700 transition-colors leading-snug">
                        {s.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{s.sub}</p>
                    </div>
                  </a>
                ))}
              </nav>
            </div>

            {/* Info box */}
            {sidebarInfo && (
              <div className="px-4 pb-4">
                <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3.5 flex gap-2.5">
                  <Info className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-brand-800 leading-relaxed font-medium">
                    {sidebarInfo}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Form panel stack — flex-1, left side in RTL */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5 pb-24">
          {children}
        </div>
      </div>
    </div>
  );
}

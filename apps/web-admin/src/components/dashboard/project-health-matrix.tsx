import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';

export interface ProjectHealthRow {
  id:              string;
  name:            string;
  totalUnits:      number;
  availableUnits:  number;
  reservedUnits:   number;
  soldUnits:       number;
  signedContracts: number;
  contractValue:   number;
}

type HealthStatus = 'excellent' | 'good' | 'warning' | 'attention';

function getHealth(p: ProjectHealthRow): HealthStatus {
  const total       = p.totalUnits || 1;
  const soldPct     = (p.soldUnits     / total) * 100;
  const reservedPct = (p.reservedUnits / total) * 100;

  if (soldPct >= 70)                              return 'excellent';
  if (soldPct >= 40 || soldPct + reservedPct >= 60) return 'good';
  if (soldPct >= 15)                              return 'warning';
  return 'attention';
}

const HEALTH: Record<HealthStatus, { label: string; dotCls: string; badgeCls: string }> = {
  excellent: { label: 'ممتاز',         dotCls: 'bg-success-500', badgeCls: 'bg-success-50 border-success-100 text-success-700' },
  good:      { label: 'جيد',           dotCls: 'bg-brand-500',   badgeCls: 'bg-brand-50 border-brand-100 text-brand-700'       },
  warning:   { label: 'متوسط',         dotCls: 'bg-amber-500',   badgeCls: 'bg-amber-50 border-amber-100 text-amber-700'       },
  attention: { label: 'يحتاج متابعة', dotCls: 'bg-danger-500',  badgeCls: 'bg-danger-50 border-danger-100 text-danger-700'    },
};

interface Props {
  projects:   ProjectHealthRow[];
  className?: string;
}

export function ProjectHealthMatrix({ projects, className }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-sm text-slate-400">لا توجد مشاريع منشورة بعد</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3', className)}>
      {projects.map((p) => {
        const total    = p.totalUnits || 1;
        const availPct = Math.round((p.availableUnits / total) * 100);
        const resPct   = Math.round((p.reservedUnits  / total) * 100);
        const soldPct  = Math.round((p.soldUnits      / total) * 100);
        const health   = getHealth(p);
        const h        = HEALTH[health];

        return (
          <Link key={p.id} href={`/dashboard/projects/${p.id}` as never} className="group block">
            <div className="bg-canvas/40 border border-hairline rounded-[18px] p-4 sm:p-5 flex flex-col gap-3.5 hover:border-brand-200/80 hover:bg-surface hover:shadow-soft transition-all duration-150 h-full">

              {/* Name + contract value */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-bold text-navy leading-snug line-clamp-2 flex-1">
                  {p.name}
                </p>
                <p className="text-[12.5px] font-bold text-brand-700 tabular-nums shrink-0 leading-none mt-0.5">
                  {formatCompact(p.contractValue)}
                </p>
              </div>

              {/* Stacked inventory bar */}
              <div className="h-2.5 w-full rounded-full overflow-hidden bg-surface-muted flex">
                {availPct > 0 && (
                  <div className="bg-emerald-400 shrink-0" style={{ width: `${availPct}%` }} />
                )}
                {resPct > 0 && (
                  <div className="bg-amber-400 shrink-0" style={{ width: `${resPct}%` }} />
                )}
                {soldPct > 0 && (
                  <div className="bg-brand-400 shrink-0" style={{ width: `${soldPct}%` }} />
                )}
              </div>

              {/* Unit counts */}
              <div className="flex items-center gap-3 text-[10.5px] font-semibold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {p.availableUnits} متاح
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {p.reservedUnits} محجوز
                </span>
                <span className="flex items-center gap-1 text-brand-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                  {p.soldUnits} مباع
                </span>
              </div>

              {/* Footer: health badge + contracts count */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-hairline mt-auto">
                <span className={cn(
                  'inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full border text-[10px] font-semibold',
                  h.badgeCls,
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', h.dotCls)} />
                  {h.label}
                </span>
                <span className="text-[10.5px] font-medium text-slate-400 tabular-nums">
                  {p.signedContracts} عقد موقّع
                </span>
              </div>

            </div>
          </Link>
        );
      })}
    </div>
  );
}

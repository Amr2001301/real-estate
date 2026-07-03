import { Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';

export interface ProjectRow {
  id:              string;
  name:            string;
  totalUnits:      number;
  availableUnits:  number;
  reservedUnits:   number;
  soldUnits:       number;
  signedContracts: number;
  contractValue:   number;
}

interface Props {
  projects:        ProjectRow[];
  className?:      string;
  currencySymbol?: string;
}

export function ProjectPerformanceTable({ projects, className, currencySymbol = 'ر.س' }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Building2 className="h-5 w-5 text-slate-300" aria-hidden />
        <p className="text-sm text-slate-400">لا توجد مشاريع منشورة بعد</p>
      </div>
    );
  }

  return (
    <div className={cn('divide-y divide-hairline', className)}>
      {projects.map((p) => {
        const total       = p.totalUnits || 1;
        const availPct    = Math.round((p.availableUnits / total) * 100);
        const reservedPct = Math.round((p.reservedUnits  / total) * 100);
        const soldPct     = Math.round((p.soldUnits      / total) * 100);

        return (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
            {/* Icon */}
            <div className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
              <Building2 className="h-3.5 w-3.5 text-brand-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Name + value */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold text-slate-900 truncate leading-none">{p.name}</p>
                <span className="text-xs font-extrabold text-brand-700 tabular-nums shrink-0 leading-none">
                  {formatCompact(p.contractValue, currencySymbol)}
                </span>
              </div>

              {/* Inventory bar */}
              <div className="flex h-1 rounded-full overflow-hidden bg-slate-100 mb-1.5">
                {availPct > 0    && <div className="bg-emerald-400" style={{ width: `${availPct}%` }}    />}
                {reservedPct > 0 && <div className="bg-amber-400"   style={{ width: `${reservedPct}%` }} />}
                {soldPct > 0     && <div className="bg-brand-400"   style={{ width: `${soldPct}%` }}     />}
              </div>

              {/* Pill counters */}
              <div className="flex items-center gap-2 text-[9px] font-semibold">
                <span className="text-emerald-700">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 me-0.5" />{p.availableUnits} متاح
                </span>
                <span className="text-slate-300 select-none">·</span>
                <span className="text-amber-700">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 me-0.5" />{p.reservedUnits} محجوز
                </span>
                <span className="text-slate-300 select-none">·</span>
                <span className="text-brand-700">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400 me-0.5" />{p.soldUnits} مباع
                </span>
                <span className="text-slate-300 select-none ms-auto">·</span>
                <span className="text-slate-500">{p.signedContracts} عقد</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

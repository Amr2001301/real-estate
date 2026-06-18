'use client';
import { cn } from '@/lib/cn';

export interface FunnelStage {
  label: string;
  value: number;
  pctOfFirst: number;
  convFromPrev: number | null;
  color: string;
  bg: string;
  text: string;
  dot: string;
}

const HEX_MAP: Record<string, string> = {
  'bg-brand-500':   '#d97706',
  'bg-sky-500':     '#0ea5e9',
  'bg-violet-500':  '#8b5cf6',
  'bg-amber-500':   '#f59e0b',
  'bg-emerald-500': '#10b981',
  'bg-teal-500':    '#14b8a6',
};

function ConvBadge({ rate }: { rate: number }) {
  const cls =
    rate > 1    ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200' :
    rate >= 0.4 ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200' :
                  'text-slate-500 bg-slate-100';
  return (
    <div className="flex items-center justify-center py-1">
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold', cls)}>
        ↓ {(rate * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function BrokerFunnelChart({
  stages,
  overallConv,
}: {
  stages: FunnelStage[];
  overallConv: number | null;
}) {
  if (!stages.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        لا توجد بيانات
      </div>
    );
  }

  return (
    <div className="w-full">
      {stages.map((stage, i) => {
        const hex = HEX_MAP[stage.dot] ?? '#94a3b8';

        return (
          <div key={stage.label}>
            {i > 0 && stage.convFromPrev !== null && (
              <ConvBadge rate={stage.convFromPrev} />
            )}

            {/* Stage card */}
            <div className="relative flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 overflow-hidden">
              {/* Start accent stripe */}
              <div
                className="absolute inset-y-0 start-0 w-[3px] rounded-s-xl"
                style={{ backgroundColor: hex }}
              />

              {/* Large count */}
              <span
                className="text-[26px] font-black tabular-nums leading-none shrink-0 ps-1"
                style={{ color: hex }}
              >
                {stage.value.toLocaleString('ar-EG')}
              </span>

              {/* Label + progress */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 truncate leading-snug">
                  {stage.label}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${i === 0 ? 100 : stage.pctOfFirst}%`,
                        backgroundColor: hex,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 tabular-nums shrink-0">
                    {i === 0 ? '100%' : `${stage.pctOfFirst.toFixed(0)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {overallConv !== null && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">فرصة → دفعة مُنجزة</span>
          <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full tabular-nums">
            {(overallConv * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

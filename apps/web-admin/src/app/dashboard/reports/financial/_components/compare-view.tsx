import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { PremiumMetricStrip, PremiumPanel } from '@/components/premium';
import { cn } from '@/lib/cn';

/** One figure in both periods. `good` says which way is better. */
export interface CompareRow {
  label: string;
  cur: string;
  prev: string;
  diff: string;
  pct?: string;
  /** -1 worse, 0 flat, 1 better */
  tone: -1 | 0 | 1;
  spark: number[];
  asOfToday?: boolean;
}
export interface CompareInsight { tone: 'bad' | 'warn' | 'good'; title: string; text: string }
export interface CompareSplit { name: string; cur: number; prev: number; note?: string }
export interface BridgeStep { label: string; value: number }
export interface CompareData {
  periodLabel: string;
  prevLabel: string;
  band: { label: string; value: string | number; ring?: number; unit?: string; sub: string; trend?: string; trendCls?: string }[];
  insights: CompareInsight[];
  rows: CompareRow[];
  bridge: { from: number; to: number; fromLabel: string; toLabel: string; steps: BridgeStep[] };
  asOf: { label: string; value: string; tone?: 'danger' }[];
  cumulative: { cur: number[]; prev: number[]; pace?: number[] };
  aging: { label: string; cur: string; prev: string; diff: string; tone: -1 | 0 | 1 }[];
  splits: { title: string; sub: string; rows: CompareSplit[]; unit: string }[];
}

const TONE_TEXT = { '-1': 'text-danger-600', '0': 'text-slate-500', '1': 'text-emerald-600' } as const;

function Spark({ v, tone }: { v: number[]; tone: -1 | 0 | 1 }) {
  const w = 96, h = 26;
  const mx = Math.max(...v), mn = Math.min(...v), r = mx - mn || 1;
  const pts = v.map((y, i) => `${(i * w) / (v.length - 1)},${h - 3 - ((y - mn) / r) * (h - 6)}`).join(' ');
  const c = tone === 1 ? '#2F8A5B' : tone === -1 ? '#C4503E' : '#98A2B3';
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - 3 - ((v[v.length - 1]! - mn) / r) * (h - 6)} r="3" fill={c} />
    </svg>
  );
}

const INSIGHT_ICON = { bad: TrendingDown, warn: AlertTriangle, good: TrendingUp } as const;
const INSIGHT_RING = {
  bad: 'border-danger-600/40 text-danger-600',
  warn: 'border-warning-600/45 text-warning-600',
  good: 'border-emerald-600/40 text-emerald-600',
} as const;

function Insight({ i }: { i: CompareInsight }) {
  const Icon = INSIGHT_ICON[i.tone];
  return (
    <div className="flex gap-3.5 rounded-[22px] border border-hairline bg-surface p-5">
      <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border', INSIGHT_RING[i.tone])}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[16px] font-bold leading-snug text-slate-900">{i.title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{i.text}</p>
      </div>
    </div>
  );
}

function Bridge({ b, fmt }: { b: CompareData['bridge']; fmt: (n: number) => string }) {
  const cols: { label: string; top: number; h: number; kind: 'base' | 'up' | 'down'; shown: string }[] = [];
  let cur = b.from;
  const max = Math.max(b.from, b.to, cur) * 1.05;
  const pct = (n: number) => (n / max) * 100;
  cols.push({ label: b.fromLabel, top: pct(b.from), h: pct(b.from), kind: 'base', shown: fmt(b.from) });
  for (const s of b.steps) {
    const next = cur + s.value;
    cols.push({ label: s.label, top: pct(Math.max(cur, next)), h: Math.max(1.2, pct(Math.abs(s.value))), kind: s.value < 0 ? 'down' : 'up', shown: (s.value > 0 ? '+' : '−') + fmt(Math.abs(s.value)) });
    cur = next;
  }
  cols.push({ label: b.toLabel, top: pct(b.to), h: pct(b.to), kind: 'base', shown: fmt(b.to) });
  return (
    <div dir="ltr" className="flex h-[210px] items-end gap-3 border-b border-hairline pb-0">
      {cols.map((c) => (
        <div key={c.label} className="relative flex h-full flex-1 flex-col justify-end">
          <div className="relative w-full" style={{ height: `${c.top}%` }}>
            <span className="absolute -top-5 inset-x-0 text-center text-[11.5px] font-bold tabular-nums text-slate-700">{c.shown}</span>
            <span
              className={cn(
                'absolute inset-x-[14%] top-0 rounded-t-lg',
                c.kind === 'base' && 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_0_18px_-4px] shadow-brand-500/50',
                c.kind === 'down' && 'bg-danger-500/80',
                c.kind === 'up' && 'bg-emerald-500/80',
              )}
              style={{ height: `${(c.h / c.top) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Lines({ d }: { d: CompareData['cumulative'] }) {
  const W = 640, H = 200;
  const max = Math.max(...d.cur, ...d.prev, ...(d.pace ?? [0])) * 1.08;
  const path = (v: number[]) => v.map((y, i) => `${(i * W) / (v.length - 1)},${H - (y / max) * H}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} className="h-[210px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1="0" x2={W} y1={H * t} y2={H * t} className="stroke-hairline" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1="0" x2={W} y1={H} y2={H} className="stroke-hairline" vectorEffect="non-scaling-stroke" />
      {d.pace && <polyline points={path(d.pace)} fill="none" stroke="#2F8A5B" strokeWidth="1.5" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />}
      <polyline points={path(d.prev)} fill="none" stroke="#98A2B3" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
      <polyline points={path(d.cur)} fill="none" stroke="#D8B66A" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SplitTable({ rows, unit, cur, prev }: { rows: CompareSplit[]; unit: string; cur: string; prev: string }) {
  const max = Math.max(...rows.flatMap((r) => [r.cur, r.prev]), 0.0001);
  return (
    <ul className="divide-y divide-hairline">
      {rows.map((r) => {
        const d = r.cur - r.prev;
        return (
          <li key={r.name} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13.5px] font-semibold text-slate-900">{r.name}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <b className="text-[14px] text-slate-900">{r.cur.toFixed(2)}</b>
                <span className={cn('text-[12px] font-bold', d < 0 ? 'text-danger-600' : d > 0 ? 'text-emerald-600' : 'text-slate-500')}>
                  {d > 0 ? '+' : d < 0 ? '−' : ''}{Math.abs(d).toFixed(2)}
                </span>
              </span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400" style={{ width: `${(r.cur / max) * 100}%` }} />
            </div>
            <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-slate-400/45" style={{ width: `${(r.prev / max) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{prev}: {r.prev.toFixed(2)} {unit}{r.note ? ` · ${r.note}` : ''}</p>
          </li>
        );
      })}
      <li className="hidden">{cur}</li>
    </ul>
  );
}

/**
 * The comparison view of the financial report: the navy band with each
 * figure against the other period, what the owner should notice, every
 * figure in both periods with its trend, where the difference came from,
 * the pace through the month, the age of what is late, and the split by
 * project, payment type and salesperson. Presentational: the page decides
 * the periods and passes the figures.
 */
export function CompareView({ data, actions }: { data: CompareData; actions?: ReactNode }) {
  const fmt = (n: number) => n.toFixed(2);
  return (
    <div className="flex flex-col gap-5 lg:gap-6" data-testid="fin-compare">
      <PremiumMetricStrip cols={5} metrics={data.band} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="insights">
        {data.insights.map((i) => <Insight key={i.title} i={i} />)}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <PremiumPanel title="مؤشرات الأداء" sub={`${data.periodLabel} مقابل ${data.prevLabel}، مع اتجاه آخر 12 شهرًا`} padding="none">
          <div className="overflow-x-auto px-6 pb-4">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-slate-500">
                  <th className="py-2 text-start font-medium">المؤشر</th>
                  <th className="py-2 text-start font-medium">{data.periodLabel}</th>
                  <th className="py-2 text-start font-medium">{data.prevLabel}</th>
                  <th className="py-2 text-start font-medium">الفرق</th>
                  <th className="py-2 text-start font-medium">الاتجاه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="py-3 font-semibold text-slate-900">{r.label}</td>
                    <td className="py-3 font-heading text-[18px] font-bold tabular-nums text-slate-900">{r.cur}</td>
                    <td className="py-3 tabular-nums text-slate-500">{r.prev}</td>
                    <td className={cn('py-3 font-bold tabular-nums', TONE_TEXT[String(r.tone) as keyof typeof TONE_TEXT])}>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-current/10 px-2.5 py-0.5 text-[12.5px]" style={{ backgroundColor: 'color-mix(in srgb, currentColor 11%, transparent)' }}>
                        {r.diff}{r.pct ? ` · ${r.pct}` : ''}
                      </span>
                    </td>
                    <td className="py-3"><Spark v={r.spark} tone={r.tone} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumPanel>

        <PremiumPanel title="من أين جاء الفرق" sub={`المحصّل من ${data.bridge.fromLabel} إلى ${data.bridge.toLabel} حسب المشروع (مليون ج.م)`}>
          <div className="pt-6"><Bridge b={data.bridge} fmt={fmt} /></div>
          <div className="mt-2 flex" dir="ltr">
            {[data.bridge.fromLabel, ...data.bridge.steps.map((s) => s.label), data.bridge.toLabel].map((l) => (
              <span key={l} className="flex-1 truncate px-1 text-center text-[11px] text-slate-500">{l}</span>
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-hairline pt-4">
            {data.asOf.map((a) => (
              <div key={a.label} className="min-w-0">
                <dt className="truncate text-[11.5px] text-slate-500">{a.label}</dt>
                <dd className={cn('mt-0.5 font-heading text-[19px] font-bold tabular-nums', a.tone === 'danger' ? 'text-danger-600' : 'text-slate-900')}>{a.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            أرقام «حتى اليوم»: لا تتأثر بالفترة ولا تدخل في المقارنة.
          </p>
        </PremiumPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <PremiumPanel
          title="التحصيل التراكمي يومًا بيوم"
          sub="كل يوم من الفترة مقابل نفس اليوم في الفترة السابقة"
          trailing={
            <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />{data.periodLabel}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400/60" />{data.prevLabel}</span>
              {data.cumulative.pace && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />وتيرة المستهدف</span>}
            </div>
          }
        >
          <Lines d={data.cumulative} />
        </PremiumPanel>

        <PremiumPanel title="أعمار المتأخرات" sub="ما تأخر عن موعده، حسب مدة التأخير">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-slate-500">
                <th className="py-2 text-start font-medium">المدة</th>
                <th className="py-2 text-start font-medium">{data.periodLabel}</th>
                <th className="py-2 text-start font-medium">{data.prevLabel}</th>
                <th className="py-2 text-start font-medium">الفرق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.aging.map((r) => (
                <tr key={r.label}>
                  <td className="py-3 font-semibold text-slate-900">{r.label}</td>
                  <td className="py-3 font-bold tabular-nums text-slate-900">{r.cur}</td>
                  <td className="py-3 tabular-nums text-slate-500">{r.prev}</td>
                  <td className={cn('py-3 font-bold tabular-nums', TONE_TEXT[String(r.tone) as keyof typeof TONE_TEXT])}>{r.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-warning-600/30 bg-warning-500/[0.08] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-700">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600" aria-hidden />
            الأقساط المتأخرة تنتقل إلى شرائح أقدم، وهذا مؤشر لزيادة المتابعة.
          </p>
        </PremiumPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {data.splits.map((s) => (
          <PremiumPanel key={s.title} title={s.title} sub={s.sub}>
            <SplitTable rows={s.rows} unit={s.unit} cur={data.periodLabel} prev={data.prevLabel} />
          </PremiumPanel>
        ))}
      </div>
      {actions}
    </div>
  );
}

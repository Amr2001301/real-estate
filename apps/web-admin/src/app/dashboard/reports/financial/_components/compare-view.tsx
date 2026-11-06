import { AlertTriangle, CalendarClock, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { PremiumMetricStrip, PremiumPanel, type Metric } from '@/components/premium';
import { cn } from '@/lib/cn';

/** Everything the view says, in the page's language. */
export interface CompareLabels {
  kpiTitle: string; kpiSub: (cur: string, prev: string) => string;
  driversTitle: string; driversSub: (from: string, to: string) => string; driversBy: string; driversShare: (pct: number) => string;
  asOfNote: string;
  cumTitle: string; cumSub: string; cumUntil: (n: number) => string; cumDays: string; cumUnit: { million: string; thousand: string };
  dueTitle: string; dueSub: string; dueNote: string;
  colMetric: string; colDiff: string; colTrend: string;
  noChange: string;
  splitUnit: string;
}

/** One figure in both periods. `good` says which way is better. */
export interface CompareRow {
  label: string;
  cur: string;
  prev: string;
  diff: string;
  pct?: string;
  /** -1 worse, 0 flat, 1 better */
  tone: -1 | 0 | 1;
  spark?: number[];
}
export interface CompareInsight { tone: 'bad' | 'warn' | 'good'; title: string; figure: string; text: string }
export interface CompareSplit { name: string; cur: number; prev: number; note?: string }
export interface BridgeStep { label: string; value: number }
export interface CompareDueRow { label: string; cur: string; prev: string; diff: string; tone: -1 | 0 | 1 }
export interface CompareData {
  labels: CompareLabels;
  /** A figure as money / a short figure — the page's own formatters. */
  money: (n: number) => string;
  short: (n: number) => string;
  periodLabel: string;
  prevLabel: string;
  band: Metric[];
  insights: CompareInsight[];
  rows: CompareRow[];
  bridge: { from: number; to: number; fromLabel: string; toLabel: string; steps: BridgeStep[] };
  asOf: { label: string; value: string; tone?: 'danger' }[];
  cumulative: { cur: number[]; prev: number[]; days: number };
  due: CompareDueRow[];
  splits: { title: string; sub: string; rows: CompareSplit[] }[];
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

const INSIGHT_TEXT = { bad: 'text-danger-600', warn: 'text-warning-600', good: 'text-emerald-600' } as const;

function Insight({ i }: { i: CompareInsight }) {
  const Icon = INSIGHT_ICON[i.tone];
  return (
    <div className="rounded-[22px] border border-hairline bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', INSIGHT_RING[i.tone])}>
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.6} aria-hidden />
        </span>
        <p className="text-[14px] font-semibold text-slate-600">{i.title}</p>
      </div>
      <p className={cn('mt-3 font-heading text-[34px] font-bold leading-none tabular-nums', INSIGHT_TEXT[i.tone])}><bdi dir="ltr">{i.figure}</bdi></p>
      <p className="mt-2.5 text-[14px] leading-snug text-slate-700">{i.text}</p>
    </div>
  );
}

function Drivers({ b, data }: { b: CompareData['bridge']; data: CompareData }) {
  const { money, short, labels: L } = data;
  const total = b.to - b.from;
  const max = Math.max(...b.steps.map((x) => Math.abs(x.value)), 0.0001);
  const sumAbs = b.steps.reduce((n, x) => n + Math.abs(x.value), 0) || 1;
  const sign = (n: number) => (n < 0 ? '−' : n > 0 ? '+' : '');
  return (
    <div>
      <div className="flex items-end justify-between gap-3 rounded-2xl bg-surface-muted/60 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[12px] text-slate-500">{b.fromLabel}</p>
          <p className="font-heading text-[22px] font-bold tabular-nums text-slate-900">{money(b.from)}</p>
        </div>
        <span className={cn('mb-1 shrink-0 rounded-full px-3 py-1 text-[13px] font-bold tabular-nums', total < 0 ? 'bg-danger-500/15 text-danger-600' : 'bg-emerald-500/15 text-emerald-600')}>
          <bdi dir="ltr">{sign(total)}{short(Math.abs(total))}</bdi>
        </span>
        <div className="min-w-0 text-end">
          <p className="truncate text-[12px] text-slate-500">{b.toLabel}</p>
          <p className="font-heading text-[22px] font-bold tabular-nums text-slate-900">{money(b.to)}</p>
        </div>
      </div>
      {b.steps.length > 0 && (
        <>
          <p className="mb-1 mt-5 text-[12.5px] font-semibold text-slate-600">{L.driversBy}</p>
          <ul className="divide-y divide-hairline">
            {b.steps.map((x) => (
              <li key={x.label} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3 py-3">
                <span className="truncate text-[13.5px] font-semibold text-slate-900">{x.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <span className={cn('block h-full rounded-full', x.value < 0 ? 'bg-danger-500' : 'bg-emerald-500')} style={{ width: `${(Math.abs(x.value) / max) * 100}%` }} />
                </span>
                <span className="text-end tabular-nums">
                  <b className={cn('text-[14px]', x.value < 0 ? 'text-danger-600' : 'text-emerald-600')}><bdi dir="ltr">{sign(x.value)}{short(Math.abs(x.value))}</bdi></b>
                  <span className="ms-2 text-[12px] text-slate-500">{L.driversShare(Math.round((Math.abs(x.value) / sumAbs) * 100))}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function niceTop(max: number): number {
  const raw = Math.max(max, 1) / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp * 4;
}

function Lines({ data }: { data: CompareData }) {
  const { cumulative: d, labels: L, money } = data;
  const W = 640, H = 220;
  const days = Math.max(d.days, d.cur.length, d.prev.length) - 1 || 1;
  const maxV = Math.max(...d.cur, ...d.prev, 1);
  const top = niceTop(maxV);
  const million = top >= 1_000_000;
  const div = million ? 1_000_000 : 1_000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const X = (i: number) => (i * W) / days;
  const Y = (v: number) => H - (v / top) * H;
  const path = (v: number[]) => v.map((y, i) => `${X(i)},${Y(y)}`).join(' ');
  const last = d.cur.length - 1;
  const curEnd = d.cur[last] ?? 0;
  const prevAt = d.prev[Math.min(last, d.prev.length - 1)] ?? 0;
  const gap = curEnd - prevAt;
  const tickText = (t: number) => (t === 0 ? '0' : String(Number((t / div).toFixed(2))));
  const step = Math.max(1, Math.ceil((days + 1) / 6));
  const xs = Array.from({ length: Math.floor(days / step) + 1 }, (_, i) => i * step);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
        <span className="rounded-full bg-surface-muted/70 px-3 py-1 text-slate-600">{L.cumUntil(last + 1)}</span>
        <span className="text-slate-700">{data.periodLabel} <b className="tabular-nums text-slate-900">{money(curEnd)}</b></span>
        <span className="text-slate-700">{data.prevLabel} <b className="tabular-nums text-slate-900">{money(prevAt)}</b></span>
        <span className={cn('rounded-full px-3 py-1 font-bold tabular-nums', gap < 0 ? 'bg-danger-500/15 text-danger-600' : 'bg-emerald-500/15 text-emerald-600')}>
          <bdi dir="ltr">{gap < 0 ? '−' : gap > 0 ? '+' : ''}{data.short(Math.abs(gap))}</bdi>
        </span>
      </div>
      <div dir="ltr" className="grid grid-cols-[auto_1fr] gap-x-3">
        <div className="relative h-[220px] w-11">
          {ticks.map((t) => (
            <span key={t} className="absolute end-0 text-[11px] tabular-nums text-slate-400" style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>{tickText(t)}</span>
          ))}
          <span className="absolute -top-5 end-0 text-[10.5px] text-slate-400">{million ? L.cumUnit.million : L.cumUnit.thousand}</span>
        </div>
        <div className="relative">
          <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className="h-[232px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
            {ticks.map((t) => (
              <line key={t} x1="0" x2={W} y1={Y(t)} y2={Y(t)} className={t === 0 ? 'stroke-hairline' : 'stroke-hairline/70'} strokeDasharray={t === 0 ? undefined : '4 5'} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={X(last)} x2={X(last)} y1="0" y2={H} className="stroke-brand-500/40" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <polyline points={path(d.prev)} fill="none" stroke="#98A2B3" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
            <polyline points={path(d.cur)} fill="none" stroke="#D8B66A" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500 bg-surface p-1" style={{ left: `${(last / days) * 100}%`, top: `${(Y(curEnd) / H) * 94 + 2.5}%` }} />
          <div className="relative mt-1 h-4">
            {xs.map((x) => (
              <span key={x} className="absolute -translate-x-1/2 text-[11px] tabular-nums text-slate-400" style={{ left: `${(x / days) * 100}%` }}>{x + 1}</span>
            ))}
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-400">{L.cumDays}</p>
        </div>
      </div>
    </div>
  );
}

function SplitTable({ rows, data }: { rows: CompareSplit[]; data: CompareData }) {
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
                <b className="text-[14px] text-slate-900">{data.short(r.cur)}</b>
                <span className={cn('text-[12px] font-bold', d < 0 ? 'text-danger-600' : d > 0 ? 'text-emerald-600' : 'text-slate-500')}>
                  <bdi dir="ltr">{d > 0 ? '+' : d < 0 ? '−' : ''}{data.short(Math.abs(d))}</bdi>
                </span>
              </span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-gradient-to-l from-brand-600 to-brand-400" style={{ width: `${(r.cur / max) * 100}%` }} />
            </div>
            <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-surface-muted">
              <span className="block h-full rounded-full bg-slate-400/45" style={{ width: `${(r.prev / max) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{data.prevLabel}: {data.short(r.prev)}{r.note ? ` · ${r.note}` : ''}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The comparison view of the financial report: the navy band with each
 * figure against the other period, what the owner should notice, every
 * figure in both periods with its trend, where the difference came from,
 * the pace through the period, what fell due and how much is settled, and
 * the split by project, payment type and salesperson. Presentational: the
 * page decides the periods and passes the figures.
 */
export function CompareView({ data }: { data: CompareData }) {
  const L = data.labels;
  return (
    <div className="flex flex-col gap-5 lg:gap-6" data-testid="fin-compare">
      <PremiumMetricStrip cols={5} metrics={data.band} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="insights">
        {data.insights.map((i) => <Insight key={i.title} i={i} />)}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <PremiumPanel title={L.kpiTitle} sub={L.kpiSub(data.periodLabel, data.prevLabel)} padding="none">
          <div className="overflow-x-auto px-6 pb-4">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-slate-500">
                  <th className="py-2 text-start font-medium">{L.colMetric}</th>
                  <th className="py-2 text-start font-medium">{data.periodLabel}</th>
                  <th className="py-2 text-start font-medium">{data.prevLabel}</th>
                  <th className="py-2 text-start font-medium">{L.colDiff}</th>
                  <th className="py-2 text-start font-medium">{L.colTrend}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.rows.map((r) => (
                  <tr key={r.label}>
                    <td className="py-3 font-semibold text-slate-900">{r.label}</td>
                    <td className="py-3 font-heading text-[18px] font-bold tabular-nums text-slate-900">{r.cur}</td>
                    <td className="py-3 tabular-nums text-slate-500">{r.prev}</td>
                    <td className={cn('py-3 font-bold tabular-nums', TONE_TEXT[String(r.tone) as keyof typeof TONE_TEXT])}>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px]" style={{ backgroundColor: 'color-mix(in srgb, currentColor 11%, transparent)' }}>
                        <bdi dir="ltr">{r.diff}</bdi>{r.pct ? <> · <bdi dir="ltr">{r.pct}</bdi></> : null}
                      </span>
                    </td>
                    <td className="py-3">{r.spark ? <Spark v={r.spark} tone={r.tone} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumPanel>

        <PremiumPanel title={L.driversTitle} sub={L.driversSub(data.bridge.fromLabel, data.bridge.toLabel)}>
          <Drivers b={data.bridge} data={data} />
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-hairline pt-4">
            {data.asOf.map((a) => (
              <div key={a.label} className="min-w-0">
                <dt className="truncate text-[11.5px] text-slate-500">{a.label}</dt>
                <dd className={cn('mt-0.5 truncate font-heading text-[18px] font-bold tabular-nums', a.tone === 'danger' ? 'text-danger-600' : 'text-slate-900')}>{a.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {L.asOfNote}
          </p>
        </PremiumPanel>
      </div>

      <div className={cn('grid grid-cols-1 gap-5 lg:gap-6', data.due.length > 0 && 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]')}>
        <PremiumPanel
          title={L.cumTitle}
          sub={L.cumSub}
          trailing={
            <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />{data.periodLabel}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400/60" />{data.prevLabel}</span>
            </div>
          }
        >
          <Lines data={data} />
        </PremiumPanel>

        {data.due.length > 0 && <PremiumPanel title={L.dueTitle} sub={L.dueSub}>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-slate-500">
                <th className="py-2 text-start font-medium" />
                <th className="py-2 text-start font-medium">{data.periodLabel}</th>
                <th className="py-2 text-start font-medium">{data.prevLabel}</th>
                <th className="py-2 text-start font-medium">{L.colDiff}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.due.map((r) => (
                <tr key={r.label}>
                  <td className="py-3 font-semibold text-slate-900">{r.label}</td>
                  <td className="py-3 font-bold tabular-nums text-slate-900">{r.cur}</td>
                  <td className="py-3 tabular-nums text-slate-500">{r.prev}</td>
                  <td className={cn('py-3 font-bold tabular-nums', TONE_TEXT[String(r.tone) as keyof typeof TONE_TEXT])}><bdi dir="ltr">{r.diff}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-warning-600/30 bg-warning-500/[0.08] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-700">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600" aria-hidden />
            {L.dueNote}
          </p>
        </PremiumPanel>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {data.splits.map((s) => (
          <PremiumPanel key={s.title} title={s.title} sub={s.sub}>
            {s.rows.length > 0 ? <SplitTable rows={s.rows} data={data} /> : <p className="py-6 text-center text-[13px] text-slate-500">{L.noChange}</p>}
          </PremiumPanel>
        ))}
      </div>
    </div>
  );
}

import type { CompareData, CompareInsight, CompareRow, CompareSplit } from './compare-view';
import type { Metric } from '@/components/premium';

/** The API's /reports/financial-comparison payload. */
export interface FinancialComparison {
  period: { from: string; to: string };
  previous: { from: string; to: string };
  today: string;
  days: { current: number; previous: number; elapsed: number };
  figures: { current: Figures; previous: Figures };
  /** Null under a payment-type filter: a type does not split what falls due. */
  due: { current: DueFigures; previous: DueFigures } | null;
  trend: { months: string[]; collected: number[]; payments: number[]; fees: number[]; contractsSigned: number[]; reservations: number[]; avgPayment: number[] };
  byProject: Split[];
  byType: Split[];
  bySales: Split[];
  cumulative: { current: number[]; previous: number[] };
}
interface Figures { collected: number; payments: number; avgPayment: number; fees: number; contractsSigned: number; reservations: number }
interface DueFigures { due: number; settled: number; open: number; rate: number | null }
interface Split { key: string; name: unknown; cur: number; prev: number }

type Tone = -1 | 0 | 1;
const tone = (d: number, higherBetter: boolean): Tone => (d === 0 ? 0 : (d > 0) === higherBetter ? 1 : -1);
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const pctOf = (cur: number, prev: number): number | null => (prev === 0 ? null : Math.round(((cur - prev) / Math.abs(prev)) * 100));
const pctText = (p: number | null) => (p === null ? undefined : `${sign(p)}${Math.abs(p)}%`);

interface Ctx {
  en: boolean;
  money: (n: number) => string;
  short: (n: number) => string;
  count: (n: number) => string;
  /** A name from a translatable value. */
  name: (v: unknown) => string;
  typeLabel: (key: string) => string;
  periodLabel: string;
  prevLabel: string;
  asOf: { dueToDate: number; overdue: number; contractValue: number };
}

/** Builds what the view shows from the API's figures, in the page's language. */
export function buildCompareData(c: FinancialComparison, x: Ctx): CompareData {
  const en = x.en;
  const t = (ar: string, e: string) => (en ? e : ar);
  const cur = c.figures.current;
  const prev = c.figures.previous;
  const due = c.due?.current ?? null;
  const dueP = c.due?.previous ?? null;

  const moneyDiff = (a: number, b: number) => `${sign(a - b)}${x.short(Math.abs(a - b))}`;
  const countDiff = (a: number, b: number) => `${sign(a - b)}${x.count(Math.abs(a - b))}`;
  const row = (label: string, a: number, b: number, fmt: (n: number) => string, diff: (a: number, b: number) => string, higherBetter: boolean, spark?: number[]): CompareRow => ({
    label, cur: fmt(a), prev: fmt(b),
    diff: a === b ? t('بدون تغيير', 'No change') : diff(a, b),
    pct: a === b ? undefined : pctText(pctOf(a, b)),
    tone: tone(a - b, higherBetter),
    spark,
  });

  const rows: CompareRow[] = [
    row(t('المحصّل من الدفعات', 'Collected'), cur.collected, prev.collected, x.short, moneyDiff, true, c.trend.collected),
    row(t('عدد المدفوعات', 'Payments'), cur.payments, prev.payments, x.count, countDiff, true, c.trend.payments),
    row(t('متوسط قيمة الدفعة', 'Average payment'), cur.avgPayment, prev.avgPayment, x.short, moneyDiff, true, c.trend.avgPayment),
    row(t('رسوم وغرامات', 'Fees & penalties'), cur.fees, prev.fees, x.short, moneyDiff, true, c.trend.fees),
    row(t('عقود موقّعة', 'Contracts signed'), cur.contractsSigned, prev.contractsSigned, x.count, countDiff, true, c.trend.contractsSigned),
    row(t('حجوزات جديدة', 'New bookings'), cur.reservations, prev.reservations, x.count, countDiff, true, c.trend.reservations),
  ];

  // ── The band ────────────────────────────────────────────────────────
  const vs = (a: string) => t(`مقابل ${a} في ${x.prevLabel}`, `vs ${a} in ${x.prevLabel}`);
  const arrow = (d: number) => (d > 0 ? '↑' : d < 0 ? '↓' : '');
  const trendCls = (d: number, higherBetter: boolean) => (d === 0 ? undefined : tone(d, higherBetter) === 1 ? 'success' : 'danger');
  const dueBand = (due: DueFigures, dueP: DueFigures): Metric[] => [
    {
      label: t('المسدّد من مستحقات الفترة', 'Settled of the period’s dues'),
      value: due.rate ?? '—', unit: due.rate !== null ? '%' : '', ring: due.rate ?? undefined,
      sub: dueP.rate !== null ? vs(`${dueP.rate}%`) : t('لا مستحقات في الفترة السابقة', 'No dues in the other period'),
      trend: due.rate !== null && dueP.rate !== null && due.rate !== dueP.rate ? `${arrow(due.rate - dueP.rate)} ${Math.abs(due.rate - dueP.rate)} ${t('نقطة', 'pts')}` : undefined,
      trendCls: due.rate !== null && dueP.rate !== null ? trendCls(due.rate - dueP.rate, true) : undefined,
    },
    {
      label: t('غير المسدّد من مستحقات الفترة', 'Still unpaid of the period’s dues'), value: x.short(due.open).split(' ')[0] ?? '0', unit: x.short(due.open).split(' ').slice(1).join(' ') || undefined,
      sub: vs(x.short(dueP.open)),
      trend: due.open === dueP.open ? undefined : `${arrow(due.open - dueP.open)} ${x.short(Math.abs(due.open - dueP.open))}`,
      trendCls: trendCls(due.open - dueP.open, false),
    },
  ];
  const avgBand: Metric = {
    label: t('متوسط قيمة الدفعة', 'Average payment'), value: x.short(cur.avgPayment).split(' ')[0] ?? '0', unit: x.short(cur.avgPayment).split(' ').slice(1).join(' ') || undefined,
    sub: vs(x.short(prev.avgPayment)),
    trend: cur.avgPayment === prev.avgPayment ? undefined : `${arrow(cur.avgPayment - prev.avgPayment)} ${pctText(pctOf(cur.avgPayment, prev.avgPayment)) ?? ''}`,
    trendCls: trendCls(cur.avgPayment - prev.avgPayment, true),
  };
  const feesBand: Metric = {
    label: t('رسوم وغرامات', 'Fees & penalties'), value: x.short(cur.fees).split(' ')[0] ?? '0', unit: x.short(cur.fees).split(' ').slice(1).join(' ') || undefined,
    sub: vs(x.short(prev.fees)),
    trend: cur.fees === prev.fees ? undefined : `${arrow(cur.fees - prev.fees)} ${x.short(Math.abs(cur.fees - prev.fees))}`,
    trendCls: trendCls(cur.fees - prev.fees, true),
  };
  const band: Metric[] = [
    {
      label: t('المحصّل من الدفعات', 'Collected'), value: x.short(cur.collected).split(' ')[0] ?? '0', unit: x.short(cur.collected).split(' ').slice(1).join(' ') || undefined,
      sub: vs(x.short(prev.collected)),
      trend: cur.collected === prev.collected ? undefined : `${arrow(cur.collected - prev.collected)} ${pctText(pctOf(cur.collected, prev.collected)) ?? x.money(Math.abs(cur.collected - prev.collected))}`,
      trendCls: trendCls(cur.collected - prev.collected, true),
    },
    {
      label: t('عدد المدفوعات', 'Payments'), value: x.count(cur.payments), unit: t('دفعة', 'payments'),
      sub: vs(x.count(prev.payments)),
      trend: cur.payments === prev.payments ? undefined : `${arrow(cur.payments - prev.payments)} ${x.count(Math.abs(cur.payments - prev.payments))}`,
      trendCls: trendCls(cur.payments - prev.payments, true),
    },
    {
      label: t('عقود موقّعة', 'Contracts signed'), value: x.count(cur.contractsSigned), unit: t('عقد', 'contracts'),
      sub: vs(x.count(prev.contractsSigned)),
      trend: cur.contractsSigned === prev.contractsSigned ? undefined : `${arrow(cur.contractsSigned - prev.contractsSigned)} ${x.count(Math.abs(cur.contractsSigned - prev.contractsSigned))}`,
      trendCls: trendCls(cur.contractsSigned - prev.contractsSigned, true),
    },
    ...(due && dueP ? dueBand(due, dueP) : [avgBand, feesBand]),
  ];

  // ── The difference, by project ───────────────────────────────────────
  const projects = c.byProject.map((p) => ({ name: x.name(p.name), delta: p.cur - p.prev }));
  const ranked = [...projects].filter((p) => p.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const steps = ranked.slice(0, 3).map((p) => ({ label: p.name, value: p.delta }));
  const rest = ranked.slice(3).reduce((n, p) => n + p.delta, 0);
  if (rest !== 0) steps.push({ label: t('أخرى', 'Other'), value: rest });

  // ── What the owner should notice ─────────────────────────────────────
  const insights: CompareInsight[] = [];
  const dC = cur.collected - prev.collected;
  const pC = pctOf(cur.collected, prev.collected);
  const top = ranked[0];
  const topShare = top && dC !== 0 ? Math.round((Math.abs(top.delta) / Math.abs(dC)) * 100) : 0;
  insights.push({
    tone: dC < 0 ? 'bad' : dC > 0 ? 'good' : 'warn',
    title: t('التحصيل', 'Collected'),
    figure: pC === null ? (dC === 0 ? '0' : `${sign(dC)}${x.short(Math.abs(dC))}`) : `${sign(pC)}${Math.abs(pC)}%`,
    text: dC === 0
      ? t('بلا تغيير عن الفترة السابقة.', 'Unchanged from the other period.')
      : `${dC < 0 ? t('أقل', 'Lower') : t('أعلى', 'Higher')} ${t('من', 'than')} ${x.prevLabel}${top && topShare >= 50 && ranked.length > 1 ? t(`، ومعظمه من ${top.name}.`, `, mostly from ${top.name}.`) : '.'}`,
  });
  if (!due) {
    insights.push({ tone: 'good', title: t('الرسوم والغرامات', 'Fees & penalties'), figure: x.short(cur.fees), text: t(`مقابل ${x.short(prev.fees)} في ${x.prevLabel}.`, `vs ${x.short(prev.fees)} in ${x.prevLabel}.`) });
  } else if (due.due > 0) {
    insights.push({
      tone: due.rate !== null && due.rate >= 90 ? 'good' : 'warn',
      title: t('مستحقات الفترة', 'Dues of the period'),
      figure: `${due.rate ?? 0}%`,
      text: t(`سُدّد من ${x.money(due.due)}، والباقي ${x.money(due.open)}.`, `${x.money(due.settled)} of ${x.money(due.due)} settled; ${x.money(due.open)} left.`),
    });
  } else {
    insights.push({ tone: 'warn', title: t('مستحقات الفترة', 'Dues of the period'), figure: '—', text: t('لا أقساط مستحقة في هذه الفترة.', 'No instalments fell due in this period.') });
  }
  const dS = cur.contractsSigned - prev.contractsSigned;
  insights.push({
    tone: dS < 0 ? 'bad' : dS > 0 ? 'good' : 'warn',
    title: t('العقود الموقّعة', 'Contracts signed'),
    figure: x.count(cur.contractsSigned),
    text: t(`مقابل ${x.count(prev.contractsSigned)} في ${x.prevLabel}.`, `vs ${x.count(prev.contractsSigned)} in ${x.prevLabel}.`),
  });
  {
    const totalCur = c.byProject.reduce((n, p) => n + p.cur, 0);
    const lead = [...c.byProject].sort((a, b) => b.cur - a.cur)[0];
    insights.push({
      tone: 'good',
      title: t('أكبر مشروع تحصيلًا', 'Top project'),
      figure: lead && totalCur > 0 ? `${Math.round((lead.cur / totalCur) * 100)}%` : '—',
      text: lead && totalCur > 0 ? t(`من المحصّل جاء من ${x.name(lead.name)}.`, `of the collected came from ${x.name(lead.name)}.`) : t('لا تحصيل في الفترة.', 'Nothing collected in the period.'),
    });
  }

  // ── Splits ───────────────────────────────────────────────────────────
  const split = (list: Split[], label: (s: Split) => string): CompareSplit[] =>
    list.filter((s) => s.cur > 0 || s.prev > 0).slice(0, 5).map((s) => ({ name: label(s), cur: s.cur, prev: s.prev }));

  const dueRow = (label: string, a: number, b: number, higherBetter: boolean): { label: string; cur: string; prev: string; diff: string; tone: Tone } => ({
    label, cur: x.short(a), prev: x.short(b), diff: a === b ? '0' : moneyDiff(a, b), tone: tone(a - b, higherBetter),
  });

  return {
    labels: {
      kpiTitle: t('مؤشرات الأداء', 'Key figures'),
      kpiSub: (a, b) => t(`${a} مقابل ${b}، مع اتجاه آخر 12 شهرًا`, `${a} vs ${b}, with the last 12 months’ trend`),
      driversTitle: t('من أين جاء الفرق', 'Where the difference came from'),
      driversSub: (a, b) => t(`ما الذي غيّر المحصّل بين ${a} و${b}`, `What moved the collected between ${a} and ${b}`),
      driversBy: t('الفرق بحسب المشروع', 'By project'),
      driversShare: (p) => t(`${p}٪ من الفرق`, `${p}% of the change`),
      asOfNote: t('أرقام «حتى اليوم»: لا تتأثر بالفترة المختارة ولا تدخل في المقارنة.', '“To date” figures: they do not depend on the chosen period and are not compared.'),
      cumTitle: t('التحصيل التراكمي يومًا بيوم', 'Collected, day by day'),
      cumSub: t('كم تجمّع من الأموال منذ بداية الفترة، مقارنة بنفس اليوم في الفترة الأخرى', 'How much has come in since the period began, against the same day of the other period'),
      cumUntil: (n) => t(`حتى اليوم ${n}:`, `By day ${n}:`),
      cumDays: t('يوم الفترة', 'Day of the period'),
      cumUnit: { million: t('مليون', 'million'), thousand: t('ألف', 'thousand') },
      dueTitle: t('مستحقات الفترة', 'Dues of the period'),
      dueSub: t('ما حلّ موعده في الفترة، وكم سُدّد منه حتى الآن', 'What fell due in the period, and how much of it is settled by now'),
      dueNote: t('ما لم يُسدَّد من مستحقات الفترة يحتاج متابعة، وكلما تأخر زادت صعوبة تحصيله.', 'What is still unpaid from the period needs follow-up; the longer it waits, the harder it is to collect.'),
      colMetric: t('المؤشر', 'Figure'), colDiff: t('الفرق', 'Change'), colTrend: t('الاتجاه', 'Trend'),
      noChange: t('لا بيانات في الفترتين.', 'No data in either period.'),
      splitUnit: '',
    },
    money: x.money,
    short: x.short,
    periodLabel: x.periodLabel,
    prevLabel: x.prevLabel,
    band,
    insights,
    rows,
    bridge: { from: prev.collected, to: cur.collected, fromLabel: x.prevLabel, toLabel: x.periodLabel, steps },
    asOf: [
      { label: t('المستحق حتى اليوم', 'Due to date'), value: x.short(x.asOf.dueToDate) },
      { label: t('المتأخر', 'Overdue'), value: x.short(x.asOf.overdue), tone: x.asOf.overdue > 0 ? 'danger' : undefined },
      { label: t('قيمة العقود', 'Contract value'), value: x.short(x.asOf.contractValue) },
    ],
    cumulative: { cur: c.cumulative.current, prev: c.cumulative.previous, days: Math.max(c.days.current, c.days.previous) },
    due: !due || !dueP ? [] : [
      dueRow(t('حلّ موعده', 'Fell due'), due.due, dueP.due, true),
      dueRow(t('سُدّد منه', 'Settled'), due.settled, dueP.settled, true),
      dueRow(t('لم يُسدَّد', 'Unpaid'), due.open, dueP.open, false),
      { label: t('نسبة السداد', 'Settled share'), cur: due.rate === null ? '—' : `${due.rate}%`, prev: dueP.rate === null ? '—' : `${dueP.rate}%`, diff: due.rate !== null && dueP.rate !== null && due.rate !== dueP.rate ? `${sign(due.rate - dueP.rate)}${Math.abs(due.rate - dueP.rate)} ${t('نقطة', 'pts')}` : '0', tone: due.rate !== null && dueP.rate !== null ? tone(due.rate - dueP.rate, true) : 0 },
    ],
    splits: [
      { title: t('حسب المشروع', 'By project'), sub: t('المحصّل في الفترتين', 'Collected in both periods'), rows: split(c.byProject, (s) => x.name(s.name)) },
      { title: t('حسب نوع الدفعة', 'By payment type'), sub: t('المحصّل في الفترتين', 'Collected in both periods'), rows: split(c.byType, (s) => x.typeLabel(s.key)) },
      { title: t('حسب مسؤول المبيعات', 'By salesperson'), sub: t('تحصيل عقود كل مسؤول', 'Collected on each one’s deals'), rows: split(c.bySales, (s) => String(s.name ?? '—')) },
    ],
  };
}

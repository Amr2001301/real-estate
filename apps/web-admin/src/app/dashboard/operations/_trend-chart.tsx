/**
 * The operations center's activity trend: events per day as a soft gold area
 * with a line and a dot per day (each with its count on hover). Plain SVG —
 * server-rendered, no chart runtime — and drawn left to right in both
 * languages (time reads that way on a chart).
 */
export function ActivityTrendChart({
  days,
  label,
  format,
}: {
  days: Array<{ date: string; count: number }>;
  /** Accessible name of the chart. */
  label: string;
  /** The hover text of a day ("12 events · 18 Oct"). */
  format: (count: number, date: string) => string;
}) {
  const W = 640;
  const H = 168;
  const PAD_X = 8;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 8;
  const max = Math.max(1, ...days.map((d) => d.count));
  const step = days.length > 1 ? (W - PAD_X * 2) / (days.length - 1) : 0;
  const x = (i: number) => PAD_X + i * step;
  const y = (n: number) => PAD_TOP + (1 - n / max) * (H - PAD_TOP - PAD_BOTTOM);
  const points = days.map((d, i) => [x(i), y(d.count)] as const);
  // A gentle curve through the points (midpoint smoothing).
  const line = points.reduce((path, [px, py], i) => {
    if (i === 0) return `M ${px} ${py}`;
    const [qx, qy] = points[i - 1]!;
    const cx = (qx + px) / 2;
    return `${path} C ${cx} ${qy}, ${cx} ${py}, ${px} ${py}`;
  }, '');
  const area = points.length
    ? `${line} L ${points.at(-1)![0]} ${H} L ${points[0]![0]} ${H} Z`
    : '';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="h-auto w-full overflow-visible text-brand-500"
      data-testid="ops-trend"
    >
      <defs>
        <linearGradient id="ops-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Guide lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
          y2={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
          className="stroke-hairline"
          strokeDasharray="3 6"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill="url(#ops-trend-fill)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([px, py], i) => {
        const d = days[i]!;
        const last = i === points.length - 1;
        return (
          <g key={d.date}>
            <title>{format(d.count, d.date)}</title>
            {/* A wide hit area per day for the hover text. */}
            <rect x={px - step / 2} y={0} width={Math.max(step, 1)} height={H} fill="transparent" />
            <circle
              cx={px}
              cy={py}
              r={last ? 4.5 : 2.5}
              className={last ? 'fill-brand-500 stroke-surface' : 'fill-surface stroke-brand-500'}
              strokeWidth={last ? 3 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

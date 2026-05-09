import { cn } from '@/lib/cn';

export interface LeadSourceSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: LeadSourceSlice[];
  centerLabel?: string;
  centerSub?: string;
  className?: string;
}

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LeadSourceDonut({
  slices,
  centerLabel,
  centerSub,
  className,
}: Props) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;

  let offset = 0;
  const segments = slices.map((s) => {
    const fraction = s.value / total;
    const length = fraction * CIRCUMFERENCE;
    const dasharray = `${length} ${CIRCUMFERENCE - length}`;
    const dashoffset = -offset;
    offset += length;
    return { ...s, dasharray, dashoffset };
  });

  return (
    <div className={cn('flex flex-col items-center gap-5 py-2', className)}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgb(226 232 240 / 0.6)"
            strokeWidth={STROKE}
          />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {centerLabel}
            </span>
          )}
          {centerSub && (
            <span className="text-xs text-slate-500 mt-0.5">{centerSub}</span>
          )}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-slate-600">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-medium text-slate-700">{s.label}</span>
            <span className="ms-auto text-slate-500 tabular-nums">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

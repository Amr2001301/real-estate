import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A filter field with its name printed small above the chosen value
 * («المدينة» over «كل المدن»), so a narrow field never cuts the text the way
 * an icon-only select did. A real <select> fills the box for the keyboard and
 * screen readers.
 */
export function FieldSelect({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative flex h-[52px] min-w-0 flex-col justify-center rounded-2xl border border-hairline bg-canvas pe-9 ps-4 transition-colors focus-within:border-navy/50 focus-within:ring-2 focus-within:ring-navy/15',
        className,
      )}
    >
      <span className="text-[11px] leading-tight text-ink-muted">{label}</span>
      <select
        value={value}
        aria-label={label}
        data-bare
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none truncate bg-transparent text-[15px] text-ink-strong outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
    </label>
  );
}

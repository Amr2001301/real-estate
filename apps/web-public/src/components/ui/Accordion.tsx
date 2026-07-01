import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Open the first item by default. */
  defaultOpenFirst?: boolean;
  className?: string;
}

/**
 * Premium FAQ accordion built on native <details>/<summary> — fully
 * accessible and keyboard-friendly with no JavaScript. RTL-safe.
 */
export function Accordion({ items, defaultOpenFirst = false, className }: AccordionProps) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card',
        className,
      )}
    >
      {items.map((item, i) => (
        <details
          key={i}
          open={defaultOpenFirst && i === 0}
          className="group border-b border-hairline/60 last:border-0 open:bg-gold-50/30 transition-colors duration-200"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-surface-soft/50 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold text-ink-strong leading-snug">{item.question}</span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-500 ring-1 ring-gold-100 transition-transform duration-300 group-open:rotate-180">
              <ChevronDown className="h-4 w-4" aria-hidden />
            </span>
          </summary>
          <div className="px-6 pb-6 pt-1 text-sm leading-relaxed text-ink-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

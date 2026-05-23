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
 * Premium FAQ/info accordion built on native <details>/<summary> — fully
 * accessible and keyboard-friendly with no JavaScript. RTL-safe.
 */
export function Accordion({ items, defaultOpenFirst = false, className }: AccordionProps) {
  if (items.length === 0) return null;
  return (
    <div className={cn('divide-y divide-hairline overflow-hidden rounded-3xl border border-hairline bg-surface shadow-soft', className)}>
      {items.map((item, i) => (
        <details key={i} open={defaultOpenFirst && i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-navy transition-colors hover:bg-surface-soft/60 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">{item.question}</span>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-gold-500 transition-transform duration-300 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

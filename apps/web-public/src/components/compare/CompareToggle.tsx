'use client';

import { Check, Scale } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCompare, type CompareItem } from './CompareContext';

/**
 * Compare selection control overlaid on a unit card. Rendered as a sibling of
 * the card's link (not nested), and stops propagation, so toggling never
 * triggers navigation.
 */
export function CompareToggle({ item }: { item: CompareItem }) {
  const { isSelected, toggle } = useCompare();
  const selected = isSelected(item.id);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? 'إزالة من المقارنة' : 'إضافة إلى المقارنة'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur-sm transition-all duration-200',
        selected
          ? 'bg-gold-400 text-navy ring-gold-300'
          : 'bg-white/80 text-ink-strong ring-black/5 hover:bg-white hover:text-navy',
      )}
    >
      {selected ? <Check className="h-4 w-4" aria-hidden /> : <Scale className="h-4 w-4" aria-hidden />}
    </button>
  );
}

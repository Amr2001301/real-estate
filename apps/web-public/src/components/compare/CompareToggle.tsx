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
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-soft backdrop-blur-md transition-colors',
        selected
          ? 'bg-gold-400 text-navy'
          : 'bg-surface/90 text-navy hover:bg-surface',
      )}
    >
      {selected ? <Check className="h-4 w-4" aria-hidden /> : <Scale className="h-4 w-4" aria-hidden />}
      {selected ? 'في المقارنة' : 'قارن'}
    </button>
  );
}

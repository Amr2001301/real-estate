import { Check } from 'lucide-react';
import { pickAr } from '@/lib/format';
import type { Translatable } from '@/lib/api-types';
import { Stagger } from '@/components/motion/Stagger';

/** Renders services/amenities as premium vertical feature tiles. Returns null when empty. */
export function ProjectAmenities({ services }: { services: Translatable[] }) {
  const items = (services ?? []).map((s) => pickAr(s)).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div>
      {/* Section heading — small label + strong title, no double-heading feel */}
      <div>
        <div className="mb-3 h-0.5 w-10 rounded-full bg-gold-400" />
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
          المرافق والخدمات
        </span>
        <h2 className="mt-1.5 text-[1.65rem] font-bold leading-tight text-ink-strong sm:text-3xl">
          ما يميّز هذا المشروع
        </h2>
      </div>

      {/* Feature tiles — horizontal: icon anchored, text flows beside it.
          Height is content-driven, never stretched by the grid row. */}
      <Stagger className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" step={60}>
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface px-4 py-4 shadow-soft transition-shadow duration-200 hover:shadow-card"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-50 to-white shadow-[0_1px_4px_-1px_rgba(200,162,75,0.18)] ring-1 ring-gold-100/80">
              <Check className="h-4 w-4 stroke-[2.5] text-gold-600" aria-hidden />
            </span>
            <span className="text-sm font-medium leading-snug text-ink-strong">{item}</span>
          </div>
        ))}
      </Stagger>
    </div>
  );
}

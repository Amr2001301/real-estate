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

      {/* Feature tiles — vertical layout with gold gradient background */}
      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" step={60}>
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex flex-col gap-3.5 rounded-2xl border border-gold-100/80 bg-gradient-to-br from-gold-50/70 to-white p-5 shadow-soft transition-shadow duration-200 hover:shadow-card"
          >
            {/* Gold check icon at top */}
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
              <Check className="h-5 w-5 stroke-[2.5]" aria-hidden />
            </span>
            {/* Feature label */}
            <span className="font-medium leading-snug text-ink-strong">{item}</span>
          </div>
        ))}
      </Stagger>
    </div>
  );
}

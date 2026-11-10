import { Check } from 'lucide-react';
import { pickAr } from '@/lib/format';
import type { Translatable } from '@/lib/api-types';
import { Stagger } from '@/components/motion/Stagger';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';
import { DetailHead } from '@/components/detail/DetailStats';

/** Renders services/amenities as premium vertical feature tiles. Returns null when empty. */
export function ProjectAmenities({ services, locale = 'ar' }: { services: Translatable[]; locale?: Locale }) {
  const t = extraT(locale).amenities;
  const items = (services ?? []).map((s) => pickAr(s, '', locale)).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div>
      <DetailHead eyebrow={t.eyebrow} title={t.title} />

      {/* Feature tiles — horizontal: icon anchored, text flows beside it.
          Height is content-driven, never stretched by the grid row. */}
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" step={60}>
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-3.5 rounded-2xl border border-hairline bg-surface px-5 py-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15">
              <Check className="h-4 w-4 stroke-[2.5] text-gold-600" aria-hidden />
            </span>
            <span className="text-[15px] font-medium leading-snug text-ink-strong">{item}</span>
          </div>
        ))}
      </Stagger>
    </div>
  );
}

import { Check } from 'lucide-react';
import { pickAr } from '@/lib/format';
import type { Translatable } from '@/lib/api-types';
import { SectionHeading } from '@/components/ui/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { Stagger } from '@/components/motion/Stagger';

/** Renders services/amenities. Returns null when there are none (no big empty card). */
export function ProjectAmenities({ services }: { services: Translatable[] }) {
  const items = (services ?? []).map((s) => pickAr(s)).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div>
      <SectionHeading eyebrow="المرافق والخدمات" title="ما يميّز هذا المشروع" />
      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" step={60}>
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-soft"
          >
            <IconCircle tone="gold" className="h-10 w-10">
              <Check className="h-5 w-5" aria-hidden />
            </IconCircle>
            <span className="text-ink-strong">{item}</span>
          </div>
        ))}
      </Stagger>
    </div>
  );
}

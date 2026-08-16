import Link from 'next/link';
import { Home } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Stagger } from '@/components/motion/Stagger';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { UnitCard } from './UnitCard';

export function FeaturedUnits({
  result,
  locale,
}: {
  result: ApiResult<Paginated<PublicUnit>>;
  locale: Locale;
}) {
  const m = siteT(locale).home.units;
  const units = result.ok ? result.data.data : [];

  return (
    <Section tone="soft" className="py-10 sm:py-12 lg:py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink-strong lg:text-4xl">{m.title}</h2>
          <p className="mt-2 text-ink-muted">{m.sub}</p>
        </div>
        <Link
          href={routes.units}
          className="shrink-0 text-sm font-semibold text-gold-600 underline-offset-4 transition-colors hover:text-gold-700 hover:underline"
        >
          {m.viewAll}
        </Link>
      </div>

      <div className="mt-8">
        {!result.ok ? (
          <ErrorState
            title={m.errorTitle}
            message={m.errorMsg}
            className="mx-auto max-w-2xl"
          />
        ) : units.length === 0 ? (
          <EmptyState
            title={m.emptyTitle}
            message={m.emptyMsg}
            icon={<Home className="h-6 w-6" aria-hidden />}
            className="mx-auto max-w-2xl"
          />
        ) : (
          <Stagger className="grid gap-7 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={90}>
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </Stagger>
        )}
      </div>
    </Section>
  );
}

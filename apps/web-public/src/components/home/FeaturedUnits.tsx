import { Home } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Stagger } from '@/components/motion/Stagger';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SectionHead } from './SectionHead';
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
    <section className="pt-20 sm:pt-28">
      <Container>
        <SectionHead
          eyebrow={m.eyebrow}
          title={m.title}
          sub={m.sub}
          action={units.length > 0 ? { href: routes.units, label: m.viewAll } : undefined}
        />
        {!result.ok ? (
          <ErrorState title={m.errorTitle} message={m.errorMsg} className="mx-auto max-w-2xl" />
        ) : units.length === 0 ? (
          <EmptyState
            title={m.emptyTitle}
            message={m.emptyMsg}
            icon={<Home className="h-6 w-6" aria-hidden />}
            className="mx-auto max-w-2xl"
          />
        ) : (
          <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={90}>
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} locale={locale} />
            ))}
          </Stagger>
        )}
      </Container>
    </section>
  );
}

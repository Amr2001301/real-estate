import { Home } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger } from '@/components/motion/Stagger';
import { UnitCard } from './UnitCard';

export function FeaturedUnits({ result }: { result: ApiResult<Paginated<PublicUnit>> }) {
  const units = result.ok ? result.data.data : [];

  return (
    <Section tone="soft" className="pt-2 sm:pt-3 lg:pt-4">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="وحدات مميزة"
          title="وحدات فاخرة جاهزة لاستقبالك"
          description="تشكيلة من الوحدات المتاحة بمواصفات راقية تناسب أسلوب حياتك واستثمارك."
        />
        <Reveal>
          <ButtonLink href={routes.units} variant="outline" size="md">
            كل الوحدات
          </ButtonLink>
        </Reveal>
      </div>

      <div className="mt-12">
        {!result.ok ? (
          <ErrorState
            title="لم نتمكن من تحميل الوحدات حاليًا"
            message="سيتم عرض الوحدات المتاحة فور استعادة الاتصال."
            className="mx-auto max-w-2xl"
          />
        ) : units.length === 0 ? (
          <EmptyState
            title="لا توجد وحدات متاحة حاليًا"
            message="تواصل مع مستشار لمعرفة أحدث الإتاحات."
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

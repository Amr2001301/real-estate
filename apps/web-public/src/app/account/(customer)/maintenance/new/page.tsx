import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { Paginated, MeContract, MaintenanceCategoryRef } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { MaintenanceRequestForm, type SelectOption } from '@/components/account/MaintenanceRequestForm';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'طلب صيانة جديد',
  description: 'إنشاء طلب صيانة جديد في ديفورا.',
  robots: { index: false, follow: false },
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function Header() {
  return (
    <div className="space-y-4">
      <Link href={routes.accountMaintenance} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-500">
        <ArrowRight className="h-4 w-4" aria-hidden />
        العودة إلى الصيانة
      </Link>
      <AccountPageHeader
        title="طلب صيانة جديد"
        description="اختر الوحدة وفئة الصيانة واشرح المشكلة، وسيتابع فريقنا طلبك."
      />
    </div>
  );
}

/** Build unique owned-unit options from the customer's contracts. */
function deriveUnitOptions(contracts: MeContract[]): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];
  for (const c of contracts) {
    const unit = c.unit;
    if (!unit || seen.has(unit.id)) continue;
    seen.add(unit.id);
    const projectName = pickAr(unit.building?.phase?.project?.name ?? {});
    const label = [projectName, `${unitTypeLabel(unit.type)} · ${unit.code}`].filter(Boolean).join(' — ');
    options.push({ id: unit.id, label });
  }
  return options;
}

export default async function AccountMaintenanceNewPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const requestedUnitId = firstStr(sp.unitId);

  let contractsRes: Paginated<MeContract>;
  let categories: MaintenanceCategoryRef[];
  try {
    [contractsRes, categories] = await Promise.all([
      authFetch<Paginated<MeContract>>('/contracts/me/contracts?page=1&pageSize=100'),
      authFetch<MaintenanceCategoryRef[]>('/maintenance-categories'),
    ]);
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل البيانات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const units = deriveUnitOptions(contractsRes.data);
  const categoryOptions: SelectOption[] = categories.map((c) => ({ id: c.id, label: pickAr(c.name) || 'فئة' }));

  // Preselect ?unitId only if the customer actually owns it.
  const initialUnitId = units.some((u) => u.id === requestedUnitId) ? requestedUnitId : '';

  return (
    <div className="space-y-8">
      <Header />

      {units.length === 0 ? (
        <EmptyState
          title="لا توجد وحدات مسجّلة"
          message="تتوفر خدمة الصيانة بعد إتمام الشراء وتسجيل العقار. ستجد وحداتك في صفحة عقاراتي."
          icon={<Building2 className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountProperty} variant="outline" size="md">
              الذهاب إلى عقاراتي
            </ButtonLink>
          }
        />
      ) : categoryOptions.length === 0 ? (
        <InlineNotice tone="warning">
          لا تتوفر فئات صيانة حاليًا. يرجى التواصل مع فريق الدعم لإتمام طلبك.
        </InlineNotice>
      ) : (
        <PremiumCard className="p-6 sm:p-8">
          <MaintenanceRequestForm units={units} categories={categoryOptions} initialUnitId={initialUnitId} />
        </PremiumCard>
      )}
    </div>
  );
}

import { Scale } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { compactParts, formatDate, formatExactCurrency } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { PremiumPageHero } from '@/components/premium';
import { developersT, type ComparedPlan, type PlanOption } from '@/components/developers/messages';
import { Panel, Pill } from '@/app/dashboard/deals/_components/ui';
import { ComparePicker } from '../_components/compare-picker';
import { PrintButton } from '../_components/print-button';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const UUID = /^[0-9a-f-]{36}$/i;

/** BRK-5 — up to four plans from the directory on one price, side by side. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ price?: string; plans?: string }> }) {
  const [sp, locale, currency] = await Promise.all([searchParams, getLocale(), getReportsCurrency()]);
  const t = developersT(locale);
  const c = t.compare;
  const symbol = currencySymbol(currency, locale);
  const price = Number(sp.price);
  const ids = (sp.plans ?? '').split(',').filter((x) => UUID.test(x)).slice(0, 4);
  const [optionsRes, compared] = await Promise.all([
    safe(api.get<PlanOption[]>('/developers/plans/options')),
    price > 0 && ids.length ? safe(api.post<{ price: number; plans: ComparedPlan[] }>('/developers/plans/compare', { price, planIds: ids })) : Promise.resolve(null),
  ]);
  const plans = compared?.data?.plans ?? [];
  const money = (v: number) => formatExactCurrency(v, currency, locale);
  const installmentPlans = plans.filter((p) => !p.breakdown.cash);
  const minMonthly = installmentPlans.length > 1 ? Math.min(...installmentPlans.map((p) => p.breakdown.monthly)) : null;
  const minDown = installmentPlans.length > 1 ? Math.min(...installmentPlans.map((p) => p.breakdown.downPayment)) : null;

  return (
    <div className="flex flex-col gap-6" data-testid="compare-page">
      <PremiumPageHero
        eyebrow={t.list.title}
        title={c.title}
        description={c.desc}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: t.list.title, href: '/dashboard/developers' },
          { label: c.title },
        ]}
        actions={plans.length ? <PrintButton label={c.print} /> : undefined}
      />

      <Panel icon={<Scale />} title={c.plans} className="print:hidden">
        <ComparePicker locale={locale} plans={optionsRes.data ?? []} price={price > 0 ? String(price) : ''} selected={ids} />
      </Panel>

      {compared?.error && <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{compared.error}</div>}

      {plans.length > 0 && (
        <section data-testid="compare-results">
          <p className="mb-3 text-[13px] text-slate-500">
            {c.price}: <span className="num font-bold text-slate-900">{money(price)}</span>
          </p>
          <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', plans.length === 3 && 'xl:grid-cols-3', plans.length === 4 && 'xl:grid-cols-4')}>
            {plans.map((p) => {
              const b = p.breakdown;
              const best = (minMonthly !== null && b.monthly === minMonthly && !b.cash) || (minDown !== null && b.downPayment === minDown && !b.cash);
              return (
                <article
                  key={p.id}
                  className={cn('flex flex-col overflow-hidden rounded-[22px] border bg-surface', best ? 'border-[#D8B66A]/70 shadow-[0_18px_36px_-24px_rgb(184_140_58/0.7)]' : 'border-hairline')}
                  data-testid={`compare-card-${p.id}`}
                >
                  <header className="bg-navy-band px-5 py-4 text-[#F4ECD8]">
                    <p className="truncate text-[12px] text-[#A9B0BD]">{p.project.developer.name} — {p.project.name}</p>
                    <p className="mt-1 truncate font-heading text-[18px] font-bold">{p.name}</p>
                    <p className="num mt-0.5 text-[12px] text-[#D8B66A]">
                      {b.cash ? t.detail.cashLine(p.terms.cashDiscountPct) : t.detail.planLine(p.terms.downPaymentPct, p.terms.years, t.frequency[p.terms.frequency], p.terms.deliveryPct)}
                    </p>
                  </header>
                  <dl className="flex flex-1 flex-col gap-3 p-5 text-[13px]">
                    <div className="flex flex-wrap gap-1.5">
                      {minMonthly !== null && b.monthly === minMonthly && !b.cash && <Pill tone="gold">{c.lowestMonthly}</Pill>}
                      {minDown !== null && b.downPayment === minDown && !b.cash && <Pill tone="green">{c.lowestDown}</Pill>}
                      {b.cash && b.total < price && <Pill tone="green">{c.saving(compactParts(price - b.total, symbol, locale).join(' '))}</Pill>}
                    </div>
                    {b.cash ? (
                      <div>
                        <dt className="text-slate-500">{c.cash}</dt>
                        <dd className="num mt-1 font-heading text-[24px] font-bold text-slate-900">{money(b.total)}</dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt className="text-slate-500">{c.monthly}</dt>
                          <dd className="num mt-1 font-heading text-[24px] font-bold text-brand-700">{money(b.monthly)}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 border-t border-hairline pt-3">
                          <dt className="text-slate-500">{c.downPayment}</dt>
                          <dd className="num font-bold text-slate-900">{money(b.downPayment)}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-slate-500">{c.installment} <span className="text-[11.5px]">({c.installments(b.installments)})</span></dt>
                          <dd className="num font-bold text-slate-900">{money(b.installment)}</dd>
                        </div>
                        {b.deliveryPayment > 0 && (
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="text-slate-500">{c.delivery}</dt>
                            <dd className="num font-bold text-slate-900">{money(b.deliveryPayment)}</dd>
                          </div>
                        )}
                      </>
                    )}
                    <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-hairline pt-3">
                      <dt className="font-bold text-slate-700">{c.total}</dt>
                      <dd className="num font-bold text-slate-900">{money(b.total)}</dd>
                    </div>
                    {p.project.deliveryDate && (
                      <p className="text-[12px] text-slate-500">{c.handover}: {formatDate(p.project.deliveryDate, locale)}</p>
                    )}
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Info, TrendingUp } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Project, UnitTypeOption } from '@/lib/types';
import { formatDate, formatExactCurrency, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { uiT } from '@/messages/ui';
import { prT } from '@/messages/price-rates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { setPriceRateAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface RateRow {
  unitType: string | null;
  units: number;
  forSale: number;
  marketPricePerMeter: string | null;
  manual: { pricePerMeter: string; recordedAt: string } | null;
}

/**
 * «أسعار المتر الحالية»: per unit type, today's average price per meter of
 * the units for sale and the company's own figure — what «قيمة وحدتك» values
 * an owner's unit with. The own figure is for a type that sold out.
 */
export default async function ProjectPricesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [{ id }, sp, locale, session, currency] = await Promise.all([params, searchParams, getLocale(), getSession(), getReportsCurrency()]);
  if (session?.role !== 'ADMIN' && !(await can('units:update'))) redirect(`/dashboard/projects/${id}` as never);
  const [projectRes, ratesRes, typesRes, settingRes] = await Promise.all([
    safe(api.get<Project>(`/projects/${id}`)),
    safe(api.get<{ project: RateRow; types: RateRow[] }>(`/projects/${id}/price-rates`)),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
    safe(api.get<{ value: unknown }>('/settings/unitValue.enabled')),
  ]);
  const t = prT(locale);
  const projectName = tx(projectRes.data?.name, locale) || '';
  const typeName = (code: string | null) =>
    code === null ? t.wholeProject : tx(typesRes.data?.find((x) => x.code === code)?.name, locale) || code;
  const money = (v: string | null | undefined) => (v ? formatExactCurrency(v, currency, locale) : '—');
  const enabled = settingRes.data?.value === true;
  const rows = ratesRes.data ? [...ratesRes.data.types, ratesRes.data.project] : [];

  return (
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: projectName, href: `/dashboard/projects/${id}` },
          { label: t.title },
        ]}
      />

      {!enabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <span>{t.off}</span>
          <Link href={'/dashboard/settings?q=unitValue' as never} className="font-semibold underline">
            {t.settingsLink}
          </Link>
        </div>
      )}
      {sp.err && (
        <div role="alert" className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && !sp.err && (
        <div className="rounded-[20px] bg-success-50 border border-success-100 text-success-700 px-4 py-3 text-sm">{t.saved}</div>
      )}
      {ratesRes.error && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">{ratesRes.error}</div>
      )}

      <PremiumSectionCard title={t.title} icon={<TrendingUp />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="price-rates">
            <thead>
              <tr className="border-b border-hairline text-start text-xs text-slate-500">
                <th className="py-2 pe-3 text-start font-medium">{t.colType}</th>
                <th className="py-2 pe-3 text-start font-medium">{t.colUnits}</th>
                <th className="py-2 pe-3 text-start font-medium">{t.colMarket}</th>
                <th className="py-2 pe-3 text-start font-medium">{t.colManual}</th>
                <th className="py-2 text-start font-medium">{t.colNew}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unitType ?? '*'} className={`border-b border-hairline last:border-0 ${r.unitType === null ? 'bg-surface-muted/40' : ''}`}>
                  <td className="py-3 pe-3 font-semibold text-navy">{typeName(r.unitType)}</td>
                  <td className="py-3 pe-3 text-slate-600">{r.forSale > 0 ? t.forSale(r.forSale, r.units) : t.noneForSale}</td>
                  <td className="py-3 pe-3 font-mono" dir="ltr">{money(r.marketPricePerMeter)}</td>
                  <td className="py-3 pe-3">
                    {r.manual ? (
                      <div className="flex flex-col">
                        <span className="font-mono" dir="ltr">{money(r.manual.pricePerMeter)}</span>
                        <span className="text-xs text-slate-500">{t.since(formatDate(r.manual.recordedAt, locale))}</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3">
                    <form action={setPriceRateAction.bind(null, id, r.unitType)} className="flex items-center gap-2">
                      <Input
                        name="pricePerMeter"
                        type="number"
                        step="0.01"
                        min={1}
                        required
                        dir="ltr"
                        className="w-36"
                        placeholder={t.perMeter}
                        aria-label={`${t.colNew} — ${typeName(r.unitType)}`}
                      />
                      <Button type="submit" variant="outline" size="sm">{t.save}</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumSectionCard>

      <PremiumSectionCard title={t.howTitle} icon={<Info />}>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm text-slate-600">
          {t.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </PremiumSectionCard>
    </div>
  );
}

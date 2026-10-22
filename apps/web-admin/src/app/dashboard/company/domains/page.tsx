import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { PremiumPageHero } from '@/components/premium';
import { domainsT } from './messages';
import { DomainCard, type DomainView } from './_components/domain-card';
import { AddDomainForm } from './_components/add-domain-form';

export const dynamic = 'force-dynamic';

async function fetchDomains(): Promise<DomainView[]> {
  try {
    return await api.get<DomainView[]>('/company-domains');
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}

export default async function DomainsPage() {
  const [domains, locale] = await Promise.all([fetchDomains(), getLocale()]);
  const m = domainsT(locale);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title }]}
      />

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2" data-testid="domain-list">
          {domains.length === 0 ? (
            <p className="rounded-[22px] border border-hairline bg-surface px-6 py-10 text-center text-[13px] text-slate-500">{m.empty}</p>
          ) : (
            domains.map((d) => <DomainCard key={d.id} d={d} m={m} locale={locale} />)
          )}
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <section className="rounded-[22px] border border-hairline bg-surface p-6">
            <AddDomainForm m={m} />
          </section>
          <section className="overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band p-6 text-[#F4ECD8]">
            <h2 className="font-heading text-[17px] font-bold text-[#F4ECD8]">{m.steps.title}</h2>
            <ol className="mt-4 space-y-3">
              {m.steps.items.map((s, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-[#D9DEE7]">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D8B66A]/50 text-[11.5px] font-bold text-[#D8B66A]">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-[#D8B66A]/20 pt-3 text-[12px] text-[#A9B0BD]">{m.steps.note}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

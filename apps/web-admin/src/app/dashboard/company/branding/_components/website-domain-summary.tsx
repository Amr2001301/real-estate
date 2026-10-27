import { Globe, Info } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { PremiumSectionCard } from '@/components/premium';
import { DomainCard, PlatformAddressLine, type DomainView } from '@/components/website-domain/domain-card';
import { domainT } from '@/components/website-domain/messages';

/**
 * «دومين الموقع» as the company sees it: the addresses its website is served
 * on. Adding or changing one is the platform owner's (super-admin company page).
 */
export function WebsiteDomainSummary({ domains, locale }: { domains: DomainView[]; locale: Locale }) {
  const m = domainT(locale);
  return (
    <PremiumSectionCard title={m.title} description={m.company.description} icon={<Globe className="h-4 w-4" />}>
      <div data-testid="website-domain-summary" className="flex flex-col gap-3">
        {domains
          .filter((d) => d.type === 'CUSTOM')
          .map((d) => (
            <DomainCard key={d.id} d={d} m={m} locale={locale} />
          ))}
        {domains
          .filter((d) => d.type === 'PLATFORM_SUBDOMAIN')
          .map((d) => (
            <PlatformAddressLine key={d.id} d={d} m={m} />
          ))}
        <p className="flex items-start gap-2 rounded-xl bg-surface-muted/60 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          {m.company.managed}
        </p>
      </div>
    </PremiumSectionCard>
  );
}

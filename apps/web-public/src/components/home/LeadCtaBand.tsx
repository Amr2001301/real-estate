import { Headset } from 'lucide-react';
import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { CtaBand } from '@/components/marketing/CtaBand';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

export function LeadCtaBand({ locale }: { locale: Locale }) {
  const m = siteT(locale).home.cta;

  return (
    <CtaBand
      eyebrow={m.eyebrow}
      title={m.title}
      description={m.desc}
    >
      <ButtonLink
        href={routes.contact}
        variant="gold"
        size="lg"
        className="shadow-[0_16px_40px_-14px_rgba(200,162,75,0.55)]"
      >
        <Headset className="h-5 w-5" aria-hidden />
        {m.cta1}
      </ButtonLink>
      <ButtonLink
        href={routes.units}
        variant="outline"
        size="lg"
        className="border-white/30 text-white hover:border-white/60 hover:bg-white/10"
      >
        {m.cta2}
      </ButtonLink>
    </CtaBand>
  );
}

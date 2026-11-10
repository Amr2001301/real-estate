'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import { Phone, CalendarDays } from 'lucide-react';
import { telHref, whatsappHref } from '@/lib/contact';
import { useCompanyContact } from '@/components/contact/CompanyContactProvider';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { extraT } from '@/messages/site-extra';

/**
 * The booking card beside a unit or project: the headline figure, a visit
 * request, call and WhatsApp (the number is never printed), and the page's
 * own tools. On a phone the same actions sit in a bar at the foot.
 */
export function DetailBookingCard({
  eyebrow,
  status,
  headline,
  lines,
  visitHref,
  infoHref,
  waMessage,
  tools,
}: {
  eyebrow?: string;
  status?: string;
  headline: ReactNode;
  lines?: ReactNode[];
  visitHref: string;
  infoHref: string;
  waMessage: string;
  tools?: ReactNode;
}) {
  const t = extraT(useSiteLocale()).unitPage;
  const { phone, whatsapp } = useCompanyContact();
  const waHref = whatsapp ? whatsappHref(whatsapp, waMessage) : null;
  const shown = (lines ?? []).filter(Boolean);

  return (
    <>
      <div className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            {eyebrow && <p className="text-[13px] font-medium text-ink-muted">{eyebrow}</p>}
            {status && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{status}</span>}
          </div>
          <div className="mt-2 font-display text-[1.9rem] font-semibold leading-tight text-ink-strong">{headline}</div>
          {shown.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-hairline pt-4 text-[14px] text-ink-muted">
              {shown.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-hairline px-6 py-5">
          <a href={visitHref} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gold-400 px-5 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300">
            <CalendarDays className="h-5 w-5" aria-hidden />
            {t.bookVisit}
          </a>
          <div className="grid grid-cols-2 gap-2.5">
            <a href={phone ? telHref(phone) : (infoHref as Route)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-hairline text-[15px] font-semibold text-ink-strong transition-colors hover:bg-surface-soft">
              <Phone className="h-[18px] w-[18px]" aria-hidden />
              {t.callNow}
            </a>
            <a href={waHref ?? infoHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 text-[15px] font-semibold text-ink-strong transition-colors hover:bg-[#25D366]/[0.08]">
              <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />
              {t.whatsapp}
            </a>
          </div>
        </div>
        {tools && <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-4">{tools}</div>}
        <p className="border-t border-hairline px-6 py-3.5 text-xs text-ink-muted">{t.trust}</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur-lg lg:hidden" role="region" aria-label={t.bookVisit}>
        <div className="mx-auto flex max-w-md items-center gap-2">
          <a href={visitHref} className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gold-400 text-[15px] font-semibold text-[#1B1206]">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            {t.bookVisit}
          </a>
          {phone && (
            <a href={telHref(phone)} aria-label={t.callNow} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hairline text-ink-strong">
              <Phone className="h-5 w-5" aria-hidden />
            </a>
          )}
          {waHref && (
            <a href={waHref} aria-label={t.whatsapp} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#25D366]/40">
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/** The hero's two actions: a visit request and WhatsApp. */
export function HeroActions({ visitHref, waMessage }: { visitHref: string; waMessage: string }) {
  const t = extraT(useSiteLocale()).unitPage;
  const { whatsapp } = useCompanyContact();
  return (
    <>
      <a href={visitHref} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300">
        <CalendarDays className="h-5 w-5" aria-hidden />
        {t.bookVisit}
      </a>
      {whatsapp && (
        <a href={whatsappHref(whatsapp, waMessage)} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/[0.12] px-6 text-[15px] font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20">
          <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
          {t.whatsapp}
        </a>
      )}
    </>
  );
}

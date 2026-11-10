'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import { Phone, CalendarDays, ShieldCheck } from 'lucide-react';
import { DEEP_BG } from '@/components/home/Hero';
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
  headSub,
  rows,
  visitHref,
  infoHref,
  waMessage,
}: {
  eyebrow?: string;
  status?: string;
  headline: ReactNode;
  headSub?: ReactNode;
  /** The terms under the price: down payment, instalment, handover… */
  rows?: ({ label: string; value: ReactNode; testId?: string } | null)[];
  visitHref: string;
  infoHref: string;
  waMessage: string;
}) {
  const t = extraT(useSiteLocale()).unitPage;
  const { phone, whatsapp } = useCompanyContact();
  const waHref = whatsapp ? whatsappHref(whatsapp, waMessage) : null;
  const shown = (rows ?? []).filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <>
      <div className="overflow-hidden rounded-[1.5rem] bg-surface shadow-[0_30px_70px_-34px_rgba(0,0,0,0.45)] ring-1 ring-hairline">
        {/* The company's deep colour carries the headline figure. */}
        <div className="relative overflow-hidden px-7 pb-7 pt-6 text-white" style={{ background: DEEP_BG }}>
          <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
          <div className="relative flex items-center justify-between gap-3">
            {eyebrow && <p className="truncate text-[13px] font-medium text-white/70">{eyebrow}</p>}
            {status && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gold-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-300" aria-hidden />
                {status}
              </span>
            )}
          </div>
          <div className="relative mt-3 font-display text-[2.1rem] font-semibold leading-tight">{headline}</div>
          {headSub && <div className="relative mt-1 text-sm text-white/65">{headSub}</div>}
        </div>

        {shown.length > 0 && (
          <dl className="divide-y divide-hairline px-7">
            {shown.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 py-4" data-testid={r.testId}>
                <dt className="text-[14px] text-ink-muted">{r.label}</dt>
                <dd className="text-end text-[15px] font-semibold text-ink-strong">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-col gap-2.5 px-7 pb-7 pt-3">
          <a href={visitHref} className="inline-flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-gold-400 px-5 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300">
            <CalendarDays className="h-5 w-5" aria-hidden />
            {t.bookVisit}
          </a>
          <div className="grid grid-cols-2 gap-2.5">
            <a href={phone ? telHref(phone) : (infoHref as Route)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface-soft text-[15px] font-semibold text-ink-strong transition-colors hover:bg-hairline/60">
              <Phone className="h-[18px] w-[18px]" aria-hidden />
              {t.callNow}
            </a>
            <a href={waHref ?? infoHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface-soft text-[15px] font-semibold text-ink-strong transition-colors hover:bg-hairline/60">
              <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />
              {t.whatsapp}
            </a>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t.trust}
          </p>
        </div>
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

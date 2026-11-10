'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import { Phone, CalendarDays } from 'lucide-react';
import { Price } from '@/components/currency/CurrencyProvider';
import { routes } from '@/lib/routes';
import { telHref, whatsappHref } from '@/lib/contact';
import { useCompanyContact } from '@/components/contact/CompanyContactProvider';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { formatNumber } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { extraT } from '@/messages/site-extra';

/**
 * The booking card beside the unit: the price and its state, the down payment
 * (from the unit's public payment plan, when there is one), a visit request,
 * call and WhatsApp (never printing the number), and save / compare / share.
 * On a phone the same three actions sit in a bar at the foot of the screen.
 */
export function UnitInquiryCard({
  unitId,
  price,
  unitCode,
  projectName,
  statusLabel,
  down,
  locale,
  tools,
}: {
  unitId: string;
  price: string;
  unitCode?: string;
  projectName?: string;
  statusLabel?: string;
  down?: { percent: number; amount: number } | null;
  locale: Locale;
  /** Compare / share buttons, placed by the page. */
  tools?: ReactNode;
}) {
  const t = siteT(locale).unitInquiry;
  const x = extraT(locale).unitPage;
  const info = `${routes.contact}?unitId=${unitId}` as Route;
  const visit = `${routes.contact}?type=visit&unitId=${unitId}` as Route;
  const { phone, whatsapp } = useCompanyContact();
  const subject = unitCode ? t.waUnitSubject(unitCode) : t.waThisUnit;
  const waHref = whatsapp ? whatsappHref(whatsapp, t.waInterest(subject, projectName ?? '')) : null;

  return (
    <>
      <div className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)]">
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            {unitCode && <p className="text-xs font-medium text-ink-muted">{t.unitCode} {unitCode}</p>}
            {statusLabel && (
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">{statusLabel}</span>
            )}
          </div>
          <p className="mt-2 font-display text-[2rem] font-semibold leading-tight text-ink-strong">
            <Price value={price} />
          </p>
          {down && down.percent > 0 && (
            <p className="mt-1.5 text-sm text-ink-muted" data-testid="unit-down-payment">
              {x.downFrom(formatNumber(down.percent, locale))}
              {down.amount > 0 && <> · <Price value={down.amount} /></>}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-hairline px-6 py-5">
          <a
            href={visit}
            className="inline-flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gold-400 px-5 text-[15px] font-semibold text-[#1B1206] transition-colors hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
          >
            <CalendarDays className="h-5 w-5" aria-hidden />
            {x.bookVisit}
          </a>
          <div className="grid grid-cols-2 gap-2.5">
            {phone ? (
              <a
                href={telHref(phone)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-hairline text-[15px] font-semibold text-ink-strong transition-colors hover:border-gold-400/60 hover:bg-surface-soft"
              >
                <Phone className="h-[18px] w-[18px]" aria-hidden />
                {x.callNow}
              </a>
            ) : (
              <a href={info} className="inline-flex h-12 items-center justify-center rounded-2xl border border-hairline text-[15px] font-semibold text-ink-strong hover:bg-surface-soft">
                {t.requestInfo}
              </a>
            )}
            {waHref ? (
              <a
                href={waHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 text-[15px] font-semibold text-ink-strong transition-colors hover:bg-[#25D366]/[0.08]"
              >
                <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />
                {x.whatsapp}
              </a>
            ) : (
              <a href={info} className="inline-flex h-12 items-center justify-center rounded-2xl border border-hairline text-[15px] font-semibold text-ink-strong hover:bg-surface-soft">
                {t.talkAdvisor}
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-4">
          <FavoriteButton kind="unit" id={unitId} variant="inline" />
          {tools}
        </div>
        <p className="border-t border-hairline px-6 py-3.5 text-xs text-ink-muted">{x.trust}</p>
      </div>

      {/* Phone: the same actions at the foot of the screen. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur-lg lg:hidden"
        role="region"
        aria-label={t.quickContact}
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          <a href={visit} className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gold-400 text-[15px] font-semibold text-[#1B1206]">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            {x.bookVisit}
          </a>
          {phone && (
            <a href={telHref(phone)} aria-label={x.callNow} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hairline text-ink-strong">
              <Phone className="h-5 w-5" aria-hidden />
            </a>
          )}
          {waHref && (
            <a href={waHref} aria-label={x.whatsapp} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#25D366]/40">
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, MapPin, Phone, MessageCircle, UserRound, CalendarPlus, Handshake } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UnitTypeOption } from '@/lib/types';
import { tx, compactParts, formatDate } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { PremiumPageHero } from '@/components/premium';
import { KindTag, StatusTag, ListingPhotoPlaceholder, ListingPrice, placeLine } from '@/components/listings/listing-card';
import { listingsT, LISTING_STATUSES, type Listing, type ListingTerms } from '@/components/listings/messages';
import { ListingTermsPanels } from '../_components/listing-terms';
import { ListingStatusSelect, DeleteListingButton } from '../_components/listing-actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-hairline bg-surface p-5 sm:p-6">
      <h2 className="font-heading text-[17px] font-bold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** BRK-2 — one listing: its photos, price, specs, place, owner and agent. */
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, session, currency] = await Promise.all([params, getLocale(), getSession(), getReportsCurrency()]);
  const m = listingsT(locale);
  const u = uiT(locale).pages.units;
  const symbol = currencySymbol(currency, locale);
  const [listingRes, typesRes, termsRes, timeZone] = await Promise.all([
    safe(api.get<Listing>(`/listings/${id}`)),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
    safe(api.get<ListingTerms>(`/listings/${id}/terms`)),
    getCompanyTimeZone(),
  ]);
  const l = listingRes.data;
  if (!l) notFound();
  const type = (typesRes.data ?? []).find((t) => t.code === l.unitType);
  const typeName = type ? tx(type.name, locale) : l.unitType;
  const canDelete = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const [cover, ...rest] = l.photos;
  const price = Number(l.price);
  const perMeter = l.kind !== 'RENT' && l.area > 0 ? compactParts(price / l.area, symbol, locale).join(' ') : null;
  const phone = l.ownerPhone?.replace(/[^\d+]/g, '');
  const waPhone = phone?.replace(/^0/, '20').replace(/^\+/, '');

  const facts: Array<[string, React.ReactNode]> = [
    [m.form.unitType, typeName],
    [m.form.area, <span key="a" className="tabular-nums">{l.area} {m.card.area}</span>],
    ...(l.bedrooms !== null ? [[m.form.bedrooms, <span key="b" className="tabular-nums">{l.bedrooms}</span>] as [string, React.ReactNode]] : []),
    ...(l.bathrooms !== null ? [[m.form.bathrooms, <span key="c" className="tabular-nums">{l.bathrooms}</span>] as [string, React.ReactNode]] : []),
    ...(l.floor !== null ? [[m.form.floor, <span key="d" className="tabular-nums">{l.floor}</span>] as [string, React.ReactNode]] : []),
    ...(l.finishing ? [[m.form.finishing, u.finishingLabels[l.finishing] ?? l.finishing] as [string, React.ReactNode]] : []),
    ...(l.view ? [[m.form.view, u.viewLabels[l.view] ?? l.view] as [string, React.ReactNode]] : []),
    ...(l.deliveryDate ? [[m.form.delivery, formatDate(l.deliveryDate, locale)] as [string, React.ReactNode]] : []),
    ...(l.developerName ? [[m.form.developer, l.developerName] as [string, React.ReactNode]] : []),
    ...(l.projectName ? [[m.form.project, l.projectName] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="listing-page">
      <PremiumPageHero
        eyebrow={typeName}
        title={l.title}
        description={placeLine(l)}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.list.title, href: '/dashboard/listings' },
          { label: l.code },
        ]}
        meta={
          <>
            <KindTag kind={l.kind} locale={locale} />
            <StatusTag status={l.status} kind={l.kind} locale={locale} />
            <span className="text-[12.5px] text-slate-500">{m.detail.added} {formatDate(l.createdAt, locale)}</span>
          </>
        }
        actions={
          <>
            {canDelete && <DeleteListingButton id={l.id} label={m.detail.delete} confirm={m.detail.deleteConfirm} />}
            <ListingStatusSelect
              key={l.status}
              id={l.id}
              status={l.status}
              label={m.detail.setStatus}
              options={LISTING_STATUSES.map((s) => ({ value: s, label: s === 'CLOSED' ? m.closed[l.kind] : m.status[s] }))}
            />
            {l.status !== 'CLOSED' && l.status !== 'WITHDRAWN' && (
              <Link href={`/dashboard/visits/new?listingId=${l.id}` as never}>
                <Button variant="outline" size="md" leftIcon={<CalendarPlus className="h-4 w-4" />}>{m.terms.scheduleVisit}</Button>
              </Link>
            )}
            {l.status !== 'WITHDRAWN' && (
              <Link href={`/dashboard/deals/new?listingId=${l.id}` as never}>
                <Button variant="outline" size="md" leftIcon={<Handshake className="h-4 w-4" />} data-testid="listing-record-deal">{m.detail.recordDeal}</Button>
              </Link>
            )}
            <Link href={`/dashboard/listings/${l.id}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>{m.detail.edit}</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* The cover, then the rest as a strip of thumbnails. */}
          <div className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={l.title} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <ListingPhotoPlaceholder label={m.list.noPhoto} className="aspect-[16/6] w-full" />
            )}
            {rest.length > 0 && (
              <div className="grid grid-cols-4 gap-2 p-2 sm:grid-cols-6">
                {rest.map((p) => (
                  <a key={p} href={p} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <Card title={m.detail.facts}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[12px] font-semibold text-slate-500">{k}</dt>
                  <dd className="mt-1 text-[14.5px] font-bold text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {termsRes.data && (
            <ListingTermsPanels
              listingId={l.id}
              kind={l.kind}
              price={price}
              terms={termsRes.data}
              locale={locale}
              symbol={symbol}
              today={todayIn(timeZone)}
              canUndo={canDelete}
            />
          )}

          {l.description && (
            <Card title={m.detail.description}>
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-slate-700">{l.description}</p>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          {/* The price on the navy band, as on the homes. */}
          <section className="overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band p-6 text-[#F4ECD8] shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]">
            <p className="text-[13px] text-[#A9B0BD]">{l.kind === 'RENT' ? m.form.rent : m.form.price}</p>
            <div className="mt-2">
              <ListingPrice listing={l} symbol={symbol} locale={locale} size="lg" onNavy />
            </div>
            {(l.downPayment || perMeter) && (
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#D8B66A]/[0.16] pt-4 text-[12.5px]">
                {l.downPayment && (
                  <div>
                    <dt className="text-[#A9B0BD]">{m.form.downPayment}</dt>
                    <dd className="mt-1 text-[16px] font-bold tabular-nums">{compactParts(Number(l.downPayment), symbol, locale).join(' ')}</dd>
                  </div>
                )}
                {perMeter && (
                  <div>
                    <dt className="text-[#A9B0BD]">{m.detail.pricePerMeter}</dt>
                    <dd className="mt-1 text-[16px] font-bold tabular-nums">{perMeter}</dd>
                  </div>
                )}
              </dl>
            )}
          </section>

          <Card title={m.detail.location}>
            <p className="flex items-start gap-2 text-[14px] text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
              <span>{[placeLine(l), l.address].filter(Boolean).join(' — ')}</span>
            </p>
          </Card>

          {/* A developer's unit has no owner to call unless one was recorded. */}
          {(l.kind !== 'PRIMARY' || l.ownerName || l.ownerPhone) && <Card title={m.detail.owner}>
            {l.ownerName || l.ownerPhone ? (
              <div className="space-y-3">
                {l.ownerName && <p className="text-[14.5px] font-bold text-slate-900">{l.ownerName}</p>}
                {phone && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[14px] text-slate-700" dir="ltr">{l.ownerPhone}</span>
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-bold text-slate-700 hover:border-[#D8B66A]/60">
                      <Phone className="h-3.5 w-3.5" /> {m.detail.call}
                    </a>
                    <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-bold text-success-700 hover:border-success-700/40">
                      <MessageCircle className="h-3.5 w-3.5" /> {m.detail.whatsapp}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13.5px] text-slate-500">{m.detail.noOwner}</p>
            )}
          </Card>}

          <Card title={m.detail.agent}>
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
              <UserRound className="h-4 w-4 text-brand-700" aria-hidden />
              {l.agent?.fullName ?? <span className="font-normal text-slate-500">{m.detail.noAgent}</span>}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

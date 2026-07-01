import type { Route } from 'next';
import { MessageCircle, CalendarDays, ShieldCheck, Phone, Users, Building2 } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice } from '@/lib/format';
import { getContactPhone, getWhatsappPhone, telHref, whatsappHref } from '@/lib/contact';
import { ButtonLink } from '@/components/ui/Button';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function UnitInquiryCard({
  unitId,
  price,
  unitCode,
  projectName,
}: {
  unitId: string;
  price: string;
  unitCode?: string;
  projectName?: string;
}) {
  const info  = `${routes.contact}?unitId=${unitId}` as Route;
  const visit = `${routes.contact}?type=visit&unitId=${unitId}` as Route;

  const contactPhone  = getContactPhone();
  const whatsappPhone = getWhatsappPhone();
  const subject  = unitCode ? `بالوحدة رقم ${unitCode}` : 'بهذه الوحدة';
  const waMessage = `مرحبًا، أنا مهتم ${subject}${projectName ? ` في مشروع ${projectName}` : ''}. أرجو تزويدي بالتفاصيل.`;

  return (
    <>
      {/* ══════════════════════════════════════════
          Desktop / scroll card  — mirrors InquiryCard
          ══════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-[0_8px_40px_-8px_rgba(11,23,38,0.16)]">

        {/* Thin gold gradient accent stripe */}
        <div
          className="h-1.5 w-full"
          style={{ background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' }}
          aria-hidden
        />

        {/* ── Unit context header ────────────────────
            Price is the headline fact — shown large and
            gold. Unit code + project name give context.
        ────────────────────────────────────────────── */}
        <div className="border-b border-gold-100/60 bg-gradient-to-br from-gold-50/70 to-gold-50/10 px-5 py-5">
          <div className="flex items-start gap-3">
            {/* Icon tile */}
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_2px_10px_-2px_rgba(200,162,75,0.24)] ring-1 ring-gold-200/70">
              <Building2 className="h-5 w-5 text-gold-600" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              {unitCode && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-500">
                  رمز: {unitCode}
                </p>
              )}
              {/* Price — the primary fact in the sidebar */}
              <p className="mt-0.5 font-display text-2xl font-bold leading-snug text-ink-strong">
                {formatPrice(price)}
              </p>
              {projectName && (
                <p className="mt-1 truncate text-[11px] text-ink-muted">
                  {projectName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Primary CTAs ────────────────────────────
            size="lg" (h-14) for the lead action creates
            clear visual dominance over the gold secondary.
        ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 px-5 py-5">
          <ButtonLink
            href={info}
            variant="primary"
            size="lg"
            className="w-full shadow-[0_4px_20px_-6px_rgba(11,23,38,0.35)]"
          >
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            طلب معلومات
          </ButtonLink>

          <ButtonLink href={visit} variant="gold" size="md" className="w-full">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            طلب زيارة ميدانية
          </ButtonLink>
        </div>

        {/* ── Utility actions ─────────────────────────
            Row 1: مستشار (flex-1) + phone/WA icon pills
            Row 2: FavoriteButton — full-width, no wrapping
        ────────────────────────────────────────────── */}
        <div className="border-t border-hairline px-5 pb-5 pt-4">
          <div className="flex items-center gap-2">
            <ButtonLink
              href={routes.contact}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              تحدث مع مستشار
            </ButtonLink>

            {contactPhone && (
              <a
                href={telHref(contactPhone)}
                aria-label="اتصل بنا"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-transparent text-ink-muted transition-colors duration-200 hover:border-gold-300 hover:bg-gold-50 hover:text-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50"
              >
                <Phone className="h-[18px] w-[18px]" aria-hidden />
              </a>
            )}

            {whatsappPhone && (
              <a
                href={whatsappHref(whatsappPhone, waMessage)}
                aria-label="تواصل عبر واتساب"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#25D366]/30 bg-transparent transition-colors duration-200 hover:border-[#25D366]/60 hover:bg-[#25D366]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/30"
              >
                <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />
              </a>
            )}
          </div>

          {/* Favorite — own full-width row so it never wraps */}
          <div className="mt-2">
            <FavoriteButton kind="unit" id={unitId} variant="inline" />
          </div>
        </div>

        {/* ── Trust footer ── */}
        <div className="mx-5 flex items-center gap-2 border-t border-hairline py-3.5 text-xs text-ink-muted/65">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
          بياناتك آمنة ولن تُستخدم إلا للتواصل معك.
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Mobile sticky bottom action bar
          Hidden on lg+ where the sidebar card is visible.
          ══════════════════════════════════════════ */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-3 shadow-[0_-4px_24px_-4px_rgba(11,23,38,0.12)] backdrop-blur-lg lg:hidden"
        role="region"
        aria-label="خيارات التواصل السريع"
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          <ButtonLink href={info} variant="primary" size="md" className="min-w-0 flex-1 truncate">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            طلب معلومات
          </ButtonLink>

          <ButtonLink href={visit} variant="gold" size="md" className="min-w-0 flex-1 truncate">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            طلب زيارة
          </ButtonLink>

          {whatsappPhone && (
            <a
              href={whatsappHref(whatsappPhone, waMessage)}
              aria-label="تواصل عبر واتساب"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#25D366]/30 bg-transparent transition-all duration-200 hover:border-[#25D366]/60 hover:bg-[#25D366]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2"
            >
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}

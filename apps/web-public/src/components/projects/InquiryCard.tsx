import type { Route } from 'next';
import Link from 'next/link';
import { MessageCircle, CalendarDays, Headset, ShieldCheck, Phone } from 'lucide-react';
import { routes } from '@/lib/routes';
import { getContactPhone, getWhatsappPhone, telHref, whatsappHref } from '@/lib/contact';
import { ButtonLink } from '@/components/ui/Button';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

// Official WhatsApp brand icon (Simple Icons path, CC0).
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

/**
 * Premium inquiry card for a project.
 *
 * Desktop — sticky side card (stickiness is applied by the parent aside wrapper).
 * Mobile  — a compact fixed bottom action bar with primary CTAs sits at the
 *           viewport bottom, while the full card remains reachable by scrolling.
 */
export function InquiryCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const info = `${routes.contact}?projectId=${projectId}` as Route;
  const visit = `${routes.contact}?type=visit&projectId=${projectId}` as Route;

  const contactPhone = getContactPhone();
  const whatsappPhone = getWhatsappPhone();
  const waMessage = `مرحبًا، أنا مهتم بمشروع ${projectName}. أرجو تزويدي بمزيد من التفاصيل.`;

  return (
    <>
      {/* ══════════════════════════════════════════
          Desktop / scroll card
          ══════════════════════════════════════════ */}
      <PremiumCard className="overflow-hidden p-0">

        {/* ── Header band ── */}
        <div className="relative flex items-start gap-4 bg-navy px-6 py-5">
          {/* Gold hairline along the bottom edge */}
          <div
            className="absolute inset-x-0 bottom-0 h-px"
            style={{
              background:
                'linear-gradient(to left, transparent, rgba(200,162,75,0.50), transparent)',
            }}
            aria-hidden
          />

          {/* Headset icon — frosted glass on dark navy */}
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.09] text-white ring-1 ring-white/[0.12]">
            <Headset className="h-5 w-5" aria-hidden />
          </span>

          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">هل أنت مهتم؟</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-white/55">
              تواصل معنا للحصول على تفاصيل{' '}
              <span className="font-medium text-white/80">{projectName}</span>{' '}
              أو لحجز زيارة.
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">

          {/* Primary CTAs */}
          <div className="flex flex-col gap-2.5">
            <ButtonLink href={info} variant="primary" size="md" className="w-full">
              <MessageCircle className="h-5 w-5" aria-hidden />
              طلب معلومات
            </ButtonLink>

            <ButtonLink href={visit} variant="gold" size="md" className="w-full">
              <CalendarDays className="h-5 w-5" aria-hidden />
              طلب زيارة
            </ButtonLink>

            <ButtonLink href={routes.contact} variant="outline" size="md" className="w-full">
              تحدث مع مستشار
            </ButtonLink>

            <FavoriteButton kind="project" id={projectId} variant="inline" />
          </div>

          {/* Contact channels — only when at least one number is configured */}
          {(contactPhone || whatsappPhone) && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-hairline" />
                <span className="text-[11px] text-ink-muted/70">أو تواصل مباشرةً</span>
                <div className="h-px flex-1 bg-hairline" />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {contactPhone && (
                  <ButtonLink
                    href={telHref(contactPhone)}
                    variant="outline"
                    size="md"
                    className="w-full"
                  >
                    <Phone className="h-5 w-5" aria-hidden />
                    اتصل بنا
                  </ButtonLink>
                )}
                {whatsappPhone && (
                  <ButtonLink
                    href={whatsappHref(whatsappPhone, waMessage)}
                    variant="outline"
                    size="md"
                    className="w-full border-[#25D366]/25 hover:border-[#25D366]/50 hover:bg-[#25D366]/[0.06]"
                  >
                    <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
                    واتساب
                  </ButtonLink>
                )}
              </div>
            </>
          )}

          {/* Trust / privacy notice */}
          <div className="mt-5 flex items-center gap-2 border-t border-hairline pt-4 text-xs text-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
            بياناتك آمنة ولن تُستخدم إلا للتواصل معك.
          </div>
        </div>
      </PremiumCard>

      {/* ══════════════════════════════════════════
          Mobile sticky bottom action bar
          Fixed to the viewport; hidden on lg+ where the side card is visible.
          z-40 keeps it below the z-50 navbar.
          ══════════════════════════════════════════ */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-4 py-3 shadow-[0_-4px_24px_-4px_rgba(11,23,38,0.12)] backdrop-blur-lg lg:hidden"
        role="region"
        aria-label="خيارات التواصل السريع"
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          {/* Primary — navy */}
          <ButtonLink href={info} variant="primary" size="md" className="min-w-0 flex-1 truncate">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            طلب معلومات
          </ButtonLink>

          {/* Secondary — gold */}
          <ButtonLink href={visit} variant="gold" size="md" className="min-w-0 flex-1 truncate">
            <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
            طلب زيارة
          </ButtonLink>

          {/* WhatsApp icon-only — uses a direct Link to control padding precisely */}
          {whatsappPhone && (
            <Link
              href={whatsappHref(whatsappPhone, waMessage)}
              aria-label="تواصل عبر واتساب"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#25D366]/30 bg-transparent transition-all duration-200 ease-smooth hover:border-[#25D366]/60 hover:bg-[#25D366]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2"
            >
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

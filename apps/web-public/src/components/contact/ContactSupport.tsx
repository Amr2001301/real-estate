import type { Route } from 'next';
import { Phone, Mail, MessageCircle, Clock, MapPin, Navigation } from 'lucide-react';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';
import { OpenStatus } from './OpenStatus';

const PHONE = '+966 11 000 0000';
const PHONE_TEL = '+966110000000';
const EMAIL = 'hello@dar-alfakhama.sa';
const MAP_URL = 'https://maps.google.com/?q=الرياض،+المملكة+العربية+السعودية';

/** Side support block: instant help, working hours, and HQ location. */
export function ContactSupport() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;

  return (
    <div className="space-y-5">
      {/* Instant help — dark navy accent card */}
      <div className="relative overflow-hidden rounded-3xl bg-navy p-7 text-white shadow-card">
        <span className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-navy-600/40 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-navy ring-1 ring-gold-300/40">
            <Phone className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="mt-5 text-xl font-semibold text-white">هل تحتاج مساعدة فورية؟</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            تواصل معنا مباشرة وسيسعد فريقنا بالرد على استفساراتك.
          </p>

          {/* Tappable contact rows */}
          <div className="mt-5 space-y-2.5">
            <a
              href={`tel:${PHONE_TEL}`}
              className="group flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Phone className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-white/55">اتصل بنا</span>
                <span dir="ltr" className="block font-display text-lg leading-tight text-gold-100 group-hover:text-white">
                  {PHONE}
                </span>
              </span>
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="group flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Mail className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-white/55">راسلنا عبر البريد</span>
                <span dir="ltr" className="block truncate text-sm text-white/85 group-hover:text-white">
                  {EMAIL}
                </span>
              </span>
            </a>
          </div>

          {whatsapp && (
            <ButtonLink href={whatsapp as Route} variant="gold" size="md" className="mt-4 w-full">
              <MessageCircle className="h-5 w-5" aria-hidden />
              تواصل عبر واتساب
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Working hours */}
      <PremiumCard className="p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-navy">ساعات العمل</h3>
              <OpenStatus />
            </div>
            <p className="mt-1 text-sm text-ink-muted">الأحد - الخميس</p>
            <p className="text-sm text-ink-muted">9:00 ص - 6:00 م</p>
          </div>
        </div>
      </PremiumCard>

      {/* Location */}
      <PremiumCard className="p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-navy">مقر الشركة</h3>
            <p className="mt-1 text-sm text-ink-muted">الرياض، المملكة العربية السعودية</p>
            <a
              href={MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              الحصول على الاتجاهات
            </a>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}

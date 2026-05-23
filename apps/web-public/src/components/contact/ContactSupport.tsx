import type { Route } from 'next';
import { Phone, MessageCircle, Clock, MapPin } from 'lucide-react';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';

const PHONE = '+966 11 000 0000';
const PHONE_TEL = '+966110000000';

/** Side support block: instant help, working hours, and HQ location. */
export function ContactSupport() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;

  return (
    <div className="space-y-6">
      {/* Instant help — dark navy accent card */}
      <div className="overflow-hidden rounded-3xl bg-navy p-7 text-white shadow-card">
        <IconCircle tone="gold" className="h-12 w-12">
          <Phone className="h-6 w-6" aria-hidden />
        </IconCircle>
        <h3 className="mt-5 text-xl text-white">هل تحتاج مساعدة فورية؟</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          تواصل معنا مباشرة وسيسعد فريقنا بالرد على استفساراتك.
        </p>
        <a href={`tel:${PHONE_TEL}`} dir="ltr" className="mt-5 block font-display text-2xl text-gold-200">
          {PHONE}
        </a>
        {whatsapp && (
          <ButtonLink href={whatsapp as Route} variant="gold" size="md" className="mt-5 w-full">
            <MessageCircle className="h-5 w-5" aria-hidden />
            تواصل عبر واتساب
          </ButtonLink>
        )}
      </div>

      {/* Working hours */}
      <PremiumCard className="flex items-start gap-4 p-6">
        <IconCircle tone="soft" className="h-11 w-11">
          <Clock className="h-5 w-5" aria-hidden />
        </IconCircle>
        <div>
          <h3 className="text-base text-navy">ساعات العمل</h3>
          <p className="mt-1 text-sm text-ink-muted">الأحد - الخميس</p>
          <p className="text-sm text-ink-muted">9:00 ص - 6:00 م</p>
        </div>
      </PremiumCard>

      {/* Location */}
      <PremiumCard className="flex items-start gap-4 p-6">
        <IconCircle tone="soft" className="h-11 w-11">
          <MapPin className="h-5 w-5" aria-hidden />
        </IconCircle>
        <div>
          <h3 className="text-base text-navy">مقر الشركة</h3>
          <p className="mt-1 text-sm text-ink-muted">الرياض، المملكة العربية السعودية</p>
        </div>
      </PremiumCard>
    </div>
  );
}

import type { Route } from 'next';
import { MessageCircle, CalendarDays, Headset, ShieldCheck, Phone } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice } from '@/lib/format';
import { getContactPhone, getWhatsappPhone, telHref, whatsappHref } from '@/lib/contact';
import { ButtonLink } from '@/components/ui/Button';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

/**
 * Premium inquiry card for a unit. The info/visit CTAs deep-link to /contact;
 * the Call and WhatsApp CTAs use env-configured numbers and hide when unset.
 */
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
  const info = `${routes.contact}?unitId=${unitId}` as Route;
  const visit = `${routes.contact}?type=visit&unitId=${unitId}` as Route;

  const contactPhone = getContactPhone();
  const whatsappPhone = getWhatsappPhone();
  const subject = unitCode ? `بالوحدة رقم ${unitCode}` : 'بهذه الوحدة';
  const waMessage = `مرحبًا، أنا مهتم ${subject}${projectName ? ` في مشروع ${projectName}` : ''}. أرجو تزويدي بالتفاصيل.`;

  return (
    <PremiumCard className="p-7">
      <div className="flex items-center justify-between">
        <IconCircle tone="navy">
          <Headset className="h-6 w-6" aria-hidden />
        </IconCircle>
        <div className="text-end">
          <div className="text-xs text-ink-muted">السعر</div>
          <div className="font-display text-2xl text-ink-strong">{formatPrice(price)}</div>
        </div>
      </div>

      <h3 className="mt-5 text-xl text-ink-strong">مهتم بهذه الوحدة؟</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        تواصل معنا للحصول على مزيد من التفاصيل أو لحجز معاينة، وسيسعد أحد مستشارينا بمساعدتك.
      </p>

      <div className="mt-6 flex flex-col gap-3">
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

        <FavoriteButton kind="unit" id={unitId} variant="inline" />

        {(contactPhone || whatsappPhone) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {contactPhone && (
              <ButtonLink href={telHref(contactPhone)} variant="outline" size="md" className="w-full">
                <Phone className="h-5 w-5" aria-hidden />
                اتصل بنا
              </ButtonLink>
            )}
            {whatsappPhone && (
              <ButtonLink href={whatsappHref(whatsappPhone, waMessage)} variant="outline" size="md" className="w-full">
                <MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden />
                واتساب
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-hairline pt-5 text-xs text-ink-muted">
        <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
        بياناتك آمنة ولن تُستخدم إلا للتواصل معك.
      </div>
    </PremiumCard>
  );
}

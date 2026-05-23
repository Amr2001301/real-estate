import type { Route } from 'next';
import { MessageCircle, CalendarDays, Headset, ShieldCheck } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';

/**
 * Premium inquiry card for a unit. CTAs deep-link to /contact with unit
 * context; form submission itself is W8.
 */
export function UnitInquiryCard({
  unitId,
  price,
}: {
  unitId: string;
  price: string;
}) {
  const info = `${routes.contact}?unitId=${unitId}` as Route;
  const visit = `${routes.contact}?type=visit&unitId=${unitId}` as Route;

  return (
    <PremiumCard className="p-7">
      <div className="flex items-center justify-between">
        <IconCircle tone="navy">
          <Headset className="h-6 w-6" aria-hidden />
        </IconCircle>
        <div className="text-end">
          <div className="text-xs text-ink-muted">السعر</div>
          <div className="font-display text-2xl text-navy">{formatPrice(price)}</div>
        </div>
      </div>

      <h3 className="mt-5 text-xl text-navy">مهتم بهذه الوحدة؟</h3>
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
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-hairline pt-5 text-xs text-ink-muted">
        <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
        بياناتك آمنة ولن تُستخدم إلا للتواصل معك.
      </div>
    </PremiumCard>
  );
}

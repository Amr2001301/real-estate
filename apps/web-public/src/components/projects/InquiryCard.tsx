import type { Route } from 'next';
import { MessageCircle, CalendarDays, Headset, ShieldCheck } from 'lucide-react';
import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';

/**
 * Premium inquiry card. CTAs deep-link to /contact with project context; form
 * submission itself is W8, so these are links for now.
 */
export function InquiryCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const info = `${routes.contact}?projectId=${projectId}` as Route;
  const visit = `${routes.contact}?type=visit&projectId=${projectId}` as Route;

  return (
    <PremiumCard className="p-7">
      <IconCircle tone="navy">
        <Headset className="h-6 w-6" aria-hidden />
      </IconCircle>
      <h3 className="mt-5 text-xl text-navy">هل أنت مهتم؟</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        تواصل معنا للحصول على تفاصيل {projectName} أو لحجز زيارة، وسيتواصل معك أحد مستشارينا.
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

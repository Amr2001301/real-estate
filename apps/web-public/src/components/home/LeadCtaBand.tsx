import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { CtaBand } from '@/components/marketing/CtaBand';

export function LeadCtaBand() {
  return (
    <CtaBand
      eyebrow="ابدأ الآن"
      title="ابدأ رحلتك نحو منزل الأحلام اليوم"
      description="فريق مستشارينا جاهز لمساعدتك في اختيار الوحدة أو المشروع الأنسب لك."
    >
      <ButtonLink href={routes.contact} variant="gold" size="lg">
        تواصل مع مستشار
      </ButtonLink>
      <ButtonLink
        href={routes.units}
        variant="outline"
        size="lg"
        className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
      >
        تصفح الوحدات
      </ButtonLink>
    </CtaBand>
  );
}

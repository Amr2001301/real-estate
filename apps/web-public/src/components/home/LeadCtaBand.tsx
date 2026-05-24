import { Headset, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { CtaBand } from '@/components/marketing/CtaBand';

export function LeadCtaBand() {
  return (
    <CtaBand
      eyebrow="ابدأ الآن"
      title="ابدأ رحلتك العقارية بثقة"
      description="اختر من مشاريع ووحدات مختارة بعناية، وتواصل مع مستشار يساعدك في القرار المناسب."
    >
      <ButtonLink
        href={routes.contact}
        variant="gold"
        size="lg"
        className="shadow-[0_16px_40px_-14px_rgba(200,162,75,0.55)]"
      >
        <Headset className="h-5 w-5" aria-hidden />
        تواصل مع مستشار
      </ButtonLink>
      <ButtonLink
        href={routes.units}
        variant="outline"
        size="lg"
        className="border-white/30 text-white hover:border-white/60 hover:bg-white/10"
      >
        تصفح الوحدات
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </ButtonLink>
    </CtaBand>
  );
}

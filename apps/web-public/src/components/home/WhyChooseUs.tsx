import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { CoverImage } from '@/components/ui/CoverImage';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { DEEP_BG } from './Hero';

/**
 * «لماذا نحن» on the company's deep colour: the title, a photo and the call
 * to action on one side; the six values as a numbered grid on the other.
 */
export function WhyChooseUs({ locale, image }: { locale: Locale; image?: string | null }) {
  const m = siteT(locale).home.why;

  return (
    <section className="mt-20 text-white sm:mt-28" style={{ background: DEEP_BG }}>
      <Container className="flex flex-col gap-12 py-20 lg:flex-row lg:gap-16 lg:py-24">
        <div className="lg:w-[36%]">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-gold-300">
            <span className="h-0.5 w-7 rounded-full bg-gold-400" aria-hidden />
            {m.eyebrow}
          </span>
          <h2 className="mt-3 text-[2rem] font-semibold leading-[1.45] text-white sm:text-[2.5rem]">{m.title}</h2>
          <p className="mt-4 text-[17px] font-light leading-[1.95] text-white/80">{m.sub}</p>
          <CoverImage src={image ?? '/images/home/why.jpg'} alt="" className="mt-7 h-60 rounded-[20px]" />
          <ButtonLink href={routes.contact} variant="gold" size="lg" className="mt-7 text-[#1B1206]">
            {m.cta}
          </ButtonLink>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-px self-center overflow-hidden rounded-3xl bg-white/[0.14] sm:grid-cols-2">
          {m.values.map((v, i) => (
            <div key={v.title} className="px-7 py-8" style={{ background: DEEP_BG }}>
              <div className="font-display text-[1.625rem] font-semibold text-gold-300">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="mt-2 text-xl font-semibold leading-snug text-white">{v.title}</h3>
              <p className="mt-2 text-[15px] font-light leading-[1.85] text-white/75">{v.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

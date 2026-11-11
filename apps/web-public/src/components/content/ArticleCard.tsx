import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';
import { CoverImage } from '@/components/ui/CoverImage';
import { formatDateShort } from '@/lib/format';
import type { Locale } from '@/lib/locale';

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  createdAt: string;
}

/** An article as a card: photo, date, title, two lines and «اقرأ المقال». `lead` lays it out wide. */
export function ArticleCard({ article, locale, lead = false }: { article: ArticleSummary; locale: Locale; lead?: boolean }) {
  const read = locale === 'en' ? 'Read article' : 'اقرأ المقال';
  return (
    <Link
      href={`/articles/${article.slug}` as Route}
      className={`group flex overflow-hidden rounded-[1.5rem] border border-hairline bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_-30px_rgba(0,0,0,0.35)] ${lead ? 'flex-col lg:flex-row' : 'h-full flex-col'}`}
    >
      <div className={`relative overflow-hidden ${lead ? 'h-64 lg:h-auto lg:min-h-[380px] lg:flex-[1.2]' : 'h-56'}`}>
        <CoverImage src={article.coverUrl} alt={article.title} className="absolute inset-0 h-full" zoomOnHover />
      </div>
      <div className={`flex flex-1 flex-col ${lead ? 'p-8 sm:p-11 lg:justify-center' : 'p-6'}`}>
        <p className="text-[13px] font-medium text-gold-700 dark:text-gold-300">{formatDateShort(article.createdAt, locale)}</p>
        <h3 className={`mt-2 font-display font-semibold leading-snug text-ink-strong ${lead ? 'text-[1.9rem] sm:text-[2.2rem]' : 'line-clamp-2 text-[1.3rem]'}`}>{article.title}</h3>
        {article.excerpt && <p className={`mt-3 text-ink-muted ${lead ? 'text-[17px] leading-[1.9]' : 'line-clamp-2 text-[15px] leading-[1.8]'}`}>{article.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[15px] font-semibold text-navy dark:text-gold-300">
          {read}
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

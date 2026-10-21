import { revalidatePath } from 'next/cache';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { FileText, Image as ImageIcon, BookOpen, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { tx, formatDate } from '@/lib/format';
import type { Translatable } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PremiumPageHero } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Banner {
  id: string;
  imageUrl: string;
  title: Translatable;
  link: string | null;
  active: boolean;
}
interface Article {
  id: string;
  slug: string;
  title: Translatable;
  excerpt: Translatable;
  published: boolean;
  createdAt: string;
  coverUrl?: string | null;
}
interface CmsPage {
  id: string;
  slug: string;
  title: Translatable;
  published: boolean;
  updatedAt: string;
}

// ── Server actions (names/fields unchanged) ───────────────────────────────────

async function deleteBannerAction(id: string) {
  'use server';
  await api.delete(`/cms/banners/${id}`);
  revalidatePath('/dashboard/cms');
}

async function upsertPageAction(formData: FormData) {
  'use server';
  await api.post('/cms/pages', {
    slug: String(formData.get('slug') ?? ''),
    ar_title: String(formData.get('ar_title') ?? ''),
    en_title: String(formData.get('en_title') ?? ''),
    ar_body: String(formData.get('ar_body') ?? ''),
    en_body: String(formData.get('en_body') ?? ''),
    published: formData.get('published') === 'on',
  });
  revalidatePath('/dashboard/cms');
}

async function createBannerAction(formData: FormData) {
  'use server';
  await api.post('/cms/banners', {
    imageUrl: String(formData.get('imageUrl') ?? ''),
    ar_title: String(formData.get('ar_title') ?? ''),
    en_title: String(formData.get('en_title') ?? ''),
    link: String(formData.get('link') ?? '') || undefined,
    active: true,
  });
  revalidatePath('/dashboard/cms');
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'articles' | 'pages' | 'banners';

/**
 * Site content in three tabs (articles, pages, banners), one at a time.
 * Each tab lists its items and opens its own create form in place.
 */
export default async function CmsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [pagesRes, bannersRes, articlesRes, locale, sp] = await Promise.all([
    safe(api.get<CmsPage[]>('/cms/pages')),
    safe(api.get<Banner[]>('/cms/banners')),
    safe(api.get<Article[]>('/cms/articles')),
    getLocale(),
    searchParams,
  ]);

  const pages = pagesRes.data ?? [];
  const banners = bannersRes.data ?? [];
  const articles = articlesRes.data ?? [];
  const m = uiT(locale).cmsPage;
  const tab: Tab = sp.tab === 'pages' || sp.tab === 'banners' ? sp.tab : 'articles';

  const tabs: Array<{ key: Tab; label: string; icon: ReactNode; count: number; live: number; liveLabel: string }> = [
    { key: 'articles', label: m.sectionArticlesTitle, icon: <BookOpen />, count: articles.length, live: articles.filter((a) => a.published).length, liveLabel: m.badgePublished },
    { key: 'pages', label: m.sectionPagesTitle, icon: <FileText />, count: pages.length, live: pages.filter((p) => p.published).length, liveLabel: m.badgePublished },
    { key: 'banners', label: m.sectionBannersTitle, icon: <ImageIcon />, count: banners.length, live: banners.filter((b) => b.active).length, liveLabel: m.badgeActive },
  ];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbCms },
        ]}
        actions={
          <Link href="/dashboard/cms/articles/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.createArticleLabel}</Button>
          </Link>
        }
      />

      {/* Tabs, each with its count and how many are live */}
      <nav data-testid="cms-tabs" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={(t.key === 'articles' ? '/dashboard/cms' : `/dashboard/cms?tab=${t.key}`) as never}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex items-center gap-4 rounded-[20px] border px-5 py-4 transition-colors',
                on ? 'border-[#C9A24E]/60 bg-[#D8B66A]/[0.10]' : 'border-hairline bg-surface hover:border-[#C9A24E]/40',
              )}
            >
              <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5', on ? 'bg-[#D8B66A]/25 text-[#9A7A2E] dark:text-[#D8B66A]' : 'bg-surface-muted text-slate-500')}>
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-slate-900">{t.label}</span>
                <span className="block text-[12px] text-slate-500">{t.live} {t.liveLabel}</span>
              </span>
              <span className="text-[26px] font-bold tabular-nums text-slate-900">{t.count}</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'articles' && (
        <section data-testid="cms-articles" className="rounded-[22px] border border-hairline bg-surface">
          <SectionHead title={m.sectionArticlesTitle} action={
            <Link href="/dashboard/cms/articles/new" className={ADD_BTN}>
              <Plus className="h-3.5 w-3.5" />
              {m.createArticleLabel}
            </Link>
          } />
          {articles.length === 0 ? (
            <CompactEmpty icon={<BookOpen />} title={m.emptyArticlesTitle} description={m.emptyArticlesDesc} />
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {articles.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-muted/30">
                  <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                    {a.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/cms/articles/${a.slug}/edit`} className="block truncate text-[15px] font-bold text-slate-900 hover:text-brand-700">
                      {tx(a.title, locale)}
                    </Link>
                    {a.excerpt && <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{tx(a.excerpt, locale)}</p>}
                    <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-500">
                      <StatusChip on={a.published} onLabel={m.badgePublished} offLabel={m.badgeDraft} />
                      <span>{formatDate(a.createdAt, locale)}</span>
                    </p>
                  </div>
                  <Link href={`/dashboard/cms/articles/${a.slug}/edit`} aria-label={m.editArticleLabel} title={m.editArticleLabel} className={ROUND_BTN}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'pages' && (
        <section data-testid="cms-pages" className="rounded-[22px] border border-hairline bg-surface">
          <details className="group">
            <SectionHead title={m.sectionPagesTitle} summary action={<span className={ADD_BTN}><Plus className="h-3.5 w-3.5 transition-transform group-open:rotate-45" />{m.createPageLabel}</span>} />
            <form action={upsertPageAction} className="grid gap-5 border-t border-hairline bg-surface-muted/20 px-6 py-6 md:grid-cols-2">
              <FormField label={m.fieldSlug} hint={m.hintSlug} required className="md:col-span-2">
                <Input name="slug" required dir="ltr" placeholder="about" className="max-w-sm font-mono" leftAddon={<span className="text-[12px] font-bold">/</span>} />
              </FormField>
              <FormField label={`${m.fieldPageTitle} — العربية`} required>
                <Input name="ar_title" required dir="rtl" placeholder="من نحن" />
              </FormField>
              <FormField label={`${m.fieldPageTitle} — English`} required>
                <Input name="en_title" required dir="ltr" placeholder="About us" />
              </FormField>
              <FormField label={`${m.fieldContent} — العربية`}>
                <Textarea name="ar_body" dir="rtl" rows={6} />
              </FormField>
              <FormField label={`${m.fieldContent} — English`}>
                <Textarea name="en_body" dir="ltr" rows={6} />
              </FormField>
              <div className="flex items-center justify-between gap-4 md:col-span-2">
                <PublishToggle name="published" label={m.checkPublish} />
                <Button type="submit" variant="primary" size="md">{m.btnSavePage}</Button>
              </div>
            </form>
          </details>
          {pages.length === 0 ? (
            <CompactEmpty icon={<FileText />} title={m.emptyPagesTitle} description={m.emptyPagesDesc} />
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {pages.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-muted/30">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                    <FileText className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-slate-900">{tx(p.title, locale)}</p>
                    <p className="mt-0.5 truncate font-mono text-[12px] text-slate-500" dir="ltr">/{p.slug}</p>
                  </div>
                  <StatusChip on={p.published} onLabel={m.badgePublished} offLabel={m.badgeDraft} />
                  <span className="hidden w-28 text-end text-[12px] text-slate-500 sm:block">{formatDate(p.updatedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'banners' && (
        <section data-testid="cms-banners" className="rounded-[22px] border border-hairline bg-surface">
          <details className="group">
            <SectionHead title={m.sectionBannersTitle} summary action={<span className={ADD_BTN}><Plus className="h-3.5 w-3.5 transition-transform group-open:rotate-45" />{m.addBannerLabel}</span>} />
            <form action={createBannerAction} className="grid gap-5 border-t border-hairline bg-surface-muted/20 px-6 py-6 md:grid-cols-2">
              <FormField label={m.fieldImageUrl} required className="md:col-span-2">
                <Input name="imageUrl" required dir="ltr" placeholder="https://..." leftAddon={<ImageIcon />} />
              </FormField>
              <FormField label={`${m.fieldBannerTitle} — العربية`} required>
                <Input name="ar_title" required dir="rtl" />
              </FormField>
              <FormField label={`${m.fieldBannerTitle} — English`} required>
                <Input name="en_title" required dir="ltr" />
              </FormField>
              <FormField label={`${m.fieldDestLink} (${m.destLinkOptional})`} className="md:col-span-2">
                <Input name="link" dir="ltr" placeholder="/projects" leftAddon={<ExternalLink />} />
              </FormField>
              <div className="flex justify-end md:col-span-2">
                <Button type="submit" variant="primary" size="md">{m.btnAddBanner}</Button>
              </div>
            </form>
          </details>
          {banners.length === 0 ? (
            <CompactEmpty icon={<ImageIcon />} title={m.emptyBannersTitle} description={m.emptyBannersDesc} />
          ) : (
            <div className="grid grid-cols-1 gap-5 border-t border-hairline p-6 sm:grid-cols-2 xl:grid-cols-3">
              {banners.map((b) => (
                <article key={b.id} className="group/banner relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover/banner:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className={cn('absolute start-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur', b.active ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/20 text-white/80')}>
                    {b.active ? m.badgeActive : m.badgeInactive}
                  </span>
                  <form action={deleteBannerAction.bind(null, b.id)} className="absolute end-3 top-3">
                    <button type="submit" aria-label={m.btnDeleteBanner} title={m.btnDeleteBanner} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur transition-colors hover:bg-danger-600 hover:text-white">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="truncate text-[15px] font-bold">{tx(b.title, locale)}</p>
                    {b.link && <p className="mt-0.5 truncate font-mono text-[11.5px] text-white/70" dir="ltr">{b.link}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

const ADD_BTN =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[#C9A24E]/50 px-3.5 text-[12.5px] font-bold text-[#9A7A2E] transition-colors hover:bg-[#D8B66A]/10 dark:text-[#D8B66A]';
const ROUND_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900';

function SectionHead({ title, action, summary }: { title: string; action: ReactNode; summary?: boolean }) {
  const inner = (
    <>
      <h2 className="font-heading text-[18px] font-bold text-slate-900">{title}</h2>
      {action}
    </>
  );
  return summary ? (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">{inner}</summary>
  ) : (
    <div className="flex items-center justify-between gap-4 px-6 py-5">{inner}</div>
  );
}

function FormField({ label, hint, required, className, children }: { label: string; hint?: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label className="text-[12.5px] font-semibold text-slate-700">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** A checkbox styled as a switch. */
function PublishToggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-slate-500/25 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#C9A24E] peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
    </label>
  );
}

function StatusChip({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', on ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/12 text-slate-500')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-emerald-500' : 'bg-slate-400')} />
      {on ? onLabel : offLabel}
    </span>
  );
}

function CompactEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-hairline px-6 py-10 text-center">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-slate-400 [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      <p className="text-[14px] font-semibold text-slate-700">{title}</p>
      <p className="max-w-xs text-[12.5px] text-slate-500">{description}</p>
    </div>
  );
}

import { revalidatePath } from 'next/cache';
import type { ReactNode } from 'react';
import { FileText, Image, BookOpen, Plus, Globe, FileEdit } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { tx, formatDate } from '@/lib/format';
import type { Translatable } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PremiumPageHero, PremiumSectionCard, PremiumMetricStrip } from '@/components/premium';
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

export default async function CmsPage() {
  const [pagesRes, bannersRes, articlesRes, locale] = await Promise.all([
    safe(api.get<CmsPage[]>('/cms/pages')),
    safe(api.get<Banner[]>('/cms/banners')),
    safe(api.get<Article[]>('/cms/articles')),
    getLocale(),
  ]);

  const pages = pagesRes.data ?? [];
  const banners = bannersRes.data ?? [];
  const articles = articlesRes.data ?? [];
  const m = uiT(locale).cmsPage;

  const publishedPages = pages.filter((p) => p.published).length;
  const publishedArticles = articles.filter((a) => a.published).length;
  const activeBanners = banners.filter((b) => b.active).length;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbCms },
        ]}
      />

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: m.metricPages, value: pages.length, icon: <FileText /> },
          { label: m.metricBanners, value: banners.length, sub: `${activeBanners} ${m.metricActive}`, icon: <Image /> },
          { label: m.metricArticles, value: articles.length, sub: `${publishedArticles} ${m.metricPublishedPages}`, icon: <BookOpen /> },
          { label: m.metricPublishedPages, value: publishedPages, icon: <Globe />, tone: 'success' },
        ]}
      />

      {/* ── Section 1: Pages ───────────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        {/*
         * The <details> wraps ONLY the section header + form.
         * The list/empty-state is a sibling OUTSIDE <details>, always visible.
         * Summary = styled header row → clicking toggles the create form.
         */}
        <details className="group">
          <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer select-none hover:bg-surface-muted/30 transition-colors border-b border-hairline">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-brand-600 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900">{m.sectionPagesTitle}</h3>
              {pages.length > 0 && (
                <CountChip count={pages.length} />
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-brand-700">
              <span className="text-xs font-medium hidden sm:inline">{m.createPageLabel}</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition-transform duration-200 group-open:rotate-45">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
          </summary>

          {/* Create/edit form — only visible when <details> is open */}
          <div className="border-b border-hairline bg-surface-muted/20 px-5 py-4">
            <p className="text-2xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {m.createPageDesc}
            </p>
            <form action={upsertPageAction} className="space-y-3">
              {/* Slug */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  {m.fieldSlug} <span className="text-danger-500">*</span>
                </label>
                <Input
                  name="slug"
                  required
                  dir="ltr"
                  placeholder="about, terms, privacy"
                  inputSize="sm"
                  className="font-mono max-w-xs"
                />
                <p className="text-2xs text-slate-400">{m.hintSlug}</p>
              </div>

              {/* Bilingual titles */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  {m.fieldPageTitle} <span className="text-danger-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input name="ar_title" required dir="rtl" placeholder="العنوان بالعربية" inputSize="sm" />
                  <Input name="en_title" required dir="ltr" placeholder="Title in English" inputSize="sm" />
                </div>
              </div>

              {/* Bilingual body */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">{m.fieldContent}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Textarea name="ar_body" dir="rtl" rows={3} placeholder="المحتوى بالعربية" />
                  <Textarea name="en_body" dir="ltr" rows={3} placeholder="Content in English" />
                </div>
              </div>

              {/* Publish + submit */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="published"
                    className="h-4 w-4 rounded border-hairline text-brand-600 focus:ring-brand-500/30"
                  />
                  <span className="text-xs text-slate-700">{m.checkPublish}</span>
                </label>
                <Button type="submit" variant="primary" size="sm">
                  {m.btnSavePage}
                </Button>
              </div>
            </form>
          </div>
        </details>

        {/* Always-visible: table or compact empty state */}
        {pages.length === 0 ? (
          <CompactEmpty
            icon={<FileText />}
            title={m.emptyPagesTitle}
            description={m.emptyPagesDesc}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-2.5 ps-5 pe-4">{m.colPageTitle}</th>
                  <th className="text-start font-semibold py-2.5 px-4">{m.colPath}</th>
                  <th className="text-start font-semibold py-2.5 px-4">{m.colStatus}</th>
                  <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">{m.colLastUpdated}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-muted/30 transition-colors align-middle">
                    <td className="py-3 ps-5 pe-4 font-medium text-slate-900">
                      <span className="truncate max-w-[220px] block">{tx(p.title)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-500 bg-surface-muted/60 px-2 py-0.5 rounded-md" dir="ltr">
                        /{p.slug}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <PublishedBadge published={p.published} publishedLabel={m.badgePublished} draftLabel={m.badgeDraft} />
                    </td>
                    <td className="py-3 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(p.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Banners ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <details className="group">
          <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer select-none hover:bg-surface-muted/30 transition-colors border-b border-hairline">
            <div className="flex items-center gap-2 min-w-0">
              <Image className="h-4 w-4 text-brand-600 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900">{m.sectionBannersTitle}</h3>
              {banners.length > 0 && (
                <CountChip count={banners.length} />
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-brand-700">
              <span className="text-xs font-medium hidden sm:inline">{m.addBannerLabel}</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition-transform duration-200 group-open:rotate-45">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
          </summary>

          {/* Banner create form */}
          <div className="border-b border-hairline bg-surface-muted/20 px-5 py-4">
            <p className="text-2xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
              <FileEdit className="h-3.5 w-3.5 shrink-0" />
              {m.addBannerDesc}
            </p>
            <form action={createBannerAction} className="space-y-3">
              {/* Image URL */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  {m.fieldImageUrl} <span className="text-danger-500">*</span>
                </label>
                <Input name="imageUrl" required dir="ltr" placeholder="https://..." inputSize="sm" />
              </div>

              {/* Bilingual title */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  {m.fieldBannerTitle} <span className="text-danger-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input name="ar_title" required dir="rtl" placeholder="العنوان بالعربية" inputSize="sm" />
                  <Input name="en_title" required dir="ltr" placeholder="Title in English" inputSize="sm" />
                </div>
              </div>

              {/* Link */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  {m.fieldDestLink}{' '}
                  <span className="text-slate-400 font-normal">({m.destLinkOptional})</span>
                </label>
                <Input name="link" dir="ltr" placeholder="https://..." inputSize="sm" />
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm">
                  {m.btnAddBanner}
                </Button>
              </div>
            </form>
          </div>
        </details>

        {/* Always-visible: banner grid or compact empty state */}
        {banners.length === 0 ? (
          <CompactEmpty
            icon={<Image />}
            title={m.emptyBannersTitle}
            description={m.emptyBannersDesc}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {banners.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-hairline overflow-hidden bg-surface shadow-xs hover:shadow-sm transition-shadow"
              >
                <div className="relative h-28 bg-surface-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-2 start-2">
                    <Badge tone={b.active ? 'success' : 'gray'} size="sm" dot>
                      {b.active ? m.badgeActive : m.badgeInactive}
                    </Badge>
                  </div>
                </div>
                <div className="px-3.5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{tx(b.title)}</p>
                    {b.link && (
                      <p className="text-2xs text-slate-400 truncate mt-0.5 font-mono" dir="ltr">
                        {b.link}
                      </p>
                    )}
                  </div>
                  <form action={deleteBannerAction.bind(null, b.id)} className="shrink-0">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                    >
                      {m.btnDeleteBanner}
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Articles ────────────────────────────────────────────── */}
      {/*
       * Articles are read-only from this page — no create action exists here.
       * Static header: no toggle, no form panel.
       */}
      <PremiumSectionCard
        icon={<BookOpen />}
        title={m.sectionArticlesTitle}
        trailing={articles.length > 0 ? <CountChip count={articles.length} /> : undefined}
        padded={false}
      >
        {articles.length === 0 ? (
          <CompactEmpty
            icon={<BookOpen />}
            title={m.emptyArticlesTitle}
            description={m.emptyArticlesDesc}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-2.5 ps-5 pe-4">{m.colArticleTitle}</th>
                  <th className="text-start font-semibold py-2.5 px-4">{m.colArticlePath}</th>
                  <th className="text-start font-semibold py-2.5 px-4">{m.colArticleStatus}</th>
                  <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">{m.colCreatedAt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {articles.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-muted/30 transition-colors align-middle">
                    <td className="py-3 ps-5 pe-4">
                      <p className="font-medium text-slate-900 truncate max-w-[240px]">{tx(a.title)}</p>
                      {a.excerpt && (
                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[280px]">
                          {tx(a.excerpt)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="font-mono text-xs text-slate-500 bg-surface-muted/60 px-2 py-0.5 rounded-md"
                        dir="ltr"
                      >
                        /{a.slug}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <PublishedBadge published={a.published} publishedLabel={m.badgePublished} draftLabel={m.badgeDraft} />
                    </td>
                    <td className="py-3 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function PublishedBadge({ published, publishedLabel, draftLabel }: { published: boolean; publishedLabel: string; draftLabel: string }) {
  return published ? (
    <Badge tone="success" size="sm" dot>{publishedLabel}</Badge>
  ) : (
    <Badge tone="gray" size="sm" dot>{draftLabel}</Badge>
  );
}

/** Compact count badge shown in section headers when items exist. */
function CountChip({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full bg-slate-100 text-2xs font-semibold text-slate-600 tabular-nums">
      {count}
    </span>
  );
}

/**
 * Compact empty state for CMS sections.
 * Uses py-8 (vs the global EmptyState's py-14) to keep sections tight.
 */
function CompactEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 px-6 text-center">
      <div className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-surface-muted text-slate-400 [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs">{description}</p>
    </div>
  );
}

import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import { tx, formatDate } from '@/lib/format';
import type { Translatable } from '@/lib/types';

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

export default async function CmsPage() {
  const [pagesRes, bannersRes, articlesRes] = await Promise.all([
    safe(api.get<CmsPage[]>('/cms/pages')),
    safe(api.get<Banner[]>('/cms/banners')),
    safe(api.get<Article[]>('/cms/articles')),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المحتوى (CMS)</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">الصفحات</h2>
        <ul className="divide-y divide-gray-100 text-sm mb-4">
          {(pagesRes.data ?? []).map((p) => (
            <li key={p.id} className="py-2 flex justify-between">
              <span>
                <span className="font-mono text-xs text-gray-500">{p.slug}</span> ·{' '}
                {tx(p.title)}
              </span>
              <span className="text-xs text-gray-500">
                {p.published ? '✓ منشور' : 'مسودة'} · {formatDate(p.updatedAt)}
              </span>
            </li>
          ))}
          {(pagesRes.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400 py-2">لا توجد صفحات</li>
          )}
        </ul>
        <details>
          <summary className="text-sm text-brand-600 cursor-pointer">+ صفحة جديدة / تعديل</summary>
          <form action={upsertPageAction} className="mt-3 space-y-2">
            <input
              name="slug"
              required
              dir="ltr"
              placeholder="slug (e.g. about, terms)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <input name="ar_title" required dir="rtl" placeholder="العنوان بالعربية" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input name="en_title" required dir="ltr" placeholder="Title (English)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <textarea name="ar_body" dir="rtl" rows={4} placeholder="المحتوى بالعربية" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <textarea name="en_body" dir="ltr" rows={4} placeholder="Content (English)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="published" />
              نشر
            </label>
            <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">حفظ</button>
          </form>
        </details>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">البنرات</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {(bannersRes.data ?? []).map((b) => (
            <div key={b.id} className="border border-gray-100 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt="" className="w-full h-24 object-cover" />
              <div className="p-2 text-xs flex justify-between items-center">
                <span>{tx(b.title)}</span>
                <form action={deleteBannerAction.bind(null, b.id)}>
                  <button className="text-red-600">حذف</button>
                </form>
              </div>
            </div>
          ))}
          {(bannersRes.data ?? []).length === 0 && (
            <p className="text-xs text-gray-400">لا توجد بنرات</p>
          )}
        </div>
        <details>
          <summary className="text-sm text-brand-600 cursor-pointer">+ بنر جديد</summary>
          <form action={createBannerAction} className="mt-3 space-y-2">
            <input name="imageUrl" required dir="ltr" placeholder="رابط الصورة" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="ar_title" required dir="rtl" placeholder="العنوان" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input name="en_title" required dir="ltr" placeholder="Title" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <input name="link" dir="ltr" placeholder="رابط (اختياري)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">حفظ</button>
          </form>
        </details>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">المقالات</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {(articlesRes.data ?? []).map((a) => (
            <li key={a.id} className="py-2 flex justify-between">
              <span className="flex-1">
                <span className="font-mono text-xs text-gray-500">/{a.slug}</span> · {tx(a.title)}
              </span>
              <span className="text-xs text-gray-500">{a.published ? '✓ منشور' : 'مسودة'}</span>
            </li>
          ))}
          {(articlesRes.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400 py-2">لا توجد مقالات</li>
          )}
        </ul>
      </section>
    </div>
  );
}

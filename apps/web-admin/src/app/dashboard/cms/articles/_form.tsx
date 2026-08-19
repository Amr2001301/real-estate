'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArticleEditor } from '@/components/article-editor';

interface ArticleFormValues {
  slug: string;
  ar_title: string;
  en_title: string;
  ar_excerpt: string;
  en_excerpt: string;
  ar_body: string;
  en_body: string;
  coverUrl?: string;
  published: boolean;
}

interface Props {
  initial?: Partial<ArticleFormValues>;
  mode: 'create' | 'edit';
}

export default function ArticleForm({ initial = {}, mode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: ArticleFormValues = {
      slug: String(fd.get('slug') ?? '').trim(),
      ar_title: String(fd.get('ar_title') ?? '').trim(),
      en_title: String(fd.get('en_title') ?? '').trim(),
      ar_excerpt: String(fd.get('ar_excerpt') ?? '').trim(),
      en_excerpt: String(fd.get('en_excerpt') ?? '').trim(),
      ar_body: String(fd.get('ar_body') ?? ''),
      en_body: String(fd.get('en_body') ?? ''),
      coverUrl: String(fd.get('coverUrl') ?? '').trim() || undefined,
      published: fd.get('published') === 'on',
    };

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch('/api-proxy/cms/articles', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { message?: string | string[] }).message;
          setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? `خطأ ${res.status}`));
          return;
        }
        setDone(true);
        setTimeout(() => router.push('/dashboard/cms'), 1200);
      } catch {
        setError('فشل الاتصال بالخادم');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Slug */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          مسار المقال (Slug) <span className="text-danger-500">*</span>
        </label>
        <Input
          name="slug"
          required
          dir="ltr"
          placeholder="my-article-slug"
          inputSize="sm"
          className="font-mono max-w-xs"
          defaultValue={initial.slug}
          readOnly={mode === 'edit'}
        />
        <p className="text-2xs text-slate-400">مثال: real-estate-tips → يصبح /articles/real-estate-tips</p>
      </div>

      {/* Bilingual titles */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          عنوان المقال <span className="text-danger-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input name="ar_title" required dir="rtl" placeholder="العنوان بالعربية" inputSize="sm" defaultValue={initial.ar_title} />
          <Input name="en_title" required dir="ltr" placeholder="Title in English" inputSize="sm" defaultValue={initial.en_title} />
        </div>
      </div>

      {/* Bilingual excerpts */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">المقتطف (وصف مختصر)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Textarea name="ar_excerpt" dir="rtl" rows={2} placeholder="وصف مختصر بالعربية" defaultValue={initial.ar_excerpt} />
          <Textarea name="en_excerpt" dir="ltr" rows={2} placeholder="Short description in English" defaultValue={initial.en_excerpt} />
        </div>
      </div>

      {/* Cover image URL */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">رابط صورة الغلاف</label>
        <Input name="coverUrl" dir="ltr" placeholder="https://..." inputSize="sm" defaultValue={initial.coverUrl} />
      </div>

      {/* Body — Arabic */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          محتوى المقال — العربية <span className="text-danger-500">*</span>
        </label>
        <ArticleEditor name="ar_body" dir="rtl" defaultValue={initial.ar_body} />
      </div>

      {/* Body — English */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          Article Content — English <span className="text-danger-500">*</span>
        </label>
        <ArticleEditor name="en_body" dir="ltr" defaultValue={initial.en_body} />
      </div>

      {/* Publish toggle + actions */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-hairline">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            name="published"
            defaultChecked={initial.published}
            className="h-4 w-4 rounded border-hairline text-brand-600 focus:ring-brand-500/30"
          />
          <span className="text-sm text-slate-700">نشر المقال فور الحفظ</span>
        </label>
        <div className="flex items-center gap-3">
          {error && (
            <p className="flex items-center gap-1 text-xs text-danger-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          {done && (
            <p className="flex items-center gap-1 text-xs text-success-700">
              <Check className="h-3.5 w-3.5 shrink-0" />
              تم الحفظ
            </p>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={pending || done}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'إنشاء المقال' : 'حفظ التعديلات'}
          </Button>
        </div>
      </div>
    </form>
  );
}

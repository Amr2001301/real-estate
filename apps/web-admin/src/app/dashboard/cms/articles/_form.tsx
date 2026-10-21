'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, AlertCircle, ImageIcon, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArticleEditor } from '@/components/article-editor';
import { cn } from '@/lib/cn';

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
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [cover, setCover] = useState(initial.coverUrl ?? '');

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

  const card = 'rounded-[22px] border border-hairline bg-surface';
  const label = 'text-[12.5px] font-semibold text-slate-700';

  return (
    <form
      onSubmit={handleSubmit}
      // A required field in the hidden language would block the submit silently: show its tab.
      onInvalidCapture={(e) => {
        const name = (e.target as HTMLInputElement).name ?? '';
        if (name.startsWith('ar_')) setLang('ar');
        else if (name.startsWith('en_')) setLang('en');
      }}
      className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start"
    >
      {/* The writing: one language at a time; both stay in the form */}
      <section className={cn(card, 'xl:col-span-2')}>
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <h2 className="font-heading text-[18px] font-bold text-slate-900">محتوى المقال</h2>
          <div role="tablist" className="inline-flex rounded-full border border-hairline bg-surface-muted/50 p-1">
            {(['ar', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-colors',
                  lang === l ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {(['ar', 'en'] as const).map((l) => (
          <div key={l} className={cn('space-y-5 p-6', lang !== l && 'hidden')} dir={l === 'ar' ? 'rtl' : 'ltr'}>
            <Input
              name={`${l}_title`}
              required
              placeholder={l === 'ar' ? 'عنوان المقال' : 'Article title'}
              defaultValue={l === 'ar' ? initial.ar_title : initial.en_title}
              className="h-14 rounded-2xl text-[20px] font-bold"
            />
            <Textarea
              name={`${l}_excerpt`}
              rows={2}
              placeholder={l === 'ar' ? 'مقتطف قصير يظهر في القوائم ونتائج البحث' : 'A short excerpt shown in lists and search results'}
              defaultValue={l === 'ar' ? initial.ar_excerpt : initial.en_excerpt}
            />
            <ArticleEditor name={`${l}_body`} dir={l === 'ar' ? 'rtl' : 'ltr'} defaultValue={l === 'ar' ? initial.ar_body : initial.en_body} />
          </div>
        ))}
      </section>

      {/* Publishing, kept in view */}
      <aside className="space-y-5 xl:sticky xl:top-24">
        <section className={cn(card, 'space-y-4 p-6')}>
          <h2 className="font-heading text-[16px] font-bold text-slate-900">النشر</h2>
          <div className="grid gap-1.5">
            <label className={label}>مسار المقال <span className="text-danger-500">*</span></label>
            <Input
              name="slug"
              required
              dir="ltr"
              placeholder="real-estate-tips"
              className="font-mono"
              defaultValue={initial.slug}
              readOnly={mode === 'edit'}
              leftAddon={<Link2 />}
            />
            <p className="text-[11.5px] text-slate-500" dir="ltr">/articles/{'{'}slug{'}'}</p>
          </div>
          <label className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-2xl border border-hairline px-4 py-3">
            <span className="text-[13px] font-semibold text-slate-700">نشر المقال فور الحفظ</span>
            <input type="checkbox" name="published" defaultChecked={initial.published} className="peer sr-only" />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-500/25 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#C9A24E] peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
          </label>
          {error && (
            <p className="flex items-start gap-1.5 rounded-xl bg-danger-500/10 px-3 py-2 text-[12.5px] text-danger-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          {done && (
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-500/12 px-3 py-2 text-[12.5px] font-semibold text-emerald-600">
              <Check className="h-3.5 w-3.5 shrink-0" />
              تم الحفظ
            </p>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full" disabled={pending || done}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'إنشاء المقال' : 'حفظ التعديلات'}
          </Button>
        </section>

        <section className={cn(card, 'space-y-3 p-6')}>
          <h2 className="font-heading text-[16px] font-bold text-slate-900">صورة الغلاف</h2>
          <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-hairline bg-surface-muted/40">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-slate-300" />
            )}
          </div>
          <Input name="coverUrl" dir="ltr" placeholder="https://..." value={cover} onChange={(e) => setCover(e.target.value)} />
        </section>
      </aside>
    </form>
  );
}

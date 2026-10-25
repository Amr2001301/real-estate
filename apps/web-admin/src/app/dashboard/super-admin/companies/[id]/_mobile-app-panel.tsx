'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { PremiumSectionCard } from '@/components/premium';
import { MediaUploader } from '@/components/media-uploader';
import { getClientLocale } from '@/lib/locale-client';
import type { Locale } from '@/lib/locale';
import { readError } from '@/components/ai/ai-strings';

type Status = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

interface MobileApp {
  appNameAr: string;
  appNameEn: string;
  packageId: string;
  iconUrl: string | null;
  splashUrl: string | null;
  status: Status;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

interface Account {
  company: { id: string; name: string; slug: string };
  app: MobileApp | null;
}

const ar = {
  title: 'تطبيق الشركة',
  description: 'تطبيق العملاء الخاص بالشركة في المتاجر — باسمها وشعارها. بدونه يستخدم عملاؤها تطبيق المنصة العام.',
  none: 'لا يوجد تطبيق خاص — عملاء الشركة يستخدمون تطبيق المنصة العام.',
  setUp: 'إعداد تطبيق خاص',
  edit: 'تعديل',
  remove: 'إلغاء التطبيق الخاص',
  removeConfirm: 'سيعود عملاء الشركة لتطبيق المنصة العام. متأكد؟',
  nameAr: 'اسم التطبيق بالعربية',
  nameEn: 'اسم التطبيق بالإنجليزية',
  nameHint: 'يظهر تحت الأيقونة وفي المتجر — حتى 30 حرفًا',
  packageId: 'معرّف التطبيق (Package ID)',
  packageHint: 'مثل com.company.app — لا يتغير بعد النشر',
  icon: 'أيقونة التطبيق',
  iconSpec: 'PNG · 1024×1024 · حتى 1 ميجابايت',
  splash: 'صورة شاشة البداية',
  splashSpec: 'PNG · حتى 2 ميجابايت — تُستخدم الأيقونة إن لم تُرفع',
  upload: 'رفع',
  status: 'الحالة',
  statuses: { DRAFT: 'قيد التجهيز', IN_REVIEW: 'قيد المراجعة في المتجر', PUBLISHED: 'منشور' } as Record<Status, string>,
  playStore: 'رابط Google Play',
  appStore: 'رابط App Store',
  save: 'حفظ',
  cancel: 'إلغاء',
  error: 'حدث خطأ',
  copyBuild: 'نسخ ملف البناء',
  copied: 'تم النسخ — الصقه في GitHub ← Actions ← Company app build',
  noIcon: 'ارفع الأيقونة أولًا ليمكن بناء التطبيق.',
};

const en: typeof ar = {
  title: 'Company app',
  description: "The company's own customer app in the stores — under its name and logo. Without one, its customers use the platform's shared app.",
  none: "No app of its own — the company's customers use the platform's shared app.",
  setUp: 'Set up an app',
  edit: 'Edit',
  remove: 'Remove the company app',
  removeConfirm: "The company's customers go back to the platform's shared app. Sure?",
  nameAr: 'App name (Arabic)',
  nameEn: 'App name (English)',
  nameHint: 'Shown under the icon and in the store — up to 30 characters',
  packageId: 'Package ID',
  packageHint: 'e.g. com.company.app — cannot change once published',
  icon: 'App icon',
  iconSpec: 'PNG · 1024×1024 · up to 1 MB',
  splash: 'Splash image',
  splashSpec: 'PNG · up to 2 MB — the icon is used when none is uploaded',
  upload: 'Upload',
  status: 'Status',
  statuses: { DRAFT: 'Being prepared', IN_REVIEW: 'In store review', PUBLISHED: 'Published' },
  playStore: 'Google Play link',
  appStore: 'App Store link',
  save: 'Save',
  cancel: 'Cancel',
  error: 'Something went wrong',
  copyBuild: 'Copy build file',
  copied: 'Copied — paste it in GitHub → Actions → Company app build',
  noIcon: 'Upload the icon first so the app can be built.',
};

const t = (locale: Locale) => (locale === 'en' ? en : ar);
const PRESIGN = '/api-proxy/super-admin/mobile-app/presign';

/** A package id suggested from the company's slug: com.<slug>.app */
function suggestPackageId(slug: string) {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return clean ? `com.${/^[a-z]/.test(clean) ? clean : `c${clean}`}.app` : '';
}

// The company's own customer app: its store name, package id, icon and status.
export function CompanyMobileAppPanel({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => t(locale), [locale]);
  const [account, setAccount] = useState<Account | null>(null);
  const [editing, setEditing] = useState(false);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // The build workflow takes this read as its input (company-app.yml).
  async function copyBuildFile() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(account));
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setError(m.error);
    }
  }

  async function load() {
    const res = await fetch(`/api-proxy/super-admin/companies/${companyId}/mobile-app`);
    if (res.ok) setAccount((await res.json()) as Account);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function open() {
    setError(null);
    setIconUrl(account?.app?.iconUrl ?? null);
    setSplashUrl(account?.app?.splashUrl ?? null);
    setEditing(true);
  }

  function save(form: FormData) {
    setError(null);
    const text = (k: string) => String(form.get(k) ?? '').trim();
    const body = {
      appNameAr: text('appNameAr'),
      appNameEn: text('appNameEn'),
      packageId: text('packageId'),
      iconUrl,
      splashUrl,
      status: text('status') as Status,
      playStoreUrl: text('playStoreUrl') || null,
      appStoreUrl: text('appStoreUrl') || null,
    };
    startTransition(async () => {
      const res = await fetch(`/api-proxy/super-admin/companies/${companyId}/mobile-app`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setError(await readError(res, m.error));
      setAccount((await res.json()) as Account);
      setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm(m.removeConfirm)) return;
    startTransition(async () => {
      const res = await fetch(`/api-proxy/super-admin/companies/${companyId}/mobile-app`, { method: 'DELETE' });
      if (!res.ok) return setError(await readError(res, m.error));
      setAccount((await res.json()) as Account);
      setEditing(false);
    });
  }

  const app = account?.app ?? null;

  return (
    <PremiumSectionCard
      title={m.title}
      description={m.description}
      icon={<Smartphone className="h-4 w-4" />}
      trailing={
        !editing && account ? (
          <Button variant={app ? 'outline' : 'primary'} size="sm" onClick={open} data-testid="mobile-app-edit">
            {app ? m.edit : m.setUp}
          </Button>
        ) : undefined
      }
    >
      <div data-testid="mobile-app-panel" className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

        {!editing && !app && <p className="text-sm text-slate-500">{m.none}</p>}

        {!editing && app && (
          <div className="flex flex-wrap items-center gap-4">
            {app.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={app.iconUrl} alt="" className="h-16 w-16 rounded-2xl border border-hairline object-cover" />
            ) : (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-hairline text-slate-400">
                <Smartphone className="h-6 w-6" />
              </span>
            )}
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-sm font-bold text-slate-900">
                {app.appNameAr} · <span dir="ltr">{app.appNameEn}</span>
              </span>
              <span className="text-xs text-slate-500" dir="ltr">
                {app.packageId}
              </span>
              <span className="text-xs font-semibold text-brand-700">{m.statuses[app.status]}</span>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              {app.iconUrl ? (
                <Button variant="outline" size="sm" onClick={copyBuildFile} data-testid="mobile-app-copy-build">
                  {m.copyBuild}
                </Button>
              ) : (
                <span className="text-warning-700">{m.noIcon}</span>
              )}
              {copied && <span className="text-success-700" role="status">{m.copied}</span>}
              {app.playStoreUrl && (
                <a href={app.playStoreUrl} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  Google Play
                </a>
              )}
              {app.appStoreUrl && (
                <a href={app.appStoreUrl} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  App Store
                </a>
              )}
            </div>
          </div>
        )}

        {editing && account && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save(new FormData(e.currentTarget));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={m.nameAr} name="appNameAr" required hint={m.nameHint}>
                <Input name="appNameAr" required minLength={2} maxLength={30} defaultValue={app?.appNameAr ?? account.company.name} />
              </Field>
              <Field label={m.nameEn} name="appNameEn" required hint={m.nameHint}>
                <Input name="appNameEn" required minLength={2} maxLength={30} dir="ltr" defaultValue={app?.appNameEn ?? ''} />
              </Field>
              <Field label={m.packageId} name="packageId" required hint={m.packageHint}>
                <Input
                  name="packageId"
                  required
                  maxLength={150}
                  dir="ltr"
                  pattern="[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+"
                  defaultValue={app?.packageId ?? suggestPackageId(account.company.slug)}
                />
              </Field>
              <Field label={m.status} name="status">
                <Select name="status" defaultValue={app?.status ?? 'DRAFT'}>
                  {(Object.keys(m.statuses) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {m.statuses[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.playStore} name="playStoreUrl">
                <Input name="playStoreUrl" type="url" dir="ltr" placeholder="https://play.google.com/store/apps/details?id=…" defaultValue={app?.playStoreUrl ?? ''} />
              </Field>
              <Field label={m.appStore} name="appStoreUrl">
                <Input name="appStoreUrl" type="url" dir="ltr" placeholder="https://apps.apple.com/…" defaultValue={app?.appStoreUrl ?? ''} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['icon', m.icon, m.iconSpec, iconUrl, setIconUrl],
                  ['splash', m.splash, m.splashSpec, splashUrl, setSplashUrl],
                ] as const
              ).map(([asset, label, spec, url, set]) => (
                <div key={asset} className="flex items-center gap-3 rounded-xl border border-hairline p-3">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-14 w-14 rounded-xl border border-hairline object-cover" />
                  ) : (
                    <span className="h-14 w-14 rounded-xl border border-dashed border-hairline" />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    <span className="text-xs text-slate-500">{spec}</span>
                    <MediaUploader
                      folder="branding"
                      accept="image/png"
                      buttonLabel={m.upload}
                      presignUrl={PRESIGN}
                      presignExtra={{ asset }}
                      onUploaded={(stored) => set(stored)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" size="sm" loading={pending}>
                {m.save}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {m.cancel}
              </Button>
              {app && (
                <Button type="button" variant="ghost" size="sm" className="ms-auto text-danger-700" onClick={remove}>
                  {m.remove}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </PremiumSectionCard>
  );
}

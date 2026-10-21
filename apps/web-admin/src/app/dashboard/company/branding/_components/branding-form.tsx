'use client';

import { useState, useTransition } from 'react';
import { Palette, Phone, Globe, Building2, Check, Coins, Mail, MessageCircle, MapPin, Clock, ImageIcon, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { MediaUploader } from '@/components/media-uploader';
import { patchBrandingAction, type BrandingPayload } from '../actions';
import { CURRENCY_OPTIONS, currencySymbol } from '@/lib/currency-format';

// ── Curated palette ─────────────────────────────────────────────────────────
// All colours satisfy ≥ 3:1 contrast ratio against white — safe to use as
// primaryColor without triggering the backend contrast check.

const PALETTE = [
  { hex: '#0F1E33', name: 'نيفي' },
  { hex: '#1E3A5F', name: 'أزرق عميق' },
  { hex: '#0F766E', name: 'فيروزي' },
  { hex: '#166534', name: 'أخضر داكن' },
  { hex: '#3730A3', name: 'بنفسجي غامق' },
  { hex: '#5B21B6', name: 'أرجواني' },
  { hex: '#9F1239', name: 'قرمزي' },
  { hex: '#B45309', name: 'عنبري' },
  { hex: '#44403C', name: 'حجري' },
  { hex: '#1F2937', name: 'رمادي داكن' },
  { hex: '#7C2D12', name: 'صدأ' },
  { hex: '#064E3B', name: 'زمردي داكن' },
] as const;

const ACCENT_PALETTE = [
  { hex: '#C8A24B', name: 'ذهبي' },
  { hex: '#D97706', name: 'عنبري' },
  { hex: '#0EA5E9', name: 'أزرق فاتح' },
  { hex: '#10B981', name: 'أخضر' },
  { hex: '#8B5CF6', name: 'بنفسجي' },
  { hex: '#EC4899', name: 'وردي' },
] as const;

// ── Types ───────────────────────────────────────────────────────────────────

type RawBranding = {
  displayName?: string | null;
  tagline?: { ar?: string; en?: string } | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  ogImageUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactWhatsApp?: string | null;
  contactAddress?: { ar?: string; en?: string } | null;
  officeHours?: { ar?: string; en?: string } | null;
  socialLinks?: Record<string, string> | null;
  registrationNumber?: string | null;
  currency?: string | null;
};

// ── Field helpers ───────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label className="text-[12.5px] font-semibold text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-[11.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

function ColourSwatch({
  hex,
  name,
  selected,
  onClick,
}: {
  hex: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={name}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition-transform',
        selected ? 'ring-2 ring-[#C9A24E]' : 'ring-1 ring-black/10 hover:scale-110 dark:ring-white/10',
      )}
      style={{ backgroundColor: hex }}
    >
      {selected && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
      <span className="sr-only">{name}</span>
    </button>
  );
}

/** A card per brand asset: its preview, its spec and the upload button. */
function AssetTile({
  title,
  spec,
  url,
  previewClass,
  children,
}: {
  title: string;
  spec: string;
  url: string;
  previewClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-muted/30 p-4">
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-hairline bg-surface">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className={cn('object-contain', previewClass)} />
        ) : (
          <ImageIcon className="h-7 w-7 text-slate-300" />
        )}
      </div>
      <div>
        <p className="text-[13.5px] font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-slate-500">{spec}</p>
      </div>
      <div className="[&_button]:w-full">{children}</div>
    </div>
  );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-hairline bg-surface">
      <header className="flex items-center gap-3 border-b border-hairline px-6 py-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A] [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{title}</h2>
          <p className="text-[12.5px] text-slate-500">{description}</p>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

const Monogram = ({ children }: { children: string }) => (
  <span className="text-[10.5px] font-bold tracking-wide text-slate-500">{children}</span>
);

// ── Main form ───────────────────────────────────────────────────────────────

export function BrandingForm({ initial }: { initial: RawBranding }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const str = (v: string | null | undefined) => v ?? '';
  const obj = (v: Record<string, string> | null | undefined) => v ?? {};

  const [displayName, setDisplayName] = useState(str(initial.displayName));
  const [taglineAr, setTaglineAr] = useState(str(initial.tagline?.ar));
  const [taglineEn, setTaglineEn] = useState(str(initial.tagline?.en));
  const [logoUrl, setLogoUrl] = useState(str(initial.logoUrl));
  const [faviconUrl, setFaviconUrl] = useState(str(initial.faviconUrl));
  const [ogImageUrl, setOgImageUrl] = useState(str(initial.ogImageUrl));
  const [primaryColor, setPrimaryColor] = useState(str(initial.primaryColor));
  const [primaryHex, setPrimaryHex] = useState(str(initial.primaryColor));
  const [accentColor, setAccentColor] = useState(str(initial.accentColor));
  const [accentHex, setAccentHex] = useState(str(initial.accentColor));
  const [contactEmail, setContactEmail] = useState(str(initial.contactEmail));
  const [contactPhone, setContactPhone] = useState(str(initial.contactPhone));
  const [contactWhatsApp, setContactWhatsApp] = useState(str(initial.contactWhatsApp));
  const [addressAr, setAddressAr] = useState(str(initial.contactAddress?.ar));
  const [addressEn, setAddressEn] = useState(str(initial.contactAddress?.en));
  const [hoursAr, setHoursAr] = useState(str(initial.officeHours?.ar));
  const [hoursEn, setHoursEn] = useState(str(initial.officeHours?.en));
  const socialInit = obj(initial.socialLinks as Record<string, string> | null | undefined);
  const [instagram, setInstagram] = useState(str(socialInit.instagram));
  const [facebook, setFacebook] = useState(str(socialInit.facebook));
  const [twitter, setTwitter] = useState(str(socialInit.twitter));
  const [linkedin, setLinkedin] = useState(str(socialInit.linkedin));
  const [youtube, setYoutube] = useState(str(socialInit.youtube));
  const [tiktok, setTiktok] = useState(str(socialInit.tiktok));
  const [regNumber, setRegNumber] = useState(str(initial.registrationNumber));
  const [currency, setCurrency] = useState(str(initial.currency) || 'EGP');

  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const primaryHexError = primaryHex && !HEX_RE.test(primaryHex)
    ? 'يجب أن يكون اللون بصيغة #RRGGBB' : null;
  const accentHexError = accentHex && !HEX_RE.test(accentHex)
    ? 'يجب أن يكون اللون بصيغة #RRGGBB' : null;

  function handlePrimaryPalette(hex: string) {
    setPrimaryColor(hex);
    setPrimaryHex(hex);
  }

  function handleAccentPalette(hex: string) {
    setAccentColor(hex);
    setAccentHex(hex);
  }

  function handleSubmit() {
    const payload: BrandingPayload = {};
    if (displayName)    payload.displayName    = displayName;
    if (taglineAr || taglineEn) payload.tagline = { ar: taglineAr || undefined, en: taglineEn || undefined };
    if (logoUrl)        payload.logoUrl        = logoUrl;
    if (faviconUrl)     payload.faviconUrl     = faviconUrl;
    if (ogImageUrl)     payload.ogImageUrl     = ogImageUrl;
    if (primaryColor && HEX_RE.test(primaryColor)) payload.primaryColor = primaryColor;
    if (accentColor  && HEX_RE.test(accentColor))  payload.accentColor  = accentColor;
    if (contactEmail) payload.contactEmail = contactEmail;
    if (contactPhone) payload.contactPhone = contactPhone;
    if (contactWhatsApp) payload.contactWhatsApp = contactWhatsApp;
    if (addressAr || addressEn) payload.contactAddress = { ar: addressAr || undefined, en: addressEn || undefined };
    if (hoursAr || hoursEn) payload.officeHours = { ar: hoursAr || undefined, en: hoursEn || undefined };
    const social: BrandingPayload['socialLinks'] = {};
    if (instagram) social.instagram = instagram;
    if (facebook)  social.facebook  = facebook;
    if (twitter)   social.twitter   = twitter;
    if (linkedin)  social.linkedin  = linkedin;
    if (youtube)   social.youtube   = youtube;
    if (tiktok)    social.tiktok    = tiktok;
    if (Object.keys(social).length) payload.socialLinks = social;
    if (regNumber) payload.registrationNumber = regNumber;
    payload.currency = currency;

    startTransition(async () => {
      const r = await patchBrandingAction(payload);
      setResult(r);
    });
  }

  const shownPrimary = HEX_RE.test(primaryColor) ? primaryColor : '#1E3A5F';
  const shownAccent = HEX_RE.test(accentColor) ? accentColor : '#C8A24B';
  const shownName = displayName || 'اسم الشركة';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
      <div className="space-y-6 xl:col-span-2">
        {/* Identity */}
        <Section title="الهوية" description="اسم الشركة والشعار والعلامة التجارية" icon={<Building2 />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="الاسم المعروض">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسم الشركة للعرض العام" dir="rtl" />
            </Field>
            <Field label="رقم السجل التجاري">
              <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="رقم الترخيص" dir="ltr" />
            </Field>
            <Field label="الشعار النصي (عربي)">
              <Input value={taglineAr} onChange={(e) => setTaglineAr(e.target.value)} placeholder="وصف قصير بالعربية" dir="rtl" />
            </Field>
            <Field label="الشعار النصي (إنجليزي)">
              <Input value={taglineEn} onChange={(e) => setTaglineEn(e.target.value)} placeholder="Short tagline in English" dir="ltr" />
            </Field>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <AssetTile title="الشعار الرئيسي" spec="PNG / WebP · مربع 1:1 · حد 512 كيلوبايت" url={logoUrl} previewClass="h-20 w-20 rounded-xl">
              <MediaUploader folder="branding" accept="image/png,image/webp,image/jpeg" buttonLabel="رفع الشعار" presignExtra={{ brandingAsset: 'logo' }} onUploaded={(url) => setLogoUrl(url)} />
            </AssetTile>
            <AssetTile title="أيقونة المتصفح" spec="PNG / WebP · 64×64 · حد 128 كيلوبايت" url={faviconUrl} previewClass="h-12 w-12 rounded-lg">
              <MediaUploader folder="branding" accept="image/png,image/webp,image/jpeg" buttonLabel="رفع الأيقونة" presignExtra={{ brandingAsset: 'favicon' }} onUploaded={(url) => setFaviconUrl(url)} />
            </AssetTile>
            <AssetTile title="صورة المشاركة (OG)" spec="1200×630 · PNG / WebP · حد 1 ميجابايت" url={ogImageUrl} previewClass="h-full w-full rounded-xl object-cover">
              <MediaUploader folder="branding" accept="image/png,image/webp,image/jpeg" buttonLabel="رفع صورة OG" presignExtra={{ brandingAsset: 'og' }} onUploaded={(url) => setOgImageUrl(url)} />
            </AssetTile>
          </div>
        </Section>

        {/* Colours */}
        <Section title="الألوان" description="اختر من اللوحة المعتمدة أو أدخل كود لون مخصص" icon={<Palette />}>
          <div className="space-y-7">
            {([
              ['اللون الرئيسي', 'للأزرار والعناوين وشريط الموقع — التباين مع الأبيض ≥ 3:1', PALETTE, primaryColor, primaryHex, setPrimaryHex, setPrimaryColor, handlePrimaryPalette, primaryHexError, '#1E3A5F', shownPrimary],
              ['لون التمييز', 'للمسات الصغيرة: الروابط والشارات والخطوط', ACCENT_PALETTE, accentColor, accentHex, setAccentHex, setAccentColor, handleAccentPalette, accentHexError, '#C8A24B', shownAccent],
            ] as const).map(([label, hint, palette, chosen, hex, setHex, setColour, pick, err, ph, shown]) => (
              <div key={label} className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 shrink-0 rounded-2xl shadow-inner ring-1 ring-black/10 dark:ring-white/10" style={{ backgroundColor: shown }} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900">{label}</p>
                    <p className="text-[11.5px] leading-snug text-slate-500">{hint}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2.5">
                    {palette.map(({ hex: h, name }) => (
                      <ColourSwatch key={h} hex={h} name={name} selected={chosen === h} onClick={() => pick(h)} />
                    ))}
                  </div>
                  <div className="max-w-[220px]">
                    <Input
                      value={hex}
                      onChange={(e) => {
                        setHex(e.target.value);
                        if (HEX_RE.test(e.target.value)) setColour(e.target.value);
                      }}
                      placeholder={ph}
                      dir="ltr"
                      inputSize="sm"
                      aria-label={`${label} — كود مخصص`}
                      invalid={!!err}
                      leftAddon={<span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: shown }} />}
                    />
                    {err && <p className="mt-1 text-[11px] text-danger-600">{err}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Contact */}
        <Section title="بيانات التواصل" description="تظهر في الموقع العام والتطبيق" icon={<Phone />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="البريد الإلكتروني">
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@company.com" dir="ltr" leftAddon={<Mail />} />
            </Field>
            <Field label="رقم الهاتف">
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+201001234567" dir="ltr" leftAddon={<Phone />} />
            </Field>
            <Field label="واتساب">
              <Input value={contactWhatsApp} onChange={(e) => setContactWhatsApp(e.target.value)} placeholder="201001234567" dir="ltr" leftAddon={<MessageCircle />} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="العنوان (عربي)">
              <Input value={addressAr} onChange={(e) => setAddressAr(e.target.value)} placeholder="القاهرة الجديدة، التجمع الخامس" dir="rtl" leftAddon={<MapPin />} />
            </Field>
            <Field label="العنوان (إنجليزي)">
              <Input value={addressEn} onChange={(e) => setAddressEn(e.target.value)} placeholder="Fifth Settlement, New Cairo" dir="ltr" leftAddon={<MapPin />} />
            </Field>
            <Field label="ساعات العمل (عربي)">
              <Input value={hoursAr} onChange={(e) => setHoursAr(e.target.value)} placeholder="الأحد–الخميس 9ص–6م" dir="rtl" leftAddon={<Clock />} />
            </Field>
            <Field label="ساعات العمل (إنجليزي)">
              <Input value={hoursEn} onChange={(e) => setHoursEn(e.target.value)} placeholder="Sun–Thu 9am–6pm" dir="ltr" leftAddon={<Clock />} />
            </Field>
          </div>
        </Section>

        {/* Social */}
        <Section title="روابط التواصل الاجتماعي" description="ادخل الرابط الكامل لكل منصة" icon={<Globe />}>
          <div className="grid gap-5 sm:grid-cols-2">
            {([
              ['إنستغرام', 'IG', instagram, setInstagram, 'https://instagram.com/yourpage'],
              ['فيسبوك', 'FB', facebook, setFacebook, 'https://facebook.com/yourpage'],
              ['تويتر / X', 'X', twitter, setTwitter, 'https://x.com/yourpage'],
              ['لينكد إن', 'in', linkedin, setLinkedin, 'https://linkedin.com/company/yourco'],
              ['يوتيوب', 'YT', youtube, setYoutube, 'https://youtube.com/@yourpage'],
              ['تيك توك', 'TT', tiktok, setTiktok, 'https://tiktok.com/@yourpage'],
            ] as [string, string, string, (v: string) => void, string][]).map(([label, mono, val, setter, ph]) => (
              <Field key={label} label={label}>
                <Input value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} dir="ltr" leftAddon={<Monogram>{mono}</Monogram>} />
              </Field>
            ))}
          </div>
        </Section>

        {/* Currency — one value for the whole platform */}
        <Section
          title="العملة"
          description="العملة التي تظهر بها كل المبالغ: لوحة التحكم لكل الأدوار، بوابة الوسطاء، الموقع، تطبيق العملاء والموظفين، والإشعارات."
          icon={<Coins />}
        >
          <Field label="عملة الشركة" className="max-w-sm">
            <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} data-testid="company-currency">
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.ar} ({c.code} · {currencySymbol(c.code)})
                </option>
              ))}
            </Select>
          </Field>
        </Section>
      </div>

      {/* Live preview + save, kept in view */}
      <aside className="space-y-4 xl:sticky xl:top-24">
        <section data-testid="brand-preview" className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
          <header className="flex items-center gap-2 px-5 pb-3 pt-4">
            <Eye className="h-4 w-4 text-[#B8913F] dark:text-[#D8B66A]" />
            <p className="text-[13px] font-bold text-slate-900">معاينة مباشرة</p>
          </header>
          <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-hairline">
            {/* Browser tab */}
            <div className="flex items-center gap-2 bg-surface-muted px-3 py-2">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
              </span>
              <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-surface px-2 py-0.5 text-[10.5px] text-slate-600">
                {faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconUrl} alt="" className="h-3 w-3 rounded-sm" />
                ) : (
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: shownAccent }} />
                )}
                <span className="truncate">{shownName}</span>
              </span>
            </div>
            {/* Site hero */}
            <div className="relative px-5 pb-6 pt-4 text-white" style={{ background: `linear-gradient(160deg, ${shownPrimary}, ${shownPrimary}cc)` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg bg-white/10 object-contain" />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold" style={{ backgroundColor: shownAccent }}>
                      {shownName.charAt(0)}
                    </span>
                  )}
                  <span className="truncate text-[13px] font-bold">{shownName}</span>
                </div>
                <span className="flex gap-1.5 opacity-70">
                  <span className="h-1 w-5 rounded-full bg-white/60" />
                  <span className="h-1 w-5 rounded-full bg-white/60" />
                  <span className="h-1 w-5 rounded-full bg-white/60" />
                </span>
              </div>
              <p className="mt-6 font-heading text-[19px] font-bold leading-snug">{taglineAr || 'شعارك النصي يظهر هنا'}</p>
              {taglineEn && <p className="mt-1 text-[11.5px] opacity-75" dir="ltr">{taglineEn}</p>}
              <span className="mt-4 inline-flex rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-[#1a1408]" style={{ backgroundColor: shownAccent }}>
                احجز زيارة
              </span>
            </div>
            {/* Contact footer */}
            <div className="space-y-1.5 bg-surface px-5 py-3.5 text-[11.5px] text-slate-600">
              {[
                [<Phone key="p" />, contactPhone],
                [<Mail key="m" />, contactEmail],
                [<MapPin key="a" />, addressAr],
              ].filter(([, v]) => v).map(([icon, v], i) => (
                <p key={i} className="flex items-center gap-2 truncate [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
                  <span style={{ color: shownAccent }}>{icon}</span>
                  <span className="truncate" dir="auto">{v as string}</span>
                </p>
              ))}
              {!contactPhone && !contactEmail && !addressAr && <p className="text-slate-400">بيانات التواصل تظهر هنا</p>}
            </div>
          </div>
        </section>

        <div className="space-y-3 rounded-[22px] border border-hairline bg-surface p-4">
          {result?.ok === false && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-500/10 px-3 py-2.5 text-[12.5px] text-danger-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {result.error}
            </p>
          )}
          {result?.ok === true && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/12 px-3 py-2.5 text-[12.5px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              تم حفظ الهوية البصرية
            </p>
          )}
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={handleSubmit}
            disabled={pending || !!primaryHexError || !!accentHexError}
          >
            {pending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
          </Button>
          <p className="text-center text-[11.5px] text-slate-500">التغييرات تظهر في الموقع والتطبيق بعد الحفظ</p>
        </div>
      </aside>
    </div>
  );
}

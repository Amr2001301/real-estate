'use client';

import { useState, useTransition } from 'react';
import { Palette, Phone, Globe, Building2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MediaUploader } from '@/components/media-uploader';
import { PremiumSectionCard } from '@/components/premium';
import { patchBrandingAction, type BrandingPayload } from '../actions';

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
};

// ── Field helpers ───────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[12.5px] font-semibold text-navy/80">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 -mt-0.5">{hint}</p>}
      {children}
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
      onClick={onClick}
      className={`relative h-8 w-8 rounded-lg transition-all ring-offset-1 ${
        selected ? 'ring-2 ring-brand-600 scale-110' : 'ring-0 hover:scale-105'
      }`}
      style={{ backgroundColor: hex }}
    >
      {selected && (
        <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
      )}
      <span className="sr-only">{name}</span>
    </button>
  );
}

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

    startTransition(async () => {
      const r = await patchBrandingAction(payload);
      setResult(r);
    });
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <PremiumSectionCard
        title="الهوية"
        description="اسم الشركة والشعار والعلامة التجارية"
        icon={<Building2 />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="الاسم المعروض">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="اسم الشركة للعرض العام"
              dir="rtl"
            />
          </Field>
          <Field label="رقم السجل التجاري">
            <Input
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="رقم الترخيص"
              dir="ltr"
            />
          </Field>
          <Field label="الشعار الرئيسي" hint="PNG / WebP · مربع 1:1 · حد 512 كيلوبايت">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="logo preview" className="h-10 w-10 rounded-lg object-cover border border-hairline" />
              )}
              <MediaUploader
                folder="branding"
                accept="image/png,image/webp,image/jpeg"
                buttonLabel="رفع الشعار"
                presignExtra={{ brandingAsset: 'logo' }}
                onUploaded={(url) => setLogoUrl(url)}
              />
            </div>
          </Field>
          <Field label="الفافيكون" hint="PNG / WebP · 64×64 · حد 128 كيلوبايت">
            <div className="flex items-center gap-3">
              {faviconUrl && (
                <img src={faviconUrl} alt="favicon preview" className="h-8 w-8 rounded object-cover border border-hairline" />
              )}
              <MediaUploader
                folder="branding"
                accept="image/png,image/webp,image/jpeg"
                buttonLabel="رفع الفافيكون"
                presignExtra={{ brandingAsset: 'favicon' }}
                onUploaded={(url) => setFaviconUrl(url)}
              />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="صورة المشاركة الاجتماعية (OG Image)" hint="1200×630 · PNG / WebP · حد 1 ميجابايت (لا يُقبل SVG)">
              <div className="flex items-center gap-3">
                {ogImageUrl && (
                  <img src={ogImageUrl} alt="og preview" className="h-12 w-20 rounded object-cover border border-hairline" />
                )}
                <MediaUploader
                  folder="branding"
                  accept="image/png,image/webp,image/jpeg"
                  buttonLabel="رفع صورة OG"
                  presignExtra={{ brandingAsset: 'og' }}
                  onUploaded={(url) => setOgImageUrl(url)}
                />
              </div>
            </Field>
          </div>
          <Field label="الشعار النصي (عربي)">
            <Input
              value={taglineAr}
              onChange={(e) => setTaglineAr(e.target.value)}
              placeholder="وصف قصير بالعربية"
              dir="rtl"
            />
          </Field>
          <Field label="الشعار النصي (إنجليزي)">
            <Input
              value={taglineEn}
              onChange={(e) => setTaglineEn(e.target.value)}
              placeholder="Short tagline in English"
              dir="ltr"
            />
          </Field>
        </div>
      </PremiumSectionCard>

      {/* Colours */}
      <PremiumSectionCard
        title="الألوان"
        description="اختر من اللوحة المعتمدة أو أدخل كود لون مخصص"
        icon={<Palette />}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[12.5px] font-semibold text-navy/80">اللون الرئيسي</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map(({ hex, name }) => (
                <ColourSwatch
                  key={hex}
                  hex={hex}
                  name={name}
                  selected={primaryColor === hex}
                  onClick={() => handlePrimaryPalette(hex)}
                />
              ))}
            </div>
            <Field label="كود مخصص" hint="صيغة #RRGGBB — يجب أن يكون التباين ≥ 3:1 مع الأبيض">
              <Input
                value={primaryHex}
                onChange={(e) => {
                  setPrimaryHex(e.target.value);
                  if (HEX_RE.test(e.target.value)) {
                    setPrimaryColor(e.target.value);
                  }
                }}
                placeholder="#1E3A5F"
                dir="ltr"
                invalid={!!primaryHexError}
              />
              {primaryHexError && <p className="text-[11px] text-red-500 mt-0.5">{primaryHexError}</p>}
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-[12.5px] font-semibold text-navy/80">لون التمييز</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PALETTE.map(({ hex, name }) => (
                <ColourSwatch
                  key={hex}
                  hex={hex}
                  name={name}
                  selected={accentColor === hex}
                  onClick={() => handleAccentPalette(hex)}
                />
              ))}
            </div>
            <Field label="كود مخصص" hint="صيغة #RRGGBB">
              <Input
                value={accentHex}
                onChange={(e) => {
                  setAccentHex(e.target.value);
                  if (HEX_RE.test(e.target.value)) {
                    setAccentColor(e.target.value);
                  }
                }}
                placeholder="#C8A24B"
                dir="ltr"
                invalid={!!accentHexError}
              />
              {accentHexError && <p className="text-[11px] text-red-500 mt-0.5">{accentHexError}</p>}
            </Field>
          </div>
        </div>
      </PremiumSectionCard>

      {/* Contact */}
      <PremiumSectionCard
        title="بيانات التواصل"
        description="تظهر في الموقع العام والتطبيق"
        icon={<Phone />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="البريد الإلكتروني">
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@company.com" dir="ltr" />
          </Field>
          <Field label="رقم الهاتف">
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+966501234567" dir="ltr" />
          </Field>
          <Field label="واتساب">
            <Input value={contactWhatsApp} onChange={(e) => setContactWhatsApp(e.target.value)} placeholder="966501234567" dir="ltr" />
          </Field>
          <Field label="العنوان (عربي)">
            <Input value={addressAr} onChange={(e) => setAddressAr(e.target.value)} placeholder="الرياض، حي العليا" dir="rtl" />
          </Field>
          <Field label="العنوان (إنجليزي)">
            <Input value={addressEn} onChange={(e) => setAddressEn(e.target.value)} placeholder="Riyadh, Al Olaya" dir="ltr" />
          </Field>
          <Field label="ساعات العمل (عربي)">
            <Input value={hoursAr} onChange={(e) => setHoursAr(e.target.value)} placeholder="الأحد–الخميس 9ص–6م" dir="rtl" />
          </Field>
          <Field label="ساعات العمل (إنجليزي)">
            <Input value={hoursEn} onChange={(e) => setHoursEn(e.target.value)} placeholder="Sun–Thu 9am–6pm" dir="ltr" />
          </Field>
        </div>
      </PremiumSectionCard>

      {/* Social */}
      <PremiumSectionCard
        title="روابط التواصل الاجتماعي"
        description="ادخل الرابط الكامل لكل منصة"
        icon={<Globe />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {([
            ['إنستغرام', instagram, setInstagram, 'https://instagram.com/yourpage'],
            ['فيسبوك', facebook, setFacebook, 'https://facebook.com/yourpage'],
            ['تويتر / X', twitter, setTwitter, 'https://twitter.com/yourpage'],
            ['لينكد إن', linkedin, setLinkedin, 'https://linkedin.com/company/yourco'],
            ['يوتيوب', youtube, setYoutube, 'https://youtube.com/@yourpage'],
            ['تيك توك', tiktok, setTiktok, 'https://tiktok.com/@yourpage'],
          ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, ph]) => (
            <Field key={label} label={label}>
              <Input value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} dir="ltr" />
            </Field>
          ))}
        </div>
      </PremiumSectionCard>

      {/* Save bar */}
      {result?.ok === false && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {result.error}
        </p>
      )}
      {result?.ok === true && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          ✓ تم حفظ الهوية البصرية
        </p>
      )}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={pending || !!primaryHexError || !!accentHexError}
        >
          {pending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
        </Button>
      </div>
    </div>
  );
}

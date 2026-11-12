import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PLAN_DEFAULTS } from '../capabilities/capability-schema';
import { arabicCurrencySymbol, normalizeCurrency } from '../currency/currency';
import { esc, fontFace } from './report-html';

/**
 * The platform's price quotation: a branded, multi-page A4 document (cover with the offer
 * details, the plans side by side, a feature comparison, terms and a signature block) printed
 * by Chromium. Built from the active pricing packages; what each plan includes comes from the
 * same plan defaults the product enforces, so the quote can never promise a feature the plan
 * does not give.
 */

export type QuoteLocale = 'ar' | 'en';

export interface QuotePackage {
  planTier: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  currency: string;
  monthlyPrice: unknown;
  annualPrice: unknown;
  setupFee: unknown;
  maxUsers: number | null;
  highlights: unknown;
  specialOffer: unknown;
}

export interface QuoteInput {
  packages: QuotePackage[];
  locale: QuoteLocale;
  /** Who the quote is prepared for (free text, optional). */
  client?: string;
  reference: string;
  issuedAt: Date;
  validDays: number;
  /** Contact line printed on the last page. */
  contact?: { email?: string; phone?: string; website?: string };
  /** The assistant add-on: question packages renewed monthly (price per month). */
  aiPackages?: Array<{ name: string; questions: number; price: unknown; currency: string }>;
}

const LOGO_PATH = resolve(__dirname, '../assets/brand/devora-logo.png');
let logoUrl: string | null | undefined;
function logo(): string | null {
  if (logoUrl === undefined) {
    try {
      logoUrl = `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`;
    } catch {
      logoUrl = null;
    }
  }
  return logoUrl;
}

const FEATURES = [
  'feature.dashboard', 'feature.crm', 'feature.contracts', 'feature.installments',
  'feature.staffApp', 'feature.customerApp', 'feature.publicWebsite',
  'feature.brokers', 'feature.advancedReports', 'feature.maintenance', 'feature.customDomain',
] as const;

const T = {
  ar: {
    dir: 'rtl',
    quote: 'عرض سعر',
    platform: 'منصة إدارة العقارات',
    ref: 'رقم العرض',
    date: 'تاريخ الإصدار',
    valid: 'صالح حتى',
    preparedFor: 'مُعدّ لـ',
    introTitle: 'باقات تناسب حجم أعمالك',
    intro:
      'تقدّم منصتنا لشركات التطوير العقاري والوساطة نظاماً متكاملاً لإدارة العملاء والمبيعات والعقود والأقساط، مع موقع عام وتطبيقات للموظفين والعملاء. اختر الباقة التي تناسب فريقك، ويمكنك الترقية في أي وقت.',
    popular: 'الأكثر طلباً',
    perMonth: 'شهرياً',
    perYear: 'سنوياً',
    oneTime: 'دفعة واحدة عند التعاقد',
    save: (n: number) => `وفّر ${n}%`,
    setup: 'رسوم الإعداد',
    noSetup: 'بدون رسوم إعداد',
    seats: (n: number) => `حتى ${n} موظفاً`,
    seatsUnlimited: 'عدد غير محدود من الموظفين',
    seatsHint: 'المستخدمون الذين يعملون على النظام (مدراء، مبيعات، صيانة، وسطاء)',
    includes: 'تشمل الباقة',
    contactUs: 'تواصل معنا للتسعير',
    offer: 'عرض خاص',
    compareTitle: 'مقارنة الباقات',
    feature: 'الميزة',
    staffSeats: 'عدد الموظفين',
    termsTitle: 'الشروط والأحكام',
    terms: (days: number) => [
      `هذا العرض صالح لمدة ${days} يوماً من تاريخ الإصدار.`,
      'الأسعار بالعملة المذكورة في كل باقة وقد لا تشمل الضرائب والرسوم المطبقة.',
      'يُسدَّد الاشتراك السنوي دفعة واحدة عند التعاقد، ويبدأ من تاريخ التفعيل.',
      'يمكن ترقية الباقة في أي وقت، ويُحتسب الفرق عن المدة المتبقية.',
      'الاستضافة والتدريب الأولي والتحديثات والدعم الفني مشمولة بدون رسوم إضافية.',
      'تحتفظ الشركة بحقها في تعديل الأسعار بإشعار مسبق.',
    ],
    customTitle: 'تحتاج أكثر من ذلك؟ نخصّص باقتك',
    custom:
      'لو فريقك أكبر من الباقات المعروضة، أو تحتاج مميزات إضافية، نصمّم لك باقة مخصصة بعدد الموظفين والمميزات التي تناسب حجم أعمالك، بسعر واضح يتناسب مع احتياجك. تواصل معنا وسنرسل لك عرضاً مفصّلاً.',
    included: 'مشمول مجاناً مع كل باقة',
    services: [
      ['استضافة سحابية', 'استضافة آمنة للنظام وبياناتك بدون رسوم إضافية'],
      ['تدريب وتشغيل أولي', 'نجهّز النظام ونُدرّب فريقك في البداية'],
      ['تحديثات وميزات جديدة', 'كل تطوير جديد على المنصة يصلك مجاناً'],
      ['دعم فني على مدار الساعة', 'فريق دعم متاح 24 ساعة، كل يوم'],
    ] as ReadonlyArray<readonly [string, string]>,
    coreTitle: 'أساسيات في كل الباقات',
    core: [
      'العقود الإلكترونية والتوقيع الإلكتروني', 'خطط التقسيط وغرامات التأخير', 'الشيكات ومتابعة ارتدادها',
      'الدفعات وإثباتات السداد', 'دفتر الحسابات', 'العمولات والمكافآت وأهداف المبيعات',
      'المحادثة والإشعارات', 'استيراد وتصدير البيانات', 'سجل التدقيق وتسجيل الدخول بخطوتين',
      'هوية الشركة وقوالب الطباعة', 'خانات عملاء مخصصة', 'تقارير المبيعات والحجوزات PDF وExcel',
    ],
    aiTitle: 'المساعد الذكي (إضافة اختيارية)',
    aiIntro: 'مساعد يجيب عن بيانات شركتك بالعربي. يُباع منفصلاً بباقات أسئلة شهرية، مثل باقات الإنترنت:',
    aiRules: [
      'لكل باقة عدد أسئلة محدد في الشهر، وعند انتهائه يتوقف المساعد حتى موعد التجديد.',
      'يمكن التجديد مبكراً في أي وقت، ويبدأ الشهر الجديد من يوم التجديد بكامل الأسئلة.',
      'الأسئلة غير المستخدمة لا تُرحَّل للشهر التالي، ويمكن إضافة أسئلة خلال الشهر.',
    ],
    aiQuestions: 'عدد الأسئلة شهرياً',
    aiPackage: 'الباقة',
    aiPrice: 'السعر شهرياً',
    thanks: 'نشكركم على اهتمامكم، ويسعدنا خدمتكم.',
    authorized: 'اعتماد',
    sign: 'التوقيع والختم',
    contact: 'للتواصل',
    features: {
      'feature.dashboard': 'لوحة التحكم',
      'feature.crm': 'إدارة العملاء المحتملين',
      'feature.contracts': 'العقود',
      'feature.installments': 'الأقساط والمدفوعات',
      'feature.staffApp': 'تطبيق الموظفين',
      'feature.customerApp': 'تطبيق العملاء',
      'feature.publicWebsite': 'الموقع العام',
      'feature.brokers': 'بوابة الوسطاء',
      'feature.advancedReports': 'التقارير المتقدمة',
      'feature.maintenance': 'إدارة الصيانة',
      'feature.customDomain': 'نطاق مخصص للموقع',
    } as Record<string, string>,
    footer: 'منصة إدارة العقارات',
  },
  en: {
    dir: 'ltr',
    quote: 'Quotation',
    platform: 'Real Estate Management Platform',
    ref: 'Quote No.',
    date: 'Issue date',
    valid: 'Valid until',
    preparedFor: 'Prepared for',
    introTitle: 'Plans that fit the size of your business',
    intro:
      'Our platform gives property developers and brokerages one system for leads, sales, contracts and instalments, with a public website and apps for staff and customers. Choose the plan that fits your team and upgrade at any time.',
    popular: 'Most popular',
    perMonth: 'per month',
    perYear: 'per year',
    oneTime: 'One payment on signing',
    save: (n: number) => `Save ${n}%`,
    setup: 'Setup fee',
    noSetup: 'No setup fee',
    seats: (n: number) => `Up to ${n} staff users`,
    seatsUnlimited: 'Unlimited staff users',
    seatsHint: 'People who work in the system (managers, sales, maintenance, brokers)',
    includes: 'Includes',
    contactUs: 'Contact us for pricing',
    offer: 'Special offer',
    compareTitle: 'Plan comparison',
    feature: 'Feature',
    staffSeats: 'Staff users',
    termsTitle: 'Terms & conditions',
    terms: (days: number) => [
      `This quotation is valid for ${days} days from the issue date.`,
      'Prices are in the currency shown on each plan and may exclude applicable taxes and fees.',
      'The annual subscription is paid once on signing and starts on the activation date.',
      'You can upgrade your plan at any time; the difference is charged for the remaining period.',
      'Hosting, initial training, updates and technical support are included at no extra cost.',
      'We may revise prices with prior notice.',
    ],
    customTitle: 'Need more? We tailor your plan',
    custom:
      'If your team is larger than the plans above, or you need extra features, we will build a custom plan around the number of staff users and the features you need, at a clear price that matches your requirements. Get in touch and we will send you a detailed offer.',
    included: 'Free with every plan',
    services: [
      ['Cloud hosting', 'Secure hosting for the system and your data at no extra cost'],
      ['Training & onboarding', 'We set the system up and train your team at the start'],
      ['Updates & new features', 'Every new release of the platform reaches you for free'],
      ['24/7 technical support', 'A support team available 24 hours, every day'],
    ] as ReadonlyArray<readonly [string, string]>,
    coreTitle: 'Core in every plan',
    core: [
      'E-contracts and e-signature', 'Instalment plans and late fees', 'Cheques and bounce handling',
      'Payments and proof of payment', 'General ledger', 'Commissions, bonuses and sales targets',
      'Chat and notifications', 'Data import and export', 'Audit log and two-step sign-in',
      'Company branding and print templates', 'Custom customer fields', 'Sales and reservations reports in PDF and Excel',
    ],
    aiTitle: 'AI assistant (optional add-on)',
    aiIntro: 'An assistant that answers questions about your company data in Arabic. Sold separately in monthly question packages, like an internet bundle:',
    aiRules: [
      'Each package has a fixed number of questions a month; when they run out the assistant pauses until renewal.',
      'You can renew early at any time; the new month starts on the renewal day with the full question count.',
      'Unused questions do not roll over, and extra questions can be added during the month.',
    ],
    aiQuestions: 'Questions per month',
    aiPackage: 'Package',
    aiPrice: 'Price per month',
    thanks: 'Thank you for your interest. We look forward to working with you.',
    authorized: 'Authorised by',
    sign: 'Signature & stamp',
    contact: 'Contact',
    features: {
      'feature.dashboard': 'Dashboard',
      'feature.crm': 'Lead management (CRM)',
      'feature.contracts': 'Contracts',
      'feature.installments': 'Instalments & payments',
      'feature.staffApp': 'Staff app',
      'feature.customerApp': 'Customer app',
      'feature.publicWebsite': 'Public website',
      'feature.brokers': 'Broker portal',
      'feature.advancedReports': 'Advanced reports',
      'feature.maintenance': 'Maintenance management',
      'feature.customDomain': 'Custom website domain',
    } as Record<string, string>,
    footer: 'Real Estate Management Platform',
  },
} as const;

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 2 });

function cur(code: string, locale: QuoteLocale): string {
  const c = normalizeCurrency(code);
  return locale === 'ar' ? arabicCurrencySymbol(c) : c;
}

function dateText(d: Date, locale: QuoteLocale): string {
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo',
  });
}

const CHECK = '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="8" fill="#C8A24B"/><path d="M4.6 8.2l2.3 2.3 4.5-4.7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS = '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="8" fill="#e2e8f0"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round"/></svg>';

function planDefaults(tier: string) {
  return (PLAN_DEFAULTS as Record<string, Record<string, unknown>>)[tier] ?? PLAN_DEFAULTS.STARTER;
}

function seatsOf(p: QuotePackage): number | null {
  if (p.maxUsers !== null && p.maxUsers !== undefined) return p.maxUsers;
  const d = planDefaults(p.planTier)['limit.maxUsers'];
  return typeof d === 'number' ? d : null;
}

function offerOf(p: QuotePackage, locale: QuoteLocale): { title: string; pct: number } | null {
  const o = p.specialOffer as { titleAr?: string; titleEn?: string; discountPct?: number; validUntil?: string } | null;
  if (!o || !o.discountPct) return null;
  if (o.validUntil && new Date(o.validUntil).getTime() < Date.now()) return null;
  return { title: (locale === 'ar' ? o.titleAr : o.titleEn) || (locale === 'ar' ? o.titleEn : o.titleAr) || '', pct: o.discountPct };
}

export function buildPricingQuotationHtml(input: QuoteInput): string {
  const { locale } = input;
  const t = T[locale];
  // CUSTOM is not a card: it is the "need more? we tailor it" panel below the plans.
  const packages = input.packages.filter((p) => p.planTier !== 'CUSTOM');
  const validUntil = new Date(input.issuedAt.getTime() + input.validDays * 86_400_000);
  const mark = logo();
  const featured = packages.some((p) => p.planTier === 'PROFESSIONAL')
    ? 'PROFESSIONAL'
    : packages[Math.floor(packages.length / 2)]?.planTier;

  const cards = packages
    .map((p) => {
      const name = locale === 'ar' ? p.nameAr : p.nameEn;
      const desc = locale === 'ar' ? p.descAr : p.descEn;
      const c = cur(p.currency, locale);
      const monthly = money(p.monthlyPrice);
      const annual = money(p.annualPrice);
      const setup = money(p.setupFee);
      const seats = seatsOf(p);
      const defaults = planDefaults(p.planTier);
      const offer = offerOf(p, locale);
      const isFeatured = p.planTier === featured;
      const bullets = FEATURES.filter((k) => defaults[k] === true)
        .map((k) => `<li>${CHECK}<span>${esc(t.features[k])}</span></li>`)
        .join('');
      const extra = (Array.isArray(p.highlights) ? (p.highlights as unknown[]) : [])
        .filter((h): h is string => typeof h === 'string' && h.trim() !== '')
        .map((h) => `<li>${CHECK}<span>${esc(h)}</span></li>`)
        .join('');
      return `<article class="plan${isFeatured ? ' featured' : ''}">
  ${isFeatured ? `<div class="ribbon">${esc(t.popular)}</div>` : ''}
  <h3>${esc(name)}</h3>
  <p class="desc">${esc(desc ?? '')}</p>
  <div class="price">${
    annual !== null
      ? `<span class="amount"><bdi dir="ltr">${fmt(annual)}</bdi></span><span class="unit">${esc(c)} / ${esc(t.perYear)}</span>`
      : monthly !== null
        ? `<span class="amount"><bdi dir="ltr">${fmt(monthly)}</bdi></span><span class="unit">${esc(c)} / ${esc(t.perMonth)}</span>`
        : `<span class="ask">${esc(t.contactUs)}</span>`
  }</div>
  <div class="annual">${t.oneTime ? esc(t.oneTime) : '&nbsp;'}</div>
  <div class="setup">${setup ? `${esc(t.setup)}: <bdi dir="ltr">${fmt(setup)}</bdi> ${esc(c)}` : esc(t.noSetup)}</div>
  ${offer ? `<div class="offer"><b>${esc(t.offer)}</b> ${esc(offer.title)} <bdi dir="ltr">−${offer.pct}%</bdi></div>` : ''}
  <div class="seats">${esc(seats === null ? t.seatsUnlimited : t.seats(seats))}</div>
  <div class="includes">${esc(t.includes)}</div>
  <ul>${bullets}${extra}</ul>
</article>`;
    })
    .join('');

  const head = packages
    .map((p) => `<th>${esc(locale === 'ar' ? p.nameAr : p.nameEn)}</th>`)
    .join('');
  const seatRow = `<tr><td>${esc(t.staffSeats)}</td>${packages
    .map((p) => {
      const s = seatsOf(p);
      return `<td class="c"><b>${s === null ? '∞' : `<bdi dir="ltr">${s}</bdi>`}</b></td>`;
    })
    .join('')}</tr>`;
  const featureRows = FEATURES.map(
    (k) =>
      `<tr><td>${esc(t.features[k])}</td>${packages
        .map((p) => `<td class="c">${planDefaults(p.planTier)[k] === true ? CHECK : CROSS}</td>`)
        .join('')}</tr>`,
  ).join('');

  const contact = [input.contact?.email, input.contact?.phone, input.contact?.website]
    .filter((x): x is string => !!x)
    .map((x) => `<bdi dir="ltr">${esc(x)}</bdi>`)
    .join(' &nbsp;·&nbsp; ');

  const ai = input.aiPackages ?? [];
  const aiHtml = ai.length
    ? `<div class="ai"><h2 class="sec-title">${esc(t.aiTitle)}</h2><p class="ai-intro">${esc(t.aiIntro)}</p>
  <table class="cmp ai-t"><thead><tr><th>${esc(t.aiPackage)}</th><th>${esc(t.aiQuestions)}</th><th>${esc(t.aiPrice)}</th></tr></thead><tbody>${ai
    .map((a) => `<tr><td>${esc(a.name)}</td><td class="c"><b><bdi dir="ltr">${a.questions.toLocaleString('en')}</bdi></b></td><td class="c"><b><bdi dir="ltr">${fmt(Number(a.price) || 0)}</bdi></b> ${esc(cur(a.currency, locale))}</td></tr>`)
    .join('')}</tbody></table>
  <ul class="ai-rules">${t.aiRules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`
    : '';

  return `<!doctype html>
<html lang="${locale}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<style>
${fontFace()}
@page { size: A4; margin: 12mm 12mm 16mm; }
:root { --navy:#0F1E33; --navy2:#1C3050; --gold:#C8A24B; --gold-d:#AE8835; --ink:#0f1e33; --muted:#64748b; --line:#e5e1d6; --paper:#fbf9f3; }
* { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body { font-family:'ReportArabic','Noto Sans Arabic','Segoe UI',Tahoma,sans-serif; color:var(--ink); font-size:11px; line-height:1.55; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.hero { background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 100%); color:#fff; border-radius:16px; padding:24px 28px 20px; position:relative; overflow:hidden; }

.hero-top { margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; gap:16px; position:relative; z-index:1; }
.brand { display:flex; align-items:center; gap:12px; }
.brand img { width:52px; height:52px; border-radius:12px; display:block; }
.brand .name { font-size:20px; font-weight:800; letter-spacing:.4px; }
.brand .sub { font-size:10.5px; color:#cbd5e1; }
.badge { font-size:26px; font-weight:800; color:var(--gold); letter-spacing:.5px; }
.gold-rule { display:none; }
.meta { display:flex; gap:0; position:relative; z-index:1; margin:0; border-top:1px solid rgba(255,255,255,.14); padding-top:12px; }
.meta div { flex:1; padding:0 14px; border-inline-start:1px solid rgba(255,255,255,.14); }
.meta div:first-child { padding-inline-start:0; border-inline-start:0; }
.meta dt { font-size:9.5px; color:var(--gold); letter-spacing:.3px; }
.meta dd { margin:2px 0 0; font-weight:700; font-size:12px; color:#fff; }
.intro { margin:20px 4px 14px; }
.intro h2 { font-size:17px; margin:0 0 4px; color:var(--navy); }
.intro p { margin:0; color:#475569; font-size:11.5px; }
.plans { display:grid; grid-template-columns:repeat(${Math.max(1, Math.min(packages.length, 3))},1fr); gap:12px; align-items:stretch; margin-top:14px; }
.plan { position:relative; border:1px solid var(--line); border-radius:14px; padding:16px 14px 14px; background:#fff; break-inside:avoid; }
.plan.featured { border:2px solid var(--gold); background:linear-gradient(180deg,#fffdf6 0%,#fff 40%); box-shadow:0 6px 18px rgba(200,162,75,.18); }
.ribbon { position:absolute; top:-10px; inset-inline-start:50%; transform:translateX(${locale === 'ar' ? '50%' : '-50%'}); background:var(--gold); color:#fff; font-size:9.5px; font-weight:700; padding:2px 12px; border-radius:999px; white-space:nowrap; }
.plan h3 { margin:0; font-size:15px; color:var(--navy); }
.plan .desc { margin:2px 0 10px; color:var(--muted); font-size:10px; min-height:28px; }
.price { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
.price .amount { font-size:26px; font-weight:800; color:var(--navy); line-height:1.1; }
.price .unit { color:var(--muted); font-size:10px; }
.price .ask { font-size:12px; font-weight:700; color:var(--gold-d); }
.annual { margin-top:3px; font-size:10px; color:#475569; min-height:15px; }
.save { background:#fbf1d4; color:var(--gold-d); border-radius:999px; padding:0 7px; font-weight:700; font-size:9px; margin-inline-start:3px; }
.setup { margin-top:2px; font-size:10px; color:var(--muted); }
.offer { margin-top:8px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; border-radius:8px; padding:4px 8px; font-size:9.5px; }
.seats { margin-top:10px; padding:6px 8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; font-weight:700; font-size:10.5px; color:var(--navy); text-align:center; }
.includes { margin-top:10px; font-size:9.5px; font-weight:700; color:var(--gold-d); text-transform:uppercase; letter-spacing:.4px; }
.plan ul { list-style:none; margin:6px 0 0; padding:0; }
.plan li { display:flex; gap:7px; align-items:flex-start; padding:3px 0; font-size:10.5px; border-top:1px dashed #eee9dc; }
.plan li:first-child { border-top:0; }
.plan li svg { flex:none; margin-top:2px; }
.custombox { margin-top:16px; border:1.5px dashed var(--gold); background:#fffdf6; border-radius:14px; padding:14px 18px; break-inside:avoid; }
.custom-t { font-weight:800; font-size:13.5px; color:var(--navy); }
.custombox p { margin:4px 0 0; color:#475569; font-size:11px; }
.custom-c { margin-top:6px; font-weight:700; color:var(--gold-d); font-size:11px; }
.seatsnote { margin:8px 4px 0; font-size:9.5px; color:var(--muted); }
.page2 { break-before:page; padding-top:6mm; }
.sec-title { font-size:15px; margin:0 0 10px; color:var(--navy); display:flex; align-items:center; gap:8px; }
.sec-title::before { content:''; width:4px; height:18px; background:var(--gold); border-radius:2px; }
table.cmp { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:11px; }
table.cmp th { background:var(--navy); color:#fff; padding:9px 12px; text-align:center; font-weight:700; }
table.cmp th:first-child { text-align:start; }
table.cmp td { padding:7px 12px; border-top:1px solid var(--line); }
table.cmp tbody tr:nth-child(even) td { background:var(--paper); }
table.cmp td.c { text-align:center; }
table.cmp td.c svg { vertical-align:middle; }
.svc { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.svc div { border:1px solid var(--line); background:var(--paper); border-radius:10px; padding:8px 12px; break-inside:avoid; }
.svc b { display:block; color:var(--navy); font-size:11.5px; } .svc span { color:var(--muted); font-size:10px; }
.sub-title { font-size:12px; margin:14px 0 6px; color:var(--gold-d); }
.chips { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; }
.chips li { display:flex; gap:7px; align-items:flex-start; font-size:10.5px; }
.chips li svg { flex:none; margin-top:2px; }
.ai { margin-top:22px; break-inside:avoid; }
.ai-intro { margin:0 0 8px; color:#475569; font-size:10.5px; }
.ai-rules { margin:8px 0 0; padding-inline-start:18px; color:#475569; font-size:10px; }
.terms { margin-top:22px; }
.terms ol { margin:0; padding-inline-start:18px; color:#334155; font-size:10.5px; }
.terms li { margin:3px 0; }
.sign { margin-top:34px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.sign div { border-top:1px solid #94a3b8; padding-top:6px; color:var(--muted); font-size:10px; }
.thanks { margin-top:26px; text-align:center; color:var(--navy); font-weight:700; font-size:12px; }
.contact { margin-top:6px; text-align:center; color:var(--muted); font-size:10px; }
</style>
</head>
<body>
<section class="hero">
  <div class="hero-top">
    <div class="brand">
      ${mark ? `<img src="${mark}" alt="">` : ''}
      <div><div class="name">Devora</div><div class="sub">${esc(t.platform)}</div></div>
    </div>
    <div class="badge">${esc(t.quote)}</div>
  </div>
  <div class="gold-rule"></div>
  <dl class="meta">
    <div><dt>${esc(t.ref)}</dt><dd><bdi dir="ltr">${esc(input.reference)}</bdi></dd></div>
    <div><dt>${esc(t.date)}</dt><dd>${esc(dateText(input.issuedAt, locale))}</dd></div>
    <div><dt>${esc(t.valid)}</dt><dd>${esc(dateText(validUntil, locale))}</dd></div>
    ${input.client?.trim() ? `<div><dt>${esc(t.preparedFor)}</dt><dd>${esc(input.client.trim())}</dd></div>` : ''}
  </dl>
</section>
<section class="intro">
  <h2>${esc(t.introTitle)}</h2>
  <p>${esc(t.intro)}</p>
</section>
<section class="plans">${cards}</section>
<p class="seatsnote">${esc(t.seatsHint)}</p>
<section class="custombox">
  <div class="custom-t">${esc(t.customTitle)}</div>
  <p>${esc(t.custom)}</p>
  ${contact ? `<div class="custom-c">${contact}</div>` : ''}
</section>

<section class="page2">
  <h2 class="sec-title">${esc(t.compareTitle)}</h2>
  <table class="cmp">
    <thead><tr><th>${esc(t.feature)}</th>${head}</tr></thead>
    <tbody>${seatRow}${featureRows}</tbody>
  </table>
  <h2 class="sec-title" style="margin-top:22px">${esc(t.included)}</h2>
  <div class="svc">${t.services.map(([h, d]) => `<div><b>${esc(h)}</b><span>${esc(d)}</span></div>`).join('')}</div>
  <h3 class="sub-title">${esc(t.coreTitle)}</h3>
  <ul class="chips">${t.core.map((x) => `<li>${CHECK}<span>${esc(x)}</span></li>`).join('')}</ul>
  ${aiHtml}
  <div class="terms">
    <h2 class="sec-title">${esc(t.termsTitle)}</h2>
    <ol>${t.terms(input.validDays).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
  </div>
  <div class="sign"><div>${esc(t.authorized)}</div><div>${esc(t.sign)}</div></div>
  <p class="thanks">${esc(t.thanks)}</p>
  ${contact ? `<p class="contact">${esc(t.contact)}: ${contact}</p>` : ''}
</section>
</body>
</html>`;
}

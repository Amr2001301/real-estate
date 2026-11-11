import type { AmenityIcon, ProjectAmenity, ProjectFaq, ProjectSection } from './project-details';

/**
 * Fills a project's page content (sections, FAQ, amenity icons) from what is
 * already recorded about it — its city and district, type, total area,
 * licence, unit types and areas, payment offers, handover dates and
 * amenities. Nothing is invented: a line with no data behind it is left
 * out, and the construction progress (which no record holds) is never
 * filled. Used once for projects made before the page content existed
 * (scripts/autofill-project-content.ts); the company edits it after.
 */

type Text = { ar: string; en: string };

export interface AutofillInput {
  name: Text;
  city: string;
  district: string | null;
  type: string | null;
  totalArea: number | null;
  licenseNumber: string | null;
  /** Every unit of the project: its type (with its names) and area. */
  units: Array<{ type: string; typeName: Text; area: number; available: boolean }>;
  phases: Array<{ name: Text; deliveryDate: Date | null }>;
  /** The public payment offers' summary (as the project page shows them). */
  plans: { minDownPaymentPercent: number | null; maxMonths: number | null; hasCash: boolean };
  amenities: ProjectAmenity[];
}

const PROJECT_TYPE: Record<string, Text> = {
  RESIDENTIAL: { ar: 'سكني', en: 'residential' },
  COASTAL: { ar: 'ساحلي', en: 'coastal' },
  ADMINISTRATIVE: { ar: 'إداري', en: 'administrative' },
  COMMERCIAL: { ar: 'تجاري', en: 'commercial' },
  MEDICAL: { ar: 'طبي', en: 'medical' },
  MIXED_USE: { ar: 'متعدد الاستخدامات', en: 'mixed-use' },
};

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const month = (d: Date): Text => ({
  ar: `${AR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  en: `${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
});
const n = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
const nameOr = (t: Text) => ({ ar: t.ar || t.en, en: t.en || t.ar });

/** "في الحي، المدينة" — the place as recorded. */
function place(p: AutofillInput): Text | null {
  if (!p.city) return null;
  return p.district ? { ar: `${p.district}، ${p.city}`, en: `${p.district}, ${p.city}` } : { ar: p.city, en: p.city };
}

/** Each unit type with its area range, most units first. */
function unitLines(p: AutofillInput, onlyAvailable: boolean): Text[] {
  const byType = new Map<string, { name: Text; areas: number[] }>();
  for (const u of p.units) {
    if (onlyAvailable && !u.available) continue;
    if (!(u.area > 0)) continue;
    const row = byType.get(u.type) ?? { name: nameOr(u.typeName), areas: [] };
    row.areas.push(u.area);
    byType.set(u.type, row);
  }
  return [...byType.values()]
    .sort((a, b) => b.areas.length - a.areas.length)
    .map(({ name, areas }) => {
      const lo = Math.min(...areas);
      const hi = Math.max(...areas);
      return lo === hi
        ? { ar: `${name.ar}: ${n(lo)} م²`, en: `${name.en}: ${n(lo)} m²` }
        : { ar: `${name.ar}: من ${n(lo)} إلى ${n(hi)} م²`, en: `${name.en}: ${n(lo)}–${n(hi)} m²` };
    });
}

function plansLine(p: AutofillInput): Text | null {
  const { minDownPaymentPercent: down, maxMonths, hasCash } = p.plans;
  const parts: Text[] = [];
  if (down !== null && maxMonths) {
    const years = maxMonths % 12 === 0 ? maxMonths / 12 : null;
    const term = years
      ? { ar: years === 1 ? 'سنة' : years === 2 ? 'سنتين' : `${years} ${years <= 10 ? 'سنوات' : 'سنة'}`, en: `${years} year${years === 1 ? '' : 's'}` }
      : { ar: `${maxMonths} شهرًا`, en: `${maxMonths} months` };
    parts.push({ ar: `مقدم يبدأ من ${down}% وتقسيط حتى ${term.ar}`, en: `Down payments from ${down}% and instalments over up to ${term.en}` });
  }
  if (hasCash) parts.push({ ar: 'ويتوفر الدفع الكاش', en: 'cash payment is also available' });
  if (parts.length === 0) return null;
  return { ar: parts.map((x) => x.ar).join('، ') + '.', en: parts.map((x) => x.en).join('; ') + '.' };
}

function handoverLine(p: AutofillInput): Text | null {
  const dated = p.phases.filter((ph) => ph.deliveryDate).sort((a, b) => a.deliveryDate!.getTime() - b.deliveryDate!.getTime());
  if (dated.length === 0) return null;
  if (dated.length === 1) {
    const m = month(dated[0]!.deliveryDate!);
    return { ar: `موعد الاستلام المحدد: ${m.ar}.`, en: `The set handover date: ${m.en}.` };
  }
  return {
    ar: dated.map((ph) => `${nameOr(ph.name).ar}: ${month(ph.deliveryDate!).ar}`).join('\n'),
    en: dated.map((ph) => `${nameOr(ph.name).en}: ${month(ph.deliveryDate!).en}`).join('\n'),
  };
}

function amenitiesLine(p: AutofillInput): Text | null {
  const names = p.amenities.map((a) => nameOr(a.name)).filter((a) => a.ar);
  if (names.length === 0) return null;
  return {
    ar: `يضم ${nameOr(p.name).ar}: ${names.map((x) => x.ar).join('، ')}.`,
    en: `${nameOr(p.name).en} offers: ${names.map((x) => x.en).join(', ')}.`,
  };
}

/** Titled sections from the recorded facts (none when there is nothing to say). */
export function autofillSections(p: AutofillInput): ProjectSection[] {
  const out: ProjectSection[] = [];
  const where = place(p);
  if (where) {
    out.push({
      title: { ar: 'الموقع', en: 'Location' },
      body: { ar: `يقع ${nameOr(p.name).ar} في ${where.ar}.`, en: `${nameOr(p.name).en} is in ${where.en}.` },
    });
  }
  const facts: Text[] = [];
  const type = p.type ? PROJECT_TYPE[p.type] : null;
  if (type) facts.push({ ar: `نوع المشروع: ${type.ar}`, en: `Project type: ${type.en}` });
  if (p.totalArea && p.totalArea > 0) facts.push({ ar: `المساحة الإجمالية: ${n(p.totalArea)} م²`, en: `Total area: ${n(p.totalArea)} m²` });
  if (p.phases.length > 1) facts.push({ ar: `عدد المراحل: ${p.phases.length}`, en: `Phases: ${p.phases.length}` });
  if (p.units.length > 0) facts.push({ ar: `عدد الوحدات: ${n(p.units.length)}`, en: `Units: ${n(p.units.length)}` });
  if (p.licenseNumber) facts.push({ ar: `رقم الترخيص: ${p.licenseNumber}`, en: `Licence no.: ${p.licenseNumber}` });
  if (facts.length > 0) {
    out.push({
      title: { ar: 'تفاصيل المشروع', en: 'Project details' },
      body: { ar: facts.map((f) => f.ar).join('\n'), en: facts.map((f) => f.en).join('\n') },
    });
  }
  const units = unitLines(p, false);
  if (units.length > 0) {
    out.push({
      title: { ar: 'الوحدات والمساحات', en: 'Units and areas' },
      body: { ar: units.map((u) => u.ar).join('\n'), en: units.map((u) => u.en).join('\n') },
    });
  }
  return out;
}

/** The ready questions, each answered from the record — or left out. */
export function autofillFaqs(p: AutofillInput): ProjectFaq[] {
  const name = nameOr(p.name);
  const out: ProjectFaq[] = [];
  const add = (q: Text, a: Text | null) => {
    if (a) out.push({ question: q, answer: a });
  };
  const where = place(p);
  add({ ar: `أين يقع ${name.ar}؟`, en: `Where is ${name.en}?` }, where && { ar: `في ${where.ar}.`, en: `In ${where.en}.` });
  const available = unitLines(p, true);
  add(
    { ar: `ما أنواع الوحدات المتاحة في ${name.ar}؟`, en: `What units are available in ${name.en}?` },
    available.length ? { ar: available.map((u) => u.ar).join('\n'), en: available.map((u) => u.en).join('\n') } : null,
  );
  add({ ar: `ما أنظمة السداد المتاحة في ${name.ar}؟`, en: `What payment plans does ${name.en} offer?` }, plansLine(p));
  add({ ar: `متى موعد الاستلام في ${name.ar}؟`, en: `When is the handover in ${name.en}?` }, handoverLine(p));
  add({ ar: `ما الذي يميز ${name.ar}؟`, en: `What makes ${name.en} stand out?` }, amenitiesLine(p));
  return out;
}

/** Keywords (Arabic and English) → icon, for amenities saved as a plain tick. */
const ICON_WORDS: Array<[AmenityIcon, RegExp]> = [
  ['pool', /سباح|بيسين|pool/i],
  ['gym', /جيم|رياضي|صحي|gym|fitness/i],
  ['spa', /سبا\b|spa/i],
  ['garden', /حديق|حدائق|garden/i],
  ['parking', /مواقف|جراج|جراچ|باركينج|انتظار|parking|garage/i],
  ['park', /بارك|\bpark\b/i],
  ['tree', /أشجار|مساحات خضراء|مسطحات|green/i],
  ['playground', /ألعاب|العاب|playground/i],
  ['kids', /أطفال|اطفال|kids|children/i],
  ['cctv', /كاميرا|مراقبة|cctv|camera/i],
  ['security', /أمن|حراس|حراسة|security|guard/i],
  ['elevator', /مصاعد|أسانسير|اسانسير|elevator|lift/i],
  ['clubhouse', /نادي|كلوب|club/i],
  ['mall', /مول|mall/i],
  ['shop', /محلات|تجاري|سوق|shop|retail|market/i],
  ['restaurant', /مطعم|مطاعم|restaurant/i],
  ['cafe', /كافيه|مقهى|كافيتريا|cafe|coffee/i],
  ['mosque', /مسجد|جامع|mosque/i],
  ['church', /كنيسة|church/i],
  ['university', /جامعة|university/i],
  ['school', /مدرسة|مدارس|حضانة|school|nursery/i],
  ['hospital', /مستشفى|hospital/i],
  ['clinic', /عيادة|عيادات|طبي|clinic|medical/i],
  ['pharmacy', /صيدلية|pharmacy/i],
  ['bank', /بنك|ATM|صراف|bank/i],
  ['sea', /بحر|شاطئ|شاطيء|beach|sea/i],
  ['lake', /بحيرة|بحيرات|lake|lagoon/i],
  ['view', /إطلالة|اطلالة|فيو|view/i],
  ['jogging', /جري|ممشى|مشي|jogging|walk/i],
  ['bike', /دراج|bike|cycl/i],
  ['tennis', /تنس|tennis|squash|اسكواش/i],
  ['sports', /جولف|golf|رياضات|sports/i],
  ['football', /كرة|ملاعب|ملعب|football|soccer/i],
  ['wifi', /إنترنت|انترنت|wi-?fi|internet/i],
  ['solar', /شمسي|solar/i],
  ['smart-home', /ذكي|smart/i],
  ['generator', /مولد|كهرباء احتياطي|generator/i],
  ['hotel', /فندق|hotel/i],
  ['office', /مكاتب|إداري|اداري|office/i],
  ['metro', /مترو|محطة|metro|station/i],
  ['road', /طريق|محور|road|highway/i],
  ['airport', /مطار|airport/i],
];

export function iconFor(name: Text): AmenityIcon | null {
  const text = `${name.ar} ${name.en}`;
  return ICON_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** The amenities with a plain tick get the icon their name suggests; others stay. */
export function autofillAmenityIcons(amenities: ProjectAmenity[]): ProjectAmenity[] {
  return amenities.map((a) => (a.icon === 'check' ? { ...a, icon: iconFor(a.name) ?? 'check' } : a));
}

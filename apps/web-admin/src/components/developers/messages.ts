import type { Locale } from '@/lib/locale';
import type { ListingKind, ListingStatus } from '@/components/listings/messages';

export type PlanFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
export type MatchReason = 'budget' | 'budgetNear' | 'city' | 'unitType' | 'bedrooms' | 'area';

/* BRK-5 — the developer directory, plan comparison, matching and distribution. Strings only. */
const ar = {
  list: {
    eyebrow: 'شركاء البيع الأولي',
    title: 'المطوّرون',
    desc: 'المطوّرون اللي بتبيع لهم: بيانات التواصل، العمولة المتفق عليها، مشاريعهم وخطط السداد.',
    add: 'إضافة مطوّر',
    compare: 'مقارنة الخطط',
    searchLabel: 'بحث',
    apply: 'عرض',
    search: 'ابحث باسم المطوّر أو المشروع…',
    kpiDevelopers: 'مطوّرون',
    kpiProjects: 'مشاريع',
    kpiPlans: 'خطط سداد',
    kpiListings: 'وحدات معروضة',
    empty: 'لا مطوّرين بعد',
    emptyHint: 'أضف أول مطوّر تبيع له، ثم مشاريعه وخطط السداد.',
    projects: (n: number) => (n === 1 ? 'مشروع واحد' : `${n} مشاريع`),
    plans: (n: number) => `${n} خطط`,
    commission: 'العمولة',
    inactive: 'موقوف',
  },
  form: {
    newTitle: 'مطوّر جديد',
    name: 'اسم المطوّر',
    contactName: 'مسؤول التواصل',
    phone: 'الهاتف',
    email: 'البريد',
    website: 'الموقع',
    commission: 'العمولة المتفق عليها %',
    commissionHint: 'تُقترح تلقائيًا في الصفقات، ويمكن تحديد نسبة لكل مشروع.',
    notes: 'ملاحظات',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل البيانات',
    deactivate: 'إيقاف',
    activate: 'تفعيل',
    remove: 'حذف',
  },
  detail: {
    contact: 'التواصل',
    projects: 'المشاريع',
    projectsSub: 'كل مشروع بخطط السداد التي يقدّمها والوحدات المعروضة منه.',
    addProject: 'إضافة مشروع',
    projectName: 'اسم المشروع',
    city: 'المدينة',
    district: 'المنطقة',
    projectCommission: 'عمولة المشروع %',
    delivery: 'موعد الاستلام',
    noProjects: 'لا مشاريع بعد',
    plans: 'خطط السداد',
    addPlan: 'إضافة خطة',
    noPlans: 'لا خطط بعد',
    planName: 'اسم الخطة',
    downPayment: 'المقدّم %',
    years: 'سنوات التقسيط',
    yearsHint: '0 = كاش',
    frequency: 'الدفع كل',
    deliveryPct: 'دفعة الاستلام %',
    cashDiscount: 'خصم الكاش %',
    listings: 'الوحدات المعروضة',
    noListings: 'لا وحدات معروضة من هذا المشروع',
    commissionFrom: (pct: number) => `عمولة ${pct}%`,
    defaultCommission: 'من المطوّر',
    planLine: (down: number, years: number, freq: string, delivery: number) =>
      years === 0 ? 'كاش' : `${down}% مقدّم · ${years} سنين ${freq}${delivery ? ` · ${delivery}% عند الاستلام` : ''}`,
    cashLine: (discount: number) => (discount ? `كاش بخصم ${discount}%` : 'كاش'),
  },
  frequency: { MONTHLY: 'شهريًا', QUARTERLY: 'كل 3 شهور', SEMI_ANNUAL: 'كل 6 شهور', ANNUAL: 'سنويًا' } satisfies Record<PlanFrequency, string>,
  frequencyShort: { MONTHLY: 'شهري', QUARTERLY: 'ربع سنوي', SEMI_ANNUAL: 'نصف سنوي', ANNUAL: 'سنوي' } satisfies Record<PlanFrequency, string>,
  compare: {
    title: 'مقارنة خطط السداد',
    desc: 'اختار سعر الوحدة وحتى 4 خطط من مطوّرين مختلفين، وشوف المقدّم والقسط والإجمالي جنب بعض.',
    price: 'سعر الوحدة',
    plans: 'الخطط',
    pick: 'اختار الخطط (حتى 4)',
    show: 'قارن',
    print: 'طباعة للعميل',
    empty: 'اختار سعرًا وخطة واحدة على الأقل',
    noPlans: 'لا خطط في الدليل بعد — أضفها من صفحة المطوّر.',
    total: 'الإجمالي',
    downPayment: 'المقدّم',
    installment: 'القسط',
    installments: (n: number) => `${n} قسط`,
    monthly: 'ما يعادل شهريًا',
    delivery: 'عند الاستلام',
    cash: 'كاش',
    saving: (v: string) => `توفّر ${v}`,
    lowestMonthly: 'أقل قسط شهري',
    lowestDown: 'أقل مقدّم',
    handover: 'الاستلام',
  },
  match: {
    title: 'ما يبحث عنه العميل',
    sub: 'نطابقها مع الوحدات المعروضة تلقائيًا.',
    edit: 'تعديل',
    set: 'تحديد الطلبات',
    none: 'لم تُحدَّد طلبات العميل بعد',
    kinds: 'نوع الطلب',
    budget: 'الميزانية',
    budgetMin: 'من',
    budgetMax: 'إلى',
    cities: 'المناطق',
    citiesHint: 'افصل بينها بفاصلة',
    unitTypes: 'نوع الوحدة',
    bedrooms: 'أقل عدد غرف',
    area: 'أقل مساحة م²',
    notes: 'ملاحظات',
    save: 'حفظ',
    cancel: 'إلغاء',
    matches: 'وحدات مناسبة',
    matchesSub: 'الأنسب أولًا.',
    noMatches: 'لا وحدات مناسبة الآن — سنبلغك عند إضافة وحدة تناسبه.',
    score: (n: number) => `تطابق ${n}%`,
    reasons: {
      budget: 'في الميزانية',
      budgetNear: 'قريبة من الميزانية',
      city: 'المنطقة',
      unitType: 'نوع الوحدة',
      bedrooms: 'عدد الغرف',
      area: 'المساحة',
    } satisfies Record<MatchReason, string>,
    rooms: (n: number) => `${n} غرف`,
    sqm: (n: number) => `${n} م²`,
    leadsTitle: 'عملاء مناسبون',
    leadsSub: 'عملاؤك المفتوحون الذين تناسبهم هذه الوحدة.',
    noLeads: 'لا عملاء مناسبين بين عملائك',
    any: 'أي',
  },
  distribute: {
    title: 'توزيع العملاء',
    desc: 'وزّع العملاء غير المسندين على الفريق مرة واحدة — كل عميل يذهب لمن لديه أقل عدد من العملاء المفتوحين.',
    button: 'توزيع العملاء',
    unassigned: 'عملاء بلا مندوب',
    pick: 'وزّع على',
    team: 'الفريق المتاح',
    openLeads: (n: number) => `${n} عميل مفتوح`,
    submit: (n: number) => `وزّع ${n} عميل`,
    nothing: 'لا عملاء بلا مندوب الآن',
    done: (n: number) => `تم توزيع ${n} عميل`,
    pickOne: 'اختار موظفًا واحدًا على الأقل',
    got: (n: number) => `+${n}`,
  },
};

const en: typeof ar = {
  list: {
    eyebrow: 'Primary-sale partners',
    title: 'Developers',
    desc: 'The developers you sell for: contacts, agreed commission, their projects and payment plans.',
    add: 'Add developer',
    compare: 'Compare plans',
    searchLabel: 'Search',
    apply: 'Show',
    search: 'Search developer or project…',
    kpiDevelopers: 'Developers',
    kpiProjects: 'Projects',
    kpiPlans: 'Payment plans',
    kpiListings: 'Listings',
    empty: 'No developers yet',
    emptyHint: 'Add the first developer you sell for, then their projects and plans.',
    projects: (n: number) => (n === 1 ? '1 project' : `${n} projects`),
    plans: (n: number) => `${n} plans`,
    commission: 'Commission',
    inactive: 'Inactive',
  },
  form: {
    newTitle: 'New developer',
    name: 'Developer name',
    contactName: 'Contact person',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    commission: 'Agreed commission %',
    commissionHint: 'Suggested on deals; a project can have its own rate.',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit details',
    deactivate: 'Deactivate',
    activate: 'Activate',
    remove: 'Delete',
  },
  detail: {
    contact: 'Contact',
    projects: 'Projects',
    projectsSub: 'Each project with its payment plans and the listings from it.',
    addProject: 'Add project',
    projectName: 'Project name',
    city: 'City',
    district: 'District',
    projectCommission: 'Project commission %',
    delivery: 'Handover',
    noProjects: 'No projects yet',
    plans: 'Payment plans',
    addPlan: 'Add plan',
    noPlans: 'No plans yet',
    planName: 'Plan name',
    downPayment: 'Down payment %',
    years: 'Years',
    yearsHint: '0 = cash',
    frequency: 'Paid',
    deliveryPct: 'At handover %',
    cashDiscount: 'Cash discount %',
    listings: 'Listings',
    noListings: 'No listings from this project',
    commissionFrom: (pct: number) => `${pct}% commission`,
    defaultCommission: 'from developer',
    planLine: (down: number, years: number, freq: string, delivery: number) =>
      years === 0 ? 'Cash' : `${down}% down · ${years} years ${freq}${delivery ? ` · ${delivery}% at handover` : ''}`,
    cashLine: (discount: number) => (discount ? `Cash, ${discount}% off` : 'Cash'),
  },
  frequency: { MONTHLY: 'monthly', QUARTERLY: 'quarterly', SEMI_ANNUAL: 'every 6 months', ANNUAL: 'yearly' },
  frequencyShort: { MONTHLY: 'monthly', QUARTERLY: 'quarterly', SEMI_ANNUAL: 'semi-annual', ANNUAL: 'annual' },
  compare: {
    title: 'Compare payment plans',
    desc: 'Pick the unit price and up to 4 plans from different developers to see down payment, instalment and total side by side.',
    price: 'Unit price',
    plans: 'Plans',
    pick: 'Pick plans (up to 4)',
    show: 'Compare',
    print: 'Print for the client',
    empty: 'Pick a price and at least one plan',
    noPlans: 'No plans in the directory yet — add them on a developer’s page.',
    total: 'Total',
    downPayment: 'Down payment',
    installment: 'Instalment',
    installments: (n: number) => `${n} instalments`,
    monthly: 'Per month',
    delivery: 'At handover',
    cash: 'Cash',
    saving: (v: string) => `Saves ${v}`,
    lowestMonthly: 'Lowest monthly',
    lowestDown: 'Lowest down payment',
    handover: 'Handover',
  },
  match: {
    title: 'What the client is looking for',
    sub: 'Matched against the listings automatically.',
    edit: 'Edit',
    set: 'Set requirements',
    none: 'No requirements recorded yet',
    kinds: 'Looking to',
    budget: 'Budget',
    budgetMin: 'From',
    budgetMax: 'To',
    cities: 'Areas',
    citiesHint: 'Separate with commas',
    unitTypes: 'Unit type',
    bedrooms: 'Min bedrooms',
    area: 'Min area m²',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    matches: 'Matching listings',
    matchesSub: 'Best first.',
    noMatches: 'Nothing fits yet — you’ll be told when a fitting listing is added.',
    score: (n: number) => `${n}% match`,
    reasons: { budget: 'In budget', budgetNear: 'Near budget', city: 'Area', unitType: 'Unit type', bedrooms: 'Bedrooms', area: 'Area size' },
    rooms: (n: number) => `${n} bd`,
    sqm: (n: number) => `${n} m²`,
    leadsTitle: 'Matching leads',
    leadsSub: 'Your open leads this listing fits.',
    noLeads: 'None of your leads fit',
    any: 'Any',
  },
  distribute: {
    title: 'Distribute leads',
    desc: 'Hand the unassigned leads to the team in one go — each goes to whoever holds the fewest open leads.',
    button: 'Distribute leads',
    unassigned: 'Unassigned leads',
    pick: 'Distribute to',
    team: 'Available team',
    openLeads: (n: number) => `${n} open leads`,
    submit: (n: number) => `Distribute ${n} leads`,
    nothing: 'No unassigned leads right now',
    done: (n: number) => `${n} leads distributed`,
    pickOne: 'Pick at least one person',
    got: (n: number) => `+${n}`,
  },
};

export function developersT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export const PLAN_FREQUENCIES: PlanFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];

export interface DeveloperPlan {
  id: string;
  name: string;
  downPaymentPct: string;
  years: number;
  frequency: PlanFrequency;
  deliveryPct: string;
  cashDiscountPct: string;
  notes: string | null;
  active: boolean;
}

export interface DeveloperProject {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  commissionPct: string | null;
  deliveryDate: string | null;
  notes: string | null;
  active: boolean;
  _count?: { plans: number; listings: number };
  plans?: DeveloperPlan[];
  listings?: Array<{ id: string; code: string; title: string; price: string; status: ListingStatus }>;
}

export interface Developer {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCommissionPct: string | null;
  notes: string | null;
  active: boolean;
  projects: DeveloperProject[];
}

export interface PlanOption extends DeveloperPlan {
  project: { id: string; name: string; developer: { id: string; name: string } };
}

export interface ComparedPlan {
  id: string;
  name: string;
  project: { id: string; name: string; deliveryDate: string | null; developer: { id: string; name: string } };
  terms: { downPaymentPct: number; years: number; frequency: PlanFrequency; deliveryPct: number; cashDiscountPct: number };
  breakdown: { total: number; downPayment: number; deliveryPayment: number; installments: number; installment: number; monthly: number; cash: boolean };
}

export interface LeadRequirement {
  kinds: ListingKind[];
  budgetMin: string | null;
  budgetMax: string | null;
  cities: string[];
  unitTypes: string[];
  bedroomsMin: number | null;
  areaMin: number | null;
  notes: string | null;
}

export interface ListingMatch {
  id: string;
  code: string;
  title: string;
  kind: ListingKind;
  status: ListingStatus;
  price: string;
  city: string;
  district: string | null;
  bedrooms: number | null;
  area: number;
  photos: string[];
  score: number;
  reasons: MatchReason[];
}

export interface LeadMatch {
  id: string;
  fullName: string;
  phone: string;
  stage: string;
  assignedSales: { id: string; fullName: string } | null;
  score: number;
  reasons: MatchReason[];
}

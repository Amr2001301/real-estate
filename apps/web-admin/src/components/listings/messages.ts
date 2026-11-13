import type { Locale } from '@/lib/locale';

export type ListingKind = 'PRIMARY' | 'RESALE' | 'RENT';
export type ListingStatus = 'AVAILABLE' | 'UNDER_OFFER' | 'CLOSED' | 'WITHDRAWN';

/* BRK-2 «الوحدات المعروضة» — a brokerage's listings. Strings only. */
const ar = {
  kind: { PRIMARY: 'بيع أولي', RESALE: 'إعادة بيع', RENT: 'إيجار' } satisfies Record<ListingKind, string>,
  kindHint: {
    PRIMARY: 'وحدة من مطوّر تبيعها لحسابه',
    RESALE: 'عقار مالك يبيعه من خلالك',
    RENT: 'عقار مالك يؤجّره من خلالك',
  } satisfies Record<ListingKind, string>,
  status: { AVAILABLE: 'متاحة', UNDER_OFFER: 'قيد التفاوض', CLOSED: 'أُغلقت', WITHDRAWN: 'مسحوبة' } satisfies Record<ListingStatus, string>,
  /** What «أُغلقت» means for each kind. */
  closed: { PRIMARY: 'تم البيع', RESALE: 'تم البيع', RENT: 'تم التأجير' } satisfies Record<ListingKind, string>,
  list: {
    eyebrow: 'المعروض',
    title: 'الوحدات المعروضة',
    desc: 'كل ما تسوّقه الشركة: وحدات المطوّرين، وإعادة البيع، والإيجار — في مكان واحد.',
    add: 'إضافة وحدة',
    all: 'الكل',
    kpiTotal: 'كل الوحدات',
    kpiAvailable: 'متاحة الآن',
    kpiAvailableSub: (n: number) => (n > 0 ? `${n} قيد التفاوض` : 'لا شيء قيد التفاوض'),
    search: 'بحث',
    searchPlaceholder: 'كود، عنوان، مدينة، كمبوند، مطوّر…',
    statusFilter: 'الحالة',
    anyStatus: 'كل الحالات',
    apply: 'عرض',
    clear: 'مسح',
    results: (n: number) => (n === 1 ? 'وحدة واحدة' : `${n} وحدة`),
    empty: 'لا توجد وحدات معروضة بعد',
    emptyHint: 'أضف أول وحدة: وحدة مطوّر تبيعها، أو عقار مالك للبيع أو للإيجار.',
    noMatch: 'لا توجد وحدات بهذه الشروط',
    perMonth: 'شهريًا',
    noPhoto: 'لا صور بعد',
  },
  card: { area: 'م²', beds: 'غرف', baths: 'حمام', floor: 'الدور', agent: 'المسؤول' },
  form: {
    newTitle: 'إضافة وحدة',
    editTitle: 'تعديل الوحدة',
    desc: 'بيانات الوحدة كما يراها فريقك وعملاؤك. بيانات المالك لا تظهر إلا للفريق.',
    kind: 'نوع العرض',
    kindLocked: 'نوع العرض لا يتغيّر بعد الحفظ.',
    basics: 'الوحدة',
    title: 'عنوان الإعلان',
    titlePlaceholder: 'مثال: شقة 3 غرف بإطلالة على الحديقة',
    panelUnit: 'عنوان الإعلان، نوع الوحدة، والموظف المسؤول عنها.',
    panelLocation: 'أين تقع الوحدة، ومن المطوّر والمشروع إن وُجدا.',
    panelSpecs: 'المساحة والغرف والتشطيب وموعد الاستلام.',
    panelPriceSale: 'السعر المطلوب، والمقدم إن كان البيع بالتقسيط.',
    panelPriceRent: 'الإيجار الشهري المطلوب.',
    unitType: 'نوع الوحدة',
    pickType: 'اختر النوع',
    location: 'الموقع',
    city: 'المدينة',
    district: 'الحي / المنطقة',
    compound: 'الكمبوند',
    address: 'العنوان التفصيلي',
    developer: 'المطوّر',
    project: 'المشروع',
    developerRequired: 'مطلوب لوحدة البيع الأولي',
    specs: 'المواصفات',
    area: 'المساحة (م²)',
    bedrooms: 'غرف النوم',
    bathrooms: 'الحمامات',
    floor: 'الدور',
    finishing: 'التشطيب',
    view: 'الإطلالة',
    none: '—',
    delivery: 'موعد الاستلام / الإتاحة',
    pricing: 'السعر',
    price: 'السعر المطلوب',
    rent: 'الإيجار الشهري',
    downPayment: 'المقدم',
    downPaymentHint: 'إن كان البيع بالتقسيط',
    owner: 'المالك',
    ownerHint: 'لا يظهر إلا لفريقك.',
    ownerName: 'اسم المالك',
    ownerPhone: 'هاتف المالك',
    photos: 'الصور',
    photosHint: 'حتى 20 صورة — الأولى هي صورة الغلاف.',
    addPhoto: 'إضافة صور',
    uploading: 'جارٍ الرفع…',
    removePhoto: 'حذف الصورة',
    cover: 'الغلاف',
    makeCover: 'اجعلها الغلاف',
    team: 'الفريق',
    agent: 'الموظف المسؤول',
    noAgent: 'بدون',
    description: 'الوصف',
    descriptionPlaceholder: 'ما يميّز الوحدة، الخدمات القريبة، شروط خاصة…',
    save: 'حفظ الوحدة',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    photoError: 'تعذّر رفع الصورة',
  },
  detail: {
    edit: 'تعديل',
    setStatus: 'تغيير الحالة',
    delete: 'حذف',
    deleteConfirm: 'حذف هذه الوحدة نهائيًا؟',
    facts: 'البيانات',
    location: 'الموقع',
    owner: 'المالك',
    noOwner: 'لم تُسجّل بيانات المالك',
    agent: 'المسؤول',
    noAgent: 'لم يُحدَّد',
    description: 'الوصف',
    added: 'أُضيفت',
    pricePerMeter: 'سعر المتر',
    call: 'اتصال',
    whatsapp: 'واتساب',
  },
};

const en: typeof ar = {
  kind: { PRIMARY: 'Primary', RESALE: 'Resale', RENT: 'Rent' },
  kindHint: {
    PRIMARY: "A developer's unit you sell for them",
    RESALE: "An owner's property for sale through you",
    RENT: "An owner's property for rent through you",
  },
  status: { AVAILABLE: 'Available', UNDER_OFFER: 'Under offer', CLOSED: 'Closed', WITHDRAWN: 'Withdrawn' },
  closed: { PRIMARY: 'Sold', RESALE: 'Sold', RENT: 'Rented' },
  list: {
    eyebrow: 'Inventory',
    title: 'Listings',
    desc: 'Everything the company markets: developer units, resale and rent — in one place.',
    add: 'Add listing',
    all: 'All',
    kpiTotal: 'All listings',
    kpiAvailable: 'Available now',
    kpiAvailableSub: (n: number) => (n > 0 ? `${n} under offer` : 'None under offer'),
    search: 'Search',
    searchPlaceholder: 'Code, title, city, compound, developer…',
    statusFilter: 'Status',
    anyStatus: 'Any status',
    apply: 'Show',
    clear: 'Clear',
    results: (n: number) => (n === 1 ? '1 listing' : `${n} listings`),
    empty: 'No listings yet',
    emptyHint: "Add your first listing: a developer's unit, or an owner's property for sale or rent.",
    noMatch: 'No listings match these filters',
    perMonth: 'per month',
    noPhoto: 'No photos yet',
  },
  card: { area: 'm²', beds: 'beds', baths: 'baths', floor: 'Floor', agent: 'Agent' },
  form: {
    newTitle: 'Add listing',
    editTitle: 'Edit listing',
    desc: "The listing as your team and customers see it. The owner's details are for your team only.",
    kind: 'Offer type',
    kindLocked: 'The offer type does not change after saving.',
    basics: 'The unit',
    title: 'Listing title',
    titlePlaceholder: 'e.g. 3-bedroom apartment overlooking the garden',
    panelUnit: 'The listing title, the unit type and the agent in charge.',
    panelLocation: 'Where the unit is, and its developer and project if any.',
    panelSpecs: 'Area, rooms, finishing and handover.',
    panelPriceSale: 'The asking price, and the down payment for a sale on instalments.',
    panelPriceRent: 'The monthly rent asked.',
    unitType: 'Unit type',
    pickType: 'Pick a type',
    location: 'Location',
    city: 'City',
    district: 'District',
    compound: 'Compound',
    address: 'Street address',
    developer: 'Developer',
    project: 'Project',
    developerRequired: 'Required for a primary sale',
    specs: 'Specs',
    area: 'Area (m²)',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    floor: 'Floor',
    finishing: 'Finishing',
    view: 'View',
    none: '—',
    delivery: 'Handover / available from',
    pricing: 'Price',
    price: 'Asking price',
    rent: 'Monthly rent',
    downPayment: 'Down payment',
    downPaymentHint: 'For a sale on instalments',
    owner: 'Owner',
    ownerHint: 'Visible to your team only.',
    ownerName: "Owner's name",
    ownerPhone: "Owner's phone",
    photos: 'Photos',
    photosHint: 'Up to 20 photos — the first is the cover.',
    addPhoto: 'Add photos',
    uploading: 'Uploading…',
    removePhoto: 'Remove photo',
    cover: 'Cover',
    makeCover: 'Make cover',
    team: 'Team',
    agent: 'Agent in charge',
    noAgent: 'None',
    description: 'Description',
    descriptionPlaceholder: 'What sets it apart, nearby services, special terms…',
    save: 'Save listing',
    saving: 'Saving…',
    cancel: 'Cancel',
    photoError: 'The photo could not be uploaded',
  },
  detail: {
    edit: 'Edit',
    setStatus: 'Change status',
    delete: 'Delete',
    deleteConfirm: 'Delete this listing for good?',
    facts: 'Details',
    location: 'Location',
    owner: 'Owner',
    noOwner: 'No owner details recorded',
    agent: 'Agent',
    noAgent: 'Not assigned',
    description: 'Description',
    added: 'Added',
    pricePerMeter: 'Price per m²',
    call: 'Call',
    whatsapp: 'WhatsApp',
  },
};

export function listingsT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export interface Listing {
  id: string;
  code: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  unitType: string;
  usage: string;
  city: string;
  district: string | null;
  compound: string | null;
  address: string | null;
  developerName: string | null;
  projectName: string | null;
  area: number;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  finishing: string | null;
  view: string | null;
  price: string;
  downPayment: string | null;
  deliveryDate: string | null;
  description: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  photos: string[];
  agentId: string | null;
  agent: { id: string; fullName: string; phone: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export const LISTING_KINDS: ListingKind[] = ['PRIMARY', 'RESALE', 'RENT'];
export const LISTING_STATUSES: ListingStatus[] = ['AVAILABLE', 'UNDER_OFFER', 'CLOSED', 'WITHDRAWN'];

import type { Locale } from '@/lib/locale';

/** Page titles and descriptions (the browser tab and search results). No platform brand: each company's name comes from the root layout. */
type Entry = { title?: string; description: string };

const META = {
  ar: {
    home: { description: 'فن العيش الراقي يبدأ من اختيارك الصحيح — اكتشف مشاريع ووحدات عقارية فاخرة مختارة بعناية لتناسب أسلوب حياتك واستثمارك.' },
    projects: { title: 'المشاريع العقارية', description: 'استكشف مجموعة منتقاة من المشاريع السكنية والتجارية الفاخرة المصممة لأسلوب حياة أرقى — مواقع مميزة وتصاميم استثنائية.' },
    units: { title: 'الوحدات المتاحة', description: 'تصفّح مجموعة مختارة من الشقق والفيلات الفاخرة المتاحة — مواصفات راقية وأسعار شفافة وإمكانية المقارنة بين الوحدات.' },
    compare: { title: 'مقارنة الوحدات', description: 'قارن بين الوحدات المختارة جنبًا إلى جنب — السعر والمساحة والغرف والمزيد في مكان واحد.' },
    contact: { title: 'تواصل معنا', description: 'تواصل مع فريقنا لطلب المعلومات أو حجز زيارة — نحن هنا لمساعدتك في اختيار المشروع أو الوحدة الأنسب لاحتياجك.' },
    articles: { title: 'المقالات', description: 'اقرأ أحدث المقالات والمعلومات العقارية.' },
    app: { title: 'التجربة الرقمية', description: 'ابدأ رحلتك العقارية — تجربة رقمية واضحة وسريعة من البحث حتى القرار.' },
    login: { title: 'تسجيل الدخول', description: 'سجّل دخولك إلى حسابك لمتابعة طلباتك وزياراتك ووحداتك المفضلة.' },
    register: { title: 'إنشاء حساب', description: 'أنشئ حسابك للوصول إلى العروض، طلبات الزيارة، ومتابعة اختياراتك.' },
    forgotPassword: { title: 'نسيت كلمة المرور', description: 'أدخل بريدك الإلكتروني وسنرسل إليك رابط إعادة تعيين كلمة المرور.' },
    resetPassword: { title: 'إعادة تعيين كلمة المرور', description: 'أدخل كلمة المرور الجديدة لإتمام إعادة التعيين.' },
    verifyEmail: { title: 'تأكيد البريد الإلكتروني', description: 'تأكيد بريدك الإلكتروني.' },
    privacy: { title: 'سياسة الخصوصية', description: 'سياسة الخصوصية.' },
    terms: { title: 'الشروط والأحكام', description: 'الشروط والأحكام لاستخدام الموقع.' },
    notFound: { title: 'الصفحة غير موجودة', description: '' },
    account: { title: 'لوحة الحساب', description: 'منطقة العميل.' },
    contracts: { title: 'العقود', description: 'عقودك.' },
    deposits: { title: 'الدفعات', description: 'سجل دفعاتك.' },
    installments: { title: 'الأقساط', description: 'جدول أقساط عقودك.' },
    maintenanceDetail: { title: 'تفاصيل طلب الصيانة', description: 'تفاصيل طلب الصيانة.' },
    maintenanceNew: { title: 'طلب صيانة جديد', description: 'إنشاء طلب صيانة جديد.' },
    maintenance: { title: 'الصيانة', description: 'طلبات الصيانة الخاصة بك.' },
    property: { title: 'عقاراتي', description: 'الوحدات التي تملكها.' },
    documents: { title: 'مستنداتي', description: 'جميع مستنداتك وملفاتك.' },
    favorites: { title: 'المفضلة', description: 'وحداتك ومشاريعك المحفوظة.' },
    notifications: { title: 'الإشعارات', description: 'إشعاراتك.' },
    profile: { title: 'الملف الشخصي', description: 'إدارة بياناتك.' },
    requests: { title: 'الطلبات', description: 'استفساراتك وطلبات المعلومات.' },
    reservations: { title: 'الحجوزات', description: 'حجوزاتك.' },
    visits: { title: 'الزيارات', description: 'طلبات الزيارة الخاصة بك.' },
  },
  en: {
    home: { description: 'Refined living starts with the right choice — discover luxury projects and units, carefully selected for your lifestyle and your investment.' },
    projects: { title: 'Real-estate projects', description: 'Explore a curated selection of residential and commercial projects designed for a finer way of living — prime locations and exceptional designs.' },
    units: { title: 'Available units', description: 'Browse a selection of available apartments and villas — refined specifications, transparent prices and side-by-side comparison.' },
    compare: { title: 'Compare units', description: 'Compare the units you chose side by side — price, area, rooms and more in one place.' },
    contact: { title: 'Contact us', description: 'Contact our team to request information or book a visit — we are here to help you choose the project or unit that suits you.' },
    articles: { title: 'Articles', description: 'Read the latest articles and real-estate insights.' },
    app: { title: 'The digital experience', description: 'Start your real-estate journey — a clear, fast digital experience from search to decision.' },
    login: { title: 'Sign in', description: 'Sign in to follow your requests, visits and favourite units.' },
    register: { title: 'Create an account', description: 'Create your account to see offers, request visits and keep track of your choices.' },
    forgotPassword: { title: 'Forgot your password', description: 'Enter your email and we will send you a link to reset your password.' },
    resetPassword: { title: 'Reset your password', description: 'Enter the new password to finish the reset.' },
    verifyEmail: { title: 'Confirm your email', description: 'Confirm your email address.' },
    privacy: { title: 'Privacy policy', description: 'The privacy policy.' },
    terms: { title: 'Terms and conditions', description: 'The terms and conditions of using the site.' },
    notFound: { title: 'Page not found', description: '' },
    account: { title: 'Account dashboard', description: 'The customer area.' },
    contracts: { title: 'Contracts', description: 'Your contracts.' },
    deposits: { title: 'Payments', description: 'Your payment history.' },
    installments: { title: 'Instalments', description: 'The instalment schedule of your contracts.' },
    maintenanceDetail: { title: 'Maintenance request details', description: 'The details of the maintenance request.' },
    maintenanceNew: { title: 'New maintenance request', description: 'Create a new maintenance request.' },
    maintenance: { title: 'Maintenance', description: 'Your maintenance requests.' },
    property: { title: 'My properties', description: 'The units you own.' },
    documents: { title: 'My documents', description: 'All your documents and files.' },
    favorites: { title: 'Favourites', description: 'Your saved units and projects.' },
    notifications: { title: 'Notifications', description: 'Your notifications.' },
    profile: { title: 'Profile', description: 'Manage your details.' },
    requests: { title: 'Requests', description: 'Your inquiries and information requests.' },
    reservations: { title: 'Reservations', description: 'Your reservations.' },
    visits: { title: 'Visits', description: 'Your visit requests.' },
  },
} as const;

export type MetaKey = keyof (typeof META)['ar'];

export function metaEntry(key: MetaKey, locale: Locale): Entry {
  return META[locale][key];
}

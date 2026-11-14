import type { Locale } from '@/lib/locale';
import type { ListingKind, ListingStatus } from '@/components/listings/messages';

export type DealStatus = 'CLOSED' | 'CANCELLED';
export type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'PARTIALLY_PAID' | 'PAID' | 'REJECTED';
export type SplitRole = 'AGENT' | 'MANAGER';

/* BRK-3 «الصفقات والعمولات» — a brokerage's deals and its money. Strings only. */
const ar = {
  tabs: { deals: 'الصفقات', claims: 'مطالبات المطوّرين', payouts: 'عمولات الفريق', myPayouts: 'عمولاتي', rules: 'نسب العمولة', targets: 'الأهداف', myTarget: 'هدفي', reports: 'التقارير' },
  status: { CLOSED: 'مُغلقة', CANCELLED: 'ملغاة' } satisfies Record<DealStatus, string>,
  claimStatus: {
    PENDING: 'لم تُقدَّم',
    SUBMITTED: 'مُقدَّمة',
    PARTIALLY_PAID: 'مدفوعة جزئيًا',
    PAID: 'مدفوعة',
    REJECTED: 'مرفوضة',
  } satisfies Record<ClaimStatus, string>,
  role: { AGENT: 'المندوب', MANAGER: 'مدير الفريق' } satisfies Record<SplitRole, string>,
  list: {
    eyebrow: 'المبيعات المُغلقة',
    title: 'الصفقات والعمولات',
    desc: 'كل صفقة أغلقها فريقك: قيمتها، عمولة الشركة، ما حُصِّل منها، ونصيب كل موظف.',
    add: 'تسجيل صفقة',
    all: 'الكل',
    kpiDeals: 'صفقات مُغلقة',
    kpiDealsSub: (n: number) => (n > 0 ? `${n} ملغاة` : 'لا صفقات ملغاة'),
    kpiValue: 'قيمة المبيعات',
    kpiCommission: 'عمولة الشركة',
    kpiReceived: 'تم تحصيله',
    kpiOutstanding: 'لم يُحصَّل بعد',
    collectedPct: (p: number) => `${p}% محصّل`,
    search: 'بحث',
    searchPlaceholder: 'كود الصفقة، العميل، الهاتف، الوحدة…',
    statusFilter: 'الحالة',
    anyStatus: 'كل الحالات',
    apply: 'عرض',
    clear: 'مسح',
    results: (n: number) => `${n} صفقة`,
    empty: 'لا صفقات بعد',
    emptyHint: 'سجّل أول صفقة من صفحة الوحدة أو من هنا، وتُحسب العمولات تلقائيًا.',
    noMatch: 'لا صفقات تطابق البحث',
    colDeal: 'الصفقة',
    colCustomer: 'العميل',
    colAgent: 'المندوب',
    colValue: 'قيمة الصفقة',
    colCommission: 'العمولة',
    colCollected: 'التحصيل',
    noListing: 'بدون وحدة مسجّلة',
    noAgent: 'بدون مندوب',
  },
  form: {
    title: 'تسجيل صفقة',
    desc: 'سجّل الصفقة عند إغلاقها: تُغلق الوحدة، ويُعلَّم العميل «تم الفوز»، وتُوزَّع العمولة حسب نسب الشركة.',
    sListing: 'الوحدة',
    sListingDesc: 'اختر الوحدة المعروضة التي بيعت أو أُجّرت؛ نوعها ومطوّرها ومندوبها يأتون منها.',
    sCustomer: 'العميل',
    sCustomerDesc: 'اختر فرصة العميل من الـ CRM لتُعلَّم «تم الفوز»، أو اكتب اسمه ورقمه.',
    sMoney: 'القيمة والعمولة',
    sMoneyDesc: 'قيمة البيع (أو قيمة عقد الإيجار) وعمولة الشركة عليها.',
    sTeam: 'المندوب والملاحظات',
    sTeamDesc: 'صاحب الصفقة؛ يأخذ هو ومديره نصيبهما من العمولة حسب النسب.',
    listing: 'الوحدة المعروضة',
    noListingOption: 'بدون وحدة — صفقة من خارج المعروض',
    kind: 'نوع الصفقة',
    developer: 'المطوّر',
    developerHint: 'المطالبة بالعمولة تُفتح باسمه.',
    lead: 'فرصة العميل',
    leadPlaceholder: 'ابحث بالاسم أو الهاتف…',
    orWalkIn: 'أو عميل غير مسجّل',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    dealValue: 'قيمة الصفقة',
    dealValueRent: 'قيمة عقد الإيجار',
    commissionPct: 'نسبة العمولة %',
    commissionTotal: 'عمولة الشركة',
    fromMandate: (pct: number) => `من تفويض المالك: ${pct}%`,
    fromDeveloper: (pct: number) => `المتفق عليه مع المطوّر: ${pct}%`,
    closedOn: 'تاريخ الإغلاق',
    agent: 'المندوب',
    noAgent: 'بدون مندوب',
    notes: 'ملاحظات',
    preview: 'توزيع العمولة',
    previewNone: 'لا توجد نسب لهذا النوع — حدّدها من «نسب العمولة».',
    previewCompany: 'صافي الشركة',
    previewManager: 'المدير',
    save: 'تسجيل الصفقة',
    cancel: 'إلغاء',
    picked: 'الوحدة المختارة',
    price: 'السعر المعروض',
  },
  detail: {
    customer: 'العميل',
    listing: 'الوحدة',
    lead: 'فرصة العميل',
    agent: 'المندوب',
    closedOn: 'أُغلقت في',
    createdBy: 'سُجّلت',
    notes: 'ملاحظات',
    money: 'العمولة',
    moneySub: 'عمولة الشركة على الصفقة وما حُصّل منها.',
    commission: 'العمولة',
    received: 'محصّل',
    outstanding: 'متبقٍ',
    recordReceived: 'تسجيل المحصّل',
    receivedTotal: 'إجمالي المحصّل حتى الآن',
    saveReceived: 'حفظ',
    splits: 'نصيب الفريق',
    splitsSub: 'يُصرف بعد تحصيل عمولة الصفقة بالكامل.',
    noSplits: 'لا نصيب للفريق على هذه الصفقة (لا نسب لهذا النوع عند تسجيلها).',
    noAgentSplits: 'لم يُحدَّد مندوب لهذه الصفقة، فلا نصيب للفريق منها.',
    pay: 'صرف',
    unpay: 'تراجع',
    paidOn: (d: string) => `صُرفت ${d}`,
    awaiting: 'بانتظار التحصيل',
    payable: 'جاهزة للصرف',
    claim: 'مطالبة المطوّر',
    claimSub: (dev: string) => `ما يدين به ${dev} للشركة على هذه البيعة.`,
    submittedOn: 'قُدِّمت في',
    notSubmitted: 'لم تُقدَّم بعد',
    submit: 'تسجيل التقديم',
    resubmit: 'إعادة التقديم',
    submitDate: 'تاريخ التقديم',
    reject: 'رفض المطوّر',
    rejectReason: 'سبب الرفض',
    addPayment: 'تسجيل دفعة',
    amount: 'المبلغ',
    receivedOn: 'تاريخ الاستلام',
    note: 'ملاحظة',
    payments: 'الدفعات',
    noPayments: 'لا دفعات بعد',
    left: 'المتبقي',
    remove: 'حذف',
    cancelDeal: 'إلغاء الصفقة',
    cancelReason: 'سبب الإلغاء',
    cancelHint: 'تعود الوحدة للعرض والعميل للتفاوض، ويُحذف نصيب الفريق والمطالبة.',
    confirmCancel: 'تأكيد الإلغاء',
    cancelled: (d: string) => `أُلغيت ${d}`,
    save: 'حفظ',
    close: 'إغلاق',
  },
  claims: {
    title: 'مطالبات المطوّرين',
    desc: 'عمولات البيع الأولي المستحقة على المطوّرين: ما طُولب به، وما دُفع، وما زال مستحقًا.',
    kpiClaimed: 'إجمالي المطالبات',
    kpiPaid: 'دفعه المطوّرون',
    kpiOutstanding: 'مستحق لم يُدفع',
    kpiOpen: 'مطالبات مفتوحة',
    empty: 'لا مطالبات',
    emptyHint: 'تُفتح مطالبة تلقائيًا مع كل صفقة بيع أولي.',
    colClaim: 'المطالبة',
    colDeveloper: 'المطوّر',
    colAmount: 'المبلغ',
    colPaid: 'المدفوع',
    colStatus: 'الحالة',
    open: 'فتح الصفقة',
  },
  payouts: {
    title: 'عمولات الفريق',
    myTitle: 'عمولاتي',
    desc: 'نصيب كل موظف من عمولات الصفقات: ما صُرف، وما جاهز للصرف، وما ينتظر تحصيل العمولة.',
    myDesc: 'نصيبك من عمولات صفقاتك: ما صُرف لك، وما جاهز للصرف، وما ينتظر التحصيل.',
    kpiPayable: 'جاهز للصرف',
    kpiAwaiting: 'ينتظر التحصيل',
    kpiPaid: 'تم صرفه',
    person: 'الموظف',
    anyone: 'كل الفريق',
    state: 'الحالة',
    anyState: 'الكل',
    unpaid: 'لم تُصرف',
    paid: 'صُرفت',
    empty: 'لا عمولات بعد',
    emptyHint: 'يظهر هنا نصيب الفريق مع كل صفقة تُسجَّل.',
    colPerson: 'الموظف',
    colDeal: 'الصفقة',
    colShare: 'النسبة',
    colAmount: 'المبلغ',
    colState: 'الحالة',
    results: (n: number) => (n === 1 ? 'حصة واحدة' : `${n} حصص`),
  },
  rules: {
    title: 'نسب العمولة',
    desc: 'نصيب المندوب ومديره من عمولة الشركة لكل نوع صفقة. تُطبَّق على الصفقات الجديدة فقط.',
    agentPct: 'نصيب المندوب %',
    managerPct: 'نصيب مدير الفريق %',
    onCommission: (c: string) => `مثال: على عمولة ${c}`,
    legendAgent: 'المندوب',
    legendManager: 'المدير',
    legendCompany: 'الشركة',
    save: 'حفظ النسب',
    saved: 'تم الحفظ',
    readOnly: 'يحدّدها مدير الشركة.',
    updated: (d: string) => `آخر تعديل ${d}`,
    never: 'لم تُحدَّد بعد',
  },
  reports: {
    title: 'التقارير المالية',
    desc: 'ما كسبته الشركة من الصفقات: العمولة، المحصّل، نصيب الفريق والمكافآت، وما يتبقى للشركة.',
    thisMonth: 'هذا الشهر',
    lastMonth: 'الشهر الماضي',
    thisQuarter: 'هذا الربع',
    thisYear: 'هذا العام',
    from: 'من شهر',
    to: 'إلى شهر',
    show: 'عرض',
    kpiCommission: 'عمولة الشركة',
    kpiReceived: 'المحصّل',
    kpiShares: 'نصيب الفريق والمكافآت',
    kpiNet: 'صافي الشركة',
    netSub: 'بعد نصيب الفريق والمكافآت',
    dealsSub: (n: number) => `${n} صفقة`,
    collectedSub: (p: number) => `${p}% من العمولة`,
    sharesSub: (paid: string) => `صُرف منها ${paid}`,
    trend: 'آخر 12 شهرًا',
    trendSub: 'العمولة والمحصّل شهرًا بشهر.',
    legendCommission: 'العمولة',
    legendReceived: 'المحصّل',
    byKind: 'حسب نوع الصفقة',
    byAgent: 'أداء الفريق',
    byAgentSub: 'العمولة التي جاء بها كل موظف ونصيبه منها.',
    colPerson: 'الموظف',
    colDeals: 'الصفقات',
    colCommission: 'العمولة',
    colShares: 'نصيبه',
    empty: 'لا صفقات في هذه الفترة',
    breakdown: 'من أين جاء صافي الشركة',
    bOutstanding: 'لم يُحصَّل بعد',
    bShares: 'نصيب الفريق',
    bBonuses: 'مكافآت الأهداف',
    bNet: 'صافي الشركة',
  },
  targets: {
    title: 'الأهداف الشهرية',
    myTitle: 'هدفي الشهري',
    desc: 'هدف كل موظف من عمولة الشركة وعدد الصفقات في الشهر، ومكافأته عند تحقيقه.',
    myDesc: 'هدفك هذا الشهر: العمولة التي تأتي بها صفقاتك، وعددها، ومكافأتك عند تحقيقه.',
    kpiTarget: 'المستهدف',
    kpiActual: 'المحقّق',
    ofTarget: (p: number) => `${p}% من المستهدف`,
    kpiAchieved: 'حقّقوا الهدف',
    kpiAchievedSub: (n: number) => `من ${n} لهم أهداف`,
    commission: 'العمولة',
    deals: 'الصفقات',
    of: 'من',
    noTarget: 'لا هدف لهذا الشهر',
    setTarget: 'تحديد هدف',
    edit: 'تعديل',
    commissionTarget: 'العمولة المستهدفة',
    dealsTarget: 'عدد الصفقات',
    bonusAmount: 'المكافأة عند التحقيق',
    save: 'حفظ',
    cancel: 'إلغاء',
    remove: 'حذف الهدف',
    bonus: { NONE: 'بدون مكافأة', PENDING: 'لم يتحقق بعد', EARNED: 'تحقّق — المكافأة مستحقة', PAID: 'صُرفت المكافأة' },
    payBonus: 'صرف المكافأة',
    unpay: 'تراجع',
    achieved: 'تحقّق',
    prev: 'الشهر السابق',
    next: 'الشهر التالي',
    empty: 'لا يوجد موظفو مبيعات بعد',
  },
};

const en: typeof ar = {
  tabs: { deals: 'Deals', claims: 'Developer claims', payouts: 'Team commissions', myPayouts: 'My commissions', rules: 'Commission rates', targets: 'Targets', myTarget: 'My target', reports: 'Reports' },
  status: { CLOSED: 'Closed', CANCELLED: 'Cancelled' },
  claimStatus: { PENDING: 'Not submitted', SUBMITTED: 'Submitted', PARTIALLY_PAID: 'Partly paid', PAID: 'Paid', REJECTED: 'Rejected' },
  role: { AGENT: 'Agent', MANAGER: 'Team manager' },
  list: {
    eyebrow: 'Closed sales',
    title: 'Deals & commissions',
    desc: 'Every deal your team closed: its value, the company’s commission, what was collected and each person’s share.',
    add: 'Record a deal',
    all: 'All',
    kpiDeals: 'Closed deals',
    kpiDealsSub: (n: number) => (n > 0 ? `${n} cancelled` : 'none cancelled'),
    kpiValue: 'Sales value',
    kpiCommission: 'Company commission',
    kpiReceived: 'Collected',
    kpiOutstanding: 'Not collected yet',
    collectedPct: (p: number) => `${p}% collected`,
    search: 'Search',
    searchPlaceholder: 'Deal code, customer, phone, listing…',
    statusFilter: 'Status',
    anyStatus: 'Any status',
    apply: 'Show',
    clear: 'Clear',
    results: (n: number) => `${n} deals`,
    empty: 'No deals yet',
    emptyHint: 'Record the first deal from a listing or here; commissions are worked out for you.',
    noMatch: 'No deals match',
    colDeal: 'Deal',
    colCustomer: 'Customer',
    colAgent: 'Agent',
    colValue: 'Deal value',
    colCommission: 'Commission',
    colCollected: 'Collected',
    noListing: 'No listing',
    noAgent: 'No agent',
  },
  form: {
    title: 'Record a deal',
    desc: 'Record a deal when it closes: the listing closes, the lead is marked won and the commission is shared by the company’s rates.',
    sListing: 'Listing',
    sListingDesc: 'The listing sold or let; its kind, developer and agent come from it.',
    sCustomer: 'Customer',
    sCustomerDesc: 'Pick the customer’s lead so it is marked won, or type their name and phone.',
    sMoney: 'Value and commission',
    sMoneyDesc: 'The sale price (or the lease value) and the company’s commission on it.',
    sTeam: 'Agent and notes',
    sTeamDesc: 'Who closed it; they and their manager get their shares by the rates.',
    listing: 'Listing',
    noListingOption: 'No listing — a deal outside the listings',
    kind: 'Deal type',
    developer: 'Developer',
    developerHint: 'The commission claim is opened in their name.',
    lead: 'Customer lead',
    leadPlaceholder: 'Search by name or phone…',
    orWalkIn: 'or an unregistered customer',
    customerName: 'Customer name',
    customerPhone: 'Customer phone',
    dealValue: 'Deal value',
    dealValueRent: 'Lease value',
    commissionPct: 'Commission %',
    commissionTotal: 'Company commission',
    fromMandate: (pct: number) => `From the owner’s mandate: ${pct}%`,
    fromDeveloper: (pct: number) => `Agreed with the developer: ${pct}%`,
    closedOn: 'Closed on',
    agent: 'Agent',
    noAgent: 'No agent',
    notes: 'Notes',
    preview: 'Commission split',
    previewNone: 'No rates for this type — set them under “Commission rates”.',
    previewCompany: 'Company keeps',
    previewManager: 'Manager',
    save: 'Record the deal',
    cancel: 'Cancel',
    picked: 'Selected listing',
    price: 'Listed price',
  },
  detail: {
    customer: 'Customer',
    listing: 'Listing',
    lead: 'Lead',
    agent: 'Agent',
    closedOn: 'Closed on',
    createdBy: 'Recorded',
    notes: 'Notes',
    money: 'Commission',
    moneySub: 'The company’s commission on the deal and what was collected.',
    commission: 'Commission',
    received: 'Collected',
    outstanding: 'Outstanding',
    recordReceived: 'Record collected',
    receivedTotal: 'Total collected so far',
    saveReceived: 'Save',
    splits: 'Team shares',
    splitsSub: 'Paid out once the deal’s commission is fully collected.',
    noSplits: 'No team shares on this deal (no rates for its type when recorded).',
    noAgentSplits: 'No agent was set on this deal, so it has no team shares.',
    pay: 'Pay',
    unpay: 'Undo',
    paidOn: (d: string) => `Paid ${d}`,
    awaiting: 'Awaiting collection',
    payable: 'Ready to pay',
    claim: 'Developer claim',
    claimSub: (dev: string) => `What ${dev} owes the company on this sale.`,
    submittedOn: 'Submitted on',
    notSubmitted: 'Not submitted yet',
    submit: 'Record submission',
    resubmit: 'Resubmit',
    submitDate: 'Submission date',
    reject: 'Rejected by developer',
    rejectReason: 'Reason',
    addPayment: 'Record a payment',
    amount: 'Amount',
    receivedOn: 'Received on',
    note: 'Note',
    payments: 'Payments',
    noPayments: 'No payments yet',
    left: 'Left',
    remove: 'Remove',
    cancelDeal: 'Cancel deal',
    cancelReason: 'Reason',
    cancelHint: 'The listing goes back on the market and the lead back to negotiation; the shares and claim are removed.',
    confirmCancel: 'Confirm cancellation',
    cancelled: (d: string) => `Cancelled ${d}`,
    save: 'Save',
    close: 'Close',
  },
  claims: {
    title: 'Developer claims',
    desc: 'Primary-sale commissions owed by developers: claimed, paid and still due.',
    kpiClaimed: 'Total claimed',
    kpiPaid: 'Paid by developers',
    kpiOutstanding: 'Still due',
    kpiOpen: 'Open claims',
    empty: 'No claims',
    emptyHint: 'A claim opens with every primary-sale deal.',
    colClaim: 'Claim',
    colDeveloper: 'Developer',
    colAmount: 'Amount',
    colPaid: 'Paid',
    colStatus: 'Status',
    open: 'Open deal',
  },
  payouts: {
    title: 'Team commissions',
    myTitle: 'My commissions',
    desc: 'Each person’s share of deal commissions: paid, ready to pay, and waiting on collection.',
    myDesc: 'Your share of your deals’ commissions: paid, ready to pay, and waiting on collection.',
    kpiPayable: 'Ready to pay',
    kpiAwaiting: 'Awaiting collection',
    kpiPaid: 'Paid out',
    person: 'Person',
    anyone: 'Whole team',
    state: 'State',
    anyState: 'All',
    unpaid: 'Unpaid',
    paid: 'Paid',
    empty: 'No commissions yet',
    emptyHint: 'Team shares appear here with every recorded deal.',
    colPerson: 'Person',
    colDeal: 'Deal',
    colShare: 'Share',
    colAmount: 'Amount',
    colState: 'State',
    results: (n: number) => (n === 1 ? '1 share' : `${n} shares`),
  },
  rules: {
    title: 'Commission rates',
    desc: 'The agent’s and their manager’s share of the company’s commission, per deal type. New deals only.',
    agentPct: 'Agent share %',
    managerPct: 'Team manager share %',
    onCommission: (c: string) => `Example: on a ${c} commission`,
    legendAgent: 'Agent',
    legendManager: 'Manager',
    legendCompany: 'Company',
    save: 'Save rates',
    saved: 'Saved',
    readOnly: 'Set by the company admin.',
    updated: (d: string) => `Updated ${d}`,
    never: 'Not set yet',
  },
  reports: {
    title: 'Financial reports',
    desc: 'What the company earned from deals: commission, collected, team shares and bonuses, and what it keeps.',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    thisQuarter: 'This quarter',
    thisYear: 'This year',
    from: 'From',
    to: 'To',
    show: 'Show',
    kpiCommission: 'Company commission',
    kpiReceived: 'Collected',
    kpiShares: 'Team shares & bonuses',
    kpiNet: 'Company net',
    netSub: 'after team shares and bonuses',
    dealsSub: (n: number) => `${n} deals`,
    collectedSub: (p: number) => `${p}% of commission`,
    sharesSub: (paid: string) => `${paid} paid out`,
    trend: 'Last 12 months',
    trendSub: 'Commission and collected, month by month.',
    legendCommission: 'Commission',
    legendReceived: 'Collected',
    byKind: 'By deal type',
    byAgent: 'Team performance',
    byAgentSub: 'The commission each person brought in and their share of it.',
    colPerson: 'Person',
    colDeals: 'Deals',
    colCommission: 'Commission',
    colShares: 'Share',
    empty: 'No deals in this period',
    breakdown: 'Where the company net comes from',
    bOutstanding: 'Not collected yet',
    bShares: 'Team shares',
    bBonuses: 'Target bonuses',
    bNet: 'Company net',
  },
  targets: {
    title: 'Monthly targets',
    myTitle: 'My monthly target',
    desc: 'Each person’s monthly target for company commission and deals, and the bonus for meeting it.',
    myDesc: 'Your target this month: the commission your deals bring in, how many, and your bonus for meeting it.',
    kpiTarget: 'Target',
    kpiActual: 'Achieved',
    ofTarget: (p: number) => `${p}% of target`,
    kpiAchieved: 'Met their target',
    kpiAchievedSub: (n: number) => `of ${n} with targets`,
    commission: 'Commission',
    deals: 'Deals',
    of: 'of',
    noTarget: 'No target this month',
    setTarget: 'Set target',
    edit: 'Edit',
    commissionTarget: 'Commission target',
    dealsTarget: 'Deals',
    bonusAmount: 'Bonus when met',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Remove target',
    bonus: { NONE: 'No bonus', PENDING: 'Not met yet', EARNED: 'Met — bonus due', PAID: 'Bonus paid' },
    payBonus: 'Pay bonus',
    unpay: 'Undo',
    achieved: 'Met',
    prev: 'Previous month',
    next: 'Next month',
    empty: 'No sales staff yet',
  },
};

export function dealsT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export const DEAL_STATUSES: DealStatus[] = ['CLOSED', 'CANCELLED'];
export const CLAIM_STATUSES: ClaimStatus[] = ['PENDING', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'REJECTED'];

interface Person {
  id: string;
  fullName: string;
}

export interface DealListingRef {
  id: string;
  code: string;
  title: string;
  kind: ListingKind;
  status: ListingStatus;
}

export interface DealSplit {
  id: string;
  userId: string;
  role: SplitRole;
  sharePct: string;
  amount: string;
  paidAt: string | null;
  user: Person;
}

export interface ClaimPayment {
  id: string;
  amount: string;
  receivedOn: string;
  note: string | null;
}

export interface DeveloperClaim {
  id: string;
  code: string;
  developerName: string;
  amount: string;
  status: ClaimStatus;
  submittedOn: string | null;
  notes: string | null;
  payments: ClaimPayment[];
}

export interface DealRow {
  id: string;
  code: string;
  kind: ListingKind;
  status: DealStatus;
  customerName: string;
  customerPhone: string | null;
  dealValue: string;
  closedOn: string;
  commissionTotal: string;
  commissionReceived: string;
  agentId: string | null;
  agent: Person | null;
  listing: DealListingRef | null;
  claim: { id: string; code: string; status: ClaimStatus } | null;
}

export interface Deal extends Omit<DealRow, 'claim'> {
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  lead: { id: string; fullName: string; phone: string; stage: string } | null;
  splits: DealSplit[];
  claim: DeveloperClaim | null;
}

export interface CommissionRule {
  kind: ListingKind;
  agentPct: number;
  managerPct: number;
  updatedAt: string | null;
}

export interface ClaimRow extends DeveloperClaim {
  paid: number;
  deal: { id: string; code: string; customerName: string; closedOn: string; dealValue: string; listing: DealListingRef | null; agent: Person | null };
}

export interface ClaimsPayload {
  data: ClaimRow[];
  counts: Record<string, number>;
  totals: { claimed: number; paid: number; outstanding: number };
}

export interface SplitRow extends DealSplit {
  payable: boolean;
  deal: {
    id: string;
    code: string;
    kind: ListingKind;
    customerName: string;
    closedOn: string;
    commissionTotal: string;
    commissionReceived: string;
    listing: DealListingRef | null;
  };
}

export interface SplitsPayload {
  data: SplitRow[];
  totals: { payable: number; awaitingCollection: number; paid: number };
}

export type BonusState = 'NONE' | 'PENDING' | 'EARNED' | 'PAID';

export interface TargetRow {
  user: { id: string; fullName: string; role: string };
  target: { id: string; period: string; commissionTarget: string; dealsTarget: number; bonusAmount: string; bonusPaidAt: string | null } | null;
  actual: { commission: number; deals: number };
  progress: { commissionPct: number; dealsPct: number; achieved: boolean } | null;
  bonus: BonusState;
}

export interface TargetsPayload {
  period: string;
  rows: TargetRow[];
  totals: { commissionTarget: number; commission: number; achieved: number; withTarget: number };
}

interface ReportFigures {
  deals: number;
  dealValue: number;
  commission: number;
  received: number;
}

export interface ReportPayload {
  from: string;
  to: string;
  totals: ReportFigures & { outstanding: number; staffShares: number; staffSharesPaid: number; bonuses: number; bonusesPaid: number; companyNet: number };
  byKind: Array<ReportFigures & { kind: ListingKind }>;
  byAgent: Array<ReportFigures & { userId: string; fullName: string; shares: number; sharesPaid: number }>;
  trend: Array<ReportFigures & { month: string }>;
}

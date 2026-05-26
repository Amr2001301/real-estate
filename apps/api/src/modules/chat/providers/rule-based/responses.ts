/**
 * Curated Arabic copy for the rule-based assistant. Centralized so tone stays
 * consistent and FreeAI-3 can expand the FAQ set in one place. No fabricated
 * numbers (prices/dates/percentages) anywhere — anything specific defers to the
 * catalog results or a human advisor.
 */

import type { SlotField, Slots } from './slots';

export const GREETING_REPLY =
  'أهلًا بك في دار الفخامة! 👋 يمكنني مساعدتك في البحث عن وحدة أو مشروع، حجز معاينة، أو الإجابة عن أسئلتك. بماذا أبدأ؟';

export const HOME_QUICK_REPLIES = ['أبحث عن شقة', 'أبحث عن مشروع', 'كيف أحجز معاينة؟', 'تواصل مع مستشار'];

/** Prompt shown when the assistant needs a particular slot. */
export const SLOT_PROMPTS: Record<SlotField, string> = {
  propertyType: 'ما نوع العقار الذي تبحث عنه؟',
  city: 'في أي منطقة أو مدينة تفضّل البحث؟',
  dealType: 'هل تبحث عن تمليك أم إيجار؟',
  budgetMax: 'ما هي ميزانيتك التقريبية؟ يمكنك كتابتها مثل: ٢ مليون أو ٥٠٠ ألف.',
  minRooms: 'كم عدد الغرف التي تحتاجها؟',
  areaMin: 'ما المساحة التقريبية التي تبحث عنها بالمتر؟',
};

/** Quick-reply chips offered alongside each slot prompt. */
export const SLOT_QUICK_REPLIES: Partial<Record<SlotField, string[]>> = {
  propertyType: ['شقة', 'فيلا', 'دوبلكس', 'استوديو'],
  city: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'],
  dealType: ['تمليك', 'إيجار'],
  minRooms: ['غرفتين', '٣ غرف', '٤ غرف'],
  budgetMax: ['٢ مليون', '٥ مليون', 'أكثر من ٥ مليون'],
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'شقة',
  villa: 'فيلا',
  duplex: 'دوبلكس',
  penthouse: 'بنتهاوس',
  studio: 'استوديو',
  chalet: 'شاليه',
  townhouse: 'تاون هاوس',
  twinhouse: 'توين هاوس',
  office: 'مكتب إداري',
  commercial: 'محل تجاري',
  land: 'أرض',
};

export function propertyTypeLabel(key: string | undefined): string {
  return (key && PROPERTY_TYPE_LABELS[key]) || 'عقار';
}

/**
 * Curated FAQ answers, keyed by the topic from intents.detectFaqTopic. Each is
 * short, helpful, and SAFE: no legal/financial advice, no promised prices or
 * availability beyond public listings, and a human handoff where specifics are
 * needed. Never expose private/account data here.
 */
export const FAQ_ANSWERS: Record<string, string> = {
  visit_howto:
    'لحجز معاينة: افتح صفحة الوحدة التي تهمك ثم اضغط «طلب زيارة» وأدخل بياناتك، وسيتواصل معك فريق المبيعات لتأكيد الموعد. يمكنني مساعدتك في إيجاد وحدة مناسبة أولًا.',
  info_howto:
    'لطلب مزيد من المعلومات: من صفحة الوحدة أو المشروع اضغط «طلب معلومات»، أو أخبرني بما يهمك وسأعرض لك المتاح، ويمكنني توصيلك بمستشار يرسل التفاصيل والكتالوج.',
  online_payment:
    'لا يتم الدفع أونلاين عبر الموقع. جميع الدفعات تتم من خلال فريق المبيعات بالطرق الرسمية المعتمدة بعد الاتفاق على التفاصيل. يسعدنا ربطك بمستشار لتوضيح الخطوات.',
  installments:
    'تتوفر عادةً أنظمة تقسيط وخطط سداد تختلف من مشروع لآخر. لا أقدّم استشارات مالية أو أرقامًا نهائية؛ أخبرني بالمشروع أو المنطقة وسأعرض المتاح، ويوضّح لك مستشارنا آخر خطط السداد.',
  deposits:
    'الدفعات والعربون تتم إدارتها بالكامل من خلال فريق المبيعات بالطرق الرسمية، وليست عبر الموقع. يمكنني توصيلك بمستشار لتوضيح قيمة الدفعة وخطواتها لكل مشروع.',
  reservation:
    'خطوات الحجز باختصار: تختار الوحدة، ثم يتواصل معك فريق المبيعات لاستكمال إجراءات الحجز والدفعات رسميًا. لا يتم الحجز أو الدفع أونلاين عبر الموقع. أساعدك في اختيار وحدة الآن؟',
  payment:
    'تتم المدفوعات من خلال فريق المبيعات بالطرق الرسمية المعتمدة، وليست أونلاين عبر الموقع. لتفاصيل وسائل الدفع المتاحة لمشروع معيّن، يمكنني توصيلك بمستشار.',
  contract:
    'إجراءات التعاقد بعد الشراء تتم بشكل رسمي وموثّق، وتختلف المستندات حسب نوع الوحدة وطريقة الشراء. لا أقدّم استشارات قانونية؛ يسعد مستشارنا بموافاتك بالقائمة الدقيقة.',
  maintenance:
    'خدمات الصيانة بعد الشراء متاحة لعملائنا من خلال حساب العميل في الموقع، حيث يمكن تقديم ومتابعة طلبات الصيانة. لا يمكنني الاطلاع على بيانات حسابك من هنا؛ سجّل الدخول لإدارتها.',
  favorites:
    'يمكنك حفظ أي وحدة أو مشروع في «المفضلة» بالضغط على رمز القلب، والرجوع إليها لاحقًا من حسابك. هل تريد أن أعرض لك بعض الوحدات لتبدأ؟',
  account_portal:
    'لديك حساب على الموقع يمكنك من خلاله متابعة طلبات الزيارة والمعلومات والمفضلة وبياناتك. لا يمكنني الوصول إلى بيانات حسابك من هنا؛ سجّل الدخول لإدارتها بنفسك.',
  delivery:
    'مواعيد التسليم تختلف حسب كل مشروع وحالة الوحدة (جاهزة أو تحت الإنشاء). حدّد لي المشروع وسأعرض تفاصيله، أو يفيدك مستشارنا بالمواعيد الدقيقة.',
  fees:
    'تفاصيل الرسوم والعمولات تعتمد على المشروع ونوع التعامل. لتجنّب أي معلومة غير دقيقة، يمكنني ربطك بمستشار يوضّح لك كل التفاصيل.',
  ownership:
    'تتباين شروط التملّك حسب نوع العقار والمنطقة. للحصول على إجابة دقيقة تناسب حالتك، أنصح بالتحدث مع أحد مستشارينا.',
  availability:
    'أعرض لك الوحدات من قوائمنا العامة المحدّثة، لكن يُفضَّل تأكيد التوفر النهائي والسعر مع فريق المبيعات قبل اتخاذ القرار. تحب أبحث لك عن المتاح الآن؟',
  contact:
    'يسعدنا تواصلك معنا! أسرع طريقة هي عبر واتساب وسيرد عليك فريقنا في أقرب وقت.',
  privacy:
    'نحرص على خصوصية بياناتك ولا نشاركها إلا لخدمة طلبك. يمكنك الاطلاع على سياسة الخصوصية وشروط الاستخدام من صفحاتها في الموقع.',
  terms:
    'تجد شروط الاستخدام وسياسة الخصوصية في صفحاتها المخصّصة بالموقع. إن كان لديك سؤال محدد، يمكنني توصيلك بمستشار.',
};

/** Topics where guiding the user back into search/browse is the natural next step. */
const SEARCH_FOLLOWUP_TOPICS = new Set([
  'visit_howto',
  'info_howto',
  'reservation',
  'availability',
  'favorites',
  'installments',
  'deposits',
]);

export const FAQ_FOLLOWUP_QUICK_REPLIES = ['أبحث عن وحدة', 'تواصل مع مستشار'];
const FAQ_HUMAN_ONLY_QUICK_REPLIES = ['تواصل مع مستشار'];

/** Quick replies tailored to the FAQ topic just answered. */
export function faqQuickReplies(topic: string | undefined): string[] {
  if (topic && SEARCH_FOLLOWUP_TOPICS.has(topic)) return FAQ_FOLLOWUP_QUICK_REPLIES;
  return FAQ_HUMAN_ONLY_QUICK_REPLIES;
}

/** Appended to result summaries: availability is confirmed by sales, not the bot. */
export const AVAILABILITY_NOTE = 'ملاحظة: يُرجى تأكيد التوفر والسعر النهائي مع فريق المبيعات.';

export const VISIT_GUIDE =
  'بكل سرور! لحجز معاينة، اختر الوحدة التي تهمك ثم اضغط «طلب زيارة» وستصلك المواعيد المتاحة. يمكنني أيضًا مساعدتك في إيجاد وحدة مناسبة أولًا، أو توصيلك بمستشار لتحديد موعد مباشرة.';

export const INFO_GUIDE =
  'يسعدني تزويدك بالتفاصيل. أخبرني بالوحدة أو المشروع الذي يهمك، أو يمكنني توصيلك بمستشار يرسل لك كل البيانات والكتالوج.';

export const COMPARE_GUIDE =
  'لأرشّح لك الأنسب، احتاج أعرف تفضيلاتك أولًا: نوع العقار، المنطقة، والميزانية التقريبية. لنبدأ —';

export const HUMAN_HANDOFF =
  'بالطبع! يمكنك التواصل مع أحد مستشارينا مباشرةً عبر واتساب وسيسعدهم خدمتك.';

export const WHATSAPP_PREFILL =
  'مرحبًا، تواصلت معكم عبر المساعد العقاري في الموقع وأرغب في الحصول على مساعدة بخصوص العقارات المتاحة.';

export const UNKNOWN_REPLY =
  'لم أفهم طلبك تمامًا 🤔 يمكنني مساعدتك في: البحث عن وحدة أو مشروع، حجز معاينة، الأسئلة الشائعة، أو التواصل مع مستشار. ماذا تفضّل؟';

/** Confirmation shown once a search flow has all it needs (results in FreeAI-2). */
export function searchReadyReply(typeLabel: string, city: string): string {
  return `تمام! أبحث لك الآن عن ${typeLabel} في ${city}…`;
}

// ---- Conversion flows (info / visit lead capture) ----

/** Field prompts asked one at a time while collecting a request. */
export const CONVERSION_PROMPTS = {
  name: 'تمام! ما اسمك من فضلك؟',
  phone: 'وما رقم هاتفك للتواصل؟ (مثال: 01XXXXXXXXX)',
  preferredDate: 'ما التاريخ الذي يناسبك للزيارة؟ (مثال: «بكرة» أو 2026-06-15)',
  consent: 'هل توافق على استخدام بياناتك للتواصل معك بخصوص هذا الطلب؟',
} as const;

/** Re-ask copy when an answer couldn't be parsed/validated. */
export const CONVERSION_INVALID = {
  name: 'لم ألتقط الاسم بوضوح. ما اسمك من فضلك؟',
  phone: 'هذا الرقم لا يبدو صحيحًا. اكتب رقم هاتفك مثل 01XXXXXXXXX أو بصيغة دولية +20…',
  preferredDate: 'لم أفهم التاريخ. اكتبه هكذا: «اليوم» أو «بكرة» أو 2026-06-15.',
  consent: 'للتأكيد فقط: اكتب «نعم» للموافقة على استخدام بياناتك للتواصل معك، أو «إلغاء».',
} as const;

export function choosePropertyPrompt(count: number): string {
  return `أي عقار من النتائج تريد تحديد موعد لزيارته؟ اكتب رقمه من 1 إلى ${count} (مثلاً: 1).`;
}

export const NEED_PROPERTY_FIRST =
  'لتحديد موعد زيارة، نحتاج أولًا اختيار المشروع أو الوحدة. ابحث الآن وسأكمل معك الحجز.';

export const CONSENT_REJECTED =
  'تمام، لن أستخدم بياناتك. يمكنك التواصل معنا مباشرةً عبر واتساب وقتما تشاء.';

export const CONVERSION_CANCELLED = 'تم إلغاء الطلب. كيف يمكنني مساعدتك؟';

export const INFO_REQUEST_SUCCESS =
  'تم استلام طلبك بنجاح ✅ سيتواصل معك فريقنا في أقرب وقت. تحب تتواصل عبر واتساب الآن؟';

export const VISIT_REQUEST_SUCCESS =
  'تم تسجيل طلب الزيارة بنجاح ✅ سيتواصل معك فريق المبيعات لتأكيد الموعد. تحب تتواصل عبر واتساب الآن؟';

export const CONVERSION_FAILURE =
  'تعذّر إرسال طلبك حاليًا. جرّب مرة أخرى بعد قليل بكتابة «نعم»، أو تواصل معنا عبر واتساب.';

/** Default inquiry message when the user didn't type a free-text note. */
export const INFO_DEFAULT_MESSAGE = 'طلب معلومات عبر المساعد العقاري في الموقع.';

export const CONSENT_QUICK_REPLIES = ['نعم', 'إلغاء'];
export const CONVERSION_FIELD_QUICK_REPLIES = ['إلغاء'];
export const DATE_QUICK_REPLIES = ['اليوم', 'بكرة', 'بعد بكرة'];

/** Summary line shown above unit result cards. `shown` ≤ `total`. */
export function unitResultsReply(total: number, shown: number, typeLabel: string, city: string): string {
  const place = city ? ` في ${city}` : '';
  if (total > shown) {
    return `وجدت ${total} ${typeLabel}${place}. إليك أقربها لميزانيتك:`;
  }
  return `وجدت ${total} ${typeLabel}${place}:`;
}

export function projectResultsReply(total: number, shown: number, city: string): string {
  const place = city ? ` في ${city}` : '';
  if (total > shown) {
    return `وجدت ${total} مشروعًا${place}. إليك أبرزها:`;
  }
  return `وجدت ${total} مشروعًا${place}:`;
}

export const NO_PROJECT_RESULTS =
  'لم أجد مشاريع مطابقة في هذه المنطقة حاليًا. جرّب منطقة أخرى، أو يمكنني توصيلك بمستشار لعرض أحدث المشاريع.';

/** Asked after a city is known and no type/budget was given (one follow-up). */
export const TYPE_PROMPT = 'تفضّل شقة، فيلا، استوديو، دوبلكس، أم تاون هاوس؟';

// ---- Guided mode (vague input → real options) ----

/** Warm opener when the user asks for help/recommendations with no criteria. */
export const GUIDED_MENU =
  'بكل سرور، خليني أساعدك تلاقي الأنسب 👌 اختر مدينة للبدء، أو اكتب نوع العقار الذي يناسبك:';

export function availableCitiesReply(cities: string[]): string {
  if (cities.length === 0) return 'اكتب اسم المدينة التي تريد البحث فيها، أو تواصل مع مستشار.';
  return `المدن المتاحة حاليًا: ${cities.join('، ')}. أي مدينة تفضّل؟`;
}

export function availableTypesReply(types: string[]): string {
  if (types.length === 0) return TYPE_PROMPT;
  return `الأنواع المتاحة حاليًا: ${types.join('، ')}. أي نوع يناسبك؟`;
}

/** Budget question + chips (used when the user resets/relaxes the budget). */
export const BUDGET_PROMPT = 'ما ميزانيتك التقريبية؟ اختر نطاقًا أو اكتب «بدون ميزانية محددة».';
export const BUDGET_QUICK_REPLIES = [
  'أقل من ١ مليون',
  '١ - ٣ مليون',
  '٣ - ٥ مليون',
  'أكثر من ٥ مليون',
  'بدون ميزانية محددة',
];

/** Escalated fallback after repeated unrecognized input (varies the reply). */
export function escalatedUnknownReply(cities: string[]): string {
  const list = cities.length ? ` جرّب إحدى المدن: ${cities.slice(0, 4).join('، ')}،` : '';
  return `خليني أوصلك أسرع 🙂${list} أو اكتب نوع العقار، أو تواصل مع مستشار وسيسعده مساعدتك.`;
}

/** Fallbacks used only if the live catalog facet lookup is unavailable. */
export const FALLBACK_CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'];
export const FALLBACK_TYPES = ['شقة', 'فيلا', 'استوديو', 'دوبلكس', 'تاون هاوس'];

/** City the user asked for isn't in the catalog → name the ones that are. */
export function cityNotAvailable(city: string, availableCities: string[]): string {
  if (availableCities.length === 0) {
    return `لا تتوفر لدينا وحدات في ${city} حاليًا. اكتب مدينة أخرى أو تواصل مع مستشار.`;
  }
  return `لا تتوفر لدينا وحدات في ${city} حاليًا. المدن المتاحة: ${availableCities.join('، ')}. أي مدينة تفضّل؟`;
}

/** City exists but the type/budget combination is too tight. */
export function unitsTooRestrictive(typeLabel: string, city: string): string {
  return `لا توجد ${typeLabel} مطابقة في ${city} بهذه المعايير الآن. تحب أعرض لك كل الوحدات المتاحة في ${city}، أو نجرّب نوعًا آخر؟`;
}

/**
 * Context-aware result quick replies: never offer "غيّر الميزانية" before a
 * budget is known. Always lets the user narrow further or book a visit.
 */
export function resultsQuickReplies(slots: Slots, hasMore: boolean): string[] {
  const qr = ['احجز زيارة', 'غيّر المدينة'];
  if (slots.budgetMax !== undefined) qr.push('غيّر الميزانية');
  else if (slots.propertyType) qr.push('غيّر النوع');
  if (hasMore) qr.push('عرض المزيد');
  return qr;
}

/** Prompt shown after the user asks to change a single criterion. */
export function changeSlotReply(field: keyof typeof SLOT_PROMPTS): string {
  return SLOT_PROMPTS[field];
}

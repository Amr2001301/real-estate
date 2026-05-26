/**
 * Deterministic intent detection over a normalized Arabic message. Returns the
 * single best-matching intent (or `unknown`). Order matters: explicit
 * hand-off/transactional intents are checked before the broader search intents
 * so "محتاج اكلم مستشار" routes to a human instead of a unit search.
 */

import { containsAny } from './normalize';
import { extractCity, extractPropertyType } from './slots';

export type Intent =
  | 'greeting'
  | 'human_help'
  | 'whatsapp_handoff'
  | 'request_visit'
  | 'request_info'
  | 'ask_faq'
  | 'compare_or_recommend'
  | 'search_projects'
  | 'search_units'
  | 'unknown';

const GREETING = ['مرحبا', 'اهلا', 'هلا', 'هاي', 'السلام', 'صباح', 'مساء', 'hello', 'hi', 'hey'];
const HUMAN = ['اكلم حد', 'اتكلم مع حد', 'مستشار', 'موظف', 'حد يكلمني', 'خدمه العملاء', 'بشري', 'agent', 'human', 'representative'];
const WHATSAPP = ['واتساب', 'واتس', 'whatsapp'];
// Visit = an in-person viewing. Generic "احجز/حجز" is intentionally NOT here —
// bare booking words route to the reservation FAQ; a visit needs a viewing cue.
const VISIT = ['زياره', 'معاينه', 'اعاين', 'اشوف الوحده', 'اشوف الشقه', 'موعد معاينه', 'احجز زياره', 'احجز معاينه', 'visit', 'viewing'];
const INFO = ['تفاصيل', 'معلومات', 'اعرف اكتر', 'كتالوج', 'بروشور', 'ابعتلي', 'بيانات', 'details', 'brochure', 'info'];
const PROJECTS = ['مشروع', 'مشاريع', 'كمبوند', 'كومباوند', 'compound', 'project'];
const SEARCH = ['ابحث', 'بدور', 'عايز', 'عاوز', 'محتاج', 'دلوقتي', 'عقار', 'وحده', 'وحدات', 'search', 'looking', 'find'];
const COMPARE = ['قارن', 'مقارنه', 'رشحلي', 'انسبلي', 'الافضل', 'افضل', 'توصيه', 'نصيحه', 'compare', 'recommend', 'suggest'];

/**
 * FAQ keyword groups → topic key, checked in declaration order (first match
 * wins), so the more specific topics are listed before the broad ones. The
 * engine maps the returned key to a curated Arabic answer in responses.ts.
 */
export const FAQ_TOPICS: Record<string, readonly string[]> = {
  visit_howto: ['ازاي احجز زياره', 'كيف احجز زياره', 'ازاي اعمل معاينه', 'how to book a visit'],
  info_howto: ['ازاي اعرف معلومات', 'كيف اطلب معلومات', 'ازاي اطلب تفاصيل', 'how to request info'],
  online_payment: ['دفع اونلاين', 'الدفع اونلاين', 'ادفع اونلاين', 'بطاقه', 'فيزا', 'اونلاين', 'online payment', 'pay online'],
  installments: ['تقسيط', 'اقساط', 'قسط', 'مقدم', 'تمويل', 'تمويل عقاري', 'خطه سداد', 'خطط سداد', 'installment', 'finance', 'mortgage'],
  deposits: ['عربون', 'دفعه مقدمه', 'الدفعات', 'مقدم الحجز', 'دفعات', 'deposit'],
  reservation: ['الحجز', 'احجز وحده', 'احجز شقه', 'خطوات الحجز', 'ازاي احجز', 'كيفيه الحجز', 'عمليه الحجز', 'احجز', 'حجز', 'reservation', 'booking'],
  payment: ['الدفع', 'ادفع', 'طريقه الدفع', 'وسائل الدفع', 'payment'],
  contract: ['عقد', 'تعاقد', 'اوراق', 'مستندات', 'توثيق', 'contract', 'paperwork'],
  maintenance: ['صيانه', 'اعطال', 'عطل', 'طلب صيانه', 'شكوي', 'maintenance', 'repair'],
  favorites: ['مفضله', 'المفضله', 'حفظ الوحده', 'احفظ', 'favorite', 'wishlist'],
  account_portal: ['حسابي', 'تسجيل دخول', 'تسجيل الدخول', 'حساب العميل', 'بوابه العميل', 'بوابه العملاء', 'بروفايل', 'login', 'account', 'portal'],
  delivery: ['تسليم', 'استلام', 'مده التسليم', 'جاهز', 'delivery', 'handover'],
  fees: ['عموله', 'رسوم', 'مصاريف', 'commission', 'fees'],
  ownership: ['تمليك للاجانب', 'اجانب', 'foreigner', 'ownership'],
  availability: ['التوفر', 'لسه متاح', 'لسه متاحه', 'لسه موجود', 'هل متاح', 'متاحه لسه', 'availability'],
  contact: ['رقم التليفون', 'رقم الموبايل', 'اتصل', 'تواصل معكم', 'ايميل', 'بريد الكتروني', 'contact', 'phone', 'email'],
  privacy: ['الخصوصيه', 'خصوصيه', 'بياناتي', 'privacy'],
  terms: ['الشروط', 'شروط الاستخدام', 'الاحكام', 'terms'],
};

export function detectFaqTopic(norm: string): string | undefined {
  for (const [topic, words] of Object.entries(FAQ_TOPICS)) {
    if (containsAny(norm, words)) return topic;
  }
  return undefined;
}

/**
 * Best-match intent for a fresh message. `hasActiveSearch` lets a bare value
 * (e.g. "القاهرة") during slot-filling stay in the search flow instead of
 * falling through to `unknown` — the orchestrator passes the current state.
 *
 * Order is deliberate: hand-off/visit first, then FAQ (so "ازاي ادفع" is a FAQ
 * not a search), then catalog search. A property-type word forces a unit search
 * ("عايز شقة"), but a bare "عايز اعرف معلومات" (no type) is an info request, so
 * INFO is checked before the generic SEARCH verbs.
 */
export function detectIntent(norm: string, hasActiveSearch = false): Intent {
  if (containsAny(norm, HUMAN)) return 'human_help';
  if (containsAny(norm, WHATSAPP)) return 'whatsapp_handoff';
  if (containsAny(norm, VISIT)) return 'request_visit';

  if (detectFaqTopic(norm)) return 'ask_faq';
  if (containsAny(norm, COMPARE)) return 'compare_or_recommend';

  if (containsAny(norm, PROJECTS)) return 'search_projects';

  // A concrete property type or a known city is itself a search (so a bare
  // "جدة" or "شقة" starts/continues the guided search instead of falling through).
  if (extractPropertyType(norm) !== undefined || extractCity(norm) !== undefined) return 'search_units';

  // No concrete type/city: a request for info/details outranks generic search verbs.
  if (containsAny(norm, INFO)) return 'request_info';
  if (containsAny(norm, SEARCH)) return 'search_units';

  // Short pleasantries with no other signal.
  if (containsAny(norm, GREETING)) return 'greeting';

  // Inside an active search, treat the turn as a slot answer (e.g. a city name).
  if (hasActiveSearch) return 'search_units';

  return 'unknown';
}

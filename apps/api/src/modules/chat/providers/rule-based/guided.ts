/**
 * Generalized "guided" action layer. Instead of matching exact phrases, we
 * group many vague/natural Arabic expressions into a few broad ACTION classes
 * so the assistant can always respond with real catalog options (cities, types,
 * budget ranges) rather than repeating a question or failing.
 *
 * Detection is deterministic keyword-group matching over normalized text — no
 * LLM, no external calls. The provider decides what each action does in context
 * (e.g. "مش عارف" while the city is pending → show the available cities).
 */

import { containsAny } from './normalize';

export type GuidedAction =
  | 'START_OVER'
  | 'CONTACT_CONSULTANT'
  | 'SHOW_ALL_IN_CITY'
  | 'RELAX_BUDGET'
  | 'RELAX_TYPE'
  | 'SHOW_AVAILABLE_CITIES'
  | 'SHOW_AVAILABLE_TYPES'
  | 'HELP_ME_CHOOSE'
  | 'RECOMMEND'
  | 'SHOW_OPTIONS';

// Order matters: the first group that matches wins. More specific groups
// (start-over, available-cities/types) are checked before broad ones (options).
const GROUPS: Array<{ action: GuidedAction; words: readonly string[] }> = [
  { action: 'START_OVER', words: ['ابدا من جديد', 'من الاول', 'بحث جديد', 'من البدايه', 'ابدا تاني', 'ريسيت', 'reset', 'start over', 'new search'] },
  { action: 'CONTACT_CONSULTANT', words: ['تواصل مع مستشار', 'اتكلم مع مستشار', 'وصلني بمستشار', 'كلموني'] },
  { action: 'SHOW_ALL_IN_CITY', words: ['كل الوحدات', 'كل العقارات', 'كل المتاح', 'اعرض الكل', 'عرض الكل', 'وريني الكل'] },
  { action: 'RELAX_BUDGET', words: ['بدون ميزانيه', 'من غير ميزانيه', 'الغي الميزانيه', 'شيل الميزانيه', 'اي ميزانيه', 'remove budget', 'no budget'] },
  { action: 'RELAX_TYPE', words: ['اي نوع', 'بدون نوع', 'مش مهم النوع', 'اي نوع وحده', 'any type'] },
  { action: 'SHOW_AVAILABLE_CITIES', words: ['المناطق المتاحه', 'المدن المتاحه', 'اي المناطق', 'اي المدن', 'اي مناطق', 'اي مدن', 'انهي مدن', 'المناطق', 'المدن', 'available cities'] },
  { action: 'SHOW_AVAILABLE_TYPES', words: ['الانواع المتاحه', 'اي الانواع', 'انواع الوحدات', 'اي نوع متاح', 'الانواع', 'available types'] },
  { action: 'HELP_ME_CHOOSE', words: ['مش عارف', 'مش عارفه', 'معرفش', 'اختارلي', 'اختار لي', 'اختار منين', 'ساعدني', 'ساعدنى', 'شوفلي', 'شوف لي', 'اللي يناسبني', 'مكان حلو', 'مكان كويس', 'حاجه حلوه', 'اي حاجه كويسه', 'اي حاجه', 'help me', 'choose for me'] },
  { action: 'RECOMMEND', words: ['رشحلي', 'رشح لي', 'اقترحلي', 'اقترح', 'نصحني', 'المناسب', 'يناسبني', 'الافضل', 'افضل حاجه', 'recommend'] },
  { action: 'SHOW_OPTIONS', words: ['ايه المتاح', 'اي المتاح', 'المتاح عندكم', 'الخيارات', 'اعرض الخيارات', 'وريني', 'ايه عندكو', 'ايه عندكم', 'عندكم ايه', 'show options', 'options'] },
];

/** Map vague/natural text to a broad guided action, or null if none applies. */
export function detectGuidedAction(norm: string): GuidedAction | null {
  for (const g of GROUPS) {
    if (containsAny(norm, g.words)) return g.action;
  }
  return null;
}

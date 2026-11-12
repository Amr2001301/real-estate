import { AR_ERROR_MESSAGES } from './error-messages.ar';

/**
 * Arabic for the API's English error messages (F-023). The messages stay English in the source (and in
 * the tests); a client that asks for Arabic (`Accept-Language: ar`) gets them through `translateErrorMessage`.
 */

type Rule = { re: RegExp; ar: string };

/** `${…}` markers in a source template, with nested braces (`${[...a].join(', ')}`) handled. */
function templateParts(key: string): string[] {
  const parts: string[] = [];
  let literal = '';
  let i = 0;
  while (i < key.length) {
    if (key.startsWith('${', i)) {
      let depth = 1;
      let j = i + 2;
      while (j < key.length && depth > 0) {
        if (key[j] === '{') depth++;
        else if (key[j] === '}') depth--;
        j++;
      }
      parts.push(literal, '\u0000');
      literal = '';
      i = j;
    } else {
      literal += key[i];
      i++;
    }
  }
  parts.push(literal);
  return parts;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ruleFor(key: string, ar: string): Rule {
  const body = templateParts(key)
    .map((p) => (p === '\u0000' ? '([\\s\\S]*?)' : escapeRe(p)))
    .join('');
  return { re: new RegExp(`^${body}$`), ar };
}

/** What Nest and its guards say when the code gave no message of its own. */
const FRAMEWORK_DEFAULTS: ReadonlyArray<readonly [string, string]> = [
  ['Unauthorized', 'غير مصرّح، سجّل الدخول أولاً'],
  ['Forbidden', 'ليست لديك صلاحية الوصول إلى هذا المورد'],
  ['Forbidden resource', 'ليست لديك صلاحية الوصول إلى هذا المورد'],
  ['Bad Request', 'الطلب غير صالح'],
  ['Bad Request Exception', 'الطلب غير صالح'],
  ['Not Found', 'غير موجود'],
  ['Conflict', 'تعارض مع حالة حالية'],
  ['Internal server error', 'حدث خطأ غير متوقع، حاول مرة أخرى'],
  ['Service Unavailable', 'الخدمة غير متاحة حالياً، حاول بعد قليل'],
  ['ThrottlerException: Too Many Requests', 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى'],
  ['Too Many Requests', 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى'],
  ['request entity too large', 'حجم الطلب أكبر من المسموح'],
  ['Payload Too Large', 'حجم الطلب أكبر من المسموح'],
];

const EXACT = new Map<string, string>(FRAMEWORK_DEFAULTS);
const TEMPLATES: Rule[] = [];
for (const [key, ar] of AR_ERROR_MESSAGES) {
  if (key.includes('${')) TEMPLATES.push(ruleFor(key, ar));
  else EXACT.set(key, ar);
}
// The most specific (longest literal) template wins.
TEMPLATES.sort((a, b) => b.re.source.length - a.re.source.length);

/** What class-validator says by default (a DTO without its own message). The field name stays as written. */
const VALIDATOR_RULES: Rule[] = [
  [/^(\S+) must be a string$/, '{1} يجب أن يكون نصاً'],
  [/^(\S+) should not be empty$/, '{1} لا يجوز أن يكون فارغاً'],
  [/^(\S+) must be a number conforming to the specified constraints$/, '{1} يجب أن يكون رقماً صالحاً'],
  [/^(\S+) must be an integer number$/, '{1} يجب أن يكون عدداً صحيحاً'],
  [/^(\S+) must be a positive number$/, '{1} يجب أن يكون رقماً موجباً'],
  [/^(\S+) must be a negative number$/, '{1} يجب أن يكون رقماً سالباً'],
  [/^(\S+) must be a UUID$/, '{1} يجب أن يكون معرّفاً (UUID) صالحاً'],
  [/^(\S+) must be an email$/, '{1} يجب أن يكون بريداً إلكترونياً صالحاً'],
  [/^(\S+) must be a URL address$/, '{1} يجب أن يكون رابطاً صالحاً'],
  [/^(\S+) must be a boolean value$/, '{1} يجب أن يكون قيمة منطقية (صح أو خطأ)'],
  [/^(\S+) must be a valid ISO 8601 date string$/, '{1} يجب أن يكون تاريخاً صالحاً بصيغة ISO 8601'],
  [/^(\S+) must be a Date instance$/, '{1} يجب أن يكون تاريخاً صالحاً'],
  [/^(\S+) must be an array$/, '{1} يجب أن يكون قائمة'],
  [/^(\S+) must be an object$/, '{1} يجب أن يكون كائناً'],
  [/^(\S+) must not be less than (-?[\d.]+)$/, '{1} يجب ألا يقل عن {2}'],
  [/^(\S+) must not be greater than (-?[\d.]+)$/, '{1} يجب ألا يزيد عن {2}'],
  [/^(\S+) must be longer than or equal to (\d+) characters$/, '{1} يجب ألا يقل طوله عن {2} حرفاً'],
  [/^(\S+) must be shorter than or equal to (\d+) characters$/, '{1} يجب ألا يزيد طوله عن {2} حرفاً'],
  [/^(\S+) must contain at least (\d+) elements$/, '{1} يجب أن يحتوي على {2} عناصر على الأقل'],
  [/^(\S+) must contain no more than (\d+) elements$/, '{1} يجب ألا يحتوي على أكثر من {2} عنصراً'],
  [/^(\S+) must be one of the following values: ([\s\S]+)$/, '{1} يجب أن يكون واحداً من: {2}'],
  [/^(\S+) must be a number string$/, '{1} يجب أن يكون نصاً رقمياً'],
  [/^(\S+) must match (.+) regular expression$/, '{1} بصيغة غير صالحة'],
  [/^property (\S+) should not exist$/, 'الحقل {1} غير مسموح به'],
  [/^(\S+)\.property (\S+) should not exist$/, 'الحقل {1}.{2} غير مسموح به'],
  [/^nested property (\S+) must be either object or array$/, '{1} يجب أن يكون كائناً أو قائمة'],
].map(([re, ar]) => ({ re: re as RegExp, ar: ar as string }));

const fill = (ar: string, m: RegExpExecArray) => ar.replace(/\{(\d+)\}/g, (_x, n: string) => m[Number(n)] ?? '');

/** The Arabic for one English message, or the message itself when the catalogue has none. */
export function translateErrorMessage(message: string): string {
  const exact = EXACT.get(message);
  if (exact !== undefined) return exact;
  for (const r of TEMPLATES) {
    const m = r.re.exec(message);
    if (m) return fill(r.ar, m);
  }
  for (const r of VALIDATOR_RULES) {
    const m = r.re.exec(message);
    if (m) return fill(r.ar, m);
  }
  return message;
}

/** The catalogue's English keys, for the coverage test. */
export function catalogueKeys(): string[] {
  return AR_ERROR_MESSAGES.map(([k]) => k);
}

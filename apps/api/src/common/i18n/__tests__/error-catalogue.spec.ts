import * as fs from 'fs';
import * as path from 'path';
import { catalogueKeys, translateErrorMessage } from '../error-catalogue';
import { UNTRANSLATABLE_ERROR_MESSAGES } from '../error-messages.ar';

describe('translateErrorMessage', () => {
  it('translates a fixed message', () => {
    expect(translateErrorMessage('Commission is already approved')).toBe('العمولة معتمدة بالفعل');
    expect(translateErrorMessage('Invalid credentials')).toBe('بيانات الدخول غير صحيحة');
  });

  it('fills the varying parts of a message in order', () => {
    expect(translateErrorMessage('Template no_such_template not found')).toBe('القالب no_such_template غير موجود');
    expect(translateErrorMessage('Cannot confirm an appointment in status: COMPLETED')).toBe('لا يمكن تأكيد موعد حالته COMPLETED');
    expect(translateErrorMessage('Invalid transition: PENDING → DONE. Allowed: APPROVED, REJECTED')).toBe(
      'انتقال غير مسموح: PENDING ← DONE. المسموح: APPROVED, REJECTED',
    );
    expect(translateErrorMessage('Unit limit reached. Your plan allows 5 units; you currently have 5. Upgrade your plan or contact support to add more.')).toContain(
      'بلغتَ حد الوحدات. تسمح باقتك بـ5 وحدة وعندك حالياً 5',
    );
  });

  it("translates class-validator's own wording, keeping the field name", () => {
    expect(translateErrorMessage('amount must not be less than 0.01')).toBe('amount يجب ألا يقل عن 0.01');
    expect(translateErrorMessage('name must be longer than or equal to 2 characters')).toBe('name يجب ألا يقل طوله عن 2 حرفاً');
    expect(translateErrorMessage('email must be an email')).toBe('email يجب أن يكون بريداً إلكترونياً صالحاً');
    expect(translateErrorMessage('property sms should not exist')).toBe('الحقل sms غير مسموح به');
    expect(translateErrorMessage('status must be one of the following values: A, B')).toBe('status يجب أن يكون واحداً من: A, B');
  });

  it("translates the framework's default messages", () => {
    expect(translateErrorMessage('Unauthorized')).toBe('غير مصرّح، سجّل الدخول أولاً');
    expect(translateErrorMessage('Forbidden resource')).toBe('ليست لديك صلاحية الوصول إلى هذا المورد');
    expect(translateErrorMessage('ThrottlerException: Too Many Requests')).toContain('محاولات كثيرة');
  });

  it('leaves Arabic and unknown messages as they are', () => {
    expect(translateErrorMessage('الصفحة غير موجودة')).toBe('الصفحة غير موجودة');
    expect(translateErrorMessage('Something nobody wrote down')).toBe('Something nobody wrote down');
  });

  it('does not let a short template swallow unrelated messages', () => {
    expect(translateErrorMessage('Two words')).toBe('Two words');
  });
});

/**
 * The policy behind F-023: an English message thrown by the API needs its Arabic in `error-messages.ar.ts`.
 * This reads the source the way the catalogue was made and fails on a message with no entry.
 */
const STR = String.raw`(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|` + '`(?:[^`\\\\]|\\\\.)*`)';
const JOINED = `${STR}(?:\\s*\\+\\s*${STR})*`;
const EXCEPTION = new RegExp(
  `new\\s+(?:BadRequest|NotFound|Forbidden|Conflict|Unauthorized|ServiceUnavailable|UnprocessableEntity|Gone|PayloadTooLarge|NotAcceptable|HttpException)[A-Za-z]*\\(\\s*(${JOINED})`,
  'gs',
);
const MESSAGE_KEY = new RegExp(`\\bmessage:\\s*(${JOINED})`, 'gs');

function joinLiterals(raw: string): string {
  const parts = [...raw.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/gs)];
  return parts.map((m) => m[1] ?? m[2] ?? m[3] ?? '').join('').replace(/\\'/g, "'").replace(/\\n/g, ' ');
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('every English error message has its Arabic (F-023)', () => {
  const known = new Set<string>([...catalogueKeys(), ...UNTRANSLATABLE_ERROR_MESSAGES]);
  const english: Array<{ message: string; file: string }> = [];
  for (const file of sourceFiles(path.join(__dirname, '..', '..', '..'))) {
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const re of [EXCEPTION, MESSAGE_KEY]) {
      for (const m of src.matchAll(re)) {
        const message = joinLiterals(m[1]!);
        if (/[A-Za-z]{3}/.test(message) && !/[؀-ۿ]/.test(message)) english.push({ message, file: path.relative(process.cwd(), file) });
      }
    }
  }

  it('found the messages to check', () => {
    expect(english.length).toBeGreaterThan(300);
  });

  it('has an entry for each of them', () => {
    const missing = english.filter((e) => !known.has(e.message) && translateErrorMessage(e.message) === e.message);
    expect(missing.map((e) => `${e.file}: ${e.message}`)).toEqual([]);
  });
});

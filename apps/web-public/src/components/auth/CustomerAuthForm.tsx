'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus } from 'lucide-react';
import { safePost } from '@/lib/api';
import { saveSession, type AuthResponse } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

type Mode = 'login' | 'register';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const REDIRECT = routes.projects; // TODO: customer dashboard once the portal exists (W10+).

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة'];
const INTERESTS = [
  { value: 'apartment', label: 'شقة' },
  { value: 'villa', label: 'فيلا' },
  { value: 'townhouse', label: 'تاون هاوس' },
  { value: 'commercial', label: 'تجاري' },
  { value: 'investment', label: 'استثمار' },
];
const BUDGETS = [
  { value: '0-1m', label: 'حتى مليون' },
  { value: '1m-2m', label: 'مليون – مليونان' },
  { value: '2m-5m', label: 'مليونان – ٥ ملايين' },
  { value: '5m+', label: 'أكثر من ٥ ملايين' },
];
const CONTACT_METHODS = [
  { value: 'phone', label: 'مكالمة هاتفية' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'email', label: 'بريد إلكتروني' },
];

function mapLoginError(status: number, code?: string): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if (code === 'not_customer') return 'هذا الحساب غير مخصص لاستخدام الموقع العام.';
  if (status === 401 || status === 403) return 'بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.';
  return 'حدث خطأ أثناء تنفيذ الطلب. يرجى المحاولة مرة أخرى.';
}

function mapRegisterError(status: number, code?: string): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if (code === 'email_taken') return 'يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.';
  if (code === 'phone_taken') return 'يوجد حساب مسجل بهذا الرقم بالفعل.';
  if (status === 400) return 'برجاء مراجعة البيانات المطلوبة.';
  return 'تعذر إنشاء الحساب حاليًا. حاول مرة أخرى بعد لحظات.';
}

export function CustomerAuthForm({
  mode,
  onUseOtp,
}: {
  mode: Mode;
  onUseOtp?: () => void;
}) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [pending, setPending] = useState(false);
  const [topError, setTopError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [city, setCity] = useState('');
  const [interestType, setInterestType] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('');
  const [terms, setTerms] = useState(false);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!email.trim() || !EMAIL_RE.test(email.trim())) e.email = 'صيغة البريد الإلكتروني غير صحيحة.';
    if (password.length < 8) e.password = 'كلمة المرور يجب ألا تقل عن ٨ أحرف.';
    if (isRegister) {
      if (fullName.trim().length < 2) e.fullName = 'يرجى إدخال الاسم الكامل.';
      if (!PHONE_RE.test(phone.trim().replace(/[\s-]/g, ''))) e.phone = 'يرجى إدخال رقم جوال صحيح بصيغة دولية، مثال: +9665XXXXXXXX';
      if (confirm !== password) e.confirm = 'كلمتا المرور غير متطابقتين.';
      if (!terms) e.terms = 'يرجى الموافقة على الشروط والأحكام.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setPending(true);
    setTopError('');

    const res = isRegister
      ? await safePost<AuthResponse>('/auth/customer/register', {
          fullName: fullName.trim(),
          phone: phone.trim().replace(/[\s-]/g, ''),
          email: email.trim(),
          password,
          acceptTerms: true,
          ...(city ? { city } : {}),
          ...(interestType ? { interestType } : {}),
          ...(budgetRange ? { budgetRange } : {}),
          ...(preferredContactMethod ? { preferredContactMethod } : {}),
        })
      : await safePost<AuthResponse>('/auth/customer/login', {
          email: email.trim(),
          password,
        });

    setPending(false);
    if (res.ok) {
      saveSession(res.data);
      router.push(REDIRECT as never);
    } else {
      setTopError(
        isRegister
          ? mapRegisterError(res.error.status, res.error.code)
          : mapLoginError(res.error.status, res.error.code),
      );
    }
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <h2 className="hidden text-2xl text-navy lg:block">
        {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {isRegister && (
          <>
            <p className="text-sm font-semibold text-gold-600">بيانات الحساب</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="الاسم الكامل" required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={!!errors.fullName} placeholder="مثال: محمد الأحمد" autoComplete="name" />
                <FormError>{errors.fullName}</FormError>
              </Field>
              <Field label="رقم الجوال" required>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} placeholder="+9665XXXXXXXX" inputMode="tel" dir="ltr" autoComplete="tel" />
                <FormError>{errors.phone}</FormError>
              </Field>
            </div>
          </>
        )}

        <Field label="البريد الإلكتروني" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} placeholder="you@example.com" dir="ltr" autoComplete="email" />
          <FormError>{errors.email}</FormError>
        </Field>

        <div className={isRegister ? 'grid gap-5 sm:grid-cols-2' : ''}>
          <Field label="كلمة المرور" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} placeholder="٨ أحرف على الأقل" autoComplete={isRegister ? 'new-password' : 'current-password'} />
            <FormError>{errors.password}</FormError>
          </Field>
          {isRegister && (
            <Field label="تأكيد كلمة المرور" required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirm} placeholder="أعد إدخال كلمة المرور" autoComplete="new-password" />
              <FormError>{errors.confirm}</FormError>
            </Field>
          )}
        </div>

        {isRegister && (
          <>
            <p className="pt-2 text-sm font-semibold text-gold-600">تفضيلاتك العقارية <span className="font-normal text-ink-muted">(اختياري)</span></p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="المدينة">
                <Select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">اختر المدينة</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="نوع الاهتمام">
                <Select value={interestType} onChange={(e) => setInterestType(e.target.value)}>
                  <option value="">اختر النوع</option>
                  {INTERESTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </Select>
              </Field>
              <Field label="نطاق الميزانية">
                <Select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}>
                  <option value="">اختر النطاق</option>
                  {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </Select>
              </Field>
              <Field label="طريقة التواصل المفضلة">
                <Select value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value)}>
                  <option value="">اختر الطريقة</option>
                  {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
            </div>

            <div>
              <label className="flex items-start gap-3 text-sm text-ink-muted">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 rounded-md border-hairline text-gold-500 focus:ring-gold-400/40" />
                <span>
                  أوافق على{' '}
                  <a href={routes.terms} className="text-navy underline-offset-4 hover:underline">الشروط والأحكام</a>{' '}
                  و{' '}
                  <a href={routes.privacy} className="text-navy underline-offset-4 hover:underline">سياسة الخصوصية</a>.
                </span>
              </label>
              <FormError>{errors.terms}</FormError>
            </div>
          </>
        )}

        {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (isRegister ? 'جارٍ الإنشاء...' : 'جارٍ الدخول...') : (
            <>
              {isRegister ? <UserPlus className="h-5 w-5" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
              {isRegister ? 'إنشاء الحساب' : 'دخول إلى الحساب'}
            </>
          )}
        </Button>

        {!isRegister && onUseOtp && (
          <button type="button" onClick={onUseOtp} className="block w-full text-center text-sm text-ink-muted transition-colors hover:text-navy">
            الدخول برقم الجوال بدلاً من ذلك
          </button>
        )}
      </form>
    </PremiumCard>
  );
}

'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Phone, KeyRound, ArrowRight } from 'lucide-react';
import { safePost } from '@/lib/api';
import { otpVerifyAction } from '@/lib/auth-actions';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

type Mode = 'login' | 'register';
type Step = 'request' | 'verify';

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s-]/g, '');
  return trimmed;
}

/** Read a post-login `from` hint from the URL at submit time (re-validated server-side). */
function readFrom(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('from') ?? undefined;
}

function mapRequestError(status: number): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if (status === 429) return 'محاولات كثيرة. يرجى الانتظار قليلًا قبل المحاولة مجددًا.';
  if (status === 400) return 'تعذر إرسال الرمز. تأكد من رقم الهاتف ثم حاول مرة أخرى.';
  return 'حدث خطأ أثناء إرسال الرمز. يرجى المحاولة مرة أخرى.';
}

function mapVerifyError(status: number): string {
  if (status === 0) return 'تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.';
  if (status === 401) return 'الرمز غير صحيح. تأكد من الرمز المُرسل إلى هاتفك.';
  if (status === 400) return 'انتهت صلاحية الرمز أو لم نعثر عليه. اطلب رمزًا جديدًا.';
  if (status === 403) return 'محاولات كثيرة. اطلب رمزًا جديدًا.';
  return 'حدث خطأ أثناء التحقق. يرجى المحاولة مرة أخرى.';
}

export function OtpAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [pending, setPending] = useState(false);
  const [topError, setTopError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState('');

  const isRegister = mode === 'register';

  async function onRequest(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (isRegister && fullName.trim().length < 2) e.fullName = 'يرجى إدخال الاسم الكامل.';
    const normalized = normalizePhone(phone);
    if (!normalized) e.phone = 'يرجى إدخال رقم الهاتف.';
    else if (!PHONE_RE.test(normalized)) e.phone = 'يرجى إدخال رقم هاتف صحيح بصيغة دولية، مثال: +9665XXXXXXXX';
    if (isRegister && !terms) e.terms = 'يرجى الموافقة على الشروط والأحكام.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setPending(true);
    setTopError('');
    const res = await safePost('/auth/otp/request', { phone: normalized });
    setPending(false);
    if (res.ok) {
      setStep('verify');
    } else {
      setTopError(mapRequestError(res.error.status));
    }
  }

  async function onVerify(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!/^\d{6}$/.test(code.trim())) e.code = 'الرمز مكوّن من ٦ أرقام.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setPending(true);
    setTopError('');
    const res = await otpVerifyAction({
      phone: normalizePhone(phone),
      code: code.trim(),
      ...(isRegister && fullName.trim() ? { fullName: fullName.trim() } : {}),
      from: readFrom(),
    });
    if (res.ok) {
      // Cookies set by the server action; navigate + refresh for server components.
      router.push(res.redirectTo as Route);
      router.refresh();
    } else {
      setPending(false);
      setTopError(mapVerifyError(res.status));
    }
  }

  async function resend() {
    setPending(true);
    setTopError('');
    const res = await safePost('/auth/otp/request', { phone: normalizePhone(phone) });
    setPending(false);
    if (!res.ok) setTopError(mapRequestError(res.error.status));
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <h2 className="hidden text-2xl text-ink-strong lg:block">
        {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
      </h2>

      {step === 'request' ? (
        <form onSubmit={onRequest} noValidate className="mt-6 space-y-5">
          {isRegister && (
            <Field label="الاسم الكامل" required>
              <Input
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                invalid={!!errors.fullName}
                placeholder="مثال: محمد الأحمد"
                autoComplete="name"
              />
              <FormError>{errors.fullName}</FormError>
            </Field>
          )}

          <Field label="رقم الهاتف" required>
            <Input
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              invalid={!!errors.phone}
              placeholder="+9665XXXXXXXX"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
            />
            <FormError>{errors.phone}</FormError>
          </Field>

          {isRegister && (
            <div>
              <label className="flex items-start gap-3 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(ev) => setTerms(ev.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded-md border-hairline text-gold-500 focus:ring-gold-400/40"
                />
                <span>
                  أوافق على{' '}
                  <a href={routes.terms} className="text-ink-strong underline-offset-4 hover:underline">الشروط والأحكام</a>{' '}
                  و{' '}
                  <a href={routes.privacy} className="text-ink-strong underline-offset-4 hover:underline">سياسة الخصوصية</a>.
                </span>
              </label>
              <FormError>{errors.terms}</FormError>
            </div>
          )}

          {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'جارٍ الإرسال...' : (
              <>
                <Phone className="h-5 w-5" aria-hidden />
                إرسال رمز التحقق
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} noValidate className="mt-6 space-y-5">
          <p className="text-sm text-ink-muted">
            أدخل رمز التحقق المكوّن من ٦ أرقام المُرسل إلى <span dir="ltr" className="font-medium text-ink-strong">{normalizePhone(phone)}</span>.
          </p>

          <Field label="رمز التحقق" required>
            <Input
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
              invalid={!!errors.code}
              placeholder="٦ أرقام"
              inputMode="numeric"
              dir="ltr"
              autoComplete="one-time-code"
            />
            <FormError>{errors.code}</FormError>
          </Field>

          {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'جارٍ التحقق...' : (
              <>
                <KeyRound className="h-5 w-5" aria-hidden />
                {isRegister ? 'إنشاء الحساب' : 'دخول إلى الحساب'}
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={resend} disabled={pending} className="text-ink-strong hover:text-gold-600 disabled:opacity-50">
              إعادة إرسال الرمز
            </button>
            <button
              type="button"
              onClick={() => { setStep('request'); setCode(''); setTopError(''); setErrors({}); }}
              className="inline-flex items-center gap-1 text-ink-muted hover:text-ink-strong"
            >
              تغيير الرقم
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </form>
      )}
    </PremiumCard>
  );
}

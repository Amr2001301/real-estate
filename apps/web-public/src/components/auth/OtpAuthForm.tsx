'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Phone, KeyRound, ArrowRight } from 'lucide-react';
import { otpRequestAction, otpVerifyAction } from '@/lib/auth-actions';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

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

type AuthText = ReturnType<typeof authT>;

function mapRequestError(t: AuthText, status: number): string {
  if (status === 0) return t.common.offline;
  if (status === 429) return t.otp.requestTooMany;
  if (status === 400) return t.otp.requestBad;
  return t.otp.requestFailed;
}

function mapVerifyError(t: AuthText, status: number): string {
  if (status === 0) return t.common.offline;
  if (status === 401) return t.otp.verifyWrong;
  if (status === 400) return t.otp.verifyExpired;
  if (status === 403) return t.otp.verifyTooMany;
  return t.otp.verifyFailed;
}

export function OtpAuthForm({ mode, locale = 'ar' }: { mode: Mode; locale?: Locale }) {
  const t = authT(locale);
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
    if (isRegister && fullName.trim().length < 2) e.fullName = t.common.fullNameRequired;
    const normalized = normalizePhone(phone);
    if (!normalized) e.phone = t.otp.phoneRequired;
    else if (!PHONE_RE.test(normalized)) e.phone = t.otp.phoneInvalid;
    if (isRegister && !terms) e.terms = t.common.termsRequired;
    setErrors(e);
    if (Object.keys(e).length) return;

    setPending(true);
    setTopError('');
    const res = await otpRequestAction(normalized);
    setPending(false);
    if (res.ok) {
      setStep('verify');
    } else {
      setTopError(mapRequestError(t, res.status));
    }
  }

  async function onVerify(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!/^\d{6}$/.test(code.trim())) e.code = t.otp.codeInvalid;
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
      setTopError(mapVerifyError(t, res.status));
    }
  }

  async function resend() {
    setPending(true);
    setTopError('');
    const res = await otpRequestAction(normalizePhone(phone));
    setPending(false);
    if (!res.ok) setTopError(mapRequestError(t, res.status));
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <h2 className="hidden text-2xl text-ink-strong lg:block">
        {isRegister ? t.common.createAccount : t.common.signIn}
      </h2>

      {step === 'request' ? (
        <form onSubmit={onRequest} noValidate className="mt-6 space-y-5">
          {isRegister && (
            <Field label={t.common.fullNameLabel} required>
              <Input
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                invalid={!!errors.fullName}
                placeholder={t.common.fullNameExample}
                autoComplete="name"
              />
              <FormError>{errors.fullName}</FormError>
            </Field>
          )}

          <Field label={t.otp.phoneLabel} required>
            <Input
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              invalid={!!errors.phone}
              placeholder="+2010XXXXXXXX"
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
                  {t.common.iAgree}{' '}
                  <a href={routes.terms} className="text-ink-strong underline-offset-4 hover:underline">{t.common.terms}</a>{' '}
                  {t.common.and}{' '}
                  <a href={routes.privacy} className="text-ink-strong underline-offset-4 hover:underline">{t.common.privacy}</a>.
                </span>
              </label>
              <FormError>{errors.terms}</FormError>
            </div>
          )}

          {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? t.otp.sending : (
              <>
                <Phone className="h-5 w-5" aria-hidden />
                {t.otp.sendCode}
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={onVerify} noValidate className="mt-6 space-y-5">
          <p className="text-sm text-ink-muted">
            {t.otp.enterCode} <span dir="ltr" className="font-medium text-ink-strong">{normalizePhone(phone)}</span>.
          </p>

          <Field label={t.otp.codeLabel} required>
            <Input
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
              invalid={!!errors.code}
              placeholder={t.otp.codeHint}
              inputMode="numeric"
              dir="ltr"
              autoComplete="one-time-code"
            />
            <FormError>{errors.code}</FormError>
          </Field>

          {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? t.otp.verifying : (
              <>
                <KeyRound className="h-5 w-5" aria-hidden />
                {isRegister ? t.common.createAccountBtn : t.common.signInBtn}
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={resend} disabled={pending} className="text-ink-strong hover:text-gold-600 disabled:opacity-50">
              {t.otp.resend}
            </button>
            <button
              type="button"
              onClick={() => { setStep('request'); setCode(''); setTopError(''); setErrors({}); }}
              className="inline-flex items-center gap-1 text-ink-muted hover:text-ink-strong"
            >
              {t.otp.changeNumber}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </form>
      )}
    </PremiumCard>
  );
}

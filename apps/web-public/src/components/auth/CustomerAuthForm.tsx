'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, MailCheck } from 'lucide-react';
import { customerLoginAction, customerRegisterAction } from '@/lib/auth-actions';
import { trackEvent } from '@/lib/analytics';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

type Mode = 'login' | 'register';
type Step = 'form' | 'check-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

/**
 * Read a post-login `from` target from the current URL (client-only, at submit
 * time — avoids a useSearchParams Suspense boundary). The server action
 * re-validates it stays inside /account, so this is only a hint.
 */
function readFrom(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('from') ?? undefined;
}

type AuthText = ReturnType<typeof authT>;

function mapLoginError(t: AuthText, status: number, code?: string): string {
  if (status === 0) return t.common.offline;
  if (code === 'not_customer') return t.login.notCustomer;
  if (status === 401 || status === 403) return t.login.badCredentials;
  return t.common.genericError;
}

function mapRegisterError(t: AuthText, status: number, code?: string): string {
  if (status === 0) return t.common.offline;
  if (code === 'email_taken') return t.register.emailTaken;
  if (code === 'phone_taken') return t.register.phoneTaken;
  if (code === 'account_exists_verify') return t.register.accountExists;
  if (status === 400) return t.register.reviewData;
  return t.register.createFailed;
}

export function CustomerAuthForm({
  mode,
  onUseOtp,
  locale = 'ar',
}: {
  mode: Mode;
  onUseOtp?: () => void;
  locale?: Locale;
}) {
  const t = authT(locale);
  const router = useRouter();
  const isRegister = mode === 'register';
  const [step, setStep] = useState<Step>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');
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
    if (!email.trim() || !EMAIL_RE.test(email.trim())) e.email = t.common.emailInvalid;
    if (password.length < 8) e.password = t.common.passwordMin;
    if (isRegister) {
      if (fullName.trim().length < 2) e.fullName = t.common.fullNameRequired;
      if (!PHONE_RE.test(phone.trim().replace(/[\s-]/g, ''))) e.phone = t.register.phoneInvalid;
      if (confirm !== password) e.confirm = t.common.passwordMismatch;
      if (!terms) e.terms = t.common.termsRequired;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setPending(true);
    setTopError('');

    const from = readFrom();
    const res = isRegister
      ? await customerRegisterAction({
          fullName: fullName.trim(),
          phone: phone.trim().replace(/[\s-]/g, ''),
          email: email.trim(),
          password,
          acceptTerms: terms,
          ...(city ? { city } : {}),
          ...(interestType ? { interestType } : {}),
          ...(budgetRange ? { budgetRange } : {}),
          ...(preferredContactMethod ? { preferredContactMethod } : {}),
          from,
        })
      : await customerLoginAction({ email: email.trim(), password, from });

    if (res.ok) {
      if (isRegister) {
        trackEvent('sign_up_complete');
        setRegisteredEmail(email.trim());
        setPending(false);
        setStep('check-email');
        return;
      }
      trackEvent('login_complete');
      // Login: cookies already set; navigate and refresh so server components
      // pick up the new session. Tokens never touch JS here.
      router.push(res.redirectTo as Route);
      router.refresh();
    } else {
      setPending(false);
      setTopError(
        isRegister
          ? mapRegisterError(t, res.status, res.code)
          : mapLoginError(t, res.status, res.code),
      );
    }
  }

  if (step === 'check-email') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <MailCheck className="h-14 w-14 text-gold-500" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">{t.register.doneTitle}</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          {t.register.doneBefore}{' '}
          <span className="font-medium text-ink-strong" dir="ltr">{registeredEmail}</span>.
          {' '}{t.register.doneAfter}
        </p>
        <button
          type="button"
          onClick={() => { router.push(routes.account as Route); router.refresh(); }}
          className="mt-2 w-full rounded-full bg-navy px-8 py-3.5 text-base font-medium tracking-tight text-white transition-all hover:-translate-y-0.5 hover:bg-navy-700"
        >
          {t.common.goToAccount}
        </button>
        <p className="text-xs text-ink-muted">
          {t.register.noMail}{' '}
          <a href={routes.accountProfile} className="underline underline-offset-4 hover:text-ink-strong">
            {t.register.resendFromProfile}
          </a>.
        </p>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <h2 className="hidden text-2xl text-ink-strong lg:block">
        {isRegister ? t.common.createAccount : t.common.signIn}
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {isRegister && (
          <>
            <p className="text-sm font-semibold text-gold-600">{t.register.accountData}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.common.fullNameLabel} required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={!!errors.fullName} placeholder={t.common.fullNameExample} autoComplete="name" />
                <FormError>{errors.fullName}</FormError>
              </Field>
              <Field label={t.register.phoneLabel} required>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} placeholder="+2010XXXXXXXX" inputMode="tel" dir="ltr" autoComplete="tel" />
                <FormError>{errors.phone}</FormError>
              </Field>
            </div>
          </>
        )}

        <Field label={t.common.emailLabel} required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} placeholder="you@example.com" dir="ltr" autoComplete="email" />
          <FormError>{errors.email}</FormError>
        </Field>

        <div className={isRegister ? 'grid gap-5 sm:grid-cols-2' : ''}>
          <Field label={t.register.passwordLabel} required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} placeholder={t.register.passwordHint} autoComplete={isRegister ? 'new-password' : 'current-password'} />
            <FormError>{errors.password}</FormError>
          </Field>
          {isRegister && (
            <Field label={t.register.confirmLabel} required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirm} placeholder={t.register.confirmHint} autoComplete="new-password" />
              <FormError>{errors.confirm}</FormError>
            </Field>
          )}
        </div>

        {isRegister && (
          <>
            <p className="pt-2 text-sm font-semibold text-gold-600">{t.register.prefs} <span className="font-normal text-ink-muted">{t.register.optional}</span></p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.register.city}>
                {/* Free text: a fixed list offered Saudi cities to every company (F37). */}
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.register.cityExample} maxLength={80} />
              </Field>
              <Field label={t.register.interest}>
                <Select value={interestType} onChange={(e) => setInterestType(e.target.value)}>
                  <option value="">{t.register.pickType}</option>
                  {Object.entries(t.register.interests).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </Select>
              </Field>
              <Field label={t.register.budget}>
                <Select value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}>
                  <option value="">{t.register.pickRange}</option>
                  {Object.entries(t.register.budgets).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </Select>
              </Field>
              <Field label={t.register.contactMethod}>
                <Select value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value)}>
                  <option value="">{t.register.pickMethod}</option>
                  {Object.entries(t.register.methods).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </Select>
              </Field>
            </div>

            <div>
              <label className="flex items-start gap-3 text-sm text-ink-muted">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 rounded-md border-hairline text-gold-500 focus:ring-gold-400/40" />
                <span>
                  {t.common.iAgree}{' '}
                  <a href={routes.terms} className="text-ink-strong underline-offset-4 hover:underline">{t.common.terms}</a>{' '}
                  {t.common.and}{' '}
                  <a href={routes.privacy} className="text-ink-strong underline-offset-4 hover:underline">{t.common.privacy}</a>.
                </span>
              </label>
              <FormError>{errors.terms}</FormError>
            </div>
          </>
        )}

        {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (isRegister ? t.register.creating : t.login.signingIn) : (
            <>
              {isRegister ? <UserPlus className="h-5 w-5" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
              {isRegister ? t.common.createAccountBtn : t.common.signInBtn}
            </>
          )}
        </Button>

        {!isRegister && (
          <div className="flex flex-col items-center gap-2">
            {onUseOtp && (
              <button type="button" onClick={onUseOtp} className="text-sm text-ink-muted transition-colors hover:text-ink-strong">
                {t.login.useOtp}
              </button>
            )}
            <a href={routes.forgotPassword} className="text-sm text-ink-muted transition-colors hover:text-gold-600">
              {t.login.forgot}
            </a>
          </div>
        )}
      </form>
    </PremiumCard>
  );
}

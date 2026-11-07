'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { verifyEmailAction, resendVerificationAction } from '@/lib/auth-actions';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { InlineNotice } from '@/components/states/InlineNotice';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

type VerifyState = 'loading' | 'success' | 'already' | 'invalid' | 'error';

export function VerifyEmailCard({ token, locale = 'ar' }: { token: string; locale?: Locale }) {
  const t = authT(locale);
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'invalid');
  const [resendPending, setResendPending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!token) return;
    verifyEmailAction({ token }).then((res) => {
      if (res.ok) {
        setState(res.alreadyVerified ? 'already' : 'success');
      } else if (res.status === 400) {
        setState('invalid');
      } else {
        setState('error');
      }
    });
  }, [token]);

  async function handleResend() {
    setResendPending(true);
    setResendError('');
    const res = await resendVerificationAction();
    setResendPending(false);
    if (res.ok) {
      setResendDone(true);
    } else if (res.status === 429) {
      setResendError(t.verify.waitMinute);
    } else if (res.status === 401) {
      setResendError(t.verify.needLogin);
    } else {
      setResendError(t.verify.resendFailed);
    }
  }

  if (state === 'loading') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500" aria-hidden />
        <p className="text-sm text-ink-muted">{t.verify.checking}</p>
      </PremiumCard>
    );
  }

  if (state === 'success') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">{t.verify.doneTitle}</h2>
        <p className="text-sm text-ink-muted">{t.verify.doneBody}</p>
        <ButtonLink href={routes.account} size="lg" className="mt-2 w-full">
          {t.common.goToAccountShort}
        </ButtonLink>
      </PremiumCard>
    );
  }

  if (state === 'already') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">{t.verify.alreadyTitle}</h2>
        <p className="text-sm text-ink-muted">{t.verify.alreadyBody}</p>
        <ButtonLink href={routes.account} size="lg" className="mt-2 w-full">
          {t.common.goToAccountShort}
        </ButtonLink>
      </PremiumCard>
    );
  }

  // invalid or error
  const isInvalid = state === 'invalid';
  return (
    <PremiumCard className="flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle className="h-12 w-12 text-error" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">
          {isInvalid ? t.verify.invalidTitle : t.verify.errorTitle}
        </h2>
        <p className="text-sm text-ink-muted">
          {isInvalid
            ? t.verify.invalidBody
            : t.verify.errorBody}
        </p>
      </div>

      {resendDone ? (
        <InlineNotice tone="success">
          {t.verify.resendDone}
        </InlineNotice>
      ) : (
        <>
          {resendError && <InlineNotice tone="error">{resendError}</InlineNotice>}
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={resendPending}
            onClick={handleResend}
          >
            {resendPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {resendPending ? t.verify.sending : t.verify.resend}
          </Button>
          <p className="text-center text-xs text-ink-muted">
            {t.verify.noSession}{' '}
            <a href={routes.login} className="underline underline-offset-4 hover:text-ink-strong">
              {t.verify.signInFirst}
            </a>{' '}
            {t.verify.thenRequest}
          </p>
        </>
      )}
    </PremiumCard>
  );
}

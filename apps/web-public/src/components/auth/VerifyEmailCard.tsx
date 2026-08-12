'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { verifyEmailAction, resendVerificationAction } from '@/lib/auth-actions';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { InlineNotice } from '@/components/states/InlineNotice';

type VerifyState = 'loading' | 'success' | 'already' | 'invalid' | 'error';

export function VerifyEmailCard({ token }: { token: string }) {
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
      setResendError('يرجى الانتظار دقيقة قبل طلب رابط جديد.');
    } else if (res.status === 401) {
      setResendError('يجب تسجيل الدخول أولاً لإعادة إرسال رابط التأكيد.');
    } else {
      setResendError('تعذّر إرسال الرابط حاليًا. يرجى المحاولة لاحقًا.');
    }
  }

  if (state === 'loading') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500" aria-hidden />
        <p className="text-sm text-ink-muted">جارٍ التحقق من الرابط…</p>
      </PremiumCard>
    );
  }

  if (state === 'success') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">تم تأكيد بريدك الإلكتروني</h2>
        <p className="text-sm text-ink-muted">يمكنك الآن الاستفادة الكاملة من جميع خدمات ديفورا.</p>
        <ButtonLink href={routes.account} size="lg" className="mt-2 w-full">
          الذهاب إلى الحساب
        </ButtonLink>
      </PremiumCard>
    );
  }

  if (state === 'already') {
    return (
      <PremiumCard className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h2 className="text-xl font-bold text-ink-strong">بريدك الإلكتروني مؤكَّد بالفعل</h2>
        <p className="text-sm text-ink-muted">حسابك مفعّل ولا حاجة لأي إجراء إضافي.</p>
        <ButtonLink href={routes.account} size="lg" className="mt-2 w-full">
          الذهاب إلى الحساب
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
          {isInvalid ? 'رابط التأكيد غير صالح أو منتهي الصلاحية' : 'حدث خطأ أثناء التحقق'}
        </h2>
        <p className="text-sm text-ink-muted">
          {isInvalid
            ? 'قد يكون الرابط منتهي الصلاحية (٦٠ دقيقة) أو تم استخدامه من قبل.'
            : 'يرجى المحاولة مرة أخرى. إذا استمرت المشكلة تواصل معنا.'}
        </p>
      </div>

      {resendDone ? (
        <InlineNotice tone="success">
          تم إرسال رابط تأكيد جديد إلى بريدك الإلكتروني. يرجى مراجعة البريد الوارد والمجلدات الأخرى.
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
            {resendPending ? 'جارٍ الإرسال…' : 'إعادة إرسال رابط التأكيد'}
          </Button>
          <p className="text-center text-xs text-ink-muted">
            إذا لم يكن لديك جلسة نشطة،{' '}
            <a href={routes.login} className="underline underline-offset-4 hover:text-ink-strong">
              سجّل دخولك أولاً
            </a>{' '}
            ثم اطلب رابطًا جديدًا من الملف الشخصي.
          </p>
        </>
      )}
    </PremiumCard>
  );
}

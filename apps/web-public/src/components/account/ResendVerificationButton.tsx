'use client';

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { resendVerificationAction } from '@/lib/auth-actions';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/states/InlineNotice';

export function ResendVerificationButton() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setPending(true);
    setError('');
    const res = await resendVerificationAction();
    setPending(false);
    if (res.ok) {
      setDone(true);
    } else if (res.status === 429) {
      setError('يرجى الانتظار دقيقة قبل طلب رابط جديد.');
    } else {
      setError('تعذّر إرسال الرابط. يرجى المحاولة لاحقًا.');
    }
  }

  if (done) {
    return (
      <InlineNotice tone="success" className="mt-3">
        تم إرسال رابط التأكيد إلى بريدك الإلكتروني. يرجى مراجعة البريد الوارد والمجلدات الأخرى.
      </InlineNotice>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={handleClick}
        className="gap-2"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="h-4 w-4" aria-hidden />
        )}
        {pending ? 'جارٍ الإرسال…' : 'إعادة إرسال رابط التأكيد'}
      </Button>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Mail } from 'lucide-react';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-xl border border-success-100 bg-success-50 px-4 py-4">
        <p className="text-sm leading-relaxed text-success-700">
          إذا كان البريد مسجّلًا لدينا، ستصلك رسالة برابط إعادة التعيين خلال دقائق. تحقق من صندوق الوارد أو مجلد البريد غير المرغوب فيه.
        </p>
        <Link
          href="/login"
          className="mt-3 block text-center text-sm font-semibold text-navy underline-offset-4 hover:underline"
        >
          العودة إلى تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-[13px] font-semibold text-navy/70">
          البريد الإلكتروني
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            <Mail className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="ahmed@example.com"
            className="h-[52px] w-full rounded-xl border border-hairline bg-surface pr-[2.625rem] pl-4 text-sm text-navy placeholder:text-text-muted transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-600">{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-bold text-white shadow-soft transition-colors duration-150 ease-smooth hover:bg-navy-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            جارٍ الإرسال…
          </>
        ) : (
          'إرسال رابط إعادة التعيين'
        )}
      </button>

      <p className="text-center text-[13px] text-text-muted">
        <Link href="/login" className="font-semibold text-navy underline-offset-4 hover:underline">
          العودة إلى تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}

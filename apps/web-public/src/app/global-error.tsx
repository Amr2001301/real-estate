'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Last-resort boundary that replaces the root layout, so it ships its own
 * <html>/<body>. Self-contained styling — still friendly, still on-brand,
 * never a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[global-error]', error);
    }
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-canvas text-ink">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-soft text-ink-strong">
            <span className="h-3 w-3 rounded-full bg-gold-400" />
          </span>
          <h1 className="font-display text-3xl text-ink-strong">حدث خطأ غير متوقع</h1>
          <p className="mt-3 max-w-md text-ink-muted">
            حدث خطأ غير متوقع، لكن تجربتك ما زالت آمنة. يرجى المحاولة مرة أخرى بعد لحظات.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-navy px-6 text-[15px] font-medium text-white transition-colors hover:bg-navy-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}

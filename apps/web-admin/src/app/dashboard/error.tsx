'use client';

function getClientLocale(): 'ar' | 'en' {
  if (typeof document === 'undefined') return 'ar';
  const m = document.cookie.match(/(?:^|; )admin-locale=([^;]+)/);
  return m?.[1] === 'en' ? 'en' : 'ar';
}

const STRINGS = {
  ar: {
    networkError: 'تعذر الاتصال بالخادم',
    pageError: 'حدث خطأ في تحميل الصفحة',
    retry: 'إعادة المحاولة',
  },
  en: {
    networkError: 'Unable to connect to server',
    pageError: 'An error occurred while loading the page',
    retry: 'Retry',
  },
} as const;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = getClientLocale();
  const s = STRINGS[locale];
  const isNetwork = /API|fetch|ECONNREFUSED|الـ API/.test(error.message);
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-800 mb-2">
        {isNetwork ? s.networkError : s.pageError}
      </h2>
      <p className="text-sm text-red-700 mb-4 break-words">{error.message}</p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm hover:bg-red-700"
        >
          {s.retry}
        </button>
      </div>
    </div>
  );
}

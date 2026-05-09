'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetwork = /API|fetch|ECONNREFUSED|الـ API/.test(error.message);
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-800 mb-2">
        {isNetwork ? 'تعذر الاتصال بالخادم' : 'حدث خطأ في تحميل الصفحة'}
      </h2>
      <p className="text-sm text-red-700 mb-4 break-words">{error.message}</p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

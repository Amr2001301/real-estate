'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 border border-gray-100">
        <h1 className="text-xl font-bold text-red-700 mb-2">حدث خطأ</h1>
        <p className="text-sm text-gray-600 mb-4 break-words">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

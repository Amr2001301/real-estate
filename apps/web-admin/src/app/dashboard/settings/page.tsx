import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface Setting {
  key: string;
  value: unknown;
  updatedAt: string;
}

async function upsertSettingAction(formData: FormData) {
  'use server';
  const key = String(formData.get('key') ?? '');
  const valueRaw = String(formData.get('value') ?? '');
  let value: unknown = valueRaw;
  try {
    value = JSON.parse(valueRaw);
  } catch {
    value = valueRaw;
  }
  await api.put(`/settings/${encodeURIComponent(key)}`, { value });
  revalidatePath('/dashboard/settings');
}

export default async function SettingsPage() {
  const r = await safe(api.get<Setting[]>('/settings'));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">القيم الحالية</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {(r.data ?? []).map((s) => (
            <li key={s.key} className="py-3">
              <div className="flex justify-between">
                <span className="font-mono text-xs text-brand-700">{s.key}</span>
                <span className="text-xs text-gray-400">{formatDateTime(s.updatedAt)}</span>
              </div>
              <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-x-auto" dir="ltr">
                {JSON.stringify(s.value, null, 2)}
              </pre>
            </li>
          ))}
          {(r.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400 py-2">لا توجد إعدادات</li>
          )}
        </ul>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">إنشاء / تعديل إعداد</h2>
        <form action={upsertSettingAction} className="space-y-3">
          <input
            name="key"
            required
            dir="ltr"
            placeholder="key (e.g. company.name)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <textarea
            name="value"
            required
            dir="ltr"
            rows={4}
            placeholder='قيمة (يمكن أن تكون JSON: {"foo": "bar"})'
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">
            حفظ
          </button>
        </form>
      </section>
    </div>
  );
}

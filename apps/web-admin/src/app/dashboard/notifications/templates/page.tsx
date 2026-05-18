import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import type { Translatable } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';

interface Template {
  id: string;
  code: string;
  channel: 'PUSH' | 'EMAIL' | 'IN_APP';
  subject: Translatable;
  body: Translatable;
  active: boolean;
  updatedAt: string;
}

async function upsertTemplateAction(formData: FormData) {
  'use server';
  await api.post('/notification-templates', {
    code: String(formData.get('code') ?? ''),
    channel: String(formData.get('channel') ?? 'PUSH'),
    ar_subject: String(formData.get('ar_subject') ?? ''),
    en_subject: String(formData.get('en_subject') ?? ''),
    ar_body: String(formData.get('ar_body') ?? ''),
    en_body: String(formData.get('en_body') ?? ''),
  });
  revalidatePath('/dashboard/notifications/templates');
}

export default async function NotificationsPage() {
  const r = await safe(api.get<Template[]>('/notification-templates'));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">قوالب الإشعارات</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">قوالب الإشعارات</h2>
        {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-3">{r.error}</div>}
        <ul className="divide-y divide-gray-100 text-sm">
          {(r.data ?? []).map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex justify-between">
                <span className="font-mono text-xs text-brand-700">{t.code}</span>
                <span className="text-xs text-gray-500">{t.channel} · {formatDate(t.updatedAt)}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{tx(t.subject)}</p>
              <p className="text-xs text-gray-600 mt-0.5">{tx(t.body)}</p>
            </li>
          ))}
          {(r.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400 py-2">لا توجد قوالب</li>
          )}
        </ul>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">إنشاء / تعديل قالب</h2>
        <form action={upsertTemplateAction} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="code"
              required
              dir="ltr"
              placeholder="code (e.g. visit_approved)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <select
              name="channel"
              defaultValue="PUSH"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="PUSH">PUSH</option>
              <option value="EMAIL">EMAIL</option>
              <option value="IN_APP">IN_APP</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="ar_subject" required dir="rtl" placeholder="العنوان" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input name="en_subject" required dir="ltr" placeholder="Subject" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea name="ar_body" required dir="rtl" rows={3} placeholder="نص الإشعار" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <textarea name="en_body" required dir="ltr" rows={3} placeholder="Body" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">حفظ</button>
        </form>
      </section>
    </div>
  );
}

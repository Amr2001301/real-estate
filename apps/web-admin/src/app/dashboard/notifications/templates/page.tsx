import Link from 'next/link';
import type { ReactNode } from 'react';
import { revalidatePath } from 'next/cache';
import { Plus, FileEdit, ArrowRight, Bell } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Translatable } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  code: string;
  channel: 'PUSH' | 'EMAIL' | 'IN_APP';
  subject: Translatable;
  body: Translatable;
  active: boolean;
  updatedAt: string;
}

// ── Server actions (names/fields unchanged) ───────────────────────────────────

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

// ── Channel helpers ───────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<Template['channel'], string> = {
  PUSH:   'إشعار فوري',
  EMAIL:  'بريد إلكتروني',
  IN_APP: 'داخل التطبيق',
};

const CHANNEL_TONE: Record<Template['channel'], BadgeTone> = {
  PUSH:   'info',
  EMAIL:  'brand',
  IN_APP: 'success',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationTemplatesPage() {
  const r = await safe(api.get<Template[]>('/notification-templates'));
  const templates = r.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="قوالب الإشعارات"
        description="إدارة قوالب نصوص الإشعارات لجميع قنوات الإرسال."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الإشعارات', href: '/dashboard/notifications' },
          { label: 'القوالب' },
        ]}
        actions={
          <Link href="/dashboard/notifications">
            <Button variant="outline" size="sm" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              العودة للإشعارات
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل القوالب: {r.error}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* ── Card header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">قوالب الإشعارات</h2>
          <CountChip count={templates.length} />
        </div>

        {/* ── Template list ────────────────────────────────────────────────── */}
        {templates.length === 0 ? (
          <CompactEmpty
            icon={<Bell className="h-8 w-8" />}
            title="لا توجد قوالب"
            description="أضف قالباً جديداً باستخدام النموذج أدناه."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-muted/40">
                  <th className="px-5 py-2.5 text-end text-2xs font-semibold uppercase tracking-wide text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-end text-2xs font-semibold uppercase tracking-wide text-slate-500">القناة</th>
                  <th className="px-4 py-2.5 text-end text-2xs font-semibold uppercase tracking-wide text-slate-500">العنوان</th>
                  <th className="px-4 py-2.5 text-end text-2xs font-semibold uppercase tracking-wide text-slate-500">الحالة</th>
                  <th className="px-4 py-2.5 text-end text-2xs font-semibold uppercase tracking-wide text-slate-500">آخر تحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded" dir="ltr">
                        {t.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={CHANNEL_TONE[t.channel]} size="sm">
                        {CHANNEL_LABEL[t.channel]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-sm font-medium text-slate-800 truncate">{tx(t.subject)}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{tx(t.body)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.active ? 'success' : 'gray'} size="sm" dot>
                        {t.active ? 'نشط' : 'معطل'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400" dir="ltr">
                      {formatDate(t.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create / Edit form (collapsible) ─────────────────────────────── */}
        <details className="group border-t border-hairline">
          <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer select-none hover:bg-surface-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileEdit className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">إنشاء / تعديل قالب</span>
            </div>
            <Plus className="h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 group-open:rotate-45" />
          </summary>

          <div className="px-5 py-4 bg-surface-muted/20 border-t border-hairline">
            <form action={upsertTemplateAction} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  name="code"
                  required
                  dir="ltr"
                  placeholder="code (e.g. visit_approved)"
                  inputSize="sm"
                  className="font-mono"
                />
                <Select name="channel" defaultValue="PUSH" inputSize="sm">
                  <option value="PUSH">PUSH — إشعار فوري</option>
                  <option value="EMAIL">EMAIL — بريد إلكتروني</option>
                  <option value="IN_APP">IN_APP — داخل التطبيق</option>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input name="ar_subject" required dir="rtl" placeholder="العنوان (عربي)" inputSize="sm" />
                <Input name="en_subject" required dir="ltr" placeholder="Subject (English)" inputSize="sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Textarea name="ar_body" required dir="rtl" rows={3} placeholder="نص الإشعار (عربي)" className="text-sm" />
                <Textarea name="en_body" required dir="ltr" rows={3} placeholder="Notification body (English)" className="text-sm" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  حفظ القالب
                </Button>
              </div>
            </form>
          </div>
        </details>
      </Card>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function CountChip({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-2xs font-semibold text-slate-600 tabular-nums">
      {count}
    </span>
  );
}

function CompactEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-300">
        {icon}
      </span>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 max-w-xs">{description}</p>}
    </div>
  );
}

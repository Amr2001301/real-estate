import Link from 'next/link';
import { Settings, Lock, Save } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { SettingItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { patchSettingAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  q?: string;
  group?: string;
  ok?: string;
  err?: string;
}

const GROUP_LABEL: Record<string, string> = {
  company: 'الشركة',
  localization: 'اللغة والتوطين',
  reservations: 'الحجوزات',
  reservation: 'الحجوزات',
  broker: 'الوسطاء',
  brokers: 'الوسطاء',
  payments: 'المدفوعات',
  payment: 'المدفوعات',
  notifications: 'الإشعارات',
  notification: 'الإشعارات',
  system: 'النظام',
};

function groupLabel(g: string): string {
  return GROUP_LABEL[g] ?? g;
}

function renderValue(s: SettingItem): string {
  if (s.sensitive) return '***محجوب***';
  if (s.value === null || s.value === undefined) return '—';
  if (typeof s.value === 'string') return s.value;
  if (typeof s.value === 'number' || typeof s.value === 'boolean') return String(s.value);
  try {
    return JSON.stringify(s.value, null, 2);
  } catch {
    return String(s.value);
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.group) qs.set('group', sp.group);

  const res = await safe(api.get<SettingItem[]>(`/settings${qs.toString() ? `?${qs.toString()}` : ''}`));
  const items = res.data ?? [];

  // Group settings by their derived group prefix; settings without a dot
  // land under "system".
  const grouped = new Map<string, SettingItem[]>();
  for (const item of items) {
    const arr = grouped.get(item.group) ?? [];
    arr.push(item);
    grouped.set(item.group, arr);
  }
  const knownGroups = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-5">
      <PageHeader
        title="إعدادات النظام"
        description="القيم العامة للنظام. التعديل يكتب فورًا في قاعدة البيانات ويُسجّل في سجل التدقيق."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'إعدادات النظام' },
        ]}
        meta={<Settings className="h-4 w-4 text-brand-600" />}
      />

      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          تم حفظ «{sp.ok}» بنجاح.
        </div>
      )}
      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الإعدادات: {res.error}
        </div>
      )}

      <div className="rounded-2xl bg-info-50 border border-info-100 text-info-800 p-4 text-sm">
        بعض الإعدادات محفوظة فقط ولا تُؤثر تلقائيًا على منطق الأعمال بعد. راجع تقرير المرحلة 16 لتفاصيل الإعدادات الموصولة بالنظام.
      </div>

      <form
        method="get"
        action="/dashboard/settings"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white p-3 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث في المفاتيح"
          defaultValue={sp.q ?? ''}
          className="w-64"
          dir="ltr"
        />
        <Select name="group" inputSize="sm" defaultValue={sp.group ?? ''} className="w-48">
          <option value="">كل المجموعات</option>
          {knownGroups.map((g) => (
            <option key={g} value={g}>{groupLabel(g)}</option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.q || sp.group) && (
            <Link href="/dashboard/settings">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={<Settings />}
            title="لا توجد إعدادات"
            description="لا توجد قيم محفوظة بعد. يمكنك إضافة قيمة جديدة من القسم أدناه."
          />
        </Card>
      ) : (
        Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([group, rows]) => (
            <Card key={group} className="overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{groupLabel(group)}</h2>
                <span className="text-2xs text-slate-500 font-mono" dir="ltr">{group}.*</span>
                <span className="ms-auto text-2xs text-slate-500">{rows.length} عنصر</span>
              </div>
              <ul className="divide-y divide-hairline">
                {rows.map((row) => (
                  <li key={row.key} className="px-5 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-4 min-w-0">
                      <p className="font-mono text-xs text-slate-800 truncate" dir="ltr">{row.key}</p>
                      <p className="text-2xs text-slate-500 mt-0.5">{formatDateTime(row.updatedAt)}</p>
                      {row.sensitive && (
                        <p className="text-2xs text-amber-700 mt-1 inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          قيمة حساسة — يجب إعادة إدخالها بالكامل لتحديثها
                        </p>
                      )}
                    </div>
                    <pre
                      className="md:col-span-5 max-h-32 overflow-auto rounded-lg border border-hairline bg-surface-muted/40 p-2 text-2xs text-slate-800 scrollbar-thin"
                      dir="ltr"
                    >
                      {renderValue(row)}
                    </pre>
                    <form action={patchSettingAction} className="md:col-span-3 flex flex-col gap-1.5">
                      <input type="hidden" name="key" value={row.key} />
                      <Textarea
                        name="value"
                        rows={3}
                        dir="ltr"
                        placeholder={row.sensitive ? 'القيمة الجديدة (لن تظهر مرة أخرى)' : 'القيمة الجديدة (نص أو JSON)'}
                      />
                      <Button type="submit" variant="outline" size="sm" leftIcon={<Save className="h-3.5 w-3.5" />}>
                        حفظ
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">إضافة إعداد جديد</h2>
        <form action={patchSettingAction} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <Input
            name="key"
            placeholder="مفتاح (مثال: company.name أو broker.defaultCommissionPct)"
            className="md:col-span-4"
            dir="ltr"
            required
          />
          <Textarea
            name="value"
            rows={3}
            placeholder='القيمة (نص بسيط، رقم، أو JSON كائن/مصفوفة)'
            className="md:col-span-6"
            dir="ltr"
            required
          />
          <div className="md:col-span-2 flex items-start">
            <Button type="submit" variant="primary" size="md" leftIcon={<Save className="h-4 w-4" />}>
              إنشاء
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

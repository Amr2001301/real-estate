import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BadgePercent,
  Clock,
  CheckCircle2,
  Banknote,
  Hash,
  AlertCircle,
  Info,
  Plus,
  Undo2,
  RotateCcw,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PremiumMetricStrip } from '@/components/premium';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { ExportMenu } from '@/components/export-menu';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
type EntryStatus = 'PENDING' | 'APPROVED' | 'PAID';

interface BonusRule {
  id: string;
  name: string;
  percentage: string | number;
  active: boolean;
  autoApplyOnSignedContract?: boolean;
}
type EntrySource = 'MANUAL' | 'CONTRACT_AUTO';
interface BonusEntry {
  id: string;
  amount: string | number;
  period: string;
  status: EntryStatus;
  paidAt: string | null;
  source?: EntrySource;
  contractId?: string | null;
  sales?: { id: string; fullName: string };
  rule?: { name: string };
}

const SOURCE_LABEL: Record<EntrySource, string> = {
  MANUAL: 'يدوي',
  CONTRACT_AUTO: 'تلقائي من عقد',
};
interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

function salesActorLabel(u: SalesUser): string {
  return u.role === 'SALES_MANAGER' ? `${u.fullName} — مدير مبيعات` : `${u.fullName} — مبيعات`;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  PAID: 'مدفوع',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function buildEntriesUrl(sp: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  if (sp.salesId) p.set('salesId', sp.salesId);
  if (sp.status) p.set('status', sp.status);
  if (sp.period) p.set('period', sp.period);
  const qs = p.toString();
  return `/bonus-entries${qs ? `?${qs}` : ''}`;
}

function redirectBack(formData: FormData, err?: string): never {
  const base = String(formData.get('returnTo') || '/dashboard/bonus');
  if (!err) redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}err=${encodeURIComponent(err)}`);
}

// ── Server actions ─────────────────────────────────────────────────────────
async function createRuleAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/bonus-rules', {
      name: String(formData.get('name') ?? ''),
      percentage: Number(formData.get('percentage') ?? 0),
      autoApplyOnSignedContract: formData.get('autoApplyOnSignedContract') === 'on',
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function toggleRuleAction(
  ruleId: string,
  field: 'active' | 'autoApplyOnSignedContract',
  next: boolean,
  formData: FormData,
) {
  'use server';
  const res = await safe(api.patch(`/bonus-rules/${ruleId}`, { [field]: next }));
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function createEntryAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/bonus-entries', {
      salesId: String(formData.get('salesId') ?? ''),
      ruleId: String(formData.get('ruleId') ?? ''),
      amount: Number(formData.get('amount') ?? 0),
      period: String(formData.get('period') ?? ''),
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

async function entryTransitionAction(
  id: string,
  kind: 'approve' | 'pay' | 'revert',
  formData: FormData,
) {
  'use server';
  const res =
    kind === 'approve'
      ? await safe(api.post(`/bonus-entries/${id}/approve`, {}))
      : kind === 'pay'
        ? await safe(api.post(`/bonus-entries/${id}/pay`, {}))
        : await safe(api.patch(`/bonus-entries/${id}`, { status: 'PENDING' }));
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function BonusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const [rulesRes, entriesRes, salesRes] = await Promise.all([
    safe(api.get<BonusRule[]>('/bonus-rules')),
    safe(api.get<BonusEntry[] | Paged<BonusEntry>>(buildEntriesUrl(sp))),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  const rules = rulesRes.data ?? [];
  const activeAutoRules = rules.filter((r) => r.active && r.autoApplyOnSignedContract);
  const entries = Array.isArray(entriesRes.data)
    ? entriesRes.data
    : (entriesRes.data?.data ?? []);
  const salesUsers = salesRes.data?.data ?? [];

  const sumByStatus = (s: EntryStatus) =>
    entries.filter((e) => e.status === s).reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  const returnTo = (() => {
    const p = new URLSearchParams();
    if (sp.salesId) p.set('salesId', sp.salesId);
    if (sp.status) p.set('status', sp.status);
    if (sp.period) p.set('period', sp.period);
    const qs = p.toString();
    return `/dashboard/bonus${qs ? `?${qs}` : ''}`;
  })();

  const hasFilters = !!(sp.salesId || sp.status || sp.period);
  // Arabic-Indic zero "٠" renders as a tiny dot in most web fonts at display size
  const entryCount = entries.length === 0 ? '0' : entries.length.toLocaleString('ar-EG');

  return (
    <div className="space-y-5">
      <PageHeader
        title="عمولات ومكافآت المبيعات"
        description="إدارة يدوية لمستحقات العمولات والمكافآت. تُنشأ المستحقات يدوياً ثم تُعتمد وتُدفع."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العمولات' },
        ]}
        actions={
          <ExportMenu
            xlsxPath="/bonus-entries/export.xlsx"
            csvPath="/bonus-entries/export.csv"
            filenameBase="bonus-entries"
            params={{ salesId: sp.salesId, status: sp.status, period: sp.period }}
          />
        }
      />

      {/* Error banner */}
      {sp.err && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر تنفيذ العملية</p>
            <p className="text-xs mt-0.5 opacity-80">{sp.err}</p>
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: 'إجمالي المعلق',  value: pendingTotal === 0 ? '0 ر.س.' : formatCurrency(pendingTotal),   icon: <Clock />,        tone: 'warning', valueSize: 'compact' },
          { label: 'إجمالي المعتمد', value: approvedTotal === 0 ? '0 ر.س.' : formatCurrency(approvedTotal), icon: <CheckCircle2 />, tone: 'info',    valueSize: 'compact' },
          { label: 'إجمالي المدفوع', value: paidTotal === 0 ? '0 ر.س.' : formatCurrency(paidTotal),         icon: <Banknote />,     tone: 'success', valueSize: 'compact' },
          { label: 'عدد المستحقات',  value: entryCount,                                                      icon: <Hash />,         tone: 'brand'   },
        ]}
      />

      {/* ── Compact filter bar — sr-only labels ────────────────────────────── */}
      <FilterBar
        method="get"
        action="/dashboard/bonus"
        trailing={
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilters && (
              <Link href="/dashboard/bonus">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </div>
        }
      >
        <FilterField label="المندوب" htmlFor="bonus-sales">
          <Select id="bonus-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-48">
            <option value="">كل المندوبين</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="الشهر" htmlFor="bonus-period">
          <Input id="bonus-period" name="period" type="month" inputSize="sm" defaultValue={sp.period ?? ''} className="w-40" />
        </FilterField>
        <FilterField label="الحالة" htmlFor="bonus-status">
          <Select id="bonus-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-32">
            <option value="">كل الحالات</option>
            <option value="PENDING">معلق</option>
            <option value="APPROVED">معتمد</option>
            <option value="PAID">مدفوع</option>
          </Select>
        </FilterField>
      </FilterBar>

      {/* ── Manual entitlement ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
              <Plus className="h-3 w-3 text-brand-600" />
            </div>
            <CardTitle className="text-sm">إضافة مستحق يدوي</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="px-5 py-3">
          {rules.length === 0 || salesUsers.length === 0 ? (
            <p className="text-xs text-slate-400">
              يلزم وجود قاعدة عمولة ومندوب مبيعات واحد على الأقل قبل إنشاء مستحق.
            </p>
          ) : (
            <form action={createEntryAction} className="flex flex-wrap items-end gap-2.5">
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="flex flex-col gap-1">
                <label htmlFor="be-salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
                <Select id="be-salesId" name="salesId" inputSize="sm" required className="w-48 shrink-0">
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="be-ruleId" className="text-[11px] font-medium text-slate-400">القاعدة</label>
                <Select id="be-ruleId" name="ruleId" inputSize="sm" required className="w-40 shrink-0">
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="be-amount" className="text-[11px] font-medium text-slate-400">المبلغ</label>
                <Input id="be-amount" name="amount" type="number" step="any" min={0} required inputSize="sm" className="w-32 shrink-0" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="be-period" className="text-[11px] font-medium text-slate-400">شهر الاستحقاق</label>
                <Input id="be-period" name="period" type="month" required inputSize="sm" className="w-40 shrink-0" />
              </div>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} className="self-end">
                إضافة المستحق
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      {/* ── Commission rules ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">قواعد العمولة</CardTitle>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{rules.length} قاعدة</span>
        </CardHeader>

        {/* Auto-commission status banner — compact */}
        <div className={cn(
          'mx-5 mt-3 rounded-lg px-3 py-2 text-[11px] border flex items-center gap-2',
          activeAutoRules.length === 0
            ? 'bg-warning-50 border-warning-100 text-warning-700'
            : activeAutoRules.length === 1
              ? 'bg-success-50 border-success-100 text-success-700'
              : 'bg-danger-50 border-danger-100 text-danger-700',
        )}>
          {activeAutoRules.length === 1
            ? <Info className="h-3 w-3 shrink-0" />
            : <AlertCircle className="h-3 w-3 shrink-0" />
          }
          <span>
            {activeAutoRules.length === 0
              ? 'لن يتم إنشاء عمولات تلقائية عند توقيع العقود حتى يتم تفعيل قاعدة واحدة.'
              : activeAutoRules.length === 1
                ? `العمولات التلقائية مفعّلة باستخدام قاعدة: ${activeAutoRules[0]!.name}`
                : 'يوجد أكثر من قاعدة تلقائية مفعّلة. لن يتم إنشاء عمولات تلقائية حتى يتم إصلاح الإعداد.'}
          </span>
        </div>

        {/* Rules list */}
        {rules.length > 0 ? (
          <ul className="px-5 py-1 divide-y divide-hairline">
            {rules.map((r) => {
              const isAmbiguous = activeAutoRules.length > 1 && r.active && r.autoApplyOnSignedContract;
              return (
                <li
                  key={r.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 py-3 transition-opacity',
                    !r.active && 'opacity-60',
                    isAmbiguous && 'bg-danger-50/40 -mx-2 px-2 rounded-lg',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-bold tabular-nums font-mono shrink-0">
                      {r.percentage}%
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                    {r.autoApplyOnSignedContract && (
                      <Badge tone="info" size="sm" className="shrink-0">تلقائي عند التوقيع</Badge>
                    )}
                    {!r.active && (
                      <Badge tone="gray" size="sm" className="shrink-0">غير نشطة</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <form action={toggleRuleAction.bind(null, r.id, 'active', !r.active)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant="outline" size="sm">
                        {r.active ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </form>
                    <form action={toggleRuleAction.bind(null, r.id, 'autoApplyOnSignedContract', !r.autoApplyOnSignedContract)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant={r.autoApplyOnSignedContract ? 'secondary' : 'outline'} size="sm">
                        {r.autoApplyOnSignedContract ? 'إلغاء التلقائي' : 'تفعيل التلقائي'}
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-4 text-xs text-slate-400">لا توجد قواعد بعد.</p>
        )}

        {/* Add rule footer */}
        <div className="border-t border-hairline bg-surface-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <Plus className="h-3 w-3 text-brand-700" />
            </div>
            <p className="text-xs font-semibold text-slate-700">إضافة قاعدة جديدة</p>
          </div>
          <form action={createRuleAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="flex flex-wrap items-center gap-2">
              <Input name="name" required placeholder="اسم القاعدة" inputSize="sm" className="flex-1 min-w-[160px]" />
              <Input name="percentage" type="number" step="any" min={0} required inputSize="sm" placeholder="النسبة %" className="w-28" />
              <Button type="submit" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                إضافة
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-2.5 cursor-pointer">
              <input type="checkbox" name="autoApplyOnSignedContract" className="rounded border-hairline" />
              تطبيق تلقائي عند توقيع العقد
            </label>
          </form>
          <p className="text-[11px] text-slate-400 mt-2.5">
            يجب أن تكون هناك قاعدة واحدة فقط مفعّلة للتطبيق التلقائي. تغيير القاعدة لا يؤثر على المستحقات المنشأة مسبقاً.
          </p>
        </div>
      </Card>

      {/* ── Entries table ────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">سجلّات المستحقات</CardTitle>
          <span className="text-xs text-slate-400 tabular-nums">{entryCount} مستحق</span>
        </CardHeader>
        <CardBody className="p-0">
          {entriesRes.error ? (
            <div className="flex items-start gap-2 m-5 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{entriesRes.error}</p>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<BadgePercent />}
              title="لا توجد مستحقات"
              description={hasFilters ? 'لا توجد مستحقات تطابق الفلاتر المختارة' : 'لم يتم إنشاء أي مستحقات بعد'}
              action={
                hasFilters ? (
                  <Link href="/dashboard/bonus">
                    <Button variant="outline" size="sm">مسح الفلاتر</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead className="bg-surface-muted/50 text-xs font-semibold text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المندوب</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الفترة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">القاعدة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المصدر</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المبلغ</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الحالة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="group border-t border-hairline hover:bg-brand-50/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {e.sales?.fullName ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-500 tabular-nums whitespace-nowrap font-mono text-xs">
                        {e.period}
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {e.rule?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={e.source === 'CONTRACT_AUTO' ? 'info' : 'gray'}
                            size="sm"
                          >
                            {SOURCE_LABEL[e.source ?? 'MANUAL']}
                          </Badge>
                          {e.contractId && (
                            <Link
                              href={`/dashboard/contracts/${e.contractId}` as never}
                              className="text-[11px] text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                            >
                              عرض العقد
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge
                          tone={e.status === 'PAID' ? 'success' : e.status === 'APPROVED' ? 'info' : 'warning'}
                          size="sm"
                        >
                          {STATUS_LABEL[e.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDate(e.paidAt)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {e.status === 'PENDING' && (
                            <form action={entryTransitionAction.bind(null, e.id, 'approve')}>
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <Button type="submit" variant="primary" size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                اعتماد
                              </Button>
                            </form>
                          )}
                          {e.status === 'APPROVED' && (
                            <>
                              <form action={entryTransitionAction.bind(null, e.id, 'pay')}>
                                <input type="hidden" name="returnTo" value={returnTo} />
                                <Button type="submit" variant="primary" size="sm" leftIcon={<Banknote className="h-3.5 w-3.5" />}>
                                  تحديد كمدفوع
                                </Button>
                              </form>
                              <form action={entryTransitionAction.bind(null, e.id, 'revert')}>
                                <input type="hidden" name="returnTo" value={returnTo} />
                                <Button type="submit" variant="outline" size="sm" leftIcon={<Undo2 className="h-3.5 w-3.5" />}>
                                  إرجاع لمعلّق
                                </Button>
                              </form>
                            </>
                          )}
                          {e.status === 'PAID' && (
                            <form action={entryTransitionAction.bind(null, e.id, 'revert')}>
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <Button type="submit" variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
                                إرجاع لمعلّق
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

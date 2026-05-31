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
  Plus,
  Undo2,
  RotateCcw,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
const SOURCE_CLS: Record<EntrySource, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  CONTRACT_AUTO: 'bg-info-100 text-info-700',
};
interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

// Sales actors include managers acting as reps; suffix the role so the two are
// distinguishable in the dropdown.
function salesActorLabel(u: SalesUser): string {
  return u.role === 'SALES_MANAGER' ? `${u.fullName} — مدير مبيعات` : `${u.fullName} — مبيعات`;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  PAID: 'مدفوع',
};
const STATUS_CLS: Record<EntryStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-info-100 text-info-700',
  PAID: 'bg-success-100 text-success-700',
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

/** Redirect back to the page (preserving filters) with an error banner.
 *  Approve/pay are strict-permission routes — a 403 surfaces here instead of
 *  crashing the server action. */
function redirectBack(formData: FormData, err?: string): never {
  const base = String(formData.get('returnTo') || '/dashboard/bonus');
  if (!err) redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}err=${encodeURIComponent(err)}`);
}

// ── Server actions ───────────────────────────────────────────────────────────
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

// Toggle a single boolean field on a rule. `field` is bound server-side (never
// from the client), so only active / autoApplyOnSignedContract can be flipped.
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
  // Each transition has its own backend route:
  //   approve → POST /bonus-entries/:id/approve  (strict bonus:entries:approve)
  //   pay     → POST /bonus-entries/:id/pay      (strict bonus:entries:pay)
  //   revert  → PATCH /bonus-entries/:id         (bonus:entries:approve)
  const res =
    kind === 'approve'
      ? await safe(api.post(`/bonus-entries/${id}/approve`, {}))
      : kind === 'pay'
        ? await safe(api.post(`/bonus-entries/${id}/pay`, {}))
        : await safe(api.patch(`/bonus-entries/${id}`, { status: 'PENDING' }));
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/bonus');
}

// ── Page ─────────────────────────────────────────────────────────────────────
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
  // Active rules eligible for auto sales-commission generation. The generator
  // requires exactly one; the banner below reflects zero / one / many.
  const activeAutoRules = rules.filter((r) => r.active && r.autoApplyOnSignedContract);
  const entries = Array.isArray(entriesRes.data)
    ? entriesRes.data
    : (entriesRes.data?.data ?? []);
  const salesUsers = salesRes.data?.data ?? [];

  // KPIs computed over the filtered result set.
  const sumByStatus = (s: EntryStatus) =>
    entries
      .filter((e) => e.status === s)
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  // returnTo preserves active filters across the action round-trip.
  const returnTo = (() => {
    const p = new URLSearchParams();
    if (sp.salesId) p.set('salesId', sp.salesId);
    if (sp.status) p.set('status', sp.status);
    if (sp.period) p.set('period', sp.period);
    const qs = p.toString();
    return `/dashboard/bonus${qs ? `?${qs}` : ''}`;
  })();

  const hasFilters = !!(sp.salesId || sp.status || sp.period);

  return (
    <div className="space-y-5">
      <PageHeader
        title="عمولات ومكافآت المبيعات"
        description="إدارة يدوية لمستحقات العمولات والمكافآت (الإصدار الأول من نظام التعويضات). تُنشأ المستحقات يدوياً ثم تُعتمد وتُدفع."
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

      {sp.err && (
        <div className="rounded-2xl bg-warning-50 text-warning-700 p-4 text-sm flex items-start gap-3 border border-warning-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر تنفيذ العملية</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
            <p className="text-xs mt-1 text-warning-700/80">
              إذا كانت العملية تتطلّب صلاحية اعتماد أو دفع، اطلب منحها من صفحة الصلاحيات.
            </p>
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PageKpiCard
          label="إجمالي المعلق"
          value={formatCurrency(pendingTotal)}
          icon={<Clock />}
          tone="warning"
        />
        <PageKpiCard
          label="إجمالي المعتمد"
          value={formatCurrency(approvedTotal)}
          icon={<CheckCircle2 />}
          tone="info"
        />
        <PageKpiCard
          label="إجمالي المدفوع"
          value={formatCurrency(paidTotal)}
          icon={<Banknote />}
          tone="success"
        />
        <PageKpiCard
          label="عدد المستحقات"
          value={entries.length.toLocaleString('ar-EG')}
          icon={<Hash />}
          tone="brand"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <form method="get" action="/dashboard/bonus">
        <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-hairline shadow-xs px-4 py-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
            <Select id="salesId" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-44">
              <option value="">كل المندوبين</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="period" className="text-[11px] font-medium text-slate-400">شهر الاستحقاق</label>
            <Input id="period" name="period" type="month" inputSize="sm" defaultValue={sp.period ?? ''} className="w-40" />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-[11px] font-medium text-slate-400">الحالة</label>
            <Select id="status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36">
              <option value="">الكل</option>
              <option value="PENDING">معلق</option>
              <option value="APPROVED">معتمد</option>
              <option value="PAID">مدفوع</option>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilters && (
              <a href="/dashboard/bonus">
                <Button type="button" variant="secondary" size="sm">مسح الفلاتر</Button>
              </a>
            )}
          </div>
        </div>
      </form>

      {/* ── Create manual entry ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">إضافة مستحق يدوي</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          {rules.length === 0 || salesUsers.length === 0 ? (
            <p className="text-xs text-slate-400">
              يلزم وجود قاعدة عمولة ومندوب مبيعات واحد على الأقل قبل إنشاء مستحق.
            </p>
          ) : (
            <form action={createEntryAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="flex flex-col gap-1">
                <label htmlFor="entry-salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
                <Select id="entry-salesId" name="salesId" inputSize="sm" required className="w-44">
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="entry-ruleId" className="text-[11px] font-medium text-slate-400">القاعدة</label>
                <Select id="entry-ruleId" name="ruleId" inputSize="sm" required className="w-44">
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="entry-amount" className="text-[11px] font-medium text-slate-400">المبلغ</label>
                <Input id="entry-amount" name="amount" type="number" step="any" min={0} required inputSize="sm" className="w-32" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="entry-period" className="text-[11px] font-medium text-slate-400">شهر الاستحقاق</label>
                <Input id="entry-period" name="period" type="month" required inputSize="sm" className="w-40" />
              </div>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                إضافة المستحق
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      {/* ── Rules ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">قواعد العمولة</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Auto-commission status banner */}
          {activeAutoRules.length === 0 ? (
            <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-xs border border-amber-100">
              لن يتم إنشاء عمولات تلقائية عند توقيع العقود حتى يتم تفعيل قاعدة واحدة.
            </div>
          ) : activeAutoRules.length === 1 ? (
            <div className="rounded-lg bg-success-50 text-success-700 px-3 py-2 text-xs border border-success-100">
              العمولات التلقائية مفعّلة باستخدام قاعدة: {activeAutoRules[0]!.name}
            </div>
          ) : (
            <div className="rounded-lg bg-danger-50 text-danger-700 px-3 py-2 text-xs border border-danger-100">
              يوجد أكثر من قاعدة تلقائية مفعّلة. لن يتم إنشاء عمولات تلقائية حتى يتم إصلاح الإعداد.
            </div>
          )}

          <ul className="text-sm divide-y divide-hairline">
            {rules.map((r) => {
              const isAmbiguous = activeAutoRules.length > 1 && r.active && r.autoApplyOnSignedContract;
              return (
                <li
                  key={r.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 py-2',
                    isAmbiguous && 'bg-danger-50/50 -mx-1 px-1 rounded',
                  )}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="text-slate-700 truncate">{r.name}</span>
                    <span className="text-slate-400 tabular-nums shrink-0">{r.percentage}%</span>
                    {!r.active && (
                      <span className="inline-block shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium leading-tight bg-slate-100 text-slate-500">
                        غير نشطة
                      </span>
                    )}
                    {r.autoApplyOnSignedContract && (
                      <span className="inline-block shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium leading-tight bg-info-100 text-info-700">
                        تلقائي عند التوقيع
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <form action={toggleRuleAction.bind(null, r.id, 'active', !r.active)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant="outline" size="sm">
                        {r.active ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </form>
                    <form action={toggleRuleAction.bind(null, r.id, 'autoApplyOnSignedContract', !r.autoApplyOnSignedContract)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Button type="submit" variant={r.autoApplyOnSignedContract ? 'secondary' : 'primary'} size="sm">
                        {r.autoApplyOnSignedContract ? 'إلغاء التلقائي' : 'تفعيل التلقائي'}
                      </Button>
                    </form>
                  </span>
                </li>
              );
            })}
            {rules.length === 0 && <li className="text-xs text-slate-400 py-2">لا توجد قواعد</li>}
          </ul>

          <form action={createRuleAction} className="space-y-2 border-t border-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="returnTo" value={returnTo} />
              <Input name="name" required placeholder="اسم القاعدة" inputSize="sm" className="flex-1 min-w-[160px]" />
              <Input name="percentage" type="number" step="any" min={0} required placeholder="النسبة %" inputSize="sm" className="w-28" />
              <Button type="submit" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                إضافة قاعدة
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="autoApplyOnSignedContract" className="rounded border-gray-300" />
              استخدام تلقائي عند توقيع العقد
            </label>
          </form>

          <p className="text-[11px] text-slate-400">
            يجب أن تكون هناك قاعدة واحدة نشطة فقط مفعّلة للتطبيق التلقائي عند توقيع العقد. تفعيل التلقائي على قاعدة يُلغيه تلقائياً عن باقي القواعد.
          </p>
          <p className="text-[11px] text-slate-400">
            تغيير القاعدة لا يغيّر المستحقات التي تم إنشاؤها سابقاً.
          </p>
        </CardBody>
      </Card>

      {/* ── Entries table ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">سجلّات المستحقات</CardTitle>
          <span className="text-xs text-slate-400 tabular-nums">
            {entries.length.toLocaleString('ar-EG')} مستحق
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {entriesRes.error ? (
            <div className="m-4 rounded-lg bg-red-50 text-red-700 p-3 text-sm">{entriesRes.error}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <BadgePercent className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد مستحقات تطابق الفلاتر المختارة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium">المندوب</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الفترة</th>
                    <th className="px-4 py-2.5 text-right font-medium">القاعدة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المصدر</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{e.sales?.fullName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{e.period}</td>
                      <td className="px-4 py-2.5 text-slate-600">{e.rule?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', SOURCE_CLS[e.source ?? 'MANUAL'])}>
                          {SOURCE_LABEL[e.source ?? 'MANUAL']}
                        </span>
                        {e.contractId && (
                          <Link href={`/dashboard/contracts/${e.contractId}` as never} className="ms-2 text-[11px] text-brand-700 hover:underline">
                            العقد
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', STATUS_CLS[e.status])}>
                          {STATUS_LABEL[e.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(e.paidAt)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
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

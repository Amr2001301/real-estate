import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Target, Plus, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

interface SalesUser {
  id: string;
  fullName: string;
}
interface SalesTarget {
  id: string;
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
  sales?: { id: string; fullName: string };
}

function redirectBack(formData: FormData, err?: string): never {
  const base = String(formData.get('returnTo') || '/dashboard/targets');
  if (!err) redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}err=${encodeURIComponent(err)}`);
}

// POST /sales-targets is an upsert keyed on (salesId, period): creating a target
// for an existing rep+month updates it rather than duplicating.
async function upsertTargetAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/sales-targets', {
      salesId: String(formData.get('salesId') ?? ''),
      period: String(formData.get('period') ?? ''),
      amountTarget: Number(formData.get('amountTarget') ?? 0),
      unitsTarget: Number(formData.get('unitsTarget') ?? 0),
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/targets');
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const listUrl = sp.salesId
    ? `/sales-targets?salesId=${encodeURIComponent(sp.salesId)}`
    : '/sales-targets';

  const [targetsRes, salesRes] = await Promise.all([
    safe(api.get<SalesTarget[]>(listUrl)),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES&pageSize=200')),
  ]);

  const targets = targetsRes.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];
  const returnTo = sp.salesId
    ? `/dashboard/targets?salesId=${encodeURIComponent(sp.salesId)}`
    : '/dashboard/targets';

  return (
    <div className="space-y-5">
      <PageHeader
        title="أهداف المبيعات"
        description="تحديد أهداف المبيعات الشهرية لكل مندوب (قيمة المبيعات وعدد الوحدات). تُستخدم لاحقاً لقياس الأداء واحتساب التعويضات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'أهداف المبيعات' },
        ]}
      />

      {sp.err && (
        <div className="rounded-2xl bg-warning-50 text-warning-700 p-4 text-sm flex items-start gap-3 border border-warning-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر حفظ الهدف</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      {/* ── Filter ─────────────────────────────────────────────────────────── */}
      <form method="get" action="/dashboard/targets">
        <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-hairline shadow-xs px-4 py-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
            <Select id="salesId" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-44">
              <option value="">كل المندوبين</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {sp.salesId && (
              <a href="/dashboard/targets">
                <Button type="button" variant="secondary" size="sm">إعادة تعيين</Button>
              </a>
            )}
          </div>
        </div>
      </form>

      {/* ── Create / update target ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">إضافة / تحديث هدف</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          {salesUsers.length === 0 ? (
            <p className="text-xs text-slate-400">يلزم وجود مندوب مبيعات واحد على الأقل.</p>
          ) : (
            <form action={upsertTargetAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="flex flex-col gap-1">
                <label htmlFor="t-salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
                <Select id="t-salesId" name="salesId" inputSize="sm" required className="w-44">
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="t-period" className="text-[11px] font-medium text-slate-400">الشهر</label>
                <Input id="t-period" name="period" type="month" required inputSize="sm" className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="t-amount" className="text-[11px] font-medium text-slate-400">هدف القيمة</label>
                <Input id="t-amount" name="amountTarget" type="number" step="any" min={0} required inputSize="sm" className="w-36" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="t-units" className="text-[11px] font-medium text-slate-400">هدف الوحدات</label>
                <Input id="t-units" name="unitsTarget" type="number" min={0} required inputSize="sm" className="w-28" placeholder="0" />
              </div>
              <Button type="submit" variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                حفظ الهدف
              </Button>
            </form>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            حفظ هدف لنفس المندوب والشهر يُحدّث الهدف الحالي بدلاً من تكراره.
          </p>
        </CardBody>
      </Card>

      {/* ── Targets table ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">الأهداف المسجّلة</CardTitle>
          <span className="text-xs text-slate-400 tabular-nums">
            {targets.length.toLocaleString('ar-EG')} هدف
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {targetsRes.error ? (
            <div className="m-4 rounded-lg bg-red-50 text-red-700 p-3 text-sm">{targetsRes.error}</div>
          ) : targets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Target className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد أهداف مسجّلة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium">المندوب</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الشهر</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف القيمة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف الوحدات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{t.sales?.fullName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{t.period}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(t.amountTarget)}</td>
                      <td className="px-4 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{t.unitsTarget.toLocaleString('ar-EG')}</td>
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

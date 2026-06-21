import Link from 'next/link';
import {
  Wallet,
  Eye,
  Clock,
  CircleDollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { CodeText } from '@/components/ui/code-text';
import { api, safe } from '@/lib/api';
import type { Paged, PortalPayout } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerPayoutStatusBadge } from '@/components/badges';
import { PayoutsFilterBar } from '@/components/broker/payouts-filter-bar';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHEQUE:        'شيك',
  CASH:          'نقدي',
  OTHER:         'أخرى',
};

interface Search {
  page?: string;
  q?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['q', 'status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [r, rPaid, rApproved, rProcessing] = await Promise.all([
    safe(api.get<Paged<PortalPayout>>(`/portal/payouts?${qs.toString()}`)),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=PAID')),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalPayout>>('/portal/payouts?page=1&pageSize=1&status=PROCESSING')),
  ]);

  const paged           = r.data;
  const rows            = paged?.data ?? [];
  const paidCount       = rPaid.data?.meta.total       ?? 0;
  const approvedCount   = rApproved.data?.meta.total   ?? 0;
  const processingCount = rProcessing.data?.meta.total ?? 0;

  const pageNet = rows.reduce((s, p) => s + Number(p.totalNet || 0), 0);
  const paidNet = rows
    .filter((p) => p.status === 'PAID')
    .reduce((s, p) => s + Number(p.totalNet || 0), 0);

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title="مدفوعاتي"
        description="الدفعات المالية المرتبطة بعمولاتك — دفعة «مدفوعة» تعني أن الإدارة صرفتها وسجّلتها."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'المدفوعات' },
        ]}
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل المدفوعات: {r.error}
        </div>
      )}

      <PremiumMetricStrip
        metrics={[
          { label: 'إجمالي الدفعات',       value: paged?.meta.total ?? 0, icon: <Wallet />,          tone: 'brand'   },
          { label: 'مدفوعة',               value: paidCount,              icon: <CircleDollarSign />, tone: 'success' },
          { label: 'قيد التنفيذ',           value: processingCount,        icon: <Loader2 />,          tone: 'warning' },
          { label: 'معتمدة — بانتظار صرف', value: approvedCount,           icon: <Clock />,            tone: 'info'    },
        ]}
      />

      <PayoutsFilterBar sp={{ q: sp.q, status: sp.status, period: sp.period, from: sp.from, to: sp.to }} />

      <PremiumSectionCard
        icon={<Wallet />}
        title="قائمة المدفوعات"
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
              <span>دفعة</span>
            </div>
            {pageNet > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  صافي الصفحة:{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(pageNet)}</span>
                </span>
              </>
            )}
            {paidNet > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  مدفوع منها:{' '}
                  <span className="font-semibold text-success-700 tabular-nums">{formatCurrency(paidNet)}</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الدفعة / الفترة</th>
                <th className="text-start font-semibold py-3 px-4">الصافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">طريقة الصرف</th>
                <th className="text-start font-semibold py-3 px-4">المرجع</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<Wallet />}
                      title="لا توجد مدفوعات بعد"
                      description="تظهر هنا عندما تجمّع الإدارة عمولاتك في دفعة وتعتمدها."
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const isCancelled  = p.status === 'CANCELLED';
                const isPaid       = p.status === 'PAID';
                const isProcessing = p.status === 'PROCESSING';

                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-hairline transition-colors align-top',
                      isPaid
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                        : isCancelled
                          ? 'bg-slate-50/60 hover:bg-slate-100/40'
                          : 'hover:bg-surface-muted/40',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-brand-700 font-semibold">
                        <Wallet className="h-3 w-3 text-brand-500 shrink-0" />
                        <CodeText>{p.payoutNumber}</CodeText>
                      </span>
                      {p.period && (
                        <p className="mt-0.5">
                          <CodeText className="text-2xs text-slate-400">{p.period}</CodeText>
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p
                        className={cn(
                          'text-sm font-bold tabular-nums',
                          isCancelled
                            ? 'text-slate-400 line-through'
                            : isPaid
                              ? 'text-success-700'
                              : 'text-slate-900',
                        )}
                      >
                        {formatCurrency(p.totalNet)}
                      </p>
                      {isPaid && (
                        <p className="text-2xs text-success-600 mt-0.5 flex items-center gap-0.5 font-medium">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          تم الصرف
                        </p>
                      )}
                      {isProcessing && (
                        <p className="text-2xs text-amber-600 mt-0.5 flex items-center gap-0.5 font-medium">
                          <Loader2 className="h-3 w-3 shrink-0" />
                          قيد التنفيذ
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <BrokerPayoutStatusBadge status={p.status} />
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-xs text-slate-700">
                        {p.paymentMethod ? (
                          METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </p>
                      <p className="text-2xs text-slate-500 mt-0.5 whitespace-nowrap">
                        {p.paidAt ? (
                          formatDate(p.paidAt)
                        ) : (
                          <span className="text-slate-400 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            لم يُصرف بعد
                          </span>
                        )}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      {p.paymentReference ? (
                        <CodeText className="text-2xs text-slate-500">{p.paymentReference}</CodeText>
                      ) : (
                        <span className="text-slate-400 text-2xs">—</span>
                      )}
                    </td>

                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/payouts/${p.id}` as never}>
                        <IconButton label="عرض" variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/payouts"
            params={{ q: sp.q, status: sp.status, period: sp.period, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>

      <p className="text-2xs text-slate-400 text-center">
        الدفعة «مدفوعة» تعني أن الإدارة صرفتها خارجياً (تحويل بنكي / شيك) وسجّلتها في النظام. تواصل مع إدارتك للاستفسار.
      </p>
    </div>
  );
}

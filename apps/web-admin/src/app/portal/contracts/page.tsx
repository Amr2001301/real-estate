import Link from 'next/link';
import {
  FileText,
  Eye,
  CheckCircle2,
  Clock,
  FilePen,
  BadgePercent,
  AlertCircle,
  Phone,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalContract, PortalProject } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { CodeText } from '@/components/ui/code-text';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { PageKpiCard } from '@/components/ui/page-kpi-card';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  signed?: string;
}

const PAGE_SIZE = 20;

const AVATAR_COLORS = [
  'bg-slate-100 text-slate-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default async function PortalContractsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.signed === 'yes' || sp.signed === 'no') qs.set('signed', sp.signed);

  const [contractsRes, projectsRes, rAll, rSigned, rPending] = await Promise.all([
    safe(api.get<Paged<PortalContract>>(`/portal/contracts?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1&signed=yes')),
    safe(api.get<Paged<PortalContract>>('/portal/contracts?page=1&pageSize=1&signed=no')),
  ]);

  const paged        = contractsRes.data;
  const rows         = paged?.data ?? [];
  const projects     = projectsRes.data ?? [];
  const totalAll     = rAll.data?.meta.total     ?? 0;
  const signedCount  = rSigned.data?.meta.total  ?? 0;
  const pendingCount = rPending.data?.meta.total  ?? 0;

  const pageValue = rows.reduce((s, c) => s + Number(c.totalAmount || 0), 0);

  const isFiltered = !!(sp.projectId || sp.signed);

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="عقودي"
        description="العقود المنبثقة من حجوزاتك — موقّعة أو قيد التوقيع."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العقود' },
        ]}
      />

      {contractsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل العقود: {contractsRes.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PageKpiCard label="إجمالي العقود" value={totalAll}     icon={<FileText />}     tone="brand"   />
        <PageKpiCard label="موقّعة"        value={signedCount}  icon={<CheckCircle2 />} tone="success" />
        <PageKpiCard label="قيد التوقيع"   value={pendingCount} icon={<Clock />}        tone="warning" />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <form
        method="get"
        action="/portal/contracts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-56 shrink-0">
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>
        <Select name="signed" inputSize="sm" defaultValue={sp.signed ?? ''} className="w-44 shrink-0">
          <option value="">كل العقود</option>
          <option value="yes">موقّعة فقط</option>
          <option value="no">قيد التوقيع فقط</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {isFiltered && (
            <Link href="/portal/contracts">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {rows.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
              <span>عقد</span>
            </div>
            {pageValue > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  قيمة الصفحة:{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(pageValue)}</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">القيمة الإجمالية</th>
                <th className="text-start font-semibold py-3 px-4">رقم العقد</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<FileText />}
                      title="لا توجد عقود بعد"
                      description="ستظهر هنا فور تحويل أحد الحجوزات إلى عقد."
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => {
                const clientName = c.customer?.fullName ?? c.reservation?.lead?.fullName;
                const isSigned   = !!c.signedAt;

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-t border-hairline transition-colors align-top',
                      isSigned
                        ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                        : 'hover:bg-surface-muted/40',
                    )}
                  >
                    {/* Client + phone (entity first) */}
                    <td className="py-3 ps-5 pe-4">
                      {clientName ? (
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              'h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0',
                              avatarColor(clientName),
                            )}
                          >
                            {initials(clientName)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-xs truncate max-w-[140px]">
                              {clientName}
                            </p>
                            {(c.customer?.phone ?? c.reservation?.lead?.phone) && (
                              <a
                                href={`tel:${c.customer?.phone ?? c.reservation?.lead?.phone}`}
                                className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                                dir="ltr"
                              >
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {c.customer?.phone ?? c.reservation?.lead?.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Unit / Project */}
                    <td className="py-3 px-4">
                      <CodeText className="text-xs font-semibold text-slate-800">{c.unit?.code ?? '—'}</CodeText>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {c.unit?.building ? tx(c.unit.building.phase.project.name) : '—'}
                      </p>
                    </td>

                    {/* Status (key question first) */}
                    <td className="py-3 px-4">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold">
                          <CheckCircle2 className="h-3 w-3" />
                          موقّع
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                          <FilePen className="h-3 w-3" />
                          قيد التوقيع
                        </span>
                      )}
                    </td>

                    {/* Locked commission (financial outcome) */}
                    <td className="py-3 px-4">
                      {c.reservation?.commissionLockedPct != null ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-amber-100">
                          <BadgePercent className="h-3 w-3" />
                          {Number(c.reservation.commissionLockedPct).toFixed(2)}%
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {c.reservation?.commissionLockedAmount != null && (
                        <p className="text-2xs text-slate-500 mt-1 tabular-nums">
                          {formatCurrency(c.reservation.commissionLockedAmount)}
                        </p>
                      )}
                    </td>

                    {/* Total contract value (deal size context) */}
                    <td className="py-3 px-4 tabular-nums font-semibold text-slate-900 text-xs">
                      {formatCurrency(c.totalAmount)}
                    </td>

                    {/* Contract number (reference, de-emphasised) */}
                    <td className="py-3 px-4">
                      <CodeText className="text-2xs text-slate-500">{c.contractNumber ?? '—'}</CodeText>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/contracts/${c.id}` as never}>
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
            basePath="/portal/contracts"
            params={{ projectId: sp.projectId, signed: sp.signed }}
          />
        )}
      </Card>
    </div>
  );
}

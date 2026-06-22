import Link from 'next/link';
import {
  Plus,
  Users,
  Mail,
  Phone,
  Eye,
  UserCheck,
  UserX,
  Clock,
  Copy,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalLead } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { CodeText } from '@/components/ui/code-text';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerLeadStatusBadge, LeadStageBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerApprovalStatus?: string;
  stage?: string;
  q?: string;
}

const PAGE_SIZE = 20;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

export default async function PortalLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.brokerApprovalStatus) qs.set('brokerApprovalStatus', sp.brokerApprovalStatus);
  if (sp.stage) qs.set('stage', sp.stage);
  if (sp.q) qs.set('q', sp.q);

  const [r, rAll, rPending, rApproved, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalLead>>(`/portal/leads?${qs.toString()}`)),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=PENDING')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=APPROVED')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?page=1&pageSize=1&brokerApprovalStatus=REJECTED')),
  ]);

  const paged          = r.data;
  const rows           = paged?.data ?? [];
  const totalLeads     = rAll.data?.meta.total     ?? 0;
  const pendingCount   = rPending.data?.meta.total  ?? 0;
  const approvedCount  = rApproved.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title="فرصي"
        description="الفرص التي قمتَ بإرسالها للإدارة — تابع حالة كل فرصة ومرحلتها."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص' },
        ]}
        actions={
          <Link href="/portal/leads/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              فرصة جديدة
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل الفرص: {r.error}
        </div>
      )}

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: 'إجمالي الفرص', value: totalLeads,    icon: <Users />,     tone: 'brand'   },
          { label: 'قيد المراجعة', value: pendingCount,  icon: <Clock />,     tone: 'warning' },
          { label: 'موافق عليها',  value: approvedCount, icon: <UserCheck />, tone: 'success' },
          { label: 'مرفوضة',       value: rejectedCount, icon: <UserX />,     tone: 'danger'  },
        ]}
      />

      <PremiumFilterBar
        method="get"
        action="/portal/leads"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {(sp.q || sp.brokerApprovalStatus || sp.stage) && (
              <Link href="/portal/leads">
                <Button type="button" variant="ghost" size="sm">مسح التصفية</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label="بحث">
          <Input
            name="q"
            inputSize="sm"
            leftAddon={<Search />}
            placeholder="بحث: اسم / هاتف / بريد"
            defaultValue={sp.q ?? ''}
            className="flex-1 min-w-[160px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label="حالة المراجعة">
          <Select
            name="brokerApprovalStatus"
            inputSize="sm"
            defaultValue={sp.brokerApprovalStatus ?? ''}
            className="w-44"
          >
            <option value="">كل حالات المراجعة</option>
            <option value="PENDING">قيد المراجعة</option>
            <option value="APPROVED">موافق عليه</option>
            <option value="REJECTED">مرفوض</option>
            <option value="DUPLICATE">مكرر</option>
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label="المرحلة">
          <Select
            name="stage"
            inputSize="sm"
            defaultValue={sp.stage ?? ''}
            className="w-40"
          >
            <option value="">كل المراحل</option>
            <option value="NEW">جديد</option>
            <option value="INTERESTED">مهتم</option>
            <option value="VISIT">زيارة</option>
            <option value="NEGOTIATION">تفاوض</option>
            <option value="WON">فوز</option>
            <option value="LOST">خسارة</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<Users />}
        title="قائمة الفرص"
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>فرصة</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">اهتمام بمشروع</th>
                <th className="text-start font-semibold py-3 px-4">المرحلة</th>
                <th className="text-start font-semibold py-3 px-4">حالة المراجعة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<Users />}
                      title="لا توجد فرص بعد"
                      description="ابدأ بإرسال أول فرصة للإدارة."
                      action={
                        <Link href="/portal/leads/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            فرصة جديدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((l) => {
                const isDuplicate = l.brokerApprovalStatus === 'DUPLICATE';
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      'border-t border-hairline align-top transition-colors hover:bg-surface-muted/40',
                      isDuplicate && 'opacity-60',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(l.fullName)}`}
                        >
                          {isDuplicate ? <Copy className="h-3.5 w-3.5" /> : initials(l.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-xs">{l.fullName}</p>
                          <a
                            href={`tel:${l.phone}`}
                            className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                            dir="ltr"
                          >
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            {l.phone}
                          </a>
                          {l.email && (
                            <a
                              href={`mailto:${l.email}`}
                              className="text-2xs text-slate-400 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                              dir="ltr"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{l.email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {l.projectInterest ? (
                        <>
                          <p className="text-xs font-semibold text-slate-800 truncate max-w-[160px]">
                            {tx(l.projectInterest.name)}
                          </p>
                          {l.unitInterest ? (
                            <p className="mt-0.5">
                              <CodeText className="text-2xs text-slate-500">{l.unitInterest.code}</CodeText>
                            </p>
                          ) : (
                            <p className="text-2xs text-slate-400 mt-0.5">أي وحدة متاحة</p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">لم يحدد</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <LeadStageBadge stage={l.stage} />
                    </td>

                    <td className="py-3 px-4">
                      {l.brokerApprovalStatus ? (
                        <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {formatDate(l.brokerSubmittedAt ?? l.createdAt)}
                    </td>

                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/leads/${l.id}` as never}>
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
            basePath="/portal/leads"
            params={{
              q: sp.q,
              brokerApprovalStatus: sp.brokerApprovalStatus,
              stage: sp.stage,
            }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}

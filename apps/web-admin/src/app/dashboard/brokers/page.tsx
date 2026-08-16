import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Plus,
  Briefcase,
  CheckCircle2,
  PauseCircle,
  Hourglass,
  Eye,
  Pencil,
  Users as UsersIcon,
  ShieldCheck,
  MapPin,
  Building2,
  Home,
  AlertCircle,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerStatus, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: string;
  city?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function BrokersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokers;

  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.status) qs.set('status', sp.status);
  if (sp.city) qs.set('city', sp.city);
  if (sp.q) qs.set('q', sp.q);

  const [pagedRes, snapshotRes] = await Promise.all([
    safe(api.get<Paged<Broker>>(`/brokers?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
  ]);

  const paged = pagedRes.data;
  const snapshot = snapshotRes.data;
  const rows = paged?.data ?? [];
  const allBrokers = snapshot?.data ?? [];

  const cities = Array.from(
    new Set(allBrokers.map((b) => b.city).filter((c): c is string => Boolean(c))),
  );

  const total = paged?.meta.total ?? allBrokers.length;
  const active = allBrokers.filter((b) => b.status === 'ACTIVE').length;
  const pending = allBrokers.filter((b) => b.status === 'PENDING').length;
  const suspended = allBrokers.filter((b) => b.status === 'SUSPENDED').length;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <Link href={'/dashboard/brokers/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.addBtn}
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: m.kpi.total,
            value: total,
            icon: <Briefcase />,
            tone: 'brand',
            primary: true,
          },
          {
            label: m.kpi.active,
            value: active,
            icon: <CheckCircle2 />,
            tone: 'success',
          },
          {
            label: m.kpi.pending,
            value: pending,
            icon: <Hourglass />,
            tone: 'warning',
          },
          {
            label: m.kpi.suspended,
            value: suspended,
            icon: <PauseCircle />,
            tone: 'danger',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {pagedRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorPrefix} {pagedRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/brokers">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="brk-q" className="sr-only">{m.filter.searchLabel}</label>
          <Input
            id="brk-q"
            name="q"
            inputSize="sm"
            placeholder={m.filter.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            leftAddon={<Search />}
            className="w-full"
          />
        </div>
        <PremiumFilterField label={m.filter.statusLabel} htmlFor="brk-status">
          <Select id="brk-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
            <option value="">{m.filter.allStatuses}</option>
            <option value="PENDING">{m.filter.pending}</option>
            <option value="ACTIVE">{m.filter.active}</option>
            <option value="SUSPENDED">{m.filter.suspended}</option>
            <option value="TERMINATED">{m.filter.expired}</option>
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.cityLabel} htmlFor="brk-city">
          <Select id="brk-city" name="city" inputSize="sm" defaultValue={sp.city ?? ''} className="w-40 shrink-0">
            <option value="">{uiT(locale).common.allCities}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </PremiumFilterField>

        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {(sp.status || sp.city || sp.q) && (
            <Link href={'/dashboard/brokers' as never}>
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Brokers table ────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<Briefcase />}
        title={m.sectionTitle}
        description={m.sectionDesc}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {total.toLocaleString('ar-EG')} {m.brokerSuffix}
          </span>
        }
      >
        {rows.length === 0 && !pagedRes.error ? (
          <PremiumEmptyState
            icon={<Briefcase />}
            title={m.empty.title}
            description={m.empty.description}
            action={
              <Link href={'/dashboard/brokers/new' as never}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {m.empty.addBtn}
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">{m.cols.company}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.status}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.city}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.staff}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.projects}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.units}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.cols.added}</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((b) => {
                  const counts = b._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                    >
                      <td className="py-3.5 ps-5 pe-4">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/brokers/${b.id}` as never}
                            className="font-semibold text-slate-900 hover:text-brand-700 transition-colors block truncate max-w-[260px]"
                          >
                            {b.companyName}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {b.commercialName && (
                              <span className="text-2xs text-slate-400 truncate max-w-[200px]">
                                {b.commercialName}
                              </span>
                            )}
                            <span
                              className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-px font-mono text-2xs text-slate-500 shrink-0 leading-none"
                              dir="ltr"
                            >
                              {b.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <BrokerStatusBadge status={b.status as BrokerStatus} locale={locale} />
                      </td>

                      <td className="py-3.5 px-4">
                        {b.city ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {b.city}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <MetricChip icon={<UsersIcon />} value={counts.brokerUsers} />
                      </td>
                      <td className="py-3.5 px-4">
                        <MetricChip icon={<Building2 />} value={counts.projectAccess} />
                      </td>
                      <td className="py-3.5 px-4">
                        <MetricChip icon={<Home />} value={counts.unitAccess} />
                      </td>

                      <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                        {formatDate(b.createdAt)}
                      </td>

                      <td className="py-3.5 ps-4 pe-5">
                        <div className="flex items-center gap-0.5">
                          <Link href={`/dashboard/brokers/${b.id}` as never}>
                            <IconButton label={m.actionBtns.view} variant="ghost" size="sm">
                              <Eye />
                            </IconButton>
                          </Link>
                          <Link href={`/dashboard/brokers/${b.id}/edit` as never}>
                            <IconButton label={m.actionBtns.edit} variant="ghost" size="sm">
                              <Pencil />
                            </IconButton>
                          </Link>
                          <Link href={`/dashboard/brokers/${b.id}/users` as never}>
                            <IconButton label={m.actionBtns.staff} variant="ghost" size="sm">
                              <UsersIcon />
                            </IconButton>
                          </Link>
                          <Link href={`/dashboard/brokers/${b.id}/access` as never}>
                            <IconButton label={m.actionBtns.access} variant="ghost" size="sm">
                              <ShieldCheck />
                            </IconButton>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paged && paged.meta.total > PAGE_SIZE && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/brokers"
          params={{ status: sp.status, city: sp.city, q: sp.q }}
          locale={locale}
        />
      )}
    </div>
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────

function MetricChip({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-canvas px-2 py-1 text-xs font-medium tabular-nums text-slate-700 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:text-slate-400">
      {icon}
      {value}
    </span>
  );
}

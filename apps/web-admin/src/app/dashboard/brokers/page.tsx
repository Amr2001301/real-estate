import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Plus,
  Briefcase,
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
import { brokerOptions } from '@/lib/options';
import type { Broker, BrokerStatus, Paged } from '@/lib/types';
import { formatDate, intlLocale } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { FigureBar, Avatar } from '@/components/cockpit/cockpit';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { EntityLink } from '@/components/entity-link';

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

  // FG-23 — the KPI strip and the city dropdown used to come from a
  // ?pageSize=200 snapshot of full rows: counts wrong past 200 brokers, cities
  // capped at 200. The counts now come from meta.facets of an unfiltered
  // one-row page (computed in SQL over the whole set), the cities from
  // /brokers/options (every broker, a few columns).
  const [pagedRes, snapshotRes, optionsRes] = await Promise.all([
    safe(api.get<Paged<Broker>>(`/brokers?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=1')),
    safe(brokerOptions()),
  ]);

  const paged = pagedRes.data;
  const snapshot = snapshotRes.data;
  const rows = paged?.data ?? [];

  const cities = Array.from(
    new Set(
      (optionsRes.data?.data ?? []).map((b) => b.city).filter((c): c is string => Boolean(c)),
    ),
  );

  const byStatus = snapshot?.meta.facets?.counts?.status ?? {};
  const total = snapshot?.meta.total ?? paged?.meta.total ?? 0;
  const active = byStatus.ACTIVE ?? 0;
  const pending = byStatus.PENDING ?? 0;
  const suspended = byStatus.SUSPENDED ?? 0;

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
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.kpi.total, value: total },
            { label: m.kpi.active, value: active },
            { label: m.kpi.pending, value: pending, warn: pending > 0 },
            { label: m.kpi.suspended, value: suspended },
          ]}
        />
      </section>

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
            {total.toLocaleString(intlLocale(locale))} {m.brokerSuffix}
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
          <ul className="divide-y divide-hairline">
            {rows.map((b) => {
              const counts = b._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
              return (
                <li
                  key={b.id}
                  data-testid="broker-row"
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,0.7fr)_200px_120px_minmax(0,0.6fr)_auto]"
                >
                  <Avatar name={b.companyName} className="h-11 w-11 text-[14px]" />

                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/brokers/${b.id}` as never}
                      className="block truncate text-[14.5px] font-bold text-slate-900 transition-colors hover:text-brand-700"
                    >
                      {b.companyName}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
                      {b.commercialName && <span className="truncate" dir="auto">{b.commercialName}</span>}
                      <span>
                        <span className="me-1 text-slate-400">{locale === 'en' ? 'Code' : 'كود'}</span>
                        <EntityLink kind="broker" id={b.id} className="whitespace-nowrap">{b.code}</EntityLink>
                      </span>
                    </p>
                  </div>

                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{m.cols.city}</p>
                    {b.city ? (
                      <p className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        {b.city}
                      </p>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )}
                  </div>

                  <div className="hidden items-center gap-1.5 lg:flex">
                    <MetricChip icon={<UsersIcon />} label={m.cols.staff} value={counts.brokerUsers} />
                    <MetricChip icon={<Building2 />} label={m.cols.projects} value={counts.projectAccess} />
                    <MetricChip icon={<Home />} label={m.cols.units} value={counts.unitAccess} />
                  </div>

                  <div className="justify-self-end lg:justify-self-start">
                    <BrokerStatusBadge status={b.status as BrokerStatus} locale={locale} />
                  </div>

                  <div className="hidden text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{m.cols.added}</p>
                    <p className="whitespace-nowrap font-semibold text-slate-800">{formatDate(b.createdAt, locale)}</p>
                  </div>

                  <div className="col-span-3 flex items-center gap-1.5 lg:col-span-1">
                    {[
                      { href: `/dashboard/brokers/${b.id}`, label: m.actionBtns.view, icon: <Eye /> },
                      { href: `/dashboard/brokers/${b.id}/edit`, label: m.actionBtns.edit, icon: <Pencil /> },
                      { href: `/dashboard/brokers/${b.id}/users`, label: m.actionBtns.staff, icon: <UsersIcon /> },
                      { href: `/dashboard/brokers/${b.id}/access`, label: m.actionBtns.access, icon: <ShieldCheck /> },
                    ].map((a) => (
                      <Link
                        key={a.href}
                        href={a.href as never}
                        aria-label={a.label}
                        title={a.label}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900 [&_svg]:h-4 [&_svg]:w-4"
                      >
                        {a.icon}
                      </Link>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
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

function MetricChip({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold tabular-nums text-slate-700 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:text-slate-400"
    >
      {icon}
      {value}
      <span className="sr-only">{label}</span>
    </span>
  );
}

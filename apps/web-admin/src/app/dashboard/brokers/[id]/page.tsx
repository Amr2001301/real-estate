import Link from 'next/link';
import {
  Pencil,
  Users as UsersIcon,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Home,
  FileText,
  BarChart3,
  BookmarkCheck,
  BadgePercent,
  Wallet,
  ExternalLink,
  ToggleRight,
  ArrowUpRight,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { BrokerStatusBadge } from '@/components/badges';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { ActivateBrokerNotice } from './activate-notice';
import { PremiumPageHero } from '@/components/premium';
import { FigureBar } from '@/components/cockpit/cockpit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function commissionModelLabel(model: string, m: ReturnType<typeof uiT>['pages']['brokerDetail']): string {
  if (model === 'PERCENT_OF_SALE') return m.commissionModelPercent;
  if (model === 'FIXED_PER_UNIT') return m.commissionModelFixed;
  if (model === 'TIERED') return m.commissionModelTiered;
  return model;
}

// ── Notes ───────────────────────────────────────────────────────────────────

const STATUS_WORD: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: 'قيد الانضمام', en: 'Pending' },
  ACTIVE: { ar: 'نشط', en: 'Active' },
  SUSPENDED: { ar: 'موقوف', en: 'Suspended' },
  TERMINATED: { ar: 'منتهي', en: 'Terminated' },
};

/**
 * The notes field gathers free text plus lines the API appends:
 * "[ISO] OLD → NEW: reason" on a status change and
 * "[ISO] payout held|released: reason" on a payout hold. Read them as a log.
 */
function noteLines(notes: string, locale: 'ar' | 'en'): Array<{ text: string; at?: string }> {
  const word = (code: string) => STATUS_WORD[code]?.[locale] ?? code;
  return notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const stamped = l.match(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]\s*(.*)$/);
      if (!stamped) return { text: l };
      const [, at, rest] = stamped as unknown as [string, string, string];
      const change = rest.match(/^([A-Z_]+)\s*→\s*([A-Z_]+)\s*:?\s*(.*)$/);
      if (change) {
        const [, from, to, reason] = change as unknown as [string, string, string, string];
        // In Arabic the line reads right to left, so the arrow points left.
        const arrow = locale === 'ar' ? '←' : '→';
        return { text: `${word(from)} ${arrow} ${word(to)}${reason ? ` · ${reason}` : ''}`, at };
      }
      const hold = rest.match(/^payout (held|released)\s*:?\s*(.*)$/);
      if (hold) {
        const held = hold[1] === 'held';
        const label = locale === 'ar' ? (held ? 'إيقاف صرف العمولات' : 'استئناف صرف العمولات') : held ? 'Payouts held' : 'Payouts released';
        return { text: `${label}${hold[2] ? ` · ${hold[2]}` : ''}`, at };
      }
      return { text: rest || '—', at };
    });
}

const CARD = 'rounded-[22px] border border-hairline bg-surface';

function Row({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5">
      <dt className="shrink-0 text-[12.5px] text-slate-500">{label}</dt>
      <dd className={cn('min-w-0 truncate text-end text-[13.5px] font-bold text-slate-900', ltr && 'whitespace-nowrap font-mono text-[13px]')} dir={ltr ? 'ltr' : undefined}>
        {value || <span className="font-normal text-slate-300">—</span>}
      </dd>
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-6 pb-3 pt-5 font-heading text-[18px] font-bold text-slate-900">{children}</h2>;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function BrokerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerDetail;
  const r = await safe(api.get<Broker>(`/brokers/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        {m.errorLoad}{r.error ?? m.errorNotFound}
      </div>
    );
  }

  const broker = r.data;
  const counts = broker._count ?? { brokerUsers: 0, projectAccess: 0, unitAccess: 0 };
  const commissionModel = commissionModelLabel(broker.commissionModel, m);
  const notes = broker.notes ? noteLines(broker.notes, locale) : [];
  const base = `/dashboard/brokers/${broker.id}`;

  const links: Array<{ href: string; label: string; icon: React.ReactNode; tone: string }> = [
    { href: `/dashboard/broker-leads?brokerId=${broker.id}`, label: m.cmdLeads, icon: <UsersIcon />, tone: 'bg-sky-500/12 text-sky-600' },
    { href: `/dashboard/broker-reservations?brokerId=${broker.id}`, label: m.cmdReservations, icon: <BookmarkCheck />, tone: 'bg-amber-500/12 text-amber-600' },
    { href: `/dashboard/broker-contracts?brokerId=${broker.id}`, label: m.cmdContracts, icon: <FileText />, tone: 'bg-emerald-500/12 text-emerald-600' },
    { href: `/dashboard/broker-commissions?brokerId=${broker.id}`, label: m.cmdCommissions, icon: <BadgePercent />, tone: 'bg-violet-500/12 text-violet-600' },
    { href: `/dashboard/broker-payouts?brokerId=${broker.id}`, label: m.cmdPayouts, icon: <Wallet />, tone: 'bg-[#D8B66A]/[0.16] text-[#9A7A2E] dark:text-[#D8B66A]' },
    { href: `${base}/performance`, label: m.cmdPerformance, icon: <BarChart3 />, tone: 'bg-brand-500/12 text-brand-700' },
    { href: `${base}/users`, label: m.cmdEmployees, icon: <UsersIcon />, tone: 'bg-slate-500/12 text-slate-600' },
    { href: `${base}/access`, label: m.cmdPermissions, icon: <ShieldCheck />, tone: 'bg-slate-500/12 text-slate-600' },
  ];

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={broker.companyName}
        description={broker.commercialName ?? undefined}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: broker.companyName },
        ]}
        meta={
          <>
            <BrokerStatusBadge status={broker.status} locale={locale} />
            <span className="text-[12px] text-slate-500">
              <span className="me-1 text-slate-400">{locale === 'en' ? 'Code' : 'كود'}</span>
              <span className="whitespace-nowrap font-mono" dir="ltr">{broker.code}</span>
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${base}/edit#status` as never}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[13px] font-bold text-slate-700 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
            >
              <ToggleRight className="h-4 w-4" />
              {m.btnChangeStatus}
            </Link>
            <Link href={`${base}/edit` as never}>
              <Button variant="primary" size="md" leftIcon={<Pencil className="h-4 w-4" />}>{m.btnEdit}</Button>
            </Link>
          </div>
        }
      />

      {broker.status === 'PENDING' && <ActivateBrokerNotice brokerId={broker.id} locale={locale} />}

      <section data-testid="broker-figures" className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.kpiEmployees, value: counts.brokerUsers, href: `${base}/users` },
            { label: m.kpiProjects, value: counts.projectAccess, href: `${base}/access` },
            { label: m.kpiUnits, value: counts.unitAccess, href: `${base}/access?tab=units` },
            { label: m.kpiDefaultCommission, value: `${Number(broker.defaultCommissionPct ?? 0).toFixed(2)}%`, sub: commissionModel },
          ]}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* ── Main ─────────────────────────────────────────────────────── */}
        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Contact */}
            <section className={CARD}>
              <CardTitle>{m.sectionContact}</CardTitle>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {[
                  { icon: <Phone />, label: m.labelPhone, value: broker.phone, ltr: true, href: broker.phone ? `tel:${broker.phone}` : undefined },
                  { icon: <Mail />, label: m.labelEmail, value: broker.email, ltr: true, href: broker.email ? `mailto:${broker.email}` : undefined },
                  { icon: <MapPin />, label: m.labelCity, value: broker.city },
                  { icon: <Home />, label: m.labelAddress, value: broker.address },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-3 px-6 py-3.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A] [&_svg]:h-4 [&_svg]:w-4">
                      {c.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] text-slate-500">{c.label}</p>
                      {c.value ? (
                        c.href ? (
                          <a href={c.href} className="block truncate text-[13.5px] font-bold text-slate-900 hover:text-brand-700" dir={c.ltr ? 'ltr' : undefined}>{c.value}</a>
                        ) : (
                          <p className="truncate text-[13.5px] font-bold text-slate-900">{c.value}</p>
                        )
                      ) : (
                        <p className="text-[13.5px] text-slate-300">—</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Legal & banking */}
            <section className={CARD}>
              <CardTitle>{m.sectionLegal}</CardTitle>
              <dl className="divide-y divide-hairline border-t border-hairline">
                <Row label={m.labelTaxId} value={broker.taxId} ltr />
                <Row label={m.labelCommReg} value={broker.commercialRegistration} ltr />
                <Row label={m.labelBank} value={broker.bankName} />
                <Row label={m.labelBankAccountName} value={broker.bankAccountName} />
                <Row label={m.labelIban} value={broker.bankIban} ltr />
              </dl>
            </section>
          </div>

          {/* Internal notes as a log */}
          {notes.length > 0 && (
            <section data-testid="broker-notes" className={cn(CARD, 'pb-5')}>
              <CardTitle>{m.sectionNotes}</CardTitle>
              <ol className="border-t border-hairline px-6 pt-5">
                {notes.map((n, i) => (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < notes.length - 1 && <span aria-hidden className="absolute start-[4px] top-4 h-full w-px bg-hairline" />}
                    <span className="relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full border-2 border-[#C9A24E] bg-surface" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] leading-relaxed text-slate-800">{n.text}</p>
                      {n.at && <p className="mt-0.5 text-[12px] text-slate-500">{formatDateTime(n.at, locale)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <OwnerDocumentsCard
            ownerType="BROKER"
            ownerId={broker.id}
            legacy={
              broker.contractPdfUrl
                ? [{ label: m.legacyDocLabel, href: broker.contractPdfUrl, hint: m.legacyDocHint }]
                : undefined
            }
          />
        </div>

        {/* ── Side ─────────────────────────────────────────────────────── */}
        <aside className="space-y-6">
          <section data-testid="broker-links" className={cn(CARD, 'p-5')}>
            <p className="px-1 pb-3 text-[12px] font-semibold text-slate-500">{m.cmdTitle}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href as never}
                  className="group flex items-center gap-2.5 rounded-2xl border border-hairline px-3 py-3 transition-colors hover:border-[#C9A24E]/50 hover:bg-surface-muted/40"
                >
                  <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4', l.tone)}>{l.icon}</span>
                  <span className="truncate text-[13px] font-bold text-slate-800">{l.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className={CARD}>
            <CardTitle>{m.sectionContract}</CardTitle>
            <dl className="divide-y divide-hairline border-t border-hairline">
              <Row label={m.labelContractStart} value={broker.contractStartAt ? formatDate(broker.contractStartAt, locale) : null} />
              <Row label={m.labelContractEnd} value={broker.contractEndAt ? formatDate(broker.contractEndAt, locale) : null} />
              <div className="flex items-center justify-between gap-4 px-6 py-3.5">
                <dt className="text-[12.5px] text-slate-500">{m.labelContractFile}</dt>
                <dd>
                  {broker.contractPdfUrl ? (
                    <a href={broker.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 hover:text-brand-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {m.openFile}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-[13px] text-slate-300">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

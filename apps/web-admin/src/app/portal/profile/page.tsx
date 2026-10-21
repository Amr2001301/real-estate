import type { ReactNode } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  CalendarRange,
  FileText,
  ShieldCheck,
  Star,
  Building2,
  AlertTriangle,
  AlertCircle,
  UserCircle,
  ExternalLink,
  CalendarDays,
  BadgePercent,
  Users,
  Check,
  Minus,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalMe } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { cn } from '@/lib/cn';
import { BrokerStatusBadge, BrokerUserStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function contractDaysLeft(endAt: string | null | undefined): number | null {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

/** Muted placeholder for a missing value. */
function Empty({ text }: { text: string }) {
  return <span className="text-[13px] font-normal text-slate-400">{text}</span>;
}

/** Label above value, the label quiet and the value the thing to read. */
function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-[#C9A24E]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-[14.5px] font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

function PanelHead({ icon, title, sub, trailing }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 pb-4 pt-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C9A24E]/50 text-[#C9A24E] [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[18px] font-bold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {trailing}
    </header>
  );
}

function PermissionRow({ icon, label, allowed, allowedText, deniedText }: {
  icon: ReactNode;
  label: string;
  allowed: boolean;
  allowedText: string;
  deniedText: string;
}) {
  return (
    <li className="flex items-center gap-3 px-6 py-3.5">
      <span
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border [&_svg]:h-4 [&_svg]:w-4',
          allowed ? 'border-emerald-500/40 text-emerald-600' : 'border-hairline text-slate-400',
        )}
      >
        {icon}
      </span>
      <span className={cn('flex-1 text-[14px] font-semibold', allowed ? 'text-slate-900' : 'text-slate-500')}>{label}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold',
          allowed ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/12 text-slate-500',
        )}
      >
        {allowed ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        {allowed ? allowedText : deniedText}
      </span>
    </li>
  );
}

export default async function PortalProfilePage() {
  const locale = await getLocale();
  const t = portalMoneyTeamT(locale).profile;
  const r = await safe(api.get<PortalMe>('/portal/profile'));

  if (r.error || !r.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        {t.loadError(r.error ?? t.loadErrorFallback)}
      </div>
    );
  }

  const me              = r.data;
  const commissionModel = t.commissionModel[me.broker.commissionModel] ?? me.broker.commissionModel;
  const daysLeft        = contractDaysLeft(me.broker.contractEndAt);
  const contractExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const contractExpired      = daysLeft !== null && daysLeft < 0;
  const hasContractDates     = me.broker.contractStartAt || me.broker.contractEndAt;
  const userName             = me.user.fullName ?? me.user.email ?? '';

  // Share of the agreement term already behind us, for the term bar.
  const termPct = (() => {
    const a = me.broker.contractStartAt ? new Date(me.broker.contractStartAt).getTime() : NaN;
    const b = me.broker.contractEndAt ? new Date(me.broker.contractEndAt).getTime() : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    return Math.min(100, Math.max(0, Math.round(((Date.now() - a) / (b - a)) * 100)));
  })();
  const en = locale === 'en';

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Contract alerts ─────────────────────────────────────────── */}
      {contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{t.contractExpiredTitle}</p>
            <p className="text-2xs mt-0.5 text-danger-600">{t.contractExpiredBody}</p>
          </div>
        </div>
      )}
      {contractExpiringSoon && !contractExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{t.contractExpiringTitle(daysLeft!)}</p>
            <p className="text-2xs mt-0.5 text-amber-700">{t.contractExpiringBody}</p>
          </div>
        </div>
      )}

      {/* ── Identity: on the page ground, like the other portal heroes ── */}
      <section className="flex flex-wrap items-center gap-5 pt-2">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B66A] to-[#B38B3A] text-[22px] font-extrabold text-[#1A1408]">
          {userName ? initials(userName) : <UserCircle className="h-9 w-9" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[30px] font-bold leading-[1.3] text-slate-900 sm:text-[34px]">
              {me.user.fullName ?? <Empty text={t.noName} />}
            </h1>
            <BrokerUserStatusBadge status={me.brokerUser.status} locale={locale} />
            {me.brokerUser.isPrimaryContact && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24E]/12 px-2.5 py-1 text-[11.5px] font-bold text-brand-700">
                <Star className="h-3 w-3 fill-current" />
                {t.primaryContact}
              </span>
            )}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-slate-500">
            {me.brokerUser.jobTitle && (
              <>
                <span className="font-semibold text-slate-700">{me.brokerUser.jobTitle}</span>
                <span className="text-slate-300">·</span>
              </>
            )}
            <Building2 className="h-3.5 w-3.5 shrink-0 text-[#C9A24E]" />
            <span>{me.broker.companyName}</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[12px] text-slate-400" dir="ltr">{me.broker.code}</span>
          </p>
        </div>
      </section>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface" data-testid="profile-account">
        <PanelHead icon={<UserCircle />} title={t.accountSection} />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field icon={<Mail />} label={t.accountEmail}>
            {me.user.email ? (
              <a href={`mailto:${me.user.email}`} className="hover:text-brand-700"><bdi>{me.user.email}</bdi></a>
            ) : <Empty text={t.notAvailable} />}
          </Field>
          <Field icon={<Phone />} label={t.userPhone}>
            {me.user.phone ? (
              <a href={`tel:${me.user.phone}`} className="tabular-nums hover:text-brand-700"><bdi>{me.user.phone}</bdi></a>
            ) : <Empty text={t.notSet} />}
          </Field>
          <Field icon={<CalendarRange />} label={t.joinedAt}>
            {me.brokerUser.joinedAt ?? me.brokerUser.invitedAt
              ? <bdi className="tabular-nums">{formatDate(me.brokerUser.joinedAt ?? me.brokerUser.invitedAt, locale)}</bdi>
              : <Empty text={t.notAvailable} />}
          </Field>
          <Field icon={<CalendarDays />} label={t.lastLogin}>
            {me.user.lastLoginAt
              ? <bdi className="tabular-nums">{formatDate(me.user.lastLoginAt, locale)}</bdi>
              : <Empty text={t.neverLoggedIn} />}
          </Field>
        </dl>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6">

        {/* ── Firm ────────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface lg:col-span-2" data-testid="profile-firm">
          <PanelHead
            icon={
              me.broker.logoUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={me.broker.logoUrl} alt={me.broker.companyName} className="h-full w-full rounded-full object-cover" />
                : <Building2 />
            }
            title={
              <span className="flex flex-wrap items-center gap-2">
                {me.broker.companyName}
                <BrokerStatusBadge status={me.broker.status} locale={locale} />
              </span>
            }
            sub={
              <span className="flex flex-wrap items-center gap-x-2">
                {me.broker.commercialName && <bdi>{me.broker.commercialName}</bdi>}
                {me.broker.commercialName && <span className="text-slate-300">·</span>}
                <span className="font-mono text-[12px]" dir="ltr">{me.broker.code}</span>
              </span>
            }
          />

          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-2">
            <Field icon={<Mail />} label={t.companyEmail}>
              {me.broker.email
                ? <a href={`mailto:${me.broker.email}`} className="hover:text-brand-700"><bdi>{me.broker.email}</bdi></a>
                : <Empty text={t.notAvailable} />}
            </Field>
            <Field icon={<Phone />} label={t.companyPhone}>
              {me.broker.phone
                ? <a href={`tel:${me.broker.phone}`} className="tabular-nums hover:text-brand-700"><bdi>{me.broker.phone}</bdi></a>
                : <Empty text={t.notAvailable} />}
            </Field>
            <Field icon={<MapPin />} label={t.city}>
              {me.broker.city ?? <Empty text={t.notSetFem} />}
            </Field>
            <Field icon={<MapPin />} label={t.address}>
              {me.broker.address ?? <Empty text={t.notSet} />}
            </Field>
          </dl>

          {/* Commission: the rate as the page's one big figure */}
          <div className="grid grid-cols-1 border-t border-hairline sm:grid-cols-2">
            <div className="px-6 py-5 sm:border-e sm:border-hairline">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                <BadgePercent className="h-3.5 w-3.5 text-[#C9A24E]" />
                {t.defaultRate}
              </p>
              <p className="mt-2 text-[38px] font-bold leading-none tabular-nums text-[#C9A24E]" data-testid="profile-commission">
                {Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}
                <span className="ms-1 text-[20px] font-semibold">%</span>
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[11.5px] font-semibold text-slate-500">{t.commissionModelLabel}</p>
              <p className="mt-2 text-[15px] font-bold text-slate-900">{commissionModel}</p>
            </div>
          </div>

          {/* Agreement term: two dates, each isolated so RTL never scrambles them */}
          <div className="border-t border-hairline px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11.5px] font-semibold text-slate-500">{t.agreementTerm}</p>
              {me.broker.contractPdfUrl && (
                <a
                  href={me.broker.contractPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand-700 hover:text-brand-600"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t.openContract}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}
            </div>
            {hasContractDates ? (
              <>
                <div className="mt-3 flex items-end justify-between gap-4" data-testid="profile-term">
                  <div>
                    <p className="text-[11px] text-slate-400">{t.contractStart}</p>
                    <p className="mt-0.5 text-[15px] font-bold tabular-nums text-slate-900">
                      {me.broker.contractStartAt ? <bdi>{formatDate(me.broker.contractStartAt, locale)}</bdi> : <Empty text={t.notAvailable} />}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-[11px] text-slate-400">{t.contractEnd}</p>
                    <p className={cn(
                      'mt-0.5 flex flex-wrap items-center justify-end gap-2 text-[15px] font-bold tabular-nums',
                      contractExpired ? 'text-danger-600' : contractExpiringSoon ? 'text-amber-600' : 'text-slate-900',
                    )}>
                      {me.broker.contractEndAt ? <bdi>{formatDate(me.broker.contractEndAt, locale)}</bdi> : <Empty text={t.notAvailable} />}
                      {contractExpired && (
                        <span className="rounded-full bg-danger-500/12 px-2 py-0.5 text-[11px] font-bold text-danger-600">{t.expired}</span>
                      )}
                      {contractExpiringSoon && !contractExpired && (
                        <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-600">{t.daysLeft(daysLeft!)}</span>
                      )}
                    </p>
                  </div>
                </div>
                {termPct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-slate-500/15">
                      <div className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]" style={{ width: `${termPct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11.5px] tabular-nums text-slate-500">
                      {en ? `${termPct}% of the term elapsed` : `مضى ${termPct}% من مدة الاتفاقية`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-400">
                <CalendarRange className="h-4 w-4 shrink-0" />
                {t.noContractDates}
              </p>
            )}
          </div>
        </section>

        {/* ── Permissions ─────────────────────────────────────────────── */}
        <section className="flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface" data-testid="profile-permissions">
          <PanelHead icon={<ShieldCheck />} title={t.permissionsTitle} sub={t.permissionsDescription} />
          <ul className="divide-y divide-hairline">
            <PermissionRow icon={<Star />} label={t.perms.primaryContact} allowed={me.permissions.isPrimaryContact} allowedText={t.allowed} deniedText={t.denied} />
            <PermissionRow icon={<Users />} label={t.perms.manageTeam} allowed={me.permissions.canManageBrokerUsers} allowedText={t.allowed} deniedText={t.denied} />
            <PermissionRow icon={<BadgePercent />} label={t.perms.viewCommissions} allowed={me.permissions.canViewCommissions} allowedText={t.allowed} deniedText={t.denied} />
          </ul>
          <div className="mt-auto flex items-start gap-2 border-t border-hairline px-6 py-4 text-[12px] leading-relaxed text-slate-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p>{t.footer}</p>
          </div>
        </section>

      </div>
    </div>
  );
}

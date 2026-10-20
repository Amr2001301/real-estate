'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  AlertCircle, AlertTriangle, Bell, BellRing, Check, CheckCircle2, Users, Search, Smartphone,
} from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PremiumPanel } from '@/components/premium';
import { SearchSelect } from '@/components/form/search-select';
import { cn } from '@/lib/cn';
import { Textarea } from '@/components/ui/textarea';
import {
  broadcastNotificationAction,
  previewBroadcastAction,
  type BroadcastState,
  type BroadcastPreviewResult,
} from '@/app/_actions/notifications';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const ROLES = ['ADMIN', 'SALES', 'SALES_MANAGER', 'CUSTOMER', 'BROKER', 'MAINTENANCE_SUPERVISOR', 'CLIENT'] as const;

// Targets that are mass-sends and require estimate + confirmation before send.
const MASS_TARGETS = new Set([
  'ALL_CUSTOMERS', 'ALL_BROKERS', 'ALL_SALES',
  'ALL_MAINTENANCE_SUPERVISORS', 'ALL_ACTIVE',
]);

interface Props {
  locale?: Locale;
  /** Who a single notification can go to, by name. */
  users?: Array<{ id: string; fullName: string; role: string }>;
}

export default function BroadcastForm({ locale = 'ar', users = [] }: Props) {
  const m = uiT(locale).notificationsBroadcast;
  const roleLabels = uiT(locale).pages.users.roleLabels as Record<string, string>;

  const TARGET_OPTIONS = Object.entries(m.targetOptions).map(([value, label]) => ({ value, label }));

  const [state, formAction] = useActionState<BroadcastState, FormData>(
    broadcastNotificationAction,
    {},
  );
  const [target,     setTarget]     = useState('ALL_CUSTOMERS');
  const [targetRole, setTargetRole] = useState('CUSTOMER');
  const [targetUser, setTargetUser] = useState('');
  const [channel,    setChannel]    = useState('IN_APP');
  const [confirmed,   setConfirmed] = useState(false);

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyAr,  setBodyAr]  = useState('');

  const [estimate, setEstimate]     = useState<BroadcastPreviewResult | null>(null);
  const [estimating, startEstimate] = useTransition();

  const isMass = MASS_TARGETS.has(target);

  // PUSH and IN_APP_AND_PUSH channels require estimate to verify Firebase status.
  // Mass targets also require estimate + confirmation checkbox.
  const isPushChannel   = channel === 'PUSH' || channel === 'IN_APP_AND_PUSH';
  const pushNotReady    = isPushChannel && estimate == null;
  const pushUnavailable = isPushChannel && estimate != null && estimate.pushEnabled === false;
  const massNotReady    = isMass && (estimate == null || !confirmed);
  const sendBlocked     = pushNotReady || pushUnavailable || massNotReady;

  function resetEstimate() {
    setEstimate(null);
    setConfirmed(false);
  }

  function handleTargetChange(v: string) {
    setTarget(v);
    resetEstimate();
  }

  function handleChannelChange(v: string) {
    setChannel(v);
    resetEstimate();
  }

  function handleEstimate() {
    const userId = target === 'USER' ? targetUser : undefined;
    const role   = target === 'ROLE' ? targetRole : undefined;
    startEstimate(async () => {
      const result = await previewBroadcastAction(target, channel, userId, role);
      setEstimate(result);
      setConfirmed(false);
    });
  }

  // ── Derived PUSH display state ────────────────────────────────────────────
  const pushEnabled      = estimate?.pushEnabled === true;
  const hasDevices       = (estimate?.estimatedDeviceCount ?? 0) > 0;
  const noDevicesAtAll   = pushEnabled && estimate != null && (estimate.estimatedDeviceCount ?? 0) === 0;

  // ── Result banner helpers ─────────────────────────────────────────────────
  const isInApp  = state.channel === 'IN_APP';
  const isPush   = state.channel === 'PUSH';
  const isDual   = state.channel === 'IN_APP_AND_PUSH';
  const inAppOk  = isInApp && (state.notificationRecordsCreated ?? 0) > 0 && (state.failed ?? 0) === 0;
  const inAppPartial = isInApp && (state.notificationRecordsCreated ?? 0) > 0 && (state.failed ?? 0) > 0;
  const inAppAllFailed = isInApp && (state.notificationRecordsCreated ?? 0) === 0 && (state.failed ?? 0) > 0;
  const pushOk   = isPush && (state.pushSent ?? 0) > 0 && (state.pushFailed ?? 0) === 0;
  const pushPartial = isPush && (state.pushSent ?? 0) > 0 && (state.pushFailed ?? 0) > 0;
  const pushNoDevices = isPush && (state.pushSent ?? 0) === 0 && (state.noDeviceTokens ?? 0) > 0 && (state.pushFailed ?? 0) === 0;
  const pushAllFailed = isPush && (state.pushSent ?? 0) === 0 && (state.noDeviceTokens ?? 0) === 0 && (state.pushFailed ?? 0) > 0;
  const dualDbOk = isDual && (state.notificationRecordsCreated ?? 0) > 0;
  const dualPushOk = isDual && (state.pushSent ?? 0) > 0;
  const dualOk   = isDual && dualDbOk && dualPushOk && (state.failed ?? 0) === 0 && (state.pushFailed ?? 0) === 0;
  const dualPartial = isDual && (dualDbOk || dualPushOk) && !dualOk;
  const dualAllFailed = isDual && !dualDbOk && !dualPushOk;

  const bannerColor =
    inAppOk || pushOk || dualOk     ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :
    inAppPartial || pushPartial || pushNoDevices || dualPartial
                                     ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' :
    'bg-danger-500/10 border-danger-500/30 text-danger-600';

  const bannerIcon =
    inAppOk || pushOk || dualOk
      ? <CheckCircle2 className="h-5 w-5 shrink-0" />
      : <AlertCircle className="h-5 w-5 shrink-0" />;

  const bt = m.bannerTitles;
  const bannerTitle =
    inAppOk        ? bt.inAppOk :
    inAppPartial   ? bt.inAppPartial :
    inAppAllFailed ? bt.inAppAllFailed :
    pushOk         ? bt.pushOk :
    pushPartial    ? bt.pushPartial :
    pushNoDevices  ? bt.pushNoDevices :
    pushAllFailed  ? bt.pushAllFailed :
    dualOk         ? bt.dualOk :
    dualPartial    ? bt.dualPartial :
    dualAllFailed  ? bt.dualAllFailed :
    bt.default;

  const rl = m.resultList;
  const cs = m.contentSection;
  const ch = m.channelSection;
  const ps = m.pushStatus;
  const au = m.audienceSection;
  const dl = m.deepLinkSection;
  const pv = m.previewSection;
  const ft = m.footer;

  const cm = m.composer;
  const [entityType, setEntityType] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const targetLabel =
    target === 'ROLE'
      ? roleLabels[targetRole] ?? targetRole
      : target === 'USER'
        ? users.find((u) => u.id === targetUser)?.fullName ?? m.targetOptions.USER
        : m.targetOptions[target];
  const CHANNELS = [
    { value: 'IN_APP', label: ch.optionInApp, icon: <Bell /> },
    { value: 'PUSH', label: ch.optionPush, icon: <Smartphone /> },
    { value: 'IN_APP_AND_PUSH', label: ch.optionDual, icon: <BellRing /> },
  ];

  return (
    <form action={formAction} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* ── Error banner ─────────────────────────────────────────────── */}
        {state.error && (
          <div className="flex items-start gap-3 rounded-2xl bg-danger-500/10 p-4 text-sm text-danger-600">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-medium">{state.error}</p>
          </div>
        )}

        {/* ── Result banner ────────────────────────────────────────────── */}
        {state.ok && (
          <div className={`flex flex-col gap-2 rounded-2xl border p-4 text-sm ${bannerColor}`}>
            <div className="flex items-center gap-2 font-semibold">
              {bannerIcon}
              {bannerTitle}
            </div>
            <ul className="list-disc space-y-0.5 ps-7">
              <li>{rl.recipients} <span className="font-bold tabular-nums">{state.recipientCount}</span></li>
              {(isInApp || isDual) && (
                <li>
                  {isDual ? rl.notificationsCreatedInApp : rl.notificationsCreated}{' '}
                  <span className="font-bold tabular-nums">{state.notificationRecordsCreated ?? 0}</span>
                </li>
              )}
              {(isInApp || isDual) && (state.failed ?? 0) > 0 && (
                <li>{isDual ? rl.createFailed : rl.failed} <span className="font-bold tabular-nums">{state.failed}</span></li>
              )}
              {(isPush || isDual) && (
                <li>{rl.pushDelivered} <span className="font-bold tabular-nums">{state.pushSent ?? 0}</span></li>
              )}
              {(isPush || isDual) && (state.pushFailed ?? 0) > 0 && (
                <li>{rl.pushFailed} <span className="font-bold tabular-nums">{state.pushFailed}</span></li>
              )}
              {(isPush || isDual) && (state.noDeviceTokens ?? 0) > 0 && (
                <li>{rl.noDeviceTokens} <span className="font-bold tabular-nums">{state.noDeviceTokens}</span></li>
              )}
            </ul>
            {state.failureHint && (
              <p className="mt-1 ps-7 text-xs leading-relaxed opacity-80">{m.failureHints[state.failureHint]}</p>
            )}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────── */}
        <PremiumPanel title={cs.title} sub={cs.description}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={cs.titleArLabel} name="title_ar" required>
              <Input
                id="title_ar"
                name="title_ar"
                required
                maxLength={200}
                placeholder={cs.titleArPlaceholder}
                dir="rtl"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />
            </Field>
            <Field label={cs.titleEnLabel} name="title_en" required>
              <Input
                id="title_en"
                name="title_en"
                required
                maxLength={200}
                placeholder={cs.titleEnPlaceholder}
                dir="ltr"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
              />
            </Field>
            <Field label={cs.bodyArLabel} name="body_ar" required>
              <Textarea
                id="body_ar"
                name="body_ar"
                required
                maxLength={500}
                rows={4}
                placeholder={cs.bodyArPlaceholder}
                dir="rtl"
                value={bodyAr}
                onChange={(e) => setBodyAr(e.target.value)}
              />
              <p className="mt-1 text-end text-[11px] text-slate-500 tabular-nums">{bodyAr.length}/500</p>
            </Field>
            <Field label={cs.bodyEnLabel} name="body_en" required>
              <Textarea
                id="body_en"
                name="body_en"
                required
                maxLength={500}
                rows={4}
                placeholder={cs.bodyEnPlaceholder}
                dir="ltr"
              />
            </Field>
          </div>
        </PremiumPanel>

        {/* ── Channel ──────────────────────────────────────────────────── */}
        <PremiumPanel title={ch.title} sub={ch.description}>
          <div role="radiogroup" data-testid="broadcast-channels" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <OptionTile
                key={c.value}
                name="channel"
                value={c.value}
                checked={channel === c.value}
                onSelect={() => handleChannelChange(c.value)}
                icon={c.icon}
                label={c.label}
                hint={cm.channelHints[c.value]}
              />
            ))}
          </div>

          {isPushChannel && (
            <div
              className={`mt-4 flex items-start gap-3 rounded-2xl p-4 text-sm ${
                pushEnabled && hasDevices ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {pushEnabled && hasDevices ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="text-xs leading-relaxed">
                {estimate == null && (
                  <>
                    <p className="mb-0.5 text-sm font-semibold">{ps.checkFirstTitle(channel)}</p>
                    <p className="opacity-80">{ps.checkFirstDesc}</p>
                  </>
                )}
                {estimate != null && !pushEnabled && (
                  <>
                    <p className="mb-0.5 text-sm font-semibold">{ps.notConfiguredTitle}</p>
                    <p className="opacity-80">{ps.notConfiguredDesc}</p>
                  </>
                )}
                {estimate != null && pushEnabled && hasDevices && (
                  <>
                    <p className="mb-0.5 text-sm font-semibold">{ps.readyTitle}</p>
                    <p className="opacity-80">
                      {ps.readyDesc(estimate.estimatedDeviceCount ?? 0, estimate.usersWithoutDevices ?? undefined)}
                    </p>
                  </>
                )}
                {estimate != null && pushEnabled && noDevicesAtAll && (
                  <>
                    <p className="mb-0.5 text-sm font-semibold">{ps.noDevicesTitle}</p>
                    <p className="opacity-80">{ps.noDevicesDesc}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </PremiumPanel>

        {/* ── Audience ─────────────────────────────────────────────────── */}
        <PremiumPanel title={au.title} sub={au.description}>
          <input type="hidden" name="target" value={target} />
          <div data-testid="broadcast-targets" className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={target === o.value}
                onClick={() => handleTargetChange(o.value)}
                className={cn(
                  'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                  target === o.value
                    ? 'border-brand-500/60 bg-brand-500/12 text-brand-700'
                    : 'border-hairline text-slate-600 hover:border-brand-500/40 hover:text-slate-900',
                )}
              >
                {o.label.replace('…', '')}
              </button>
            ))}
          </div>

          {(target === 'ROLE' || target === 'USER') && (
            <div className="mt-4 max-w-md">
              {target === 'ROLE' && (
                <Field label={au.roleLabel} name="targetRole" required>
                  <Select
                    id="targetRole"
                    name="targetRole"
                    required
                    value={targetRole}
                    onChange={(e) => { setTargetRole(e.target.value); resetEstimate(); }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabels[r] ?? r}</option>
                    ))}
                  </Select>
                </Field>
              )}
              {target === 'USER' && (
                <Field label={au.userIdLabel} name="targetUserId" required>
                  <Select
                    id="targetUserId"
                    name="targetUserId"
                    required
                    value={targetUser}
                    onChange={(e) => { setTargetUser(e.target.value); resetEstimate(); }}
                  >
                    <option value="">{dl.userPick}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} — {roleLabels[u.role] ?? u.role}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleEstimate} disabled={estimating}>
                <Search className="me-1.5 h-3.5 w-3.5" />
                {estimating ? au.estimatingBtn : au.estimateBtn}
              </Button>
              {estimate && !estimate.error && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/12 px-3 py-1 text-sm font-semibold text-brand-700">
                  <Users className="h-3.5 w-3.5" />
                  {estimate.recipientCount} {au.userSuffix}
                  {isPushChannel && estimate.estimatedDeviceCount != null && (
                    <span className="ms-1 flex items-center gap-1 text-xs font-normal">
                      <Smartphone className="h-3 w-3" />
                      {estimate.estimatedDeviceCount} {au.deviceSuffix}
                    </span>
                  )}
                </span>
              )}
              {estimate?.error && (
                <span className="flex items-center gap-1 text-sm text-danger-600">
                  <AlertCircle className="h-4 w-4" />
                  {estimate.error}
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{au.estimateNote}</p>

            {isMass && estimate != null && !estimate.error && (
              <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl bg-amber-500/10 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#c9a24d]"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span className="leading-snug text-amber-600">{au.confirmMass(estimate.recipientCount ?? 0)}</span>
              </label>
            )}
            {isMass && estimate == null && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {isPushChannel ? au.hintPushMassNeedEstimate : au.hintMassNeedEstimate}
              </p>
            )}
            {isPushChannel && estimate == null && !isMass && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {au.hintPushNeedEstimate(channel)}
              </p>
            )}
          </div>
        </PremiumPanel>

        {/* ── Optional link ────────────────────────────────────────────── */}
        <PremiumPanel title={dl.title} sub={dl.entityTypeHint}>
          <input type="hidden" name="entityType" value={entityType} />
          <div data-testid="broadcast-link-types" className="flex flex-wrap gap-2">
            {[['', dl.none] as const, ...Object.entries(dl.entityTypeOptions)].map(([value, label]) => (
              <button
                key={value || 'none'}
                type="button"
                aria-pressed={entityType === value}
                onClick={() => { setEntityType(value); setEntityLabel(''); }}
                className={cn(
                  'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                  entityType === value
                    ? 'border-brand-500/60 bg-brand-500/12 text-brand-700'
                    : 'border-hairline text-slate-600 hover:border-brand-500/40 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {entityType && RECORD_SOURCES[entityType] && (
            <div className="mt-4 max-w-md">
              <Field label={dl.entityIdLabel} name="entityId" required>
                <SearchSelect<Record<string, unknown>>
                  key={entityType}
                  name="entityId"
                  required
                  endpoint={RECORD_SOURCES[entityType]!.endpoint}
                  toOption={(r) => ({ id: String(r.id), label: RECORD_SOURCES[entityType]!.label(r), raw: r })}
                  onChange={(r) => setEntityLabel(r ? RECORD_SOURCES[entityType]!.label(r) : '')}
                  placeholder={dl.recordPick}
                  locale={locale}
                />
              </Field>
            </div>
          )}
        </PremiumPanel>
      </div>

      {/* ── Side: preview, summary, send ───────────────────────────────── */}
      <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
        <section className="relative overflow-hidden rounded-[22px] border border-hairline bg-surface p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.12] via-transparent to-transparent" />
          <div className="relative">
            <h2 className="font-heading text-[19px] font-bold text-slate-900">{cm.previewTitle}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{cm.previewSub}</p>
            <div data-testid="broadcast-preview" className="mt-5 rounded-2xl border border-hairline bg-surface-muted/60 p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408] [&_svg]:h-3.5 [&_svg]:w-3.5">
                  <Bell />
                </span>
                <span className="font-semibold text-slate-700">{cm.brand}</span>
                <span className="ms-auto">{pv.now}</span>
              </div>
              <p className="mt-3 text-[14px] font-bold leading-snug text-slate-900">
                {titleAr || <span className="font-medium text-slate-400">{pv.titlePlaceholder}</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                {bodyAr || <span className="text-slate-400">{pv.bodyPlaceholder}</span>}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
          <h2 className="px-6 pb-3 pt-5 font-heading text-[19px] font-bold text-slate-900">{cm.summaryTitle}</h2>
          <dl className="divide-y divide-hairline border-y border-hairline text-[13px]">
            <SummaryRow label={cm.summaryChannel}>{CHANNELS.find((c) => c.value === channel)?.label}</SummaryRow>
            <SummaryRow label={cm.summaryAudience}>{targetLabel}</SummaryRow>
            <SummaryRow label={cm.summaryRecipients}>
              {estimate && !estimate.error ? (
                <span className="tabular-nums">{estimate.recipientCount} {au.userSuffix}</span>
              ) : (
                <span className="font-normal text-slate-500">{cm.notEstimated}</span>
              )}
            </SummaryRow>
            <SummaryRow label={cm.summaryLink}>
              {entityType ? (
                <span>
                  {dl.entityTypeOptions[entityType]}
                  {entityLabel && <span className="font-normal text-slate-500"> · {entityLabel}</span>}
                </span>
              ) : (
                <span className="font-normal text-slate-500">{dl.none}</span>
              )}
            </SummaryRow>
          </dl>
          <div className="flex flex-col gap-3 p-6">
            <SubmitButton disabled={sendBlocked} className="w-full">
              {ft.submitBtn}
            </SubmitButton>
            <p className="text-center text-[12px] leading-relaxed text-slate-500">
              {pushUnavailable
                ? ft.helperFirebaseUnavailable(channel)
                : pushNotReady
                  ? ft.helperPushNotReady
                  : massNotReady
                    ? ft.helperMassNotReady
                    : ft.helperDefault}
            </p>
          </div>
        </section>
      </aside>
    </form>
  );
}

/** Where to search the record a notification links to, and how to name it. */
const RECORD_SOURCES: Record<string, { endpoint: string; label: (r: Record<string, unknown>) => string }> = {
  contract: {
    endpoint: '/api-proxy/contracts',
    label: (r) => join(r.contractNumber, name(r.customer)),
  },
  reservation: {
    endpoint: '/api-proxy/reservations',
    label: (r) => join(r.reservationNumber, name(r.client) || name(r.lead)),
  },
  deposit: {
    endpoint: '/api-proxy/deposits',
    label: (r) => join(Number(r.amount).toLocaleString('en-US'), String(r.paidAt ?? '').slice(0, 10), name(r.customer)),
  },
  maintenance: {
    endpoint: '/api-proxy/maintenance-requests',
    label: (r) => join(r.requestNumber, String(r.description ?? '').slice(0, 50)),
  },
  visit: {
    endpoint: '/api-proxy/visits/appointments',
    label: (r) => join(r.visitNumber, String(r.scheduledAt ?? '').slice(0, 10), name(r.client) || name(r.lead)),
  },
  lead: {
    endpoint: '/api-proxy/leads',
    label: (r) => join(r.fullName, r.phone),
  },
};

function name(x: unknown): string {
  return (x as { fullName?: string } | null | undefined)?.fullName ?? '';
}

function join(...parts: unknown[]): string {
  return parts.filter((p) => p != null && p !== '').map(String).join(' · ');
}

function OptionTile({
  name: field,
  value,
  checked,
  onSelect,
  icon,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-colors',
        checked
          ? 'border-brand-500/60 bg-brand-500/[0.08] shadow-[0_10px_30px_-18px_rgba(201,162,77,0.8)]'
          : 'border-hairline hover:border-brand-500/40',
      )}
    >
      <input type="radio" name={field} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]',
          checked ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408]' : 'bg-surface-muted text-slate-500',
        )}
      >
        {icon}
      </span>
      <span>
        <span className={cn('block text-[14px] font-bold', checked ? 'text-slate-900' : 'text-slate-700')}>{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-slate-500">{hint}</span>}
      </span>
      {checked && (
        <span className="absolute end-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[#1a1408]">
          <Check className="h-3 w-3" />
        </span>
      )}
    </label>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-end font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

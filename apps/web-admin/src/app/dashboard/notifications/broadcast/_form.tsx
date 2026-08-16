'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Users, Eye, EyeOff, Search, Smartphone,
} from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { Textarea } from '@/components/ui/textarea';
import {
  broadcastNotificationAction,
  previewBroadcastAction,
  type BroadcastState,
  type BroadcastPreviewResult,
} from '@/app/_actions/notifications';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const ROLE_OPTIONS = [
  { value: 'ADMIN',                  label: 'ADMIN' },
  { value: 'SALES',                  label: 'SALES' },
  { value: 'SALES_MANAGER',          label: 'SALES_MANAGER' },
  { value: 'CUSTOMER',               label: 'CUSTOMER' },
  { value: 'BROKER',                 label: 'BROKER' },
  { value: 'MAINTENANCE_SUPERVISOR', label: 'MAINTENANCE_SUPERVISOR' },
  { value: 'CLIENT',                 label: 'CLIENT' },
];

// Targets that are mass-sends and require estimate + confirmation before send.
const MASS_TARGETS = new Set([
  'ALL_CUSTOMERS', 'ALL_BROKERS', 'ALL_SALES',
  'ALL_MAINTENANCE_SUPERVISORS', 'ALL_ACTIVE',
]);

interface Props { locale?: Locale; }

export default function BroadcastForm({ locale = 'ar' }: Props) {
  const m = uiT(locale).notificationsBroadcast;

  const TARGET_OPTIONS = Object.entries(m.targetOptions).map(([value, label]) => ({ value, label }));

  const [state, formAction] = useActionState<BroadcastState, FormData>(
    broadcastNotificationAction,
    {},
  );
  const [target,     setTarget]     = useState('ALL_CUSTOMERS');
  const [targetRole, setTargetRole] = useState('CUSTOMER');
  const [targetUser, setTargetUser] = useState('');
  const [channel,    setChannel]    = useState('IN_APP');
  const [showPreview, setPreview]   = useState(false);
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
    inAppOk || pushOk || dualOk     ? 'bg-success-50 border-success-100 text-success-700' :
    inAppPartial || pushPartial || pushNoDevices || dualPartial
                                     ? 'bg-warning-50 border-warning-200 text-warning-800' :
    'bg-danger-50 border-danger-100 text-danger-700';

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

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {/* ── Result banner ────────────────────────────────────────────────── */}
      {state.ok && (
        <div className={`flex flex-col gap-2 rounded-2xl p-4 text-sm border ${bannerColor}`}>
          <div className="flex items-center gap-2 font-semibold">
            {bannerIcon}
            {bannerTitle}
          </div>

          {/* IN_APP results */}
          {isInApp && (
            <ul className="ps-7 list-disc space-y-0.5">
              <li>{rl.recipients} <span className="font-bold tabular-nums">{state.recipientCount}</span></li>
              <li>{rl.notificationsCreated} <span className="font-bold tabular-nums">{state.notificationRecordsCreated ?? 0}</span></li>
              {(state.failed ?? 0) > 0 && (
                <li>{rl.failed} <span className="font-bold tabular-nums">{state.failed}</span></li>
              )}
              <li className="text-2xs font-mono opacity-60" dir="ltr">ID: {state.broadcastId}</li>
            </ul>
          )}

          {/* PUSH results */}
          {isPush && (
            <ul className="ps-7 list-disc space-y-0.5">
              <li>{rl.recipients} <span className="font-bold tabular-nums">{state.recipientCount}</span></li>
              <li>{rl.pushDelivered} <span className="font-bold tabular-nums">{state.pushSent ?? 0}</span></li>
              {(state.pushFailed ?? 0) > 0 && (
                <li>{rl.pushFailed} <span className="font-bold tabular-nums">{state.pushFailed}</span></li>
              )}
              {(state.noDeviceTokens ?? 0) > 0 && (
                <li>
                  {rl.noDeviceTokens}{' '}
                  <span className="font-bold tabular-nums">{state.noDeviceTokens}</span>
                </li>
              )}
              <li className="text-2xs font-mono opacity-60" dir="ltr">ID: {state.broadcastId}</li>
            </ul>
          )}

          {/* IN_APP_AND_PUSH results */}
          {isDual && (
            <ul className="ps-7 list-disc space-y-0.5">
              <li>{rl.recipients} <span className="font-bold tabular-nums">{state.recipientCount}</span></li>
              <li>{rl.notificationsCreatedInApp} <span className="font-bold tabular-nums">{state.notificationRecordsCreated ?? 0}</span></li>
              {(state.failed ?? 0) > 0 && (
                <li>{rl.createFailed} <span className="font-bold tabular-nums">{state.failed}</span></li>
              )}
              <li>{rl.pushDelivered} <span className="font-bold tabular-nums">{state.pushSent ?? 0}</span></li>
              {(state.pushFailed ?? 0) > 0 && (
                <li>{rl.pushFailed} <span className="font-bold tabular-nums">{state.pushFailed}</span></li>
              )}
              {(state.noDeviceTokens ?? 0) > 0 && (
                <li>
                  {rl.noDeviceTokens}{' '}
                  <span className="font-bold tabular-nums">{state.noDeviceTokens}</span>
                </li>
              )}
              <li className="text-2xs font-mono opacity-60" dir="ltr">ID: {state.broadcastId}</li>
            </ul>
          )}

          {/* Failure hints */}
          {state.failureHint && (
            <p className="mt-1 text-xs leading-relaxed ps-7 opacity-80">
              {m.failureHints[state.failureHint]}
            </p>
          )}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <FormSection title={cs.title} description={cs.description}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label={cs.bodyArLabel} name="body_ar" required>
            <Textarea
              id="body_ar"
              name="body_ar"
              required
              maxLength={500}
              rows={3}
              placeholder={cs.bodyArPlaceholder}
              dir="rtl"
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
            />
          </Field>
          <Field label={cs.bodyEnLabel} name="body_en" required>
            <Textarea
              id="body_en"
              name="body_en"
              required
              maxLength={500}
              rows={3}
              placeholder={cs.bodyEnPlaceholder}
              dir="ltr"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Channel ──────────────────────────────────────────────────────── */}
      <FormSection title={ch.title} description={ch.description}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={ch.fieldLabel} name="channel" required>
            <Select
              id="channel"
              name="channel"
              value={channel}
              onChange={(e) => handleChannelChange(e.target.value)}
            >
              <option value="IN_APP">{ch.optionInApp}</option>
              <option value="PUSH">{ch.optionPush}</option>
              <option value="IN_APP_AND_PUSH">{ch.optionDual}</option>
            </Select>
          </Field>
        </div>

        {/* PUSH status — shown when PUSH or IN_APP_AND_PUSH channel is selected */}
        {isPushChannel && (
          <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 text-sm border ${
            pushEnabled && hasDevices
              ? 'bg-success-50 border-success-200 text-success-800'
              : pushEnabled && noDevicesAtAll
                ? 'bg-warning-50 border-warning-200 text-warning-800'
                : 'bg-warning-50 border-warning-200 text-warning-800'
          }`}>
            {pushEnabled && hasDevices
              ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-success-600" />
              : <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-warning-600" />}
            <div className="text-xs leading-relaxed">
              {estimate == null && (
                <>
                  <p className="font-semibold text-sm mb-0.5">{ps.checkFirstTitle(channel)}</p>
                  <p className="opacity-80">{ps.checkFirstDesc}</p>
                </>
              )}
              {estimate != null && !pushEnabled && (
                <>
                  <p className="font-semibold text-sm mb-0.5">{ps.notConfiguredTitle}</p>
                  <p className="opacity-80">{ps.notConfiguredDesc}</p>
                </>
              )}
              {estimate != null && pushEnabled && hasDevices && (
                <>
                  <p className="font-semibold text-sm mb-0.5">{ps.readyTitle}</p>
                  <p className="opacity-80">
                    {ps.readyDesc(estimate.estimatedDeviceCount ?? 0, estimate.usersWithoutDevices ?? undefined)}
                  </p>
                </>
              )}
              {estimate != null && pushEnabled && noDevicesAtAll && (
                <>
                  <p className="font-semibold text-sm mb-0.5">{ps.noDevicesTitle}</p>
                  <p className="opacity-80">{ps.noDevicesDesc}</p>
                </>
              )}
            </div>
          </div>
        )}
      </FormSection>

      {/* ── Audience ─────────────────────────────────────────────────────── */}
      <FormSection title={au.title} description={au.description}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={au.audienceTypeLabel} name="target" required>
            <Select
              id="target"
              name="target"
              required
              value={target}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          {target === 'ROLE' && (
            <Field label={au.roleLabel} name="targetRole" required>
              <Select
                id="targetRole"
                name="targetRole"
                required
                value={targetRole}
                onChange={(e) => { setTargetRole(e.target.value); resetEstimate(); }}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          )}

          {target === 'USER' && (
            <Field label={au.userIdLabel} name="targetUserId" required>
              <Input
                id="targetUserId"
                name="targetUserId"
                required
                dir="ltr"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                value={targetUser}
                onChange={(e) => { setTargetUser(e.target.value); resetEstimate(); }}
              />
            </Field>
          )}
        </div>

        {/* Estimate section */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEstimate}
              disabled={estimating}
            >
              <Search className="h-3.5 w-3.5 me-1.5" />
              {estimating ? au.estimatingBtn : au.estimateBtn}
            </Button>

            {estimate && !estimate.error && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-sm text-brand-700 font-semibold">
                <Users className="h-3.5 w-3.5" />
                {estimate.recipientCount} {au.userSuffix}
                {isPushChannel && estimate.estimatedDeviceCount != null && (
                  <span className="flex items-center gap-1 ms-1 text-brand-500 font-normal text-xs">
                    <Smartphone className="h-3 w-3" />
                    {estimate.estimatedDeviceCount} {au.deviceSuffix}
                  </span>
                )}
              </span>
            )}

            {estimate?.error && (
              <span className="text-sm text-danger-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {estimate.error}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">{au.estimateNote}</p>

          {/* Confirmation checkbox — mass targets only, after a successful estimate */}
          {isMass && estimate != null && !estimate.error && (
            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600 cursor-pointer"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="text-warning-800 leading-snug">
                {au.confirmMass(estimate.recipientCount ?? 0)}
              </span>
            </label>
          )}

          {/* Hint when action is required before sending */}
          {(isMass && estimate == null) && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-warning-500 shrink-0" />
              {isPushChannel ? au.hintPushMassNeedEstimate : au.hintMassNeedEstimate}
            </p>
          )}
          {isPushChannel && estimate == null && !isMass && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-warning-500 shrink-0" />
              {au.hintPushNeedEstimate(channel)}
            </p>
          )}
        </div>
      </FormSection>

      {/* ── Optional deep link ───────────────────────────────────────────── */}
      <FormSection title={dl.title} description={dl.description}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={dl.entityTypeLabel} name="entityType" hint={dl.entityTypeHint}>
            <Input
              id="entityType"
              name="entityType"
              maxLength={60}
              placeholder={dl.entityTypePlace}
              dir="ltr"
            />
          </Field>
          <Field label={dl.entityIdLabel} name="entityId">
            <Input
              id="entityId"
              name="entityId"
              maxLength={36}
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {pv.toggleShow}
          </span>
          <span className="text-slate-400 text-xs">{pv.toggleHint}</span>
        </button>
        {showPreview && (
          <div className="border-t border-hairline px-4 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-brand-50/30 px-4 py-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {titleAr || <span className="text-slate-400 italic">{pv.titlePlaceholder}</span>}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap" dir="ltr">{pv.now}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-snug">
                  {bodyAr || <span className="italic text-slate-300">{pv.bodyPlaceholder}</span>}
                </p>
              </div>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            </div>
            <p className="mt-2 text-2xs text-slate-400 text-center">{pv.simulationNote}</p>
          </div>
        )}
      </div>

      <FormFooter
        sticky
        primary={
          <SubmitButton disabled={sendBlocked}>
            {ft.submitBtn}
          </SubmitButton>
        }
        helper={
          pushUnavailable
            ? ft.helperFirebaseUnavailable(channel)
            : pushNotReady
              ? ft.helperPushNotReady
              : massNotReady
                ? ft.helperMassNotReady
                : ft.helperDefault
        }
      />
    </form>
  );
}

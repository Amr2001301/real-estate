'use client';

import { useActionState, useState } from 'react';
import type { Locale } from '@/lib/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  disableOwnTwoFactorAction,
  enableOwnTwoFactorAction,
  newRecoveryCodesAction,
  startOwnTwoFactorAction,
  type TwoFactorResult,
} from '@/lib/security-actions';
import { QrCode } from './qr-code';
import { securityT } from './security-messages';

export interface TwoFactorStatus {
  available: boolean;
  enabled: boolean;
  recoveryCodesLeft: number;
  required: boolean;
}

function CodeInput({ label }: { label: string }) {
  return (
    <label className="grid gap-1 text-[12.5px] font-semibold text-slate-600">
      {label}
      <Input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" dir="ltr" placeholder="000000" className="max-w-[180px] tracking-[0.3em]" />
    </label>
  );
}

function Codes({ codes, locale }: { codes: string[]; locale: Locale }) {
  const m = securityT(locale);
  return (
    <div className="space-y-2 rounded-xl border border-[#D8B66A]/40 bg-[#D8B66A]/10 p-4" data-testid="recovery-codes">
      <p className="text-[13px] font-bold text-slate-900">{m.tfaCodesTitle}</p>
      <p className="text-[12.5px] text-slate-600">{m.tfaCodesHint}</p>
      <ul dir="ltr" className="grid grid-cols-2 gap-1.5 font-mono text-[13.5px] text-slate-900 sm:grid-cols-5">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  );
}

/** TFA1 — turning two-step sign-in on (scan, confirm), new recovery codes, and off. */
export function TwoFactorCard({ status, locale }: { status: TwoFactorStatus; locale: Locale }) {
  const m = securityT(locale);
  const [setup, setSetup] = useState<TwoFactorResult | null>(null);
  const [panel, setPanel] = useState<'codes' | 'disable' | null>(null);
  const [enableState, enable, enabling] = useActionState<TwoFactorResult, FormData>(enableOwnTwoFactorAction, {});
  const [codesState, regenerate, regenerating] = useActionState<TwoFactorResult, FormData>(newRecoveryCodesAction, {});
  const [disableState, disable, disabling] = useActionState<TwoFactorResult, FormData>(disableOwnTwoFactorAction, {});

  const shownCodes = enableState.recoveryCodes ?? codesState.recoveryCodes;

  return (
    <div className="space-y-4" data-testid="two-factor-card">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
            status.enabled ? 'bg-emerald-500/12 text-emerald-700' : 'bg-slate-500/10 text-slate-600',
          )}
          data-testid="two-factor-state"
        >
          {status.enabled ? m.tfaOn : m.tfaOff}
        </span>
        {status.enabled && <span className="text-[12.5px] text-slate-500">{m.tfaCodesLeft(status.recoveryCodesLeft)}</span>}
      </div>
      <p className="max-w-2xl text-[12.5px] text-slate-600">{m.tfaDesc}</p>
      {status.required && <p className="text-[12.5px] font-semibold text-brand-700">{m.tfaRequired}</p>}

      {shownCodes && <Codes codes={shownCodes} locale={locale} />}
      {enableState.ok && <p role="status" className="text-[12.5px] font-semibold text-emerald-700">{m.tfaEnabled}</p>}
      {disableState.ok && <p role="status" className="text-[12.5px] font-semibold text-emerald-700">{m.tfaDisabled}</p>}

      {!status.enabled && !enableState.ok && (
        setup?.secret ? (
          <form action={enable} className="grid gap-3" data-testid="two-factor-setup">
            <p className="text-[12.5px] text-slate-600">{m.tfaScan}</p>
            <div className="flex flex-wrap items-center gap-4">
              <QrCode value={setup.otpauthUrl!} label={m.tfaQr} size={160} />
              <code dir="ltr" data-testid="totp-secret" className="select-all break-all rounded-lg bg-surface-muted px-3 py-1.5 text-[13px] text-slate-800">{setup.secret}</code>
            </div>
            <CodeInput label={m.tfaCode} />
            {enableState.error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{enableState.error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={enabling}>{m.tfaConfirm}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSetup(null)}>{m.tfaCancel}</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {setup?.error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{setup.error}</p>}
            <Button type="button" variant="primary" size="sm" onClick={async () => setSetup(await startOwnTwoFactorAction())}>{m.tfaEnable}</Button>
          </div>
        )
      )}

      {status.enabled && !disableState.ok && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPanel(panel === 'codes' ? null : 'codes')}>{m.tfaNewCodes}</Button>
            {!status.required && (
              <Button type="button" variant="ghost" size="sm" className="text-danger-600" onClick={() => setPanel(panel === 'disable' ? null : 'disable')}>{m.tfaDisable}</Button>
            )}
          </div>
          {panel === 'codes' && (
            <form action={regenerate} className="grid gap-3">
              <p className="text-[12.5px] text-slate-600">{m.tfaNewCodesHint}</p>
              <CodeInput label={m.tfaCode} />
              {codesState.error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{codesState.error}</p>}
              <div><Button type="submit" variant="primary" size="sm" disabled={regenerating}>{m.tfaNewCodes}</Button></div>
            </form>
          )}
          {panel === 'disable' && (
            <form action={disable} className="grid gap-3" data-testid="two-factor-disable">
              <p className="text-[12.5px] text-slate-600">{m.tfaDisableHint}</p>
              <label className="grid gap-1 text-[12.5px] font-semibold text-slate-600">
                {m.password}
                <Input type="password" name="password" required autoComplete="current-password" className="max-w-xs" />
              </label>
              <CodeInput label={m.tfaCode} />
              {disableState.error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{disableState.error}</p>}
              <div><Button type="submit" variant="danger" size="sm" disabled={disabling}>{m.tfaDisable}</Button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Gauge, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumSectionCard } from '@/components/premium';
import { useClientLocale } from '@/components/locale-provider';
import { capsT } from '@/messages/super-admin';

interface KeyView {
  key: string;
  planDefault: number | boolean | null;
  override?: number | boolean | null;
  effective: number | boolean | null;
  source: string;
}
interface View { plan: string; keys: KeyView[] }
interface Usage { limits: { users: { limit: number | null; used: number } } }

type FeatureChoice = 'plan' | 'on' | 'off';
type LimitMode = 'plan' | 'custom' | 'unlimited';

/** The four features an override can switch; the rest follow the plan or are set on their own panels. */
const OVERRIDABLE = ['feature.brokers', 'feature.advancedReports', 'feature.maintenance', 'feature.customDomain'] as const;
const FEATURES = [
  'feature.dashboard', 'feature.crm', 'feature.contracts', 'feature.installments',
  'feature.staffApp', 'feature.customerApp', 'feature.publicWebsite',
  'feature.brokers', 'feature.advancedReports', 'feature.maintenance', 'feature.customDomain',
] as const;

const NEAR = 0.8;

function tone(used: number, max: number | null): 'ok' | 'near' | 'at' | 'over' {
  if (max === null) return 'ok';
  if (used > max) return 'over';
  if (used === max) return 'at';
  if (used >= max * NEAR) return 'near';
  return 'ok';
}
const BAR: Record<string, string> = { ok: 'bg-emerald-500', near: 'bg-amber-500', at: 'bg-amber-600', over: 'bg-red-600' };
const TEXT: Record<string, string> = { ok: 'text-emerald-700', near: 'text-amber-700', at: 'text-amber-700', over: 'text-red-700' };

// A company's staff users against its limit, and the features its plan gives with the overrides the
// platform owner may set for this company alone.
export function CompanyCapabilitiesPanel({ companyId }: { companyId: string }) {
  const locale = useClientLocale();
  const m = useMemo(() => capsT(locale), [locale]);
  const base = `/api-proxy/super-admin/companies/${companyId}`;

  const [view, setView] = useState<View | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [choice, setChoice] = useState<Record<string, FeatureChoice>>({});
  const [limitMode, setLimitMode] = useState<LimitMode>('plan');
  const [limitValue, setLimitValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const [v, u] = await Promise.all([fetch(`${base}/capabilities/view`), fetch(`${base}/usage`)]);
    if (v.ok) {
      const data = (await v.json()) as View;
      setView(data);
      const next: Record<string, FeatureChoice> = {};
      for (const k of OVERRIDABLE) {
        const row = data.keys.find((x) => x.key === k);
        next[k] = row?.override === undefined ? 'plan' : row.override ? 'on' : 'off';
      }
      setChoice(next);
      const lim = data.keys.find((x) => x.key === 'limit.maxUsers');
      if (lim?.override === undefined) { setLimitMode('plan'); setLimitValue(''); }
      else if (lim.override === null) { setLimitMode('unlimited'); setLimitValue(''); }
      else { setLimitMode('custom'); setLimitValue(String(lim.override)); }
    }
    if (u.ok) setUsage((await u.json()) as Usage);
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  function save() {
    setError(null);
    setSaved(false);
    const overrides: Record<string, unknown> = {};
    const reset: string[] = [];
    for (const k of OVERRIDABLE) {
      if (choice[k] === 'on') overrides[k] = true;
      else if (choice[k] === 'off') overrides[k] = false;
      else reset.push(k);
    }
    if (limitMode === 'custom') {
      const n = Number(limitValue);
      if (!Number.isInteger(n) || n < 0) { setError(m.error); return; }
      overrides['limit.maxUsers'] = n;
    } else if (limitMode === 'unlimited') overrides['limit.maxUsers'] = null;
    else reset.push('limit.maxUsers');

    startTransition(async () => {
      const res = await fetch(`${base}/capabilities/overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides, reset }),
      });
      if (!res.ok) { setError(m.error); return; }
      setSaved(true);
      await load();
    });
  }

  if (!view || !usage) {
    return (
      <PremiumSectionCard title={m.title} icon={<Gauge />}>
        <p className="text-[13px] text-slate-400">{m.loading}</p>
      </PremiumSectionCard>
    );
  }

  const used = usage.limits.users.used;
  const max = usage.limits.users.limit;
  const t = tone(used, max);
  const pct = max === null || max === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / max) * 100));
  const planLimit = view.keys.find((x) => x.key === 'limit.maxUsers')?.planDefault as number | null | undefined;
  const status =
    max === null ? m.unlimited
      : t === 'over' ? m.over(used - max)
      : t === 'at' ? m.atLimit
      : t === 'near' ? m.nearLimit
      : m.left(max - used);

  return (
    <PremiumSectionCard
      title={m.title}
      icon={<Gauge />}
      trailing={
        <Button variant="primary" size="sm" loading={pending} onClick={save}>
          {m.save}
        </Button>
      }
    >
      <p className="mb-5 text-[12px] text-slate-400">{m.description}</p>

      {/* Staff users against the limit */}
      <div data-testid="caps-users" className="rounded-2xl border border-hairline bg-surface-soft/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[14px] font-bold text-slate-900">{m.users}</p>
            <p className="text-[11.5px] text-slate-400">{m.usersHint}</p>
          </div>
          <p className="text-[22px] font-extrabold tabular-nums text-slate-900">
            {max === null ? m.usedUnlimited(used) : m.usedOf(used, max)}
          </p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${BAR[t]}`} style={{ width: `${max === null ? Math.min(100, used * 4) : pct}%` }} />
        </div>
        <p className={`mt-2 text-[12px] font-semibold ${TEXT[t]}`}>{status}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">{m.limitLabel}</span>
            <Select
              value={limitMode}
              onChange={(e) => { setLimitMode(e.target.value as LimitMode); setSaved(false); }}
              inputSize="sm"
            >
              <option value="plan">{m.limitFromPlan}{planLimit === undefined ? '' : planLimit === null ? ` (${m.unlimited})` : ` (${planLimit})`}</option>
              <option value="custom">{m.limitCustom}</option>
              <option value="unlimited">{m.limitUnlimitedOption}</option>
            </Select>
          </label>
          {limitMode === 'custom' && (
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={limitValue}
              onChange={(e) => { setLimitValue(e.target.value); setSaved(false); }}
              placeholder={m.limitInputPlaceholder}
              aria-label={m.limitLabel}
              inputSize="sm"
              className="w-28"
            />
          )}
        </div>
      </div>

      {/* Features */}
      <p className="mb-2 mt-6 text-[13px] font-bold text-slate-900">{m.featuresTitle}</p>
      <ul className="divide-y divide-hairline rounded-2xl border border-hairline" data-testid="caps-features">
        {FEATURES.map((key) => {
          const row = view.keys.find((x) => x.key === key);
          const on = row?.effective === true;
          const overridable = (OVERRIDABLE as readonly string[]).includes(key);
          const fromOverride = row?.override !== undefined;
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {on ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-slate-300" />}
              <span className={`min-w-0 flex-1 text-[13.5px] font-semibold ${on ? 'text-slate-900' : 'text-slate-400'}`}>{m.feature[key]}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {on ? m.on : m.off}
              </span>
              <span className="w-24 text-[11px] text-slate-400">{fromOverride ? m.override : m.fromPlan}</span>
              {overridable ? (
                <Select
                  value={choice[key] ?? 'plan'}
                  onChange={(e) => { setChoice((c) => ({ ...c, [key]: e.target.value as FeatureChoice })); setSaved(false); }}
                  inputSize="sm"
                  className="w-36"
                  aria-label={m.feature[key]}
                >
                  <option value="plan">{m.choose.plan}</option>
                  <option value="on">{m.choose.on}</option>
                  <option value="off">{m.choose.off}</option>
                </Select>
              ) : (
                <span className="w-36 text-[11px] leading-snug text-slate-400">{m.fixedNote}</span>
              )}
            </li>
          );
        })}
      </ul>

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {m.saved}
        </p>
      )}
      {error && <p className="mt-3 text-[12px] font-semibold text-red-600">{error}</p>}
    </PremiumSectionCard>
  );
}

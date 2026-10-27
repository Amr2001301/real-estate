'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Globe, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { readError } from '@/components/ai/ai-strings';
import { domainT } from '@/components/website-domain/messages';
import {
  DomainCard,
  PlatformAddressLine,
  type DomainActionResult,
  type DomainActions,
  type DomainView,
} from '@/components/website-domain/domain-card';

// «دومين الموقع»: the platform owner connects the company's website domain.
export function CompanyWebsiteDomainPanel({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => domainT(locale), [locale]);
  const base = `/api-proxy/super-admin/companies/${companyId}/domains`;
  const [domains, setDomains] = useState<DomainView[] | null>(null);
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch(base, { cache: 'no-store' });
    if (res.ok) setDomains((await res.json()) as DomainView[]);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Each action reloads the list, so the card shows the domain's new state.
  async function call(path: string, method: 'POST' | 'DELETE'): Promise<DomainActionResult> {
    const res = await fetch(`${base}${path}`, { method });
    if (!res.ok) return { ok: false, error: await readError(res, m.error) };
    const body =
      method === 'POST' ? ((await res.json().catch(() => ({}))) as { verified?: boolean }) : {};
    await load();
    return { ok: true, verified: body.verified };
  }
  const actions: DomainActions = {
    verify: (id) => call(`/${id}/verify`, 'POST'),
    primary: (id) => call(`/${id}/primary`, 'POST'),
    remove: (id) => call(`/${id}`, 'DELETE'),
  };

  function add(e: React.FormEvent) {
    e.preventDefault();
    // Pasted as a link? Keep the host only.
    const host = hostname
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!host) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: host }),
      });
      if (!res.ok) return setError(await readError(res, m.error));
      setHostname('');
      setAdding(false);
      await load();
    });
  }

  const custom = (domains ?? []).filter((d) => d.type === 'CUSTOM');
  const platform = (domains ?? []).find((d) => d.type === 'PLATFORM_SUBDOMAIN');

  return (
    <PremiumSectionCard
      title={m.title}
      description={m.description}
      icon={<Globe className="h-4 w-4" />}
    >
      <div data-testid="website-domain-panel" className="flex flex-col gap-4">
        {domains === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          custom.map((d) => <DomainCard key={d.id} d={d} m={m} locale={locale} actions={actions} />)
        )}

        {domains !== null && custom.length > 0 && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-hairline px-4 py-2 text-[12.5px] font-semibold text-slate-700 hover:border-brand-400/50 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {m.add.another}
          </button>
        ) : (
          <form
            onSubmit={add}
            data-testid="website-domain-add"
            className="rounded-[20px] border border-dashed border-brand-400/40 bg-brand-50/30 p-5"
          >
            {domains !== null && custom.length === 0 && (
              <p className="mb-3 text-[13px] text-slate-600">{m.empty}</p>
            )}
            <label
              htmlFor={`domain-${companyId}`}
              className="mb-2 block text-[12.5px] font-bold text-slate-800"
            >
              {m.add.label}
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`domain-${companyId}`}
                dir="ltr"
                autoFocus={custom.length > 0}
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder={m.add.placeholder}
                className="min-w-[220px] flex-1 font-mono"
              />
              <button
                type="submit"
                disabled={pending || !hostname.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-navy-band px-5 text-[13px] font-semibold text-[#F4ECD8] transition-opacity disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {m.add.submit}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-danger-700">
                {error}
              </p>
            )}
          </form>
        )}

        {platform && <PlatformAddressLine d={platform} m={m} />}

        <details className="group rounded-2xl border border-hairline px-4 py-3 text-[13px] text-slate-600">
          <summary className="cursor-pointer list-none font-semibold text-slate-800">
            <span className="me-1.5 inline-block transition-transform group-open:rotate-90">‹</span>
            {m.steps.title}
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 ps-5 leading-relaxed">
            {m.steps.items.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-slate-500">{m.steps.note}</p>
        </details>
      </div>
    </PremiumSectionCard>
  );
}

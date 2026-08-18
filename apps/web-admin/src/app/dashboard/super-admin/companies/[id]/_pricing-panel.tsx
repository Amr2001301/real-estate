'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { Plus, Trash2, Sparkles, CheckCircle2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { pricingT } from '@/messages/super-admin';

interface PricingPackage {
  id: string;
  planTier: string;
  nameAr: string;
  nameEn: string;
  currency: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  setupFee: string | null;
  maxUsers: number | null;
  highlights: string[];
  specialOffer: { titleAr: string; titleEn: string; discountPct: number; validUntil?: string } | null;
  isActive: boolean;
}

const PLAN_TIERS = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];

function fmt(val: string | null, currency: string) {
  if (!val) return '—';
  return `${Number(val).toLocaleString()} ${currency}`;
}

export function CompanyPricingPanel({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => pricingT(locale), [locale]);

  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api-proxy/super-admin/companies/${companyId}/pricing`);
    if (res.ok) setPackages((await res.json()) as PricingPackage[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [companyId]);

  async function handleDelete(pkgId: string) {
    if (!confirm(m.deleteConfirm)) return;
    startTransition(async () => {
      await fetch(`/api-proxy/super-admin/companies/${companyId}/pricing/${pkgId}`, { method: 'DELETE' });
      await load();
    });
  }

  async function handleCreate(data: object) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api-proxy/super-admin/companies/${companyId}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        setError(Array.isArray(d.message) ? d.message.join(', ') : (d.message ?? 'Error'));
        return;
      }
      setShowForm(false);
      await load();
    });
  }

  return (
    <PremiumSectionCard
      title={m.companyTab}
      icon={<DollarSign />}
      trailing={
        !showForm && (
          <Button variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowForm(true)}>
            {m.addCompanyPkg}
          </Button>
        )
      }
    >
      {/* Inline create form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-hairline bg-canvas/50 p-4">
          <CompanyPkgForm
            m={m}
            error={error}
            pending={pending}
            onSubmit={handleCreate}
            onCancel={() => { setShowForm(false); setError(null); }}
          />
        </div>
      )}

      {loading && <div className="py-8 text-center text-slate-400 text-sm animate-pulse">…</div>}

      {!loading && packages.length === 0 && (
        <div className="py-8 text-center text-slate-400 text-sm">{m.emptyCompany}</div>
      )}

      <div className="space-y-3">
        {packages.map((pkg) => {
          const name = locale === 'en' ? pkg.nameEn : pkg.nameAr;
          return (
            <div key={pkg.id} className="flex items-start gap-4 rounded-xl border border-hairline bg-white px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[13px] font-bold text-slate-900">{name}</span>
                  <span className="inline-flex rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5 text-[10px] font-semibold">
                    {pkg.planTier}
                  </span>
                  {pkg.specialOffer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                      <Sparkles className="h-2.5 w-2.5" />
                      {pkg.specialOffer.discountPct}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span>{fmt(pkg.monthlyPrice, pkg.currency)}{m.pdf.monthly}</span>
                  {pkg.annualPrice && <span>{fmt(pkg.annualPrice, pkg.currency)}{m.pdf.annual}</span>}
                  {pkg.maxUsers && <span>{pkg.maxUsers} {m.pdf.users}</span>}
                </div>
                {pkg.highlights.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {pkg.highlights.slice(0, 3).map((h, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        {h}
                      </li>
                    ))}
                    {pkg.highlights.length > 3 && (
                      <li className="text-[11px] text-slate-400 ms-4.5">+{pkg.highlights.length - 3}</li>
                    )}
                  </ul>
                )}
              </div>
              <button
                onClick={() => handleDelete(pkg.id)}
                disabled={pending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </PremiumSectionCard>
  );
}

function CompanyPkgForm({ m, error, pending, onSubmit, onCancel }: {
  m: ReturnType<typeof pricingT>;
  error: string | null;
  pending: boolean;
  onSubmit: (data: object) => void;
  onCancel: () => void;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      planTier: fd.get('planTier') as string,
      nameAr: fd.get('nameAr') as string,
      nameEn: fd.get('nameEn') as string,
      currency: (fd.get('currency') as string) || 'SAR',
      monthlyPrice: fd.get('monthlyPrice') ? Number(fd.get('monthlyPrice')) : undefined,
      annualPrice: fd.get('annualPrice') ? Number(fd.get('annualPrice')) : undefined,
      setupFee: fd.get('setupFee') ? Number(fd.get('setupFee')) : undefined,
      maxUsers: fd.get('maxUsers') ? Number(fd.get('maxUsers')) : undefined,
      highlights: (fd.get('highlights') as string).split('\n').map((s) => s.trim()).filter(Boolean),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={m.form.planTier} name="planTier" required>
          <Select name="planTier"><option value="">— {m.form.planTier}</option>{PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        </Field>
        <Field label={m.form.currency} name="currency">
          <Input name="currency" defaultValue="SAR" dir="ltr" />
        </Field>
        <Field label={m.form.nameAr} name="nameAr" required>
          <Input name="nameAr" required />
        </Field>
        <Field label={m.form.nameEn} name="nameEn" required>
          <Input name="nameEn" required dir="ltr" />
        </Field>
        <Field label={m.form.monthlyPrice} name="monthlyPrice">
          <Input name="monthlyPrice" type="number" step="0.01" min="0" dir="ltr" />
        </Field>
        <Field label={m.form.annualPrice} name="annualPrice">
          <Input name="annualPrice" type="number" step="0.01" min="0" dir="ltr" />
        </Field>
        <Field label={m.form.setupFee} name="setupFee">
          <Input name="setupFee" type="number" step="0.01" min="0" dir="ltr" />
        </Field>
        <Field label={m.form.maxUsers} name="maxUsers">
          <Input name="maxUsers" type="number" min="1" dir="ltr" />
        </Field>
      </div>
      <Field label={m.form.highlights} name="highlights">
        <textarea name="highlights" rows={3}
          className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/15 resize-none"
          placeholder="ميزة أولى&#10;ميزة ثانية" />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{m.form.cancelBtn}</Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>{m.form.createBtn}</Button>
      </div>
    </form>
  );
}

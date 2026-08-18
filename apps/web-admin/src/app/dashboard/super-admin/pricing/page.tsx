'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, FileText, Tag, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { getClientLocale } from '@/lib/locale-client';
import { pricingT } from '@/messages/super-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import {
  PremiumPageHero, PremiumSectionCard, PremiumCommandPanel,
} from '@/components/premium';

interface PricingPackage {
  id: string;
  planTier: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  currency: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  setupFee: string | null;
  maxUsers: number | null;
  highlights: string[];
  specialOffer: { titleAr: string; titleEn: string; discountPct: number; validUntil?: string } | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const PLAN_TIERS = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];

function fmt(val: string | null, currency: string) {
  if (!val) return '—';
  return `${Number(val).toLocaleString()} ${currency}`;
}

export default function PricingPage() {
  const locale = getClientLocale();
  const m = useMemo(() => pricingT(locale), [locale]);

  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api-proxy/super-admin/pricing');
    if (res.ok) setPackages((await res.json()) as PricingPackage[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(pkg: PricingPackage) { setEditing(pkg); setShowForm(true); }
  function closeForm() { setEditing(null); setShowForm(false); setError(null); }

  async function handleDelete(id: string) {
    if (!confirm(m.deleteConfirm)) return;
    startTransition(async () => {
      await fetch(`/api-proxy/super-admin/pricing/${id}`, { method: 'DELETE' });
      await load();
    });
  }

  async function handleSubmit(data: object, id?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        id ? `/api-proxy/super-admin/pricing/${id}` : '/api-proxy/super-admin/pricing',
        { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
      );
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        setError(Array.isArray(d.message) ? d.message.join(', ') : (d.message ?? 'Error'));
        return;
      }
      closeForm();
      await load();
    });
  }

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        badge={{ label: m.badge }}
        breadcrumbs={[
          { label: m.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: m.breadcrumbs.pricing },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/super-admin/pricing/pdf">
              <Button variant="outline" leftIcon={<FileText className="h-4 w-4" />}>
                {m.pdfBtn}
              </Button>
            </Link>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>
              {m.newBtn}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">
        {/* Package list */}
        <div className="xl:col-span-3 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-[20px] bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && packages.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">{m.emptyGlobal}</div>
          )}

          {packages.map((pkg) => (
            <PricingCard
              key={pkg.id}
              pkg={pkg}
              locale={locale}
              m={m}
              onEdit={() => openEdit(pkg)}
              onDelete={() => handleDelete(pkg.id)}
              pending={pending}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <PremiumCommandPanel title={m.breadcrumbs.pricing} icon={<Tag />}>
            <button onClick={openNew} className="group flex w-full items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-brand-50 transition-colors duration-150">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                <Plus />
              </span>
              <span className="font-semibold text-[13px]">{m.newBtn}</span>
            </button>
            <Link href="/dashboard/super-admin/pricing/pdf" className="group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                <FileText />
              </span>
              <span className="text-[13px]">{m.pdfBtn}</span>
            </Link>
          </PremiumCommandPanel>

          <PremiumSectionCard title="الخطط" icon={<Sparkles />}>
            <div className="space-y-1.5 text-[12px] text-slate-600">
              {PLAN_TIERS.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                  {t}
                  <span className="ms-auto tabular-nums text-slate-400 text-[11px]">
                    {packages.filter((p) => p.planTier === t).length}
                  </span>
                </div>
              ))}
            </div>
          </PremiumSectionCard>
        </div>
      </div>

      {/* Form slide-in */}
      {showForm && (
        <PackageFormModal
          pkg={editing}
          m={m}
          error={error}
          pending={pending}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

function PricingCard({ pkg, locale, m, onEdit, onDelete, pending }: {
  pkg: PricingPackage;
  locale: string;
  m: ReturnType<typeof pricingT>;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = locale === 'en' ? pkg.nameEn : pkg.nameAr;
  const desc = locale === 'en' ? pkg.descEn : pkg.descAr;

  return (
    <div className={`bg-surface border border-hairline rounded-[20px] shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)] overflow-hidden transition-all ${!pkg.isActive ? 'opacity-60' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-slate-900">{name}</span>
            <span className="inline-flex rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5 text-[10px] font-semibold">
              {pkg.planTier}
            </span>
            {pkg.specialOffer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                <Sparkles className="h-2.5 w-2.5" />
                {pkg.specialOffer.discountPct}% off
              </span>
            )}
            {!pkg.isActive && (
              <span className="inline-flex rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-semibold">{m.inactive}</span>
            )}
          </div>
          {desc && <p className="text-[12px] text-slate-400 mt-0.5 truncate">{desc}</p>}
        </div>

        {/* Prices */}
        <div className="hidden sm:flex items-center gap-6 text-center shrink-0">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{m.cols.monthly}</p>
            <p className="text-[15px] font-black text-slate-900 tabular-nums">{fmt(pkg.monthlyPrice, pkg.currency)}</p>
          </div>
          {pkg.annualPrice && (
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{m.cols.annual}</p>
              <p className="text-[15px] font-black text-slate-900 tabular-nums">{fmt(pkg.annualPrice, pkg.currency)}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} disabled={pending} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-canvas/50 transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-hairline px-5 py-4 bg-canvas/40 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] mb-0.5">{m.cols.setup}</p>
              <p className="font-semibold text-slate-700">{fmt(pkg.setupFee, pkg.currency)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] mb-0.5">{m.cols.users}</p>
              <p className="font-semibold text-slate-700">{pkg.maxUsers ?? '∞'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] mb-0.5">{m.cols.monthly}</p>
              <p className="font-semibold text-slate-700">{fmt(pkg.monthlyPrice, pkg.currency)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] mb-0.5">{m.cols.annual}</p>
              <p className="font-semibold text-slate-700">{fmt(pkg.annualPrice, pkg.currency)}</p>
            </div>
          </div>

          {pkg.highlights.length > 0 && (
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px] mb-2">{m.pdf.highlights}</p>
              <ul className="space-y-1">
                {pkg.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pkg.specialOffer && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">
                <Sparkles className="h-3 w-3 inline me-1" />
                {locale === 'en' ? pkg.specialOffer.titleEn : pkg.specialOffer.titleAr}
              </p>
              <p className="text-[12px] text-amber-800">
                {pkg.specialOffer.discountPct}% {m.pdf.discount}
                {pkg.specialOffer.validUntil && ` · ${m.pdf.validUntil} ${pkg.specialOffer.validUntil}`}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
              {m.form.saveBtn}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageFormModal({ pkg, m, error, pending, onSubmit, onClose }: {
  pkg: PricingPackage | null;
  m: ReturnType<typeof pricingT>;
  error: string | null;
  pending: boolean;
  onSubmit: (data: object, id?: string) => void;
  onClose: () => void;
}) {
  const [hasOffer, setHasOffer] = useState(!!pkg?.specialOffer);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const highlights = (fd.get('highlights') as string)
      .split('\n').map((s) => s.trim()).filter(Boolean);

    const data = {
      planTier: fd.get('planTier') as string,
      nameAr: fd.get('nameAr') as string,
      nameEn: fd.get('nameEn') as string,
      descAr: (fd.get('descAr') as string) || undefined,
      descEn: (fd.get('descEn') as string) || undefined,
      currency: (fd.get('currency') as string) || 'SAR',
      monthlyPrice: fd.get('monthlyPrice') ? Number(fd.get('monthlyPrice')) : undefined,
      annualPrice: fd.get('annualPrice') ? Number(fd.get('annualPrice')) : undefined,
      setupFee: fd.get('setupFee') ? Number(fd.get('setupFee')) : undefined,
      maxUsers: fd.get('maxUsers') ? Number(fd.get('maxUsers')) : undefined,
      highlights,
      sortOrder: fd.get('sortOrder') ? Number(fd.get('sortOrder')) : 0,
      isActive: fd.get('isActive') === 'true',
      specialOffer: hasOffer ? {
        titleAr: fd.get('offerTitleAr') as string,
        titleEn: fd.get('offerTitleEn') as string,
        discountPct: Number(fd.get('offerDiscount')),
        validUntil: (fd.get('offerValidUntil') as string) || undefined,
      } : null,
    };
    onSubmit(data, pkg?.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-xl bg-surface shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface px-6 py-4">
          <h2 className="text-[16px] font-bold text-slate-900">
            {pkg ? m.form.saveBtn : m.form.createBtn}
          </h2>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-canvas/50">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={m.form.planTier} name="planTier" required>
              <Select name="planTier" defaultValue={pkg?.planTier ?? 'STARTER'}>
                {PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label={m.form.currency} name="currency">
              <Input name="currency" defaultValue={pkg?.currency ?? 'SAR'} dir="ltr" />
            </Field>
            <Field label={m.form.nameAr} name="nameAr" required>
              <Input name="nameAr" required defaultValue={pkg?.nameAr ?? ''} />
            </Field>
            <Field label={m.form.nameEn} name="nameEn" required>
              <Input name="nameEn" required defaultValue={pkg?.nameEn ?? ''} dir="ltr" />
            </Field>
            <Field label={m.form.descAr} name="descAr">
              <Input name="descAr" defaultValue={pkg?.descAr ?? ''} />
            </Field>
            <Field label={m.form.descEn} name="descEn">
              <Input name="descEn" defaultValue={pkg?.descEn ?? ''} dir="ltr" />
            </Field>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={m.form.monthlyPrice} name="monthlyPrice">
              <Input name="monthlyPrice" type="number" step="0.01" min="0" dir="ltr"
                defaultValue={pkg?.monthlyPrice ?? ''} />
            </Field>
            <Field label={m.form.annualPrice} name="annualPrice">
              <Input name="annualPrice" type="number" step="0.01" min="0" dir="ltr"
                defaultValue={pkg?.annualPrice ?? ''} />
            </Field>
            <Field label={m.form.setupFee} name="setupFee">
              <Input name="setupFee" type="number" step="0.01" min="0" dir="ltr"
                defaultValue={pkg?.setupFee ?? ''} />
            </Field>
            <Field label={m.form.maxUsers} name="maxUsers">
              <Input name="maxUsers" type="number" min="1" dir="ltr"
                defaultValue={pkg?.maxUsers ?? ''} />
            </Field>
          </div>

          {/* Highlights */}
          <Field label={m.form.highlights} name="highlights">
            <textarea
              name="highlights"
              rows={4}
              defaultValue={pkg?.highlights?.join('\n') ?? ''}
              className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/15 resize-none"
              placeholder="ميزة أولى&#10;ميزة ثانية&#10;ميزة ثالثة"
            />
          </Field>

          {/* Special offer */}
          <div className="rounded-xl border border-hairline bg-canvas/40 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasOffer} onChange={(e) => setHasOffer(e.target.checked)}
                className="rounded border-hairline" />
              <span className="text-[13px] font-semibold text-slate-700">{m.form.offerTitle}</span>
            </label>
            {hasOffer && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Field label={m.form.offerTitleAr} name="offerTitleAr">
                  <Input name="offerTitleAr" defaultValue={pkg?.specialOffer?.titleAr ?? ''} />
                </Field>
                <Field label={m.form.offerTitleEn} name="offerTitleEn">
                  <Input name="offerTitleEn" defaultValue={pkg?.specialOffer?.titleEn ?? ''} dir="ltr" />
                </Field>
                <Field label={m.form.offerDiscount} name="offerDiscount">
                  <Input name="offerDiscount" type="number" min="1" max="100" dir="ltr"
                    defaultValue={pkg?.specialOffer?.discountPct ?? ''} />
                </Field>
                <Field label={m.form.offerValidUntil} name="offerValidUntil">
                  <Input name="offerValidUntil" type="date" dir="ltr"
                    defaultValue={pkg?.specialOffer?.validUntil ?? ''} />
                </Field>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={m.form.sortOrder} name="sortOrder">
              <Input name="sortOrder" type="number" min="0" dir="ltr" defaultValue={pkg?.sortOrder ?? 0} />
            </Field>
            <Field label={m.form.isActive} name="isActive">
              <Select name="isActive" defaultValue={pkg?.isActive !== false ? 'true' : 'false'}>
                <option value="true">{m.active}</option>
                <option value="false">{m.inactive}</option>
              </Select>
            </Field>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-hairline">
            <Button type="button" variant="ghost" onClick={onClose}>{m.form.cancelBtn}</Button>
            <Button type="submit" variant="primary" loading={pending}>
              {pkg ? m.form.saveBtn : m.form.createBtn}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

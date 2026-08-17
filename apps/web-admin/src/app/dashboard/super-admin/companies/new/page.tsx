'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getClientLocale } from '@/lib/locale-client';
import { saT } from '@/messages/super-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';

export default function NewCompanyPage() {
  const router = useRouter();
  const locale = getClientLocale();
  const m = useMemo(() => saT(locale).newCompany, [locale]);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get('name') as string,
      slug: fd.get('slug') as string,
      country: (fd.get('country') as string) || 'SA',
      currency: (fd.get('currency') as string) || 'SAR',
      timezone: (fd.get('timezone') as string) || 'Asia/Riyadh',
      subscriptionPlan: (fd.get('subscriptionPlan') as string) || 'TRIAL',
      subscriptionStartAt: (fd.get('subscriptionStartAt') as string) || undefined,
      subscriptionEndAt: (fd.get('subscriptionEndAt') as string) || undefined,
      maxUsers: fd.get('maxUsers') ? Number(fd.get('maxUsers')) : undefined,
      adminEmail: (fd.get('adminEmail') as string) || undefined,
      adminPassword: (fd.get('adminPassword') as string) || undefined,
      adminFullName: (fd.get('adminFullName') as string) || undefined,
    };

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch('/api-proxy/super-admin/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          setError(data.message ?? m.errorServer);
          return;
        }
        router.push('/dashboard/super-admin/companies');
        router.refresh();
      } catch {
        setError(m.errorServer);
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: m.breadcrumbs.companies, href: '/dashboard/super-admin/companies' },
          { label: m.breadcrumbs.new },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-5">

        <PremiumSectionCard title={m.sections.company}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.name} *</label>
              <Input name="name" required placeholder="شركة المدينة للعقارات" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.slug} *</label>
              <Input name="slug" required placeholder="al-madina-realestate" dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.country}</label>
              <Input name="country" defaultValue="SA" dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.currency}</label>
              <Input name="currency" defaultValue="SAR" dir="ltr" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.timezone}</label>
              <Input name="timezone" defaultValue="Asia/Riyadh" dir="ltr" />
            </div>
          </div>
        </PremiumSectionCard>

        <PremiumSectionCard title={m.sections.subscription}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.plan}</label>
              <select name="subscriptionPlan" className={selectCls}>
                {Object.entries(m.planOptions).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.maxUsers}</label>
              <Input name="maxUsers" type="number" min={1} placeholder="—" dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.startAt}</label>
              <Input name="subscriptionStartAt" type="date" dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.endAt}</label>
              <Input name="subscriptionEndAt" type="date" dir="ltr" />
            </div>
          </div>
        </PremiumSectionCard>

        <PremiumSectionCard title={m.sections.admin}>
          <p className="text-[12px] text-slate-400 mb-4">{m.adminHint}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.adminName}</label>
              <Input name="adminFullName" placeholder="أحمد محمد" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.adminEmail}</label>
              <Input name="adminEmail" type="email" placeholder="admin@company.com" dir="ltr" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.fields.adminPassword}</label>
              <Input name="adminPassword" type="password" placeholder="••••••••" dir="ltr" />
            </div>
          </div>
        </PremiumSectionCard>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50/40 px-5 py-3.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>{m.cancelBtn}</Button>
          <Button type="submit" variant="primary" loading={pending}>{m.submitBtn}</Button>
        </div>
      </form>
    </div>
  );
}

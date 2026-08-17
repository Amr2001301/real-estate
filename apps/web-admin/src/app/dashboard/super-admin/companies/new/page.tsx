'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertCircle } from 'lucide-react';
import { getClientLocale } from '@/lib/locale-client';
import { saT } from '@/messages/super-admin';
import { Field } from '@/components/form/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PageHeader } from '@/components/ui/page-header';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';

export default function NewCompanyPage() {
  const router = useRouter();
  const locale = getClientLocale();
  const m = useMemo(() => saT(locale).newCompany, [locale]);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const navSections = [
    { id: 'section-company',      num: '01', label: m.sections.company,      sub: m.fields.name },
    { id: 'section-subscription', num: '02', label: m.sections.subscription,  sub: m.fields.plan },
    { id: 'section-admin',        num: '03', label: m.sections.admin,         sub: m.fields.adminEmail },
  ];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name:                fd.get('name') as string,
      slug:                fd.get('slug') as string,
      country:            (fd.get('country') as string)  || 'SA',
      currency:           (fd.get('currency') as string) || 'SAR',
      timezone:           (fd.get('timezone') as string) || 'Asia/Riyadh',
      subscriptionPlan:   (fd.get('subscriptionPlan') as string) || 'TRIAL',
      subscriptionStartAt:(fd.get('subscriptionStartAt') as string) || undefined,
      subscriptionEndAt:  (fd.get('subscriptionEndAt') as string)  || undefined,
      maxUsers:           fd.get('maxUsers') ? Number(fd.get('maxUsers')) : undefined,
      adminEmail:         (fd.get('adminEmail') as string)    || undefined,
      adminPassword:      (fd.get('adminPassword') as string) || undefined,
      adminFullName:      (fd.get('adminFullName') as string) || undefined,
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
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: m.breadcrumbs.companies, href: '/dashboard/super-admin/companies' },
          { label: m.breadcrumbs.new },
        ]}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 lg:gap-5">
        <PremiumFormLayout
          navSections={navSections}
          sidebarBadge={m.breadcrumbs.new}
          sidebarInfo={m.adminHint}
        >

          <PremiumFormPanel
            id="section-company"
            number="01"
            title={m.sections.company}
            description={m.fields.name}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.fields.name} name="name" required>
                <Input name="name" required placeholder="شركة المدينة للعقارات" />
              </Field>
              <Field label={m.fields.slug} name="slug" required>
                <Input name="slug" required placeholder="al-madina-realestate" dir="ltr" />
              </Field>
              <Field label={m.fields.country} name="country">
                <Input name="country" defaultValue="SA" dir="ltr" />
              </Field>
              <Field label={m.fields.currency} name="currency">
                <Input name="currency" defaultValue="SAR" dir="ltr" />
              </Field>
              <div className="md:col-span-2">
                <Field label={m.fields.timezone} name="timezone">
                  <Input name="timezone" defaultValue="Asia/Riyadh" dir="ltr" />
                </Field>
              </div>
            </div>
          </PremiumFormPanel>

          <PremiumFormPanel
            id="section-subscription"
            number="02"
            title={m.sections.subscription}
            description={m.fields.plan}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.fields.plan} name="subscriptionPlan">
                <Select name="subscriptionPlan">
                  {Object.entries(m.planOptions).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
              <Field label={m.fields.maxUsers} name="maxUsers">
                <Input name="maxUsers" type="number" min={1} placeholder="—" dir="ltr" />
              </Field>
              <Field label={m.fields.startAt} name="subscriptionStartAt">
                <Input name="subscriptionStartAt" type="date" dir="ltr" />
              </Field>
              <Field label={m.fields.endAt} name="subscriptionEndAt">
                <Input name="subscriptionEndAt" type="date" dir="ltr" />
              </Field>
            </div>
          </PremiumFormPanel>

          <PremiumFormPanel
            id="section-admin"
            number="03"
            title={m.sections.admin}
            description={m.adminHint}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.fields.adminName} name="adminFullName">
                <Input name="adminFullName" placeholder="أحمد محمد" />
              </Field>
              <Field label={m.fields.adminEmail} name="adminEmail">
                <Input name="adminEmail" type="email" placeholder="admin@company.com" dir="ltr" />
              </Field>
              <div className="md:col-span-2">
                <Field label={m.fields.adminPassword} name="adminPassword">
                  <Input name="adminPassword" type="password" placeholder="••••••••" dir="ltr" />
                </Field>
              </div>
            </div>
          </PremiumFormPanel>

        </PremiumFormLayout>

        <FormFooter
          sticky
          primary={
            <>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />} onClick={() => router.back()}>
                {m.cancelBtn}
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {m.submitBtn}
              </Button>
            </>
          }
        />
      </form>
    </div>
  );
}

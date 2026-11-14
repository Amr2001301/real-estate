import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, CalendarClock, Globe, Mail, Phone, Scale, UserRound, Wallet } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { PremiumPageHero } from '@/components/premium';
import { developersT, type Developer } from '@/components/developers/messages';
import { Panel, Pill } from '@/app/dashboard/deals/_components/ui';
import { AddPlanForm, AddProjectForm, EditDeveloperButton, RemoveButton } from '../_components/forms';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** BRK-5 — one developer: contact, agreed commission, projects with their plans and listings. */
export default async function DeveloperPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, session, currency] = await Promise.all([params, getLocale(), getSession(), getReportsCurrency()]);
  const t = developersT(locale);
  const res = await safe(api.get<Developer>(`/developers/${id}`));
  const d = res.data;
  if (!d) notFound();
  const canEdit = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const phone = d.phone?.replace(/[^\d+]/g, '');
  const contact: Array<[React.ReactNode, React.ReactNode]> = [
    ...(d.contactName ? [[<UserRound key="u" />, d.contactName] as [React.ReactNode, React.ReactNode]] : []),
    ...(phone ? [[<Phone key="p" />, <a key="pa" href={`tel:${phone}`} dir="ltr" className="num hover:text-brand-700">{d.phone}</a>] as [React.ReactNode, React.ReactNode]] : []),
    ...(d.email ? [[<Mail key="m" />, <a key="ma" href={`mailto:${d.email}`} dir="ltr" className="hover:text-brand-700">{d.email}</a>] as [React.ReactNode, React.ReactNode]] : []),
    ...(d.website ? [[<Globe key="w" />, <span key="wa" dir="ltr">{d.website}</span>] as [React.ReactNode, React.ReactNode]] : []),
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="developer-page">
      <PremiumPageHero
        eyebrow={t.list.eyebrow}
        title={d.name}
        description={d.notes ?? t.list.projects(d.projects.length)}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: t.list.title, href: '/dashboard/developers' },
          { label: d.name },
        ]}
        meta={
          <>
            {d.defaultCommissionPct && <Pill tone="gold">{t.list.commission} <span className="num ms-1">{Number(d.defaultCommissionPct)}%</span></Pill>}
            {!d.active && <Pill tone="slate">{t.list.inactive}</Pill>}
          </>
        }
        actions={
          <Link href={'/dashboard/developers/compare' as never}>
            <Button variant="outline" size="md" leftIcon={<Scale className="h-4 w-4" />}>{t.list.compare}</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel icon={<Building2 />} title={t.detail.projects} sub={t.detail.projectsSub} action={canEdit ? <AddProjectForm locale={locale} developerId={d.id} /> : undefined} testId="developer-projects">
            {d.projects.length === 0 ? (
              <p className="text-[13.5px] text-slate-500">{t.detail.noProjects}</p>
            ) : (
              <ul className="space-y-4">
                {d.projects.map((p) => {
                  const pct = p.commissionPct ? Number(p.commissionPct) : d.defaultCommissionPct ? Number(d.defaultCommissionPct) : null;
                  return (
                    <li key={p.id} className={cn('rounded-2xl border border-hairline p-4', !p.active && 'opacity-60')} data-testid={`project-${p.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-slate-900">{p.name}</p>
                          <p className="mt-0.5 text-[12.5px] text-slate-500">
                            {[p.city, p.district].filter(Boolean).join(' — ') || '—'}
                            {p.deliveryDate && (
                              <span className="ms-2 inline-flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" /> {t.detail.delivery} {formatDate(p.deliveryDate, locale)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {pct !== null && (
                            <Pill tone={p.commissionPct ? 'gold' : 'slate'}>
                              <span className="num">{t.detail.commissionFrom(pct)}</span>
                              {!p.commissionPct && <span className="ms-1 font-normal">({t.detail.defaultCommission})</span>}
                            </Pill>
                          )}
                          {canEdit && <RemoveButton kind="project" id={p.id} label={t.form.remove} />}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
                          <Wallet className="h-3.5 w-3.5" /> {t.detail.plans}
                        </p>
                        {(p.plans ?? []).length === 0 ? (
                          <p className="mt-2 text-[13px] text-slate-400">{t.detail.noPlans}</p>
                        ) : (
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {(p.plans ?? []).map((pl) => (
                              <li key={pl.id} className={cn('inline-flex items-center gap-2 rounded-xl border border-[#D8B66A]/35 bg-[#D8B66A]/[0.06] py-1.5 pe-1.5 ps-3 text-[12.5px]', !pl.active && 'opacity-50')}>
                                <span>
                                  <span className="font-bold text-slate-900">{pl.name}</span>
                                  <span className="num ms-2 text-slate-500">
                                    {pl.years === 0
                                      ? t.detail.cashLine(Number(pl.cashDiscountPct))
                                      : t.detail.planLine(Number(pl.downPaymentPct), pl.years, t.frequency[pl.frequency], Number(pl.deliveryPct))}
                                  </span>
                                </span>
                                {canEdit && <RemoveButton kind="plan" id={pl.id} label={t.form.remove} />}
                              </li>
                            ))}
                          </ul>
                        )}
                        {canEdit && <AddPlanForm locale={locale} projectId={p.id} />}
                      </div>

                      {(p.listings ?? []).length > 0 && (
                        <div className="mt-4 border-t border-hairline pt-3">
                          <p className="text-[12px] font-bold text-slate-500">{t.detail.listings}</p>
                          <ul className="mt-2 space-y-1.5">
                            {(p.listings ?? []).map((l) => (
                              <li key={l.id}>
                                <Link href={`/dashboard/listings/${l.id}` as never} className="flex items-center justify-between gap-3 text-[13px] hover:text-brand-700">
                                  <span className="truncate">
                                    <span className="num text-slate-400">{l.code}</span> · {l.title}
                                  </span>
                                  <span className="num shrink-0 font-bold text-slate-900">{formatCurrency(l.price, currency, locale)}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="order-first flex flex-col gap-6 lg:order-none lg:sticky lg:top-6">
          <Panel icon={<Phone />} title={t.detail.contact} testId="developer-contact">
            {contact.length === 0 ? (
              <p className="text-[13px] text-slate-500">—</p>
            ) : (
              <ul className="space-y-3">
                {contact.map(([icon, value], i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px] font-semibold text-slate-800 [&>span:first-child_svg]:h-4 [&>span:first-child_svg]:w-4">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-brand-700">{icon}</span>
                    <span className="min-w-0 truncate">{value}</span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="mt-5 border-t border-hairline pt-4">
                <EditDeveloperButton locale={locale} developer={d} />
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

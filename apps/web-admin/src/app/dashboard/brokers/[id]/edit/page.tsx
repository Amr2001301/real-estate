import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Broker } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import BrokerForm from '../../_form';
import BrokerStatusForm from './_status-form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function EditBrokerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [r, locale] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    getLocale(),
  ]);
  if (r.error || !r.data) notFound();
  const broker = r.data;
  const m = uiT(locale);
  const n = m.pages.brokersEdit;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-navy transition-colors">{m.common.breadcrumbHome}</Link>
            <span>/</span>
            <Link href="/dashboard/brokers" className="hover:text-navy transition-colors">{m.nav.items.brokers}</Link>
            <span>/</span>
            <Link href={`/dashboard/brokers/${id}` as never} className="hover:text-navy transition-colors">{broker.companyName}</Link>
            <span>/</span>
            <span className="text-navy font-medium">{n.breadcrumb}</span>
          </nav>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">{`${n.titlePrefix} ${broker.companyName}`}</h1>
              <p className="text-sm text-slate-500 mt-1">{n.description}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {n.badge}
            </span>
          </div>
        </div>
      </div>

      <BrokerForm broker={broker} locale={locale} />

      <section id="status" className="scroll-mt-24">
        <BrokerStatusForm broker={broker} locale={locale} />
      </section>
    </div>
  );
}

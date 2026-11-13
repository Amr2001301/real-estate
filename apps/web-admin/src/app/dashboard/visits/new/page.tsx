import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { projectOptions, staffOptions } from '@/lib/options';
import type { User } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { getSession, isBrokerage } from '@/lib/session';
import type { Paged } from '@/lib/types';
import type { Listing } from '@/components/listings/messages';
import { uiT } from '@/messages/ui';
import NewVisitForm from './_form';

export const dynamic = 'force-dynamic';

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ listingId?: string }> }) {
  const { listingId } = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale);
  const n = m.pages.visitsNew;

  // Units, leads and clients are searched from the form itself (SearchSelect).
  // BRK-2 — a brokerage visits its listings (on the market or under offer), not projects.
  const brokerage = isBrokerage(await getSession());
  const [meRes, projectsRes, salesRes, listingsRes] = await Promise.all([
    safe(api.get<User>('/users/me')),
    brokerage ? Promise.resolve({ data: null }) : safe(projectOptions()),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
    brokerage ? safe(api.get<Paged<Listing>>('/listings?status=AVAILABLE,UNDER_OFFER&pageSize=500')) : Promise.resolve({ data: null }),
  ]);

  const currentRole = (meRes.data?.role ?? 'SALES') as 'ADMIN' | 'SALES';

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium header card ── */}
      <div className="relative bg-surface border border-hairline rounded-[22px] overflow-hidden">
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  {m.common.breadcrumbHome}
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/visits' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  {m.nav.items.visits}
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">{n.breadcrumb}</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                {n.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                {n.description}
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              {n.badge}
            </span>
          </div>
        </div>
      </div>

      <NewVisitForm
        currentRole={currentRole}
        projects={projectsRes.data?.data ?? []}
        salesOptions={salesRes.data?.data ?? []}
        locale={locale}
        defaultListingId={listingId}
        listings={brokerage ? (listingsRes.data?.data ?? []).map((l) => ({ id: l.id, code: l.code, title: l.title, kind: l.kind })) : undefined}
      />
    </div>
  );
}

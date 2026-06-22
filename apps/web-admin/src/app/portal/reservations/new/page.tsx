import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, PortalLead, PortalUnit } from '@/lib/types';
import PortalReservationForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewPortalReservationPage() {
  const [leadsRes, unitsRes] = await Promise.all([
    safe(
      api.get<Paged<PortalLead>>(
        '/portal/leads?brokerApprovalStatus=APPROVED&pageSize=200',
      ),
    ),
    // pageSize is capped at 200 by PortalUnitsQueryDto (@Max(200)); requesting
    // more returns a 400 and an empty list — which is why the unit dropdown
    // showed no units. 200 covers a broker's available units in one page.
    safe(
      api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=200'),
    ),
  ]);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium header card ── */}
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              <li className="flex items-center gap-1">
                <Link
                  href={'/portal' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  البوابة
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/portal/reservations' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  الحجوزات
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">حجز جديد</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                حجز جديد
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                أنشئ حجزاً لفرصة معتمدة على وحدة متاحة.
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              حجز جديد
            </span>
          </div>
        </div>
      </div>

      <PortalReservationForm
        approvedLeads={leadsRes.data?.data ?? []}
        units={unitsRes.data?.data ?? []}
      />
    </div>
  );
}

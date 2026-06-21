import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { NewMaintenanceForm } from './new-maintenance-form';

export const dynamic = 'force-dynamic';

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const [customersRes, adminsRes] = await Promise.all([
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=ADMIN,MAINTENANCE_SUPERVISOR&pageSize=100')),
  ]);

  const customers = customersRes.data?.data ?? [];
  const admins = adminsRes.data?.data ?? [];

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
                  href={'/dashboard' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  لوحة التحكم
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/maintenance' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  الصيانة
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">طلب جديد</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                طلب صيانة جديد
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                إنشاء طلب صيانة نيابة عن العميل. عند اختيار مسؤول يبدأ الطلب بحالة «مسند»، وإلا «مفتوح».
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              جديد
            </span>
          </div>
        </div>
      </div>

      {sp.err && (
        <div className="rounded-xl bg-warning-50 border border-warning-100 text-warning-700 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر إنشاء الطلب</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      <NewMaintenanceForm customers={customers} admins={admins} />
    </div>
  );
}

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, User } from '@/lib/types';
import { getReportsCurrency } from '@/lib/currency';
import ContractForm from './form';

export default async function NewContractPage() {
  const [unitsRes, customersRes, customersRes2, currency] = await Promise.all([
    safe(api.get<Paged<Unit>>('/units?status=AVAILABLE&pageSize=100')),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=100')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=100')),
    getReportsCurrency(),
  ]);

  const customers = [
    ...(customersRes.data?.data ?? []),
    ...(customersRes2.data?.data ?? []),
  ];

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
                  href={'/dashboard/contracts' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  العقود
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">عقد جديد</span>
              </li>
            </ol>
          </nav>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                عقد يدوي جديد
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                إنشاء عقد بيع يدوياً بدون حجز مسبق.
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              عقد جديد
            </span>
          </div>
        </div>
      </div>

      {/* Advisory note */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">الطريقة المُفضَّلة: تحويل حجز</p>
          <p>
            يُنصح بإنشاء العقود عبر تحويل حجز موافَق عليه — يضمن ذلك ربط الحجز بالعقد تلقائياً،
            وتوليد خطة التقسيط من البيانات المحفوظة في الحجز.
          </p>
          <p>
            استخدم هذه الصفحة فقط عند الحاجة لإنشاء عقد يدوي بدون حجز مسبق.
          </p>
          <Link href="/dashboard/reservations" className="font-medium underline">
            الذهاب إلى الحجوزات ←
          </Link>
        </div>
      </div>

      <ContractForm
        units={unitsRes.data?.data ?? []}
        customers={customers}
        currency={currency}
      />
    </div>
  );
}

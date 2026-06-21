import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { User } from '@/lib/types';
import ClientForm from '../../_form';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<User>(`/users/${id}`));

  if (r.error || !r.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل العميل: {r.error ?? 'غير موجود'}
      </div>
    );
  }

  const user = r.data;
  const role = (user.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT') as
    | 'CLIENT'
    | 'CUSTOMER';

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />
        <div className="px-7 sm:px-9 pt-8 pb-7">
          <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-navy transition-colors">لوحة التحكم</Link>
            <span>/</span>
            <Link href={`/dashboard/clients?role=${role}` as never} className="hover:text-navy transition-colors">العملاء</Link>
            <span>/</span>
            <Link href={`/dashboard/clients/${id}` as never} className="hover:text-navy transition-colors">{user.fullName}</Link>
            <span>/</span>
            <span className="text-navy font-medium">تعديل</span>
          </nav>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">{`تعديل ملف ${user.fullName}`}</h1>
              <p className="text-sm text-slate-500 mt-1">تحديث البيانات الشخصية ومعلومات التواصل المسموح بها.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              تعديل
            </span>
          </div>
        </div>
      </div>
      <ClientForm user={user} />
    </div>
  );
}

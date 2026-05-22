import { redirect } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { getSession } from '@/lib/session';
import { logoutAction } from '@/app/login/actions';

export const dynamic = 'force-dynamic';

// Landing surface for MAINTENANCE_SUPERVISOR accounts. They have no web
// dashboard — their workspace is the maintenance mobile app — so this page just
// explains that and offers a sign-out.
export default async function MaintenanceAppPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center">
          <Wrench className="h-6 w-6 text-brand-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">هذا الحساب مخصص لتطبيق الصيانة</h1>
        <p className="text-sm text-slate-500">
          مرحباً {user.fullName}. يُستخدم هذا الحساب عبر تطبيق الصيانة على الهاتف لمتابعة الطلبات
          المُسندة إليك وتحديث حالتها ورفع الصور. لا تتوفر لوحة تحكم على الويب.
        </p>
        <form action={logoutAction}>
          <button className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );
}

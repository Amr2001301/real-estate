'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewCompanyPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          setError(data.message ?? 'حدث خطأ أثناء إنشاء الشركة');
          return;
        }
        router.push('/dashboard/super-admin');
        router.refresh();
      } catch {
        setError('تعذّر الاتصال بالخادم');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="إضافة شركة جديدة"
        description="أنشئ شركة جديدة وعيّن مديرها الأول."
        breadcrumbs={[
          { label: 'إدارة المنصة', href: '/dashboard/super-admin' },
          { label: 'الشركات', href: '/dashboard/super-admin' },
          { label: 'جديدة' },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-5">

        <Card>
          <CardHeader><CardTitle>بيانات الشركة</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة *</label>
                <Input name="name" required placeholder="شركة المدينة للعقارات" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المعرّف (Slug) *</label>
                <Input name="slug" required placeholder="al-madina-realestate" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الدولة</label>
                <Input name="country" defaultValue="SA" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">العملة</label>
                <Input name="currency" defaultValue="SAR" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المنطقة الزمنية</label>
                <Input name="timezone" defaultValue="Asia/Riyadh" dir="ltr" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>الاشتراك</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">خطة الاشتراك</label>
                <select name="subscriptionPlan" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="TRIAL">تجريبي</option>
                  <option value="STARTER">أساسي</option>
                  <option value="PROFESSIONAL">احترافي</option>
                  <option value="ENTERPRISE">مؤسسي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الحد الأقصى للمستخدمين</label>
                <Input name="maxUsers" type="number" min={1} placeholder="غير محدود" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ البدء</label>
                <Input name="subscriptionStartAt" type="date" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الانتهاء</label>
                <Input name="subscriptionEndAt" type="date" dir="ltr" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>المدير الأول (اختياري)</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-slate-500">إذا أدخلت بيانات المدير، سيُنشأ حساب ADMIN للشركة الجديدة تلقائياً.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل</label>
                <Input name="adminFullName" placeholder="أحمد محمد" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <Input name="adminEmail" type="email" placeholder="admin@company.com" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
              <Input name="adminPassword" type="password" placeholder="8 أحرف على الأقل" dir="ltr" />
            </div>
          </CardBody>
        </Card>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" variant="primary" loading={pending}>إنشاء الشركة</Button>
        </div>
      </form>
    </div>
  );
}

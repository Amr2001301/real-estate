'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Users, CheckCircle2, XCircle, PauseCircle,
  RotateCcw, AlertTriangle, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const STATUS_BADGE: Record<string, string> = {
  TRIAL: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  CANCELLING: 'bg-amber-100 text-amber-700', CANCELLED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-red-100 text-red-700', SUSPENDED: 'bg-red-200 text-red-800',
};
const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'تجريبي', ACTIVE: 'نشط', CANCELLING: 'قيد الإلغاء',
  CANCELLED: 'ملغي', EXPIRED: 'منتهي', SUSPENDED: 'موقوف',
};
const PLAN_LABEL: Record<string, string> = {
  TRIAL: 'تجريبي', STARTER: 'أساسي', PROFESSIONAL: 'احترافي', ENTERPRISE: 'مؤسسي',
};

interface CompanyDetail {
  id: string; name: string; slug: string; country: string | null;
  currency: string; timezone: string; isActive: boolean;
  subscriptionPlan: string; subscriptionStatus: string;
  subscriptionStartAt: string | null; subscriptionEndAt: string | null;
  maxUsers: number | null; cancelledAt: string | null; cancelReason: string | null;
  createdAt: string; updatedAt: string;
  _count: { users: number };
  users: Array<{ id: string; fullName: string; email: string | null; role: string; active: boolean; lastLoginAt: string | null; createdAt: string }>;
}

async function fetchCompany(id: string): Promise<CompanyDetail | null> {
  const res = await fetch(`/api-proxy/super-admin/companies/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json() as Promise<CompanyDetail>;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  async function reload() {
    setLoading(true);
    const data = await fetchCompany(id);
    setCompany(data);
    setLoading(false);
  }

  useEffect(() => { void reload(); }, [id]);

  async function callAction(path: string, body?: object) {
    setActionError(null);
    const res = await fetch(`/api-proxy/super-admin/companies/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      setActionError(d.message ?? 'حدث خطأ');
      return false;
    }
    return true;
  }

  async function patchCompany(body: object) {
    setActionError(null);
    const res = await fetch(`/api-proxy/super-admin/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      setActionError(d.message ?? 'حدث خطأ');
      return false;
    }
    return true;
  }

  if (loading) return <div className="p-8 text-sm text-slate-400">جارٍ التحميل…</div>;
  if (!company) return <div className="p-8 text-sm text-red-500">لم يتم العثور على الشركة.</div>;

  const isCancellable = company.subscriptionStatus === 'ACTIVE' || company.subscriptionStatus === 'TRIAL';
  const isActivatable = ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(company.subscriptionStatus);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/super-admin" className="text-slate-400 hover:text-slate-600">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
          <p className="text-xs font-mono text-slate-400">{company.slug} · {company.id}</p>
        </div>
        <span className={`ms-auto inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_BADGE[company.subscriptionStatus] ?? ''}`}>
          {STATUS_LABEL[company.subscriptionStatus] ?? company.subscriptionStatus}
        </span>
      </div>

      {actionError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* CANCELLING banner */}
      {company.subscriptionStatus === 'CANCELLING' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          الاشتراك قيد الإلغاء — الوصول يستمر حتى {company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — details + edit */}
        <div className="lg:col-span-2 space-y-5">

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>تفاصيل الشركة</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? 'إلغاء' : 'تعديل'}
              </Button>
            </CardHeader>
            <CardBody>
              {editMode ? (
                <EditForm company={company} onSave={async (data) => {
                  startTransition(async () => {
                    if (await patchCompany(data)) { setEditMode(false); await reload(); }
                  });
                }} pending={pending} />
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['الاسم', company.name],
                    ['الدولة', company.country ?? '—'],
                    ['العملة', company.currency],
                    ['المنطقة الزمنية', company.timezone],
                    ['خطة الاشتراك', PLAN_LABEL[company.subscriptionPlan] ?? company.subscriptionPlan],
                    ['تاريخ البدء', company.subscriptionStartAt ? formatDate(company.subscriptionStartAt) : '—'],
                    ['تاريخ الانتهاء', company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—'],
                    ['الحد الأقصى للمستخدمين', company.maxUsers?.toString() ?? 'غير محدود'],
                    ['المستخدمون', `${company._count.users}${company.maxUsers ? ` / ${company.maxUsers}` : ''}`],
                    ['تاريخ الإنشاء', formatDate(company.createdAt)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-slate-500 text-[11px] font-medium">{k}</dt>
                      <dd className="text-slate-900 font-semibold">{v}</dd>
                    </div>
                  ))}
                  {company.cancelReason && (
                    <div className="col-span-2">
                      <dt className="text-slate-500 text-[11px] font-medium">سبب الإلغاء</dt>
                      <dd className="text-slate-700">{company.cancelReason}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardBody>
          </Card>

          {/* Users list */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                المستخدمون ({company._count.users})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddAdmin(true)}>
                <UserPlus className="h-4 w-4 me-1" /> مدير جديد
              </Button>
            </CardHeader>
            <CardBody>
              {showAddAdmin && (
                <AddAdminForm onSubmit={async (data) => {
                  startTransition(async () => {
                    if (await callAction('admin', data)) { setShowAddAdmin(false); await reload(); }
                  });
                }} onCancel={() => setShowAddAdmin(false)} pending={pending} />
              )}
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead className="text-right text-xs text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-2 py-2 font-medium">الاسم</th>
                      <th className="px-2 py-2 font-medium">الدور</th>
                      <th className="px-2 py-2 font-medium">آخر دخول</th>
                      <th className="px-2 py-2 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-50">
                        <td className="px-2 py-2">
                          <p className="font-medium text-slate-900">{u.fullName}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-2 py-2 text-slate-600">{u.role}</td>
                        <td className="px-2 py-2 text-slate-500 text-[12px]">
                          {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {u.active ? 'نشط' : 'معطّل'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {company.users.length === 0 && (
                      <tr><td colSpan={4} className="px-2 py-6 text-center text-slate-400 text-sm">لا يوجد مستخدمون</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right — actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>الإجراءات</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {isActivatable && (
                <Button variant="primary" size="sm" className="w-full" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}>
                  <CheckCircle2 className="h-4 w-4 me-1" /> تفعيل الاشتراك
                </Button>
              )}
              {isCancellable && !showCancelForm && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCancelForm(true)}>
                  <XCircle className="h-4 w-4 me-1" /> إلغاء الاشتراك
                </Button>
              )}
              {isCancellable && !showCancelForm && (
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('suspend')) await reload(); })}>
                  <PauseCircle className="h-4 w-4 me-1" /> إيقاف فوري
                </Button>
              )}
              {company.subscriptionStatus === 'SUSPENDED' && (
                <Button variant="ghost" size="sm" className="w-full" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}>
                  <RotateCcw className="h-4 w-4 me-1" /> رفع الإيقاف
                </Button>
              )}
            </CardBody>
          </Card>

          {showCancelForm && (
            <CancelForm
              onSubmit={async (data) => {
                startTransition(async () => {
                  if (await callAction('cancel', data)) { setShowCancelForm(false); await reload(); }
                });
              }}
              onClose={() => setShowCancelForm(false)}
              pending={pending}
              subscriptionEndAt={company.subscriptionEndAt}
            />
          )}
        </div>

      </div>
    </div>
  );
}

function EditForm({ company, onSave, pending }: {
  company: CompanyDetail;
  onSave: (data: object) => void;
  pending: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({
      name: fd.get('name'),
      country: fd.get('country'),
      currency: fd.get('currency'),
      timezone: fd.get('timezone'),
      subscriptionPlan: fd.get('subscriptionPlan'),
      subscriptionStartAt: fd.get('subscriptionStartAt') || null,
      subscriptionEndAt: fd.get('subscriptionEndAt') || null,
      maxUsers: fd.get('maxUsers') ? Number(fd.get('maxUsers')) : null,
    });
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">الاسم</label>
          <Input name="name" defaultValue={company.name} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">الدولة</label>
          <Input name="country" defaultValue={company.country ?? ''} dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">العملة</label>
          <Input name="currency" defaultValue={company.currency} dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">المنطقة الزمنية</label>
          <Input name="timezone" defaultValue={company.timezone} dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">خطة الاشتراك</label>
          <select name="subscriptionPlan" defaultValue={company.subscriptionPlan}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            <option value="TRIAL">تجريبي</option>
            <option value="STARTER">أساسي</option>
            <option value="PROFESSIONAL">احترافي</option>
            <option value="ENTERPRISE">مؤسسي</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">الحد الأقصى للمستخدمين</label>
          <Input name="maxUsers" type="number" defaultValue={company.maxUsers ?? ''} dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">تاريخ البدء</label>
          <Input name="subscriptionStartAt" type="date" dir="ltr"
            defaultValue={company.subscriptionStartAt ? company.subscriptionStartAt.slice(0, 10) : ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">تاريخ الانتهاء</label>
          <Input name="subscriptionEndAt" type="date" dir="ltr"
            defaultValue={company.subscriptionEndAt ? company.subscriptionEndAt.slice(0, 10) : ''} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" variant="primary" size="sm" loading={pending}>حفظ</Button>
      </div>
    </form>
  );
}

function CancelForm({ onSubmit, onClose, pending, subscriptionEndAt }: {
  onSubmit: (data: { immediate: boolean; reason?: string }) => void;
  onClose: () => void;
  pending: boolean;
  subscriptionEndAt: string | null;
}) {
  const [immediate, setImmediate] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <Card>
      <CardHeader><CardTitle className="text-red-700">إلغاء الاشتراك</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={!immediate} onChange={() => setImmediate(false)} />
            <span>إلغاء في نهاية الفترة {subscriptionEndAt ? `(${formatDate(subscriptionEndAt)})` : ''}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer text-red-700">
            <input type="radio" checked={immediate} onChange={() => setImmediate(true)} />
            <span>إلغاء فوري (قطع الوصول الآن)</span>
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">سبب الإلغاء (اختياري)</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            placeholder="انتهاء العقد، عدم التجديد…"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" size="sm" loading={pending}
            className="bg-red-600 hover:bg-red-700"
            onClick={() => onSubmit({ immediate, reason: reason || undefined })}>
            تأكيد الإلغاء
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AddAdminForm({ onSubmit, onCancel, pending }: {
  onSubmit: (data: { email: string; password: string; fullName: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      fullName: fd.get('fullName') as string,
      email: fd.get('email') as string,
      password: fd.get('password') as string,
    });
  }
  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-100 bg-brand-50/30 p-4 mb-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">إضافة مدير جديد</p>
      <div className="grid grid-cols-2 gap-3">
        <Input name="fullName" required placeholder="الاسم الكامل" />
        <Input name="email" type="email" required placeholder="admin@company.com" dir="ltr" />
      </div>
      <Input name="password" type="password" required placeholder="كلمة المرور" dir="ltr" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>إضافة</Button>
      </div>
    </form>
  );
}

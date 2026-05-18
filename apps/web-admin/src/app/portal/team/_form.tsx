'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import type { BrokerUser } from '@/lib/types';
import type { TeamFormState } from './actions';

type Action = (prev: TeamFormState, formData: FormData) => Promise<TeamFormState>;

interface Props {
  action: Action;
  initial?: BrokerUser;
  submitLabel: string;
  /** When true, hides password & invitation-only fields. */
  isEdit?: boolean;
}

export function TeamMemberForm({ action, initial, submitLabel, isEdit }: Props) {
  const [state, formAction] = useActionState<TeamFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {state.error}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">المعلومات الشخصية</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">الاسم الكامل *</span>
            <Input name="fullName" defaultValue={initial?.user.fullName ?? ''} required />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">المسمى الوظيفي</span>
            <Input name="jobTitle" defaultValue={initial?.jobTitle ?? ''} />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">البريد الإلكتروني</span>
            <Input name="email" type="email" dir="ltr" defaultValue={initial?.user.email ?? ''} />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">رقم الجوال</span>
            <Input name="phone" dir="ltr" defaultValue={initial?.user.phone ?? ''} />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">اللغة المفضلة</span>
            <Select name="locale" defaultValue={initial?.user.locale ?? 'ar'}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </label>
          {!isEdit && (
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">كلمة المرور (اختياري)</span>
              <Input name="password" type="password" dir="ltr" minLength={8} placeholder="8 أحرف على الأقل" />
            </label>
          )}
        </div>
        <p className="text-2xs text-slate-500">
          يجب إدخال بريد إلكتروني أو رقم جوال على الأقل. إن لم تُحدَّد كلمة مرور، سيُرسل دعوة عبر القناة المتاحة.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">الصلاحيات</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="isPrimaryContact"
            defaultChecked={initial?.isPrimaryContact ?? false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block font-medium text-slate-800">جهة الاتصال الرئيسية</span>
            <span className="block text-2xs text-slate-500 mt-0.5">
              يمكن أن يكون لكل وسيط جهة اتصال رئيسية واحدة فقط. تعيين هذا العضو سيُلغي تلقائيًا أي جهة اتصال سابقة.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="canManageBrokerUsers"
            defaultChecked={initial?.canManageBrokerUsers ?? false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block font-medium text-slate-800">إدارة فريق العمل</span>
            <span className="block text-2xs text-slate-500 mt-0.5">
              يستطيع هذا العضو إضافة وإيقاف وإزالة بقية أعضاء الفريق.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="canViewCommissions"
            defaultChecked={initial ? initial.canViewCommissions : true}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block font-medium text-slate-800">الاطلاع على العمولات والمدفوعات</span>
            <span className="block text-2xs text-slate-500 mt-0.5">
              يستطيع هذا العضو رؤية صفحات «العمولات» و«المدفوعات» في البوابة. أَلغِ التحديد لإخفاء البيانات المالية.
            </span>
          </span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" variant="primary" size="md">{submitLabel}</Button>
      </div>
    </form>
  );
}

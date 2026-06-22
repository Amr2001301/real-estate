'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
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

const NAV_SECTIONS = [
  { id: 'section-personal',    num: '01', label: 'المعلومات الشخصية', sub: 'الاسم وبيانات التواصل' },
  { id: 'section-permissions', num: '02', label: 'الصلاحيات',         sub: 'صلاحيات العضو في البوابة' },
];

export function TeamMemberForm({ action, initial, submitLabel, isEdit }: Props) {
  const [state, formAction] = useActionState<TeamFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state?.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={NAV_SECTIONS}
        sidebarBadge="جديد"
        sidebarInfo="سيستلم العضو بريدًا/إشعارًا للتفعيل عند إرسال الدعوة."
      >
        <PremiumFormPanel
          id="section-personal"
          number="01"
          title="المعلومات الشخصية"
          description="يجب إدخال بريد إلكتروني أو رقم جوال على الأقل."
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" name="fullName" required>
            <Input id="fullName" name="fullName" defaultValue={initial?.user.fullName ?? ''} required />
          </Field>
          <Field label="المسمى الوظيفي" name="jobTitle">
            <Input id="jobTitle" name="jobTitle" defaultValue={initial?.jobTitle ?? ''} />
          </Field>
          <Field label="البريد الإلكتروني" name="email">
            <Input id="email" name="email" type="email" dir="ltr" defaultValue={initial?.user.email ?? ''} />
          </Field>
          <Field label="رقم الجوال" name="phone">
            <Input id="phone" name="phone" dir="ltr" defaultValue={initial?.user.phone ?? ''} />
          </Field>
          <Field label="اللغة المفضلة" name="locale">
            <Select id="locale" name="locale" defaultValue={initial?.user.locale ?? 'ar'}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>
          {!isEdit && (
            <Field label="كلمة المرور" name="password" hint="اختياري — 8 أحرف على الأقل">
              <Input id="password" name="password" type="password" dir="ltr" minLength={8} placeholder="اتركه فارغاً لإرسال دعوة" />
            </Field>
          )}
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-permissions"
          number="02"
          title="الصلاحيات"
          description="تحكم في ما يستطيع هذا العضو رؤيته وإدارته."
        >
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="isPrimaryContact"
              defaultChecked={initial?.isPrimaryContact ?? false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">جهة الاتصال الرئيسية</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                يمكن أن يكون لكل وسيط جهة اتصال رئيسية واحدة فقط. تعيين هذا العضو سيُلغي تلقائيًا أي جهة اتصال سابقة.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="canManageBrokerUsers"
              defaultChecked={initial?.canManageBrokerUsers ?? false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">إدارة فريق العمل</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                يستطيع هذا العضو إضافة وإيقاف وإزالة بقية أعضاء الفريق.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="canViewCommissions"
              defaultChecked={initial ? initial.canViewCommissions : true}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">الاطلاع على العمولات والمدفوعات</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                يستطيع هذا العضو رؤية صفحات «العمولات» و«المدفوعات» في البوابة. أَلغِ التحديد لإخفاء البيانات المالية.
              </span>
            </span>
          </label>
        </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/team">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>{submitLabel}</SubmitButton>
          </>
        }
      />
    </form>
  );
}

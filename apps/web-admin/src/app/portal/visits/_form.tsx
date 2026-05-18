'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { tx } from '@/lib/format';
import type { Paged, PortalLead, PortalProject, PortalUnit } from '@/lib/types';
import {
  createPortalVisitRequestAction,
  type PortalVisitFormState,
} from './actions';

interface Props {
  projects: PortalProject[];
  units: Paged<PortalUnit> | null;
  leads: Paged<PortalLead> | null;
}

export default function PortalVisitForm({ projects, units, leads }: Props) {
  const [state, formAction] = useActionState<PortalVisitFormState, FormData>(
    createPortalVisitRequestAction,
    {},
  );
  const unitRows = units?.data ?? [];
  const leadRows = leads?.data ?? [];

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="الفرصة"
        description="إن كانت الزيارة لعميل موجود اختر فرصته. خلاف ذلك اترك الحقل فارغاً وأدخل بيانات العميل أدناه."
      >
        <Field label="فرصة موجودة" name="leadId">
          <Select id="leadId" name="leadId" defaultValue="">
            <option value="">— لا، عميل جديد —</option>
            {leadRows.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName} • {l.phone}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="بيانات الزيارة" description="حدد المشروع والتاريخ المقترح.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="المشروع" name="projectId" required>
            <Select id="projectId" name="projectId" required defaultValue="">
              <option value="" disabled>
                اختر مشروعاً
              </option>
              {projects.map((p) => (
                <option key={p.project.id} value={p.project.id}>
                  {tx(p.project.name)} — {p.project.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة" name="unitId" hint="اختياري">
            <Select id="unitId" name="unitId" defaultValue="">
              <option value="">— لا تحدد وحدة —</option>
              {unitRows.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} • {tx(u.building.phase.project.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="التاريخ المقترح" name="preferredDate" required>
            <Input id="preferredDate" name="preferredDate" type="date" required />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="بيانات العميل"
        description="مطلوبة فقط إذا لم تختر فرصة موجودة في الأعلى."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" name="customerName">
            <Input id="customerName" name="customerName" />
          </Field>
          <Field label="رقم الجوال" name="customerPhone">
            <Input id="customerPhone" name="customerPhone" dir="ltr" placeholder="+9665…" />
          </Field>
          <Field label="البريد الإلكتروني" name="customerEmail" hint="اختياري">
            <Input id="customerEmail" name="customerEmail" type="email" dir="ltr" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="ملاحظات" description="أي تفاصيل إضافية تساعد في تنظيم الزيارة.">
        <Field label="ملاحظة" name="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/visits">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>طلب الزيارة</SubmitButton>
          </>
        }
        helper="ستراجع الإدارة الطلب وتجدول موعد الزيارة."
      />
    </form>
  );
}

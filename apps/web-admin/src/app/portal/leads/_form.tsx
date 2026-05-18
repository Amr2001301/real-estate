'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, Info, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { tx } from '@/lib/format';
import type { PortalProject, PortalUnit, Paged } from '@/lib/types';
import { createPortalLeadAction, type PortalLeadFormState } from './actions';

interface Props {
  projects: PortalProject[];
  units: Paged<PortalUnit> | null;
}

export default function PortalLeadForm({ projects, units }: Props) {
  const [state, formAction] = useActionState<PortalLeadFormState, FormData>(
    createPortalLeadAction,
    {},
  );

  const unitRows = units?.data ?? [];

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.duplicate && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 p-4 text-sm">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              تم تسجيل العميل بحالة "مكرر" — رقم الجوال موجود بالفعل في النظام.
            </p>
            <p className="text-xs">
              ستراجع الإدارة الحالة وقد تعتمدها أو تبقيها مكررة.{' '}
              <Link
                href={`/portal/leads/${state.duplicate.id}` as never}
                className="font-semibold underline"
              >
                عرض العميل
              </Link>
            </p>
          </div>
        </div>
      )}

      <FormSection title="بيانات العميل" description="معلومات التواصل الأساسية للعميل المحتمل.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" name="fullName" required>
            <Input id="fullName" name="fullName" required minLength={2} />
          </Field>
          <Field label="رقم الجوال" name="phone" required hint="مثال: +966500000000">
            <Input
              id="phone"
              name="phone"
              required
              dir="ltr"
              placeholder="+9665…"
            />
          </Field>
          <Field label="البريد الإلكتروني" name="email" hint="اختياري">
            <Input id="email" name="email" type="email" dir="ltr" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="الاهتمام" description="حدد المشروع والوحدة التي يهتم بها العميل.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="المشروع" name="projectInterestId" hint="من المشاريع المتاحة لك">
            <Select id="projectInterestId" name="projectInterestId" defaultValue="">
              <option value="">— لاحقاً —</option>
              {projects.map((p) => (
                <option key={p.project.id} value={p.project.id}>
                  {tx(p.project.name)} — {p.project.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة" name="unitInterestId" hint="اختياري">
            <Select id="unitInterestId" name="unitInterestId" defaultValue="">
              <option value="">— لا تحدد وحدة —</option>
              {unitRows.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} • {tx(u.building.phase.project.name)} ({u.type})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="ملاحظات" description="أي معلومات قد تساعد فريق المبيعات.">
        <Field label="ملاحظة" name="note">
          <Textarea id="note" name="note" rows={4} />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/leads">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>إرسال الفرصة</SubmitButton>
          </>
        }
        helper="سيتم إخطار الإدارة بعد الإرسال للمراجعة."
      />
    </form>
  );
}

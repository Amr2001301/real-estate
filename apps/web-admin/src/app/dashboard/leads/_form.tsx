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
import type { Project, LeadSource, User } from '@/lib/types';
import { tx } from '@/lib/format';
import { createLeadAction, type LeadFormState } from './actions';

interface Props {
  projects: Project[];
  sources: LeadSource[];
  sales: User[];
}

export default function LeadForm({ projects, sources, sales }: Props) {
  const [state, formAction] = useActionState<LeadFormState, FormData>(
    createLeadAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="بيانات الاتصال"
        description="الاسم ورقم الهاتف الأساسي. البريد الإلكتروني اختياري."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" name="fullName" required>
            <Input id="fullName" name="fullName" required />
          </Field>
          <Field
            label="رقم الهاتف"
            name="phone"
            hint="بصيغة E.164، مثال: +966500000001"
            required
          >
            <Input id="phone" name="phone" required dir="ltr" />
          </Field>
        </div>

        <Field label="البريد الإلكتروني (اختياري)" name="email">
          <Input id="email" name="email" type="email" dir="ltr" />
        </Field>
      </FormSection>

      <FormSection
        title="الاهتمام والمصدر"
        description="ساعدنا على فهم سياق هذا العميل لتحويله بشكل أسرع."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="مصدر العميل" name="sourceId">
            <Select id="sourceId" name="sourceId" defaultValue="">
              <option value="">— غير محدد —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {tx(s.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المشروع المهتم به" name="projectInterestId">
            <Select id="projectInterestId" name="projectInterestId" defaultValue="">
              <option value="">— غير محدد —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {tx(p.name)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="الإسناد والمتابعة"
        description="حدّد المسؤول عن متابعة هذا العميل وأضف ملاحظاتك الأولية."
      >
        <Field label="إسناد إلى مندوب مبيعات" name="assignedSalesId">
          <Select id="assignedSalesId" name="assignedSalesId" defaultValue="">
            <option value="">— غير مسند —</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ملاحظات أولية" name="notes" hint="اختياري — مثال: اهتم بالطابق العلوي، يفضّل التواصل مساءً.">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/leads' as never}>
              <Button
                type="button"
                variant="ghost"
                leftIcon={<X className="h-4 w-4" />}
              >
                إلغاء
              </Button>
            </Link>
            <SubmitButton>إنشاء العميل</SubmitButton>
          </>
        }
        helper="سيتم إنشاء العميل بحالة جديد افتراضياً."
      />
    </form>
  );
}

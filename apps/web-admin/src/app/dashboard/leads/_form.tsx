'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { salesActorLabel } from '@/lib/sales-actor';
import { ClientPicker } from '@/components/crm/client-picker';
import type { Project, LeadSource, User } from '@/lib/types';
import { tx } from '@/lib/format';
import { createLeadAction, type LeadFormState } from './actions';

interface Props {
  projects: Project[];
  sources: LeadSource[];
  sales: User[];
  /** Pre-selected client (e.g. when launched from Client Details). */
  initialClient?: User | null;
}

export default function LeadForm({ projects, sources, sales, initialClient }: Props) {
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
        title="العميل المرتبط"
        description="كل فرصة بيع يجب أن ترتبط بعميل. اختر عميلاً موجوداً، أو أنشئ عميلاً جديداً وسيتم إنشاء حسابه تلقائياً."
      >
        <ClientPicker initialClient={initialClient ?? null} />
      </FormSection>

      <FormSection
        title="الاهتمام والمصدر"
        description="ساعدنا على فهم سياق هذه الفرصة لتحويلها بشكل أسرع."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="مصدر الفرصة" name="sourceId">
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
        description="حدّد المسؤول عن متابعة هذه الفرصة وأضف ملاحظاتك الأولية."
      >
        <Field label="إسناد إلى مندوب مبيعات" name="assignedSalesId">
          <Select id="assignedSalesId" name="assignedSalesId" defaultValue="">
            <option value="">— غير مسند —</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {salesActorLabel(s)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="ملاحظات أولية"
          name="notes"
          hint="اختياري — مثال: اهتم بالطابق العلوي، يفضّل التواصل مساءً."
        >
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
            <SubmitButton>إنشاء فرصة CRM</SubmitButton>
          </>
        }
        helper="سيتم إنشاء الفرصة بحالة جديد افتراضياً."
      />
    </form>
  );
}

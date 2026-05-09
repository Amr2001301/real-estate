'use client';

import { useActionState } from 'react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import type { Project, LeadSource, User } from '@/lib/types';
import { tx } from '@/lib/format';
import { createLeadAction, type LeadFormState } from './actions';

interface Props {
  projects: Project[];
  sources: LeadSource[];
  sales: User[];
}

export default function LeadForm({ projects, sources, sales }: Props) {
  const [state, formAction] = useActionState<LeadFormState, FormData>(createLeadAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="الاسم الكامل" name="fullName">
          <input id="fullName" name="fullName" required className={inputClass} />
        </Field>
        <Field label="الهاتف" name="phone" hint="بصيغة E.164، مثال: +966500000001">
          <input id="phone" name="phone" required dir="ltr" className={inputClass} />
        </Field>
      </div>

      <Field label="البريد الإلكتروني (اختياري)" name="email">
        <input id="email" name="email" type="email" dir="ltr" className={inputClass} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="المصدر" name="sourceId">
          <select id="sourceId" name="sourceId" defaultValue="" className={inputClass}>
            <option value="">— غير محدد —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {tx(s.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المشروع المهتم به" name="projectInterestId">
          <select
            id="projectInterestId"
            name="projectInterestId"
            defaultValue=""
            className={inputClass}
          >
            <option value="">— غير محدد —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.name)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="إسناد إلى مندوب مبيعات" name="assignedSalesId">
        <select id="assignedSalesId" name="assignedSalesId" defaultValue="" className={inputClass}>
          <option value="">— غير مسند —</option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ملاحظات أولية" name="notes">
        <textarea id="notes" name="notes" rows={3} className={inputClass} />
      </Field>

      {state.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{state.error}</div>
      )}

      <SubmitButton>إنشاء العميل</SubmitButton>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { salesActorLabel } from '@/lib/sales-actor';
import { ClientPicker } from '@/components/crm/client-picker';
import type { Project, LeadSource, User } from '@/lib/types';
import { tx } from '@/lib/format';
import { createLeadAction, type LeadFormState } from './actions';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';

interface SlimUnit {
  id: string;
  code: string;
  type: string;
  projectId: string;
}

const NAV_SECTIONS = [
  { id: 'section-client',     num: '01', label: 'العميل المرتبط',     sub: 'ربط الفرصة بعميل قائم أو جديد' },
  { id: 'section-interest',   num: '02', label: 'الاهتمام والمصدر',   sub: 'المشروع ومصدر الفرصة' },
  { id: 'section-assignment', num: '03', label: 'الإسناد والمتابعة', sub: 'المندوب المسؤول والملاحظات' },
];

interface Props {
  projects: Project[];
  sources: LeadSource[];
  sales: User[];
  units?: SlimUnit[];
  /** Pre-selected client (e.g. when launched from Client Details). */
  initialClient?: User | null;
}

export default function LeadForm({ projects, sources, sales, units = [], initialClient }: Props) {
  const [state, formAction] = useActionState<LeadFormState, FormData>(
    createLeadAction,
    {},
  );

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const filteredUnits = units.filter((u) => u.projectId === selectedProjectId);

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={NAV_SECTIONS}
        sidebarBadge="جديد"
        sidebarInfo="سيتم إنشاء الفرصة بحالة جديد افتراضياً. يمكنك تحديث المرحلة من صفحة التفاصيل."
      >
        <PremiumFormPanel
          id="section-client"
          number="01"
          title="العميل المرتبط"
          description="كل فرصة بيع يجب أن ترتبط بعميل. اختر عميلاً موجوداً، أو أنشئ عميلاً جديداً وسيتم إنشاء حسابه تلقائياً."
        >
          <ClientPicker initialClient={initialClient ?? null} />
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-interest"
          number="02"
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
              <Select
                id="projectInterestId"
                name="projectInterestId"
                defaultValue=""
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">— غير محدد —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {tx(p.name)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Unit picker — appears after project is chosen */}
          {selectedProjectId && (
            <Field
              label="الوحدة المهتم بها"
              name="unitInterestId"
              hint="اختياري — حدد الوحدة إن كان العميل مهتماً بوحدة بعينها."
            >
              <Select id="unitInterestId" name="unitInterestId" defaultValue="">
                <option value="">— غير محدد —</option>
                {filteredUnits.length === 0 ? (
                  <option disabled value="">لا توجد وحدات متاحة لهذا المشروع</option>
                ) : (
                  filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}{u.type ? ` · ${u.type}` : ''}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          )}
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-assignment"
          number="03"
          title="الإسناد والمتابعة"
          description="حدّد المسؤول عن متابعة هذه الفرصة وأضف ملاحظاتك الأولية."
        >
          <div className="flex flex-col gap-5">
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
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

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

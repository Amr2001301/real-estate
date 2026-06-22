'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, Info, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { tx } from '@/lib/format';
import type { PortalProject, PortalUnit, Paged } from '@/lib/types';
import { createPortalLeadAction, type PortalLeadFormState } from './actions';

interface Props {
  projects: PortalProject[];
  units: Paged<PortalUnit> | null;
}

/**
 * Robust project-id resolver for a portal unit. The portal payload nests the
 * project under building.phase, exposing both `projectId` and `project.id`;
 * we fall back across the known shapes so a schema tweak can't silently break
 * the project→unit filter again.
 */
function unitProjectId(u: PortalUnit): string {
  return u.building?.phase?.projectId ?? u.building?.phase?.project?.id ?? '';
}

const NAV_SECTIONS = [
  { id: 'section-client',   num: '01', label: 'بيانات العميل', sub: 'الاسم وبيانات التواصل' },
  { id: 'section-interest', num: '02', label: 'الاهتمام',      sub: 'المشروع والوحدة المستهدفة' },
  { id: 'section-notes',    num: '03', label: 'ملاحظات',       sub: 'معلومات لفريق المبيعات' },
];

export default function PortalLeadForm({ projects, units }: Props) {
  const [state, formAction] = useActionState<PortalLeadFormState, FormData>(
    createPortalLeadAction,
    {},
  );

  const unitRows = units?.data ?? [];

  // Selected project drives which units are offered. Until a project is
  // picked we show all broker-visible units so the field still works on its
  // own; once a project is chosen we scope to that project's units.
  const [projectId, setProjectId] = useState('');
  const [unitId, setUnitId] = useState('');

  const visibleUnits = projectId
    ? unitRows.filter((u) => unitProjectId(u) === projectId)
    : unitRows;
  const noUnitsForProject = projectId !== '' && visibleUnits.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.duplicate && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 px-5 py-4 text-sm shadow-soft">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              تم تسجيل العميل بحالة &quot;مكرر&quot; — رقم الجوال موجود بالفعل في النظام.
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

      <PremiumFormLayout
        navSections={NAV_SECTIONS}
        sidebarBadge="جديد"
        sidebarInfo="سيتم إخطار الإدارة بعد الإرسال للمراجعة والاعتماد."
      >
        <PremiumFormPanel
          id="section-client"
          number="01"
          title="بيانات العميل"
          description="معلومات التواصل الأساسية للعميل المحتمل."
        >
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
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-interest"
          number="02"
          title="الاهتمام"
          description="حدد المشروع والوحدة التي يهتم بها العميل."
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="المشروع" name="projectInterestId" hint="من المشاريع المتاحة لك">
            <Select
              id="projectInterestId"
              name="projectInterestId"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                // Reset the unit when the project changes so a stale unit from
                // another project can't be submitted.
                setUnitId('');
              }}
            >
              <option value="">— لاحقاً —</option>
              {projects.map((p) => (
                <option key={p.project.id} value={p.project.id}>
                  {tx(p.project.name)} — {p.project.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة" name="unitInterestId" hint="اختياري">
            <Select
              id="unitInterestId"
              name="unitInterestId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">— لا تحدد وحدة —</option>
              {noUnitsForProject ? (
                <option value="" disabled>
                  لا توجد وحدات متاحة لهذا المشروع
                </option>
              ) : (
                visibleUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} • {tx(u.building.phase.project.name)} ({u.type})
                  </option>
                ))
              )}
            </Select>
          </Field>
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-notes"
          number="03"
          title="ملاحظات"
          description="أي معلومات قد تساعد فريق المبيعات."
        >
          <Field label="ملاحظة" name="note">
            <Textarea id="note" name="note" rows={4} />
          </Field>
        </PremiumFormPanel>
      </PremiumFormLayout>

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

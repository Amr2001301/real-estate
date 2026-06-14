'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, X, User, Phone, Mail, Info } from 'lucide-react';
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

/**
 * Robust project-id resolver for a portal unit. Portal payloads nest the
 * project under building.phase (exposing both `projectId` and `project.id`);
 * we fall back across the known shapes — including a possible flat
 * `projectId` — so a schema tweak can't silently break the project→unit
 * filter again.
 */
function getUnitProjectId(u: PortalUnit): string {
  return (
    (u as { projectId?: string }).projectId ??
    u.building?.phase?.projectId ??
    u.building?.phase?.project?.id ??
    ''
  );
}

export default function PortalVisitForm({ projects, units, leads }: Props) {
  const [state, formAction] = useActionState<PortalVisitFormState, FormData>(
    createPortalVisitRequestAction,
    {},
  );
  const unitRows = units?.data ?? [];
  const leadRows = leads?.data ?? [];

  const [leadId, setLeadId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [unitId, setUnitId] = useState('');

  const selectedLead = leadRows.find((l) => l.id === leadId) ?? null;

  // Units offered are scoped to the selected project; until one is chosen we
  // show all broker-visible units so the field still works standalone.
  const visibleUnits = projectId
    ? unitRows.filter((u) => getUnitProjectId(u) === projectId)
    : unitRows;
  const noUnitsForProject = projectId !== '' && visibleUnits.length === 0;

  function onLeadChange(nextLeadId: string) {
    setLeadId(nextLeadId);
    const lead = leadRows.find((l) => l.id === nextLeadId) ?? null;
    // Prefill project/unit from the lead's interest. Customer name/phone/email
    // are read off `selectedLead` directly at render time.
    const nextProjectId = lead?.projectInterestId ?? '';
    setProjectId(nextProjectId);
    // Only adopt the lead's unit if it belongs to the (now-selected) project
    // and is visible to this broker; otherwise leave it unset.
    const leadUnitId = lead?.unitInterestId ?? '';
    const leadUnitVisible =
      leadUnitId !== '' &&
      unitRows.some(
        (u) => u.id === leadUnitId && getUnitProjectId(u) === nextProjectId,
      );
    setUnitId(leadUnitVisible ? leadUnitId : '');
  }

  function onProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    // Drop the chosen unit if it no longer belongs to the new project.
    if (unitId) {
      const stillValid = unitRows.some(
        (u) => u.id === unitId && getUnitProjectId(u) === nextProjectId,
      );
      if (!stillValid) setUnitId('');
    }
  }

  const hasLead = selectedLead !== null;

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
        description="إن كانت الزيارة لعميل موجود اختر فرصته لتعبئة بياناته تلقائياً. خلاف ذلك اترك الحقل فارغاً وأدخل بيانات العميل أدناه."
      >
        <Field label="فرصة موجودة" name="leadId">
          <Select
            id="leadId"
            name="leadId"
            value={leadId}
            onChange={(e) => onLeadChange(e.target.value)}
          >
            <option value="">— لا، عميل جديد —</option>
            {leadRows.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName} • {l.phone}
              </option>
            ))}
          </Select>
        </Field>

        {hasLead && (
          <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-xs font-semibold text-brand-700 mb-2">
              بيانات العميل من الفرصة المختارة
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-700">
                <User className="h-4 w-4 text-slate-400" />
                {selectedLead!.fullName}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Phone className="h-4 w-4 text-slate-400" />
                {selectedLead!.phone}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Mail className="h-4 w-4 text-slate-400" />
                {selectedLead!.email ?? '—'}
              </span>
            </div>
            {/* Carry the lead's customer data through submission. The backend
                falls back to the lead's own fields, but sending them keeps the
                payload explicit and future-proof. */}
            <input type="hidden" name="customerName" value={selectedLead!.fullName} />
            <input type="hidden" name="customerPhone" value={selectedLead!.phone} />
            {selectedLead!.email && (
              <input type="hidden" name="customerEmail" value={selectedLead!.email} />
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="بيانات الزيارة" description="حدد المشروع والوحدة والتاريخ المقترح.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="المشروع" name="projectId" required>
            <Select
              id="projectId"
              name="projectId"
              required
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
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
            <Select
              id="unitId"
              name="unitId"
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
                    {u.code} • {tx(u.building.phase.project.name)}
                  </option>
                ))
              )}
            </Select>
          </Field>
          <Field label="التاريخ المقترح" name="preferredDate" required hint="يوم/شهر/سنة">
            <Input id="preferredDate" name="preferredDate" type="date" required dir="ltr" />
          </Field>
        </div>
      </FormSection>

      {!hasLead && (
        <FormSection
          title="بيانات العميل"
          description="مطلوبة لأنك لم تختر فرصة موجودة في الأعلى."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الاسم الكامل" name="customerName" required>
              <Input id="customerName" name="customerName" required minLength={2} />
            </Field>
            <Field label="رقم الجوال" name="customerPhone" required>
              <Input
                id="customerPhone"
                name="customerPhone"
                required
                dir="ltr"
                placeholder="+9665…"
              />
            </Field>
            <Field label="البريد الإلكتروني" name="customerEmail" hint="اختياري">
              <Input id="customerEmail" name="customerEmail" type="email" dir="ltr" />
            </Field>
          </div>
        </FormSection>
      )}

      {hasLead && (
        <div className="flex items-start gap-2 rounded-xl bg-info-50/60 border border-info-100 text-info-700 p-3 text-xs">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            سيتم استخدام بيانات العميل من الفرصة المختارة تلقائياً — لا حاجة
            لإعادة إدخالها.
          </p>
        </div>
      )}

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

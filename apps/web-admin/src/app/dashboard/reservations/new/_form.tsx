'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import type { LeadStage } from '@/lib/types';
import { createReservationAction, type ReservationFormState } from '../actions';

interface Unit {
  id: string;
  code: string;
  type: string;
  building?: { phase?: { project?: { name: { ar: string; en: string } } } };
}

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  projectInterest?: { id: string; name: { ar: string; en: string } } | null;
}

interface Client {
  id: string;
  fullName: string;
  phone: string | null;
  role: 'CLIENT' | 'CUSTOMER';
}

interface SalesUser {
  id: string;
  fullName: string;
}

interface Props {
  units: Unit[];
  leads: Lead[];
  clients: Client[];
  salesOptions: SalesUser[];
}

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'تم البيع',
  LOST: 'خسارة',
};

const ROLE_LABELS: Record<'CLIENT' | 'CUSTOMER', string> = {
  CLIENT: 'عميل مسجل',
  CUSTOMER: 'عميل مشتري',
};

function formatLeadLabel(l: Lead): string {
  const project = l.projectInterest?.name.ar ?? 'بدون تحديد مشروع';
  const stage = STAGE_LABELS[l.stage] ?? l.stage;
  return `${l.fullName} — ${project} — ${stage} — ${l.phone}`;
}

function formatClientLabel(c: Client): string {
  const role = ROLE_LABELS[c.role];
  const phone = c.phone ?? 'بدون هاتف';
  return `${c.fullName} — ${role} — ${phone}`;
}

export default function NewReservationForm({ units, leads, clients, salesOptions }: Props) {
  const [state, formAction] = useActionState<ReservationFormState, FormData>(
    createReservationAction,
    {},
  );
  const [ownerType, setOwnerType] = useState<'lead' | 'client'>('lead');

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="الوحدة العقارية"
        description="اختر الوحدة المراد حجزها. يجب أن تكون الوحدة في حالة متاحة."
      >
        <Field label="الوحدة" name="unitId" required>
          <Select name="unitId" required>
            <option value="">— اختر وحدة —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.type}
                {u.building?.phase?.project?.name.ar
                  ? ` (${u.building.phase.project.name.ar})`
                  : ''}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="العميل"
        description="اختر مصدر واحد فقط: إما عميل محتمل من CRM، أو عميل مسجل في النظام."
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">نوع المالك</span>
          <div className="flex flex-wrap gap-3">
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                ownerType === 'lead'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-hairline bg-surface text-muted hover:border-brand-300'
              }`}
            >
              <input
                type="radio"
                name="ownerType"
                value="lead"
                checked={ownerType === 'lead'}
                onChange={() => setOwnerType('lead')}
                className="accent-brand-500"
              />
              <span>عميل محتمل من CRM</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                ownerType === 'client'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-hairline bg-surface text-muted hover:border-brand-300'
              }`}
            >
              <input
                type="radio"
                name="ownerType"
                value="client"
                checked={ownerType === 'client'}
                onChange={() => setOwnerType('client')}
                className="accent-brand-500"
              />
              <span>عميل مسجل</span>
            </label>
          </div>
        </div>

        {ownerType === 'lead' ? (
          <Field
            label="العميل المحتمل (Lead)"
            name="leadId"
            hint="فرصة من CRM — اسم، مشروع الاهتمام، مرحلة، هاتف"
            required
          >
            <Select name="leadId" required>
              <option value="">— اختر فرصة —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatLeadLabel(l)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="العميل المسجل"
            name="clientId"
            hint="حساب مسجل في النظام — اسم، نوع الحساب، هاتف"
            required
          >
            <Select name="clientId" required>
              <option value="">— اختر عميلاً مسجلاً —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClientLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </FormSection>

      <FormSection
        title="تفاصيل الحجز"
        description="حدد المندوب المسؤول، مدة صلاحية الحجز، وأي ملاحظات داخلية."
      >
        <Field label="المندوب المسؤول" name="salesId">
          <Select name="salesId">
            <option value="">— اختر مندوباً —</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="صلاحية الحجز (بالساعات)"
          name="expiresInHours"
          hint="المدة الزمنية التي يبقى فيها الحجز قيد المراجعة قبل انتهائه تلقائياً"
        >
          <Select name="expiresInHours" defaultValue="72">
            <option value="24">24 ساعة (يوم)</option>
            <option value="48">48 ساعة (يومان)</option>
            <option value="72">72 ساعة (3 أيام) — افتراضي</option>
            <option value="120">120 ساعة (5 أيام)</option>
            <option value="168">168 ساعة (أسبوع)</option>
            <option value="336">336 ساعة (أسبوعان)</option>
          </Select>
        </Field>

        <Field label="ملاحظات" name="notes" hint="ملاحظات داخلية اختيارية">
          <Textarea name="notes" rows={3} placeholder="أضف ملاحظات اختيارية…" />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={<SubmitButton>إنشاء الحجز</SubmitButton>}
        secondary={
          <Link href="/dashboard/reservations">
            <Button variant="ghost" size="md" type="button">
              إلغاء
            </Button>
          </Link>
        }
      />
    </form>
  );
}

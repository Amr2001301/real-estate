'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import type { LeadStage, Project } from '@/lib/types';
import { createVisitAction, type VisitFormState } from '../actions';

interface Unit {
  id: string;
  code: string;
  type: string;
  building?: { phase?: { project?: { id: string; name: { ar: string; en: string } } } };
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
  currentRole: 'ADMIN' | 'SALES';
  projects: Project[];
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

function getProjectName(p: Project): string {
  return p.name?.ar ?? p.name?.en ?? '—';
}

function nowLocalInputValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

type OwnerType = 'lead' | 'client' | 'walkin';

export default function NewVisitForm({
  currentRole,
  projects,
  units,
  leads,
  clients,
  salesOptions,
}: Props) {
  const [state, formAction] = useActionState<VisitFormState, FormData>(createVisitAction, {});
  const [ownerType, setOwnerType] = useState<OwnerType>('lead');
  const [leadId, setLeadId] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const selectedLead = useMemo(() => leads.find((l) => l.id === leadId), [leads, leadId]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const filteredUnits = useMemo(
    () => (projectId ? units.filter((u) => u.building?.phase?.project?.id === projectId) : units),
    [units, projectId],
  );

  const isAdmin = currentRole === 'ADMIN';
  const minScheduledAt = isAdmin ? undefined : nowLocalInputValue();
  const isPast = scheduledAt ? new Date(scheduledAt) < new Date() : false;

  const displayName =
    ownerType === 'lead' ? selectedLead?.fullName ?? '' :
    ownerType === 'client' ? selectedClient?.fullName ?? '' : '';
  const displayPhone =
    ownerType === 'lead' ? selectedLead?.phone ?? '' :
    ownerType === 'client' ? selectedClient?.phone ?? '' : '';

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <FormSection
        title="العميل"
        description="اختر نوع العميل. الزيارة بدون حساب مخصصة للعملاء غير المسجلين الذين يحضرون مباشرة."
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">نوع العميل</span>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { value: 'lead', label: 'عميل محتمل من CRM' },
                { value: 'client', label: 'عميل مسجل' },
                { value: 'walkin', label: 'بدون حساب (Walk-in)' },
              ] as { value: OwnerType; label: string }[]
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                  ownerType === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-hairline bg-surface text-muted hover:border-brand-300'
                }`}
              >
                <input
                  type="radio"
                  name="ownerType"
                  value={opt.value}
                  checked={ownerType === opt.value}
                  onChange={() => setOwnerType(opt.value)}
                  className="accent-brand-500"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {ownerType === 'lead' && (
          <Field label="العميل المحتمل" name="leadId" required>
            <Select
              name="leadId"
              required
              value={leadId}
              onChange={(e) => {
                setLeadId(e.target.value);
                const lead = leads.find((l) => l.id === e.target.value);
                if (lead?.projectInterest?.id && !projectId) {
                  setProjectId(lead.projectInterest.id);
                }
              }}
            >
              <option value="">— اختر فرصة —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatLeadLabel(l)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {ownerType === 'client' && (
          <Field label="العميل المسجل" name="clientId" required>
            <Select
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— اختر عميلاً مسجلاً —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClientLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {(ownerType === 'lead' || ownerType === 'client') && (displayName || displayPhone) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-surface-muted/40 border border-hairline p-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">الاسم</p>
              <p className="text-sm font-medium">{displayName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">رقم الهاتف</p>
              <p className="text-sm font-medium" dir="ltr">{displayPhone || '—'}</p>
            </div>
          </div>
        )}

        {ownerType === 'walkin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="اسم العميل" name="customerName" required>
              <Input name="customerName" required placeholder="مثال: عمرو خالد" />
            </Field>
            <Field label="رقم الهاتف" name="customerPhone" required>
              <Input
                name="customerPhone"
                required
                placeholder="مثال: 01012345678"
                dir="ltr"
              />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection
        title="المشروع والوحدة"
        description="حدد المشروع الذي سيُزار. يمكنك اختياريًا تحديد وحدة معينة."
      >
        <Field label="المشروع" name="projectId" required>
          <Select
            name="projectId"
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {getProjectName(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="الوحدة (اختياري)" name="unitId" hint="تظهر فقط وحدات المشروع المختار">
          <Select name="unitId" disabled={!projectId}>
            <option value="">— بدون تحديد وحدة —</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.type}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="موعد الزيارة"
        description={
          isAdmin
            ? 'حدد موعد الزيارة. كمدير يمكنك إدخال زيارة سابقة لتوثيقها بأثر رجعي.'
            : 'حدد موعد الزيارة. لا يمكن جدولة زيارة في الماضي.'
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="التاريخ والوقت" name="scheduledAt" required>
            <Input
              type="datetime-local"
              name="scheduledAt"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minScheduledAt}
            />
          </Field>

          <Field label="المدة (دقائق)" name="durationMinutes">
            <Select name="durationMinutes" defaultValue="60">
              <option value="30">30 دقيقة</option>
              <option value="60">60 دقيقة</option>
              <option value="90">90 دقيقة</option>
              <option value="120">120 دقيقة</option>
            </Select>
          </Field>
        </div>

        {isAdmin && isPast && (
          <div className="flex items-start gap-2 text-sm rounded-xl bg-amber-50 border border-amber-100 text-amber-800 px-3 py-2">
            <input
              type="checkbox"
              checked
              readOnly
              disabled
              className="mt-0.5 accent-brand-500"
            />
            <div>
              <p className="font-medium">سيتم حفظ هذه الزيارة كمنفّذة</p>
              <p className="text-xs mt-0.5">
                التاريخ المختار في الماضي، لذلك ستُسجَّل الحالة تلقائياً كـ COMPLETED.
              </p>
            </div>
            <input type="hidden" name="status" value="COMPLETED" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="الموقع" name="location" hint="مثال: مكتب المبيعات بالقاهرة الجديدة">
            <Input name="location" placeholder="الموقع…" />
          </Field>
          <Field label="نقطة اللقاء" name="meetingPoint">
            <Input name="meetingPoint" placeholder="نقطة اللقاء…" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="المندوب والملاحظات"
        description={
          isAdmin
            ? 'حدد المندوب المسؤول عن الزيارة وأضف أي ملاحظات داخلية.'
            : 'سيتم تعيينك تلقائيًا كمندوب مسؤول.'
        }
      >
        {isAdmin && (
          <Field label="المندوب المسؤول" name="assignedSalesId">
            <Select name="assignedSalesId">
              <option value="">— بدون تعيين —</option>
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="ملاحظات داخلية" name="salesNotes">
          <Textarea name="salesNotes" rows={3} placeholder="ملاحظات اختيارية…" />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={<SubmitButton>إنشاء الزيارة</SubmitButton>}
        secondary={
          <Link href="/dashboard/visits">
            <Button variant="ghost" size="md" type="button">
              إلغاء
            </Button>
          </Link>
        }
      />
    </form>
  );
}

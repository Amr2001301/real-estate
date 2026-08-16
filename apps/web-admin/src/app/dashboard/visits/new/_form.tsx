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
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { LeadStage, Project } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createVisitAction, type VisitFormState } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';

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
  role?: string;
}

interface Props {
  currentRole: 'ADMIN' | 'SALES';
  projects: Project[];
  units: Unit[];
  leads: Lead[];
  clients: Client[];
  salesOptions: SalesUser[];
  locale?: Locale;
}

type OwnerType = 'lead' | 'client' | 'walkin';

function nowLocalInputValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewVisitForm({
  currentRole,
  projects,
  units,
  leads,
  clients,
  salesOptions,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.visitsForm;

  const STAGE_LABELS: Record<LeadStage, string> = {
    NEW: m.stageNew, INTERESTED: m.stageInterested, VISIT: m.stageVisit,
    NEGOTIATION: m.stageNegotiation, WON: m.stageWon, LOST: m.stageLost,
  };
  const ROLE_LABELS: Record<'CLIENT' | 'CUSTOMER', string> = {
    CLIENT: m.roleClient, CUSTOMER: m.roleCustomer,
  };
  function formatLeadLabel(l: Lead): string {
    const project = l.projectInterest?.name.ar ?? m.noProject;
    const stage = STAGE_LABELS[l.stage] ?? l.stage;
    return `${l.fullName} — ${project} — ${stage} — ${l.phone}`;
  }
  function formatClientLabel(c: Client): string {
    const role = ROLE_LABELS[c.role];
    const phone = c.phone ?? m.noPhone;
    return `${c.fullName} — ${role} — ${phone}`;
  }
  function getProjectName(p: Project): string {
    return p.name?.ar ?? p.name?.en ?? '—';
  }

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

  const navSections = [
    { id: 'section-client',   num: '01', label: m.nav01Label, sub: m.nav01Sub },
    { id: 'section-project',  num: '02', label: m.nav02Label, sub: m.nav02Sub },
    { id: 'section-schedule', num: '03', label: m.nav03Label, sub: m.nav03Sub },
    { id: 'section-agent',    num: '04', label: m.nav04Label, sub: m.nav04Sub },
  ];

  const clientTypeOptions: { value: OwnerType; label: string }[] = [
    { value: 'lead',   label: m.typeLeadLabel },
    { value: 'client', label: m.typeClientLabel },
    { value: 'walkin', label: m.typeWalkinLabel },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={navSections}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-client"
          number="01"
          title={m.p1Title}
          description={m.p1Desc}
        >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{m.clientTypeLabel}</span>
          <div className="flex flex-wrap gap-3">
            {clientTypeOptions.map((opt) => (
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
          <Field label={m.leadFieldLabel} name="leadId" required>
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
              <option value="">{m.leadOptionEmpty}</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatLeadLabel(l)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {ownerType === 'client' && (
          <Field label={m.clientFieldLabel} name="clientId" required>
            <Select
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">{m.clientOptionEmpty}</option>
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
              <p className="text-xs text-slate-500 mb-0.5">{m.nameLabel}</p>
              <p className="text-sm font-medium">{displayName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">{m.phoneLabelShort}</p>
              <p className="text-sm font-medium" dir="ltr">{displayPhone || '—'}</p>
            </div>
          </div>
        )}

        {ownerType === 'walkin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={m.walkinNameLabel} name="customerName" required>
              <Input name="customerName" required placeholder={m.walkinNamePlaceholder} />
            </Field>
            <Field label={m.walkinPhoneLabel} name="customerPhone" required>
              <Input
                name="customerPhone"
                required
                placeholder={m.walkinPhonePlaceholder}
                dir="ltr"
              />
            </Field>
          </div>
        )}
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-project"
          number="02"
          title={m.p2Title}
          description={m.p2Desc}
        >
        <Field label={m.projectLabel} name="projectId" required>
          <Select
            name="projectId"
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{m.projectOptionEmpty}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {getProjectName(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={m.unitLabel} name="unitId" hint={m.unitHint}>
          <Select name="unitId" disabled={!projectId}>
            <option value="">{m.unitOptionNone}</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.type}
              </option>
            ))}
          </Select>
        </Field>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-schedule"
          number="03"
          title={m.p3Title}
          description={isAdmin ? m.p3DescAdmin : m.p3DescSales}
        >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={m.dateTimeLabel} name="scheduledAt" required>
            <Input
              type="datetime-local"
              name="scheduledAt"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minScheduledAt}
            />
          </Field>

          <Field label={m.durationLabel} name="durationMinutes">
            <Select name="durationMinutes" defaultValue="60">
              <option value="30">{m.duration30}</option>
              <option value="60">{m.duration60}</option>
              <option value="90">{m.duration90}</option>
              <option value="120">{m.duration120}</option>
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
              <p className="font-medium">{m.pastVisitNote}</p>
              <p className="text-xs mt-0.5">{m.pastVisitDetail}</p>
            </div>
            <input type="hidden" name="status" value="COMPLETED" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={m.locationLabel} name="location" hint={m.locationHint}>
            <Input name="location" placeholder={m.locationPlaceholder} />
          </Field>
          <Field label={m.meetingPointLabel} name="meetingPoint">
            <Input name="meetingPoint" placeholder={m.meetingPointPlaceholder} />
          </Field>
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-agent"
          number="04"
          title={m.p4Title}
          description={isAdmin ? m.p4DescAdmin : m.p4DescSales}
        >
        {isAdmin && (
          <Field label={m.agentLabel} name="assignedSalesId">
            <Select name="assignedSalesId">
              <option value="">{m.agentOptionNone}</option>
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {salesActorLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={m.internalNotesLabel} name="salesNotes">
          <Textarea name="salesNotes" rows={3} placeholder={m.internalNotesPlaceholder} />
        </Field>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={<SubmitButton>{m.submitCreate}</SubmitButton>}
        secondary={
          <Link href="/dashboard/visits">
            <Button variant="ghost" size="md" type="button">
              {m.cancelBtn}
            </Button>
          </Link>
        }
      />
    </form>
  );
}

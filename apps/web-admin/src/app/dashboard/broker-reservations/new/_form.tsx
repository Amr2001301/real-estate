'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PremiumFormPanel } from '@/components/premium';
import { SearchSelect } from '@/components/form/search-select';
import type { AdminBrokerLead, Unit } from '@/lib/types';
import { tx } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  createAdminBrokerReservationAction,
  type AdminBrokerReservationFormState,
} from './actions';

interface BrokerOption {
  id: string;
  companyName: string;
  code: string;
  defaultCommissionPct: number;
}
interface AgentOption {
  id: string;
  fullName: string;
  email: string | null;
}
interface ProjectOption {
  id: string;
  name: string;
  city: string | null;
}

interface Props {
  brokers: BrokerOption[];
  selectedBrokerId: string;
  brokerAgents: AgentOption[];
  selectedBrokerAgentId: string;
  /** The broker has at least one approved lead with a sales rep. */
  hasApprovedLeads: boolean;
  projects: ProjectOption[];
  selectedProjectId: string;
  symbol: string;
  locale?: Locale;
}

function FormField({
  label,
  required,
  hint,
  hintTone = 'default',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hintTone?: 'default' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && (
        <p className={`text-[11px] mt-0.5 leading-snug ${hintTone === 'warning' ? 'text-amber-600' : 'text-slate-400'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function AdminBrokerReservationForm({
  brokers,
  selectedBrokerId,
  brokerAgents,
  selectedBrokerAgentId,
  hasApprovedLeads,
  projects,
  selectedProjectId,
  symbol,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.brokerReservationsForm;
  const c = uiT(locale).common;
  const router = useRouter();
  const [state, formAction] = useActionState<AdminBrokerReservationFormState, FormData>(
    createAdminBrokerReservationAction,
    {},
  );

  function pushSearch(params: Record<string, string>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
    router.replace(`/dashboard/broker-reservations/new${qs.toString() ? `?${qs.toString()}` : ''}`);
  }

  const broker = brokers.find((b) => b.id === selectedBrokerId);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{state.error}</p>
        </div>
      )}

      {/* ── Panel 01 — Broker + Agent ─────────────────────────────────────── */}
      <PremiumFormPanel
        id="broker"
        number="01"
        title={m.panel01Title}
        description={m.panel01Desc}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label={m.labelBroker}
            required
            hint={
              broker
                ? `${m.hintBrokerCommission} ${broker.defaultCommissionPct.toFixed(2)}%`
                : undefined
            }
          >
            <Select
              name="brokerId"
              required
              value={selectedBrokerId}
              onChange={(e) => pushSearch({ brokerId: e.target.value })}
            >
              <option value="" disabled>{m.optionChooseBroker}</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.companyName} ({b.code})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label={m.labelAgent}
            hint={m.hintAgent}
          >
            <Select
              name="brokerAgentId"
              value={selectedBrokerAgentId}
              onChange={(e) =>
                pushSearch({
                  brokerId: selectedBrokerId,
                  brokerAgentId: e.target.value,
                  projectId: selectedProjectId,
                })
              }
              disabled={!selectedBrokerId}
            >
              <option value="">{m.optionNoAgent}</option>
              {brokerAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}{a.email ? ` — ${a.email}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </PremiumFormPanel>

      {/* ── Panel 02 — Approved Lead ──────────────────────────────────────── */}
      <PremiumFormPanel
        id="lead"
        number="02"
        title={m.panel02Title}
        description={m.panel02Desc}
      >
        {!selectedBrokerId ? (
          <p className="text-sm text-slate-400 py-1">
            {m.noBrokerMsg}
          </p>
        ) : !hasApprovedLeads ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{m.noLeadsMsg}</p>
          </div>
        ) : (
          <FormField
            label={m.labelLead}
            required
            hint={m.hintLead}
          >
            {/* Searched on the server: this used to preload ?pageSize=100
                of the broker's approved leads. */}
            <SearchSelect<AdminBrokerLead>
              key={selectedBrokerId}
              name="leadId"
              required
              endpoint={`/api-proxy/broker-leads?brokerId=${encodeURIComponent(
                selectedBrokerId,
              )}&brokerApprovalStatus=APPROVED&assigned=true`}
              toOption={(l) => ({
                id: l.id,
                label: `${l.fullName} — ${l.phone}${
                  l.projectInterest ? ` • ${tx(l.projectInterest.name)}` : ''
                }`,
                raw: l,
              })}
              placeholder={c.searchBrokerLeadPlaceholder}
              locale={locale}
            />
          </FormField>
        )}
      </PremiumFormPanel>

      {/* ── Panel 03 — Project + Unit ─────────────────────────────────────── */}
      <PremiumFormPanel
        id="unit"
        number="03"
        title={m.panel03Title}
        description={m.panel03Desc}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label={m.labelProject} required>
            <Select
              value={selectedProjectId}
              onChange={(e) =>
                pushSearch({
                  brokerId: selectedBrokerId,
                  brokerAgentId: selectedBrokerAgentId,
                  projectId: e.target.value,
                })
              }
              required
            >
              <option value="" disabled>{m.optionChooseProject}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.city ? ` — ${p.city}` : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label={m.labelUnit}
            required
            hint={m.hintUnitAccess}
          >
            {/* Searched on the server: this used to preload ?pageSize=200
                available units of the project. */}
            <SearchSelect<Unit>
              key={selectedProjectId}
              name="unitId"
              required
              disabled={!selectedProjectId}
              endpoint={`/api-proxy/units?projectId=${encodeURIComponent(
                selectedProjectId,
              )}&status=AVAILABLE`}
              toOption={(u) => ({
                id: u.id,
                label: `${u.code} — ${u.type}${u.building?.name ? ` (${u.building.name})` : ''} — ${Number(
                  u.price,
                ).toLocaleString()} ${symbol}`,
                raw: u,
              })}
              placeholder={selectedProjectId ? c.searchUnitPlaceholder : m.optionChooseProjectFirst}
              locale={locale}
            />
          </FormField>
        </div>
      </PremiumFormPanel>

      {/* ── Panel 04 — Notes + Submit ─────────────────────────────────────── */}
      <PremiumFormPanel
        id="notes"
        number="04"
        title={m.panel04Title}
        description={m.panel04Desc}
      >
        <div className="space-y-6">
          <FormField label={m.labelNotes} hint={m.hintNotes}>
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder={m.notesPlaceholder}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 pt-5 border-t border-hairline">
            <p className="text-[11px] text-slate-400 leading-snug max-w-sm">
              {m.footerNote}
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Save className="h-4 w-4" />}
            >
              {m.submitBtn}
            </Button>
          </div>
        </div>
      </PremiumFormPanel>
    </form>
  );
}

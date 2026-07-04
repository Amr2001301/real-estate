'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PremiumFormPanel } from '@/components/premium';
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
interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
  projectInterestId: string | null;
  projectInterestName: string | null;
}
interface ProjectOption {
  id: string;
  name: string;
  city: string | null;
}
interface UnitOption {
  id: string;
  code: string;
  type: string;
  price: string | number;
  buildingName: string | null;
}

interface Props {
  brokers: BrokerOption[];
  selectedBrokerId: string;
  brokerAgents: AgentOption[];
  selectedBrokerAgentId: string;
  approvedLeads: LeadOption[];
  projects: ProjectOption[];
  selectedProjectId: string;
  units: UnitOption[];
  symbol?: string;
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
  approvedLeads,
  projects,
  selectedProjectId,
  units,
  symbol = 'ج.م',
}: Props) {
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
        title="الوسيط ووكيله"
        description="اختر شركة الوساطة ثم الوكيل الذي قدّم طلب الحجز. الوكيل اختياري إن كان الطلب مباشرًا من الشركة."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="الوسيط"
            required
            hint={
              broker
                ? `نسبة العمولة الافتراضية: ${broker.defaultCommissionPct.toFixed(2)}%`
                : undefined
            }
          >
            <Select
              name="brokerId"
              required
              value={selectedBrokerId}
              onChange={(e) => pushSearch({ brokerId: e.target.value })}
            >
              <option value="" disabled>اختر وسيطًا…</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.companyName} ({b.code})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="الوكيل"
            hint="اختياري — اتركه فارغًا إن طلب الوسيط مباشرةً"
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
              <option value="">— بدون وكيل —</option>
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
        title="الفرصة (Lead)"
        description="اربط هذا الحجز بفرصة معتمدة للوسيط. يجب أن تكون الفرصة في حالة APPROVED ولديها مسؤول مبيعات داخلي."
      >
        {!selectedBrokerId ? (
          <p className="text-sm text-slate-400 py-1">
            اختر وسيطًا أولًا لعرض الفرص المعتمدة.
          </p>
        ) : approvedLeads.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              لا توجد فرص معتمدة لهذا الوسيط بمسؤول مبيعات معيّن.
              اعتمد الفرص أولًا من «فرص من الوسطاء».
            </p>
          </div>
        ) : (
          <FormField
            label="الفرصة المعتمدة"
            required
            hint="تُعرض فقط الفرص المعتمدة (APPROVED) ولديها مسؤول مبيعات داخلي معيّن."
          >
            <Select name="leadId" required defaultValue="">
              <option value="" disabled>اختر فرصة…</option>
              {approvedLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName} — {l.phone}
                  {l.projectInterestName ? ` • ${l.projectInterestName}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </PremiumFormPanel>

      {/* ── Panel 03 — Project + Unit ─────────────────────────────────────── */}
      <PremiumFormPanel
        id="unit"
        number="03"
        title="الوحدة"
        description="اختر المشروع أولًا ثم الوحدة المتاحة. تُعرض فقط الوحدات بحالة AVAILABLE."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="المشروع" required>
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
              <option value="" disabled>اختر مشروعًا…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.city ? ` — ${p.city}` : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="الوحدة"
            required
            hint={
              selectedProjectId && units.length === 0
                ? 'لا توجد وحدات متاحة في هذا المشروع.'
                : 'إن لم تكن الوحدة في صلاحيات الوسيط، سيُرفض الإنشاء عند الحفظ.'
            }
            hintTone={selectedProjectId && units.length === 0 ? 'warning' : 'default'}
          >
            <Select name="unitId" required defaultValue="" disabled={!selectedProjectId}>
              <option value="" disabled>
                {selectedProjectId ? 'اختر وحدة…' : 'اختر مشروعًا أولًا'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.type}
                  {u.buildingName ? ` (${u.buildingName})` : ''} —{' '}
                  {Number(u.price).toLocaleString()} {symbol}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </PremiumFormPanel>

      {/* ── Panel 04 — Notes + Submit ─────────────────────────────────────── */}
      <PremiumFormPanel
        id="notes"
        number="04"
        title="ملاحظات واعتماد"
        description="أضف أي ملاحظات داخلية ثم احفظ الحجز. سيتم تثبيت نسبة عمولة الوسيط لحظة الإنشاء."
      >
        <div className="space-y-6">
          <FormField label="ملاحظات داخلية" hint="اختياري — ستُحفظ كملاحظة مرتبطة بالحجز">
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="ملاحظات داخلية على الحجز"
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 pt-5 border-t border-hairline">
            <p className="text-[11px] text-slate-400 leading-snug max-w-sm">
              سيتم تثبيت ملف عمولة الوسيط لحظة الإنشاء — حسب وصول الوسيط للمشروع أو نسبته الافتراضية.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Save className="h-4 w-4" />}
            >
              حفظ الحجز
            </Button>
          </div>
        </div>
      </PremiumFormPanel>
    </form>
  );
}

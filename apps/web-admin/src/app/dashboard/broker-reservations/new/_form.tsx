'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
}

/**
 * Three cascading dropdowns (broker → agent → lead, and project → unit).
 * Changing a parent updates the URL search params so the server component
 * can refetch the right child list. The form itself only submits when the
 * admin clicks Save.
 */
export function AdminBrokerReservationForm({
  brokers,
  selectedBrokerId,
  brokerAgents,
  selectedBrokerAgentId,
  approvedLeads,
  projects,
  selectedProjectId,
  units,
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
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {state.error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">الوسيط ووكيله</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">الوسيط *</span>
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
            {broker && (
              <span className="block text-2xs text-slate-500 mt-1">
                نسبة العمولة الافتراضية: {broker.defaultCommissionPct.toFixed(2)}%
              </span>
            )}
          </label>

          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">الوكيل (اختياري)</span>
            <Select
              name="brokerAgentId"
              value={selectedBrokerAgentId}
              onChange={(e) => pushSearch({ brokerId: selectedBrokerId, brokerAgentId: e.target.value, projectId: selectedProjectId })}
              disabled={!selectedBrokerId}
            >
              <option value="">— بدون وكيل —</option>
              {brokerAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}{a.email ? ` — ${a.email}` : ''}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">الفرصة (Lead)</h2>
        {!selectedBrokerId ? (
          <p className="text-xs text-slate-500">اختر وسيطًا أولًا لعرض الفرص المعتمدة.</p>
        ) : approvedLeads.length === 0 ? (
          <p className="text-xs text-amber-700">
            لا توجد فرص معتمدة لهذا الوسيط بمسؤول مبيعات معيّن. اعتمد الفرص أولًا من «فرص من الوسطاء».
          </p>
        ) : (
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">الفرصة المعتمدة *</span>
            <Select name="leadId" required defaultValue="">
              <option value="" disabled>اختر فرصة…</option>
              {approvedLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName} — {l.phone}{l.projectInterestName ? ` • ${l.projectInterestName}` : ''}
                </option>
              ))}
            </Select>
            <span className="block text-2xs text-slate-500 mt-1">
              تُعرض فقط الفرص المعتمدة (APPROVED) لهذا الوسيط ولديها مسؤول مبيعات داخلي معيّن.
            </span>
          </label>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">الوحدة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">المشروع *</span>
            <Select
              value={selectedProjectId}
              onChange={(e) => pushSearch({ brokerId: selectedBrokerId, brokerAgentId: selectedBrokerAgentId, projectId: e.target.value })}
              required
            >
              <option value="" disabled>اختر مشروعًا…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.city ? ` — ${p.city}` : ''}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">الوحدة *</span>
            <Select name="unitId" required defaultValue="" disabled={!selectedProjectId}>
              <option value="" disabled>
                {selectedProjectId ? 'اختر وحدة…' : 'اختر مشروعًا أولًا'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.type}{u.buildingName ? ` (${u.buildingName})` : ''} — {Number(u.price).toLocaleString()} ر.س
                </option>
              ))}
            </Select>
            {selectedProjectId && units.length === 0 && (
              <span className="block text-2xs text-amber-700 mt-1">
                لا توجد وحدات متاحة في هذا المشروع.
              </span>
            )}
            <span className="block text-2xs text-slate-500 mt-1">
              تُعرض فقط الوحدات المتاحة (AVAILABLE). إن لم تكن الوحدة في صلاحيات الوسيط، سيُرفض الإنشاء عند الحفظ.
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">ملاحظات (اختياري)</h2>
        <Textarea name="notes" rows={3} maxLength={2000} placeholder="ملاحظات داخلية على الحجز" />
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs text-slate-500">
          سيتم تثبيت ملف عمولة الوسيط لحظة الإنشاء — حسب وصول الوسيط للمشروع أو نسبته الافتراضية.
        </p>
        <Button type="submit" variant="primary" size="md" leftIcon={<Save className="h-4 w-4" />}>
          حفظ الحجز
        </Button>
      </div>
    </form>
  );
}

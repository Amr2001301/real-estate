'use client';

import { useActionState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { assignSalesAction } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';

interface Props {
  appointmentId: string;
  salesOptions: { id: string; fullName: string; role?: 'SALES' | 'SALES_MANAGER' }[];
  currentSalesId?: string | null;
  open: boolean;
  onClose: () => void;
}

const INITIAL = { error: null as string | null };

export function AssignSalesModal({
  appointmentId,
  salesOptions,
  currentSalesId,
  open,
  onClose,
}: Props) {
  const action = assignSalesAction.bind(null, appointmentId);
  const [state, dispatch, pending] = useActionState(
    async (_prev: typeof INITIAL, fd: FormData) => {
      try {
        await action(fd);
        onClose();
        return INITIAL;
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    INITIAL,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="تغيير المندوب"
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" size="sm" type="submit" form="assign-form" loading={pending}>
            تعيين
          </Button>
        </>
      }
    >
      <form id="assign-form" action={dispatch} className="space-y-4">
        {state.error && (
          <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            المندوب <span className="text-danger-600">*</span>
          </label>
          <select
            name="assignedSalesId"
            required
            defaultValue={currentSalesId ?? ''}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          >
            <option value="">اختر مندوباً</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {salesActorLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Dialog>
  );
}

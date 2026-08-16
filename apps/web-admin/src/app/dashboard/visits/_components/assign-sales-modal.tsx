'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { UserPlus, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { assignSalesAction } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

interface Props {
  appointmentId: string;
  salesOptions: { id: string; fullName: string; role?: 'SALES' | 'SALES_MANAGER' }[];
  currentSalesId?: string | null;
  open: boolean;
  onClose: () => void;
  locale?: Locale;
}

const INITIAL = { error: null as string | null };

export function AssignSalesModal({
  appointmentId,
  salesOptions,
  currentSalesId,
  open,
  onClose,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.visitComponents;
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

  // Empty state — when no sales reps exist (or the list fetch failed), render
  // a friendly explanation + a deep-link to /dashboard/users instead of an
  // empty <select> that silently confuses admins.
  const hasSalesOptions = salesOptions.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.assignTitle}
      size="sm"
      footer={
        hasSalesOptions ? (
          <>
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              {m.cancelModalBtn}
            </Button>
            <Button variant="primary" size="sm" type="submit" form="assign-form" loading={pending}>
              {m.assignBtn}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {m.closeBtn}
          </Button>
        )
      }
    >
      {hasSalesOptions ? (
        <form id="assign-form" action={dispatch} className="space-y-4">
          {state.error && (
            <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {m.assignSalesRepLabel} <span className="text-danger-600">*</span>
            </label>
            <select
              name="assignedSalesId"
              required
              defaultValue={currentSalesId ?? ''}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              <option value="">{m.chooseSalesPlaceholder}</option>
              {salesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {salesActorLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </form>
      ) : (
        <div className="space-y-4 py-2 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Users className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-800">{m.noSalesTitle}</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {m.noSalesDesc}
            </p>
          </div>
          <Link href={'/dashboard/users' as never}>
            <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
              {m.manageUsersBtn}
            </Button>
          </Link>
        </div>
      )}
    </Dialog>
  );
}

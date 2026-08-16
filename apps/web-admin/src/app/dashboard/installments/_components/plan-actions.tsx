'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import type { InstallmentPlanTemplate } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { activatePlanAction, deactivatePlanAction, deletePlanAction } from '../actions';

interface Props {
  plan: InstallmentPlanTemplate;
  isAdmin: boolean;
  locale?: Locale;
}

export function PlanActions({ plan, isAdmin, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.installments.planActions;
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  function handleActivate() {
    startTransition(async () => {
      await activatePlanAction(plan.id);
      router.refresh();
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      await deactivatePlanAction(plan.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deletePlanAction(plan.id);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Link href={`/dashboard/installments/${plan.id}`}>
        <IconButton label={m.ariaView} variant="outline" size="sm">
          <Eye />
        </IconButton>
      </Link>

      {isAdmin && (
        <>
          <span className="w-px h-4 bg-hairline shrink-0" aria-hidden />

          <Link href={`/dashboard/installments/${plan.id}/edit`}>
            <IconButton label={m.ariaEdit} variant="outline" size="sm">
              <Pencil />
            </IconButton>
          </Link>

          {plan.status !== 'ACTIVE' && (
            <IconButton
              label={m.ariaActivate}
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleActivate}
              className="text-success-600 hover:bg-success-50"
            >
              <CheckCircle2 />
            </IconButton>
          )}

          {plan.status === 'ACTIVE' && (
            <IconButton
              label={m.ariaDeactivate}
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleDeactivate}
              className="text-amber-600 hover:bg-amber-50"
            >
              <PauseCircle />
            </IconButton>
          )}

          {plan.status === 'DRAFT' && (
            <IconButton
              label={confirmDelete ? m.ariaConfirmDelete : m.ariaDelete}
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
              className={confirmDelete ? 'text-white bg-danger-600 hover:bg-danger-700' : 'text-danger-600 hover:bg-danger-50'}
            >
              <Trash2 />
            </IconButton>
          )}
        </>
      )}
    </div>
  );
}

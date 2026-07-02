'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { activatePlanAction, deactivatePlanAction } from '../actions';

interface Props {
  planId: string;
  action: 'activate' | 'deactivate';
  commandRow?: boolean;
}

export function PlanDetailActions({ planId, action, commandRow }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    startTransition(async () => {
      if (action === 'activate') {
        await activatePlanAction(planId);
      } else {
        await deactivatePlanAction(planId);
      }
      router.refresh();
    });
  }

  if (commandRow) {
    const isActivate = action === 'activate';
    return (
      <button
        type="button"
        onClick={handle}
        disabled={isPending}
        className={`flex w-full items-center gap-3 px-5 py-3.5 text-sm transition-colors duration-150 disabled:opacity-50 ${
          isActivate
            ? 'text-success-700 hover:bg-success-50/60'
            : 'text-amber-700 hover:bg-amber-50/60'
        }`}
      >
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[15px] [&_svg]:w-[15px] ${
            isActivate
              ? 'bg-success-50 text-success-600'
              : 'bg-amber-50 text-amber-600'
          }`}
        >
          {isActivate ? <CheckCircle2 /> : <PauseCircle />}
        </span>
        {isPending
          ? isActivate ? 'جارٍ التفعيل…' : 'جارٍ الإيقاف…'
          : isActivate ? 'تفعيل الخطة' : 'إيقاف الخطة'}
      </button>
    );
  }

  if (action === 'activate') {
    return (
      <Button
        variant="outline"
        size="md"
        loading={isPending}
        disabled={isPending}
        onClick={handle}
        leftIcon={<CheckCircle2 className="h-4 w-4" />}
        className="text-green-700 border-green-200 hover:bg-green-50"
      >
        تفعيل الخطة
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="md"
      loading={isPending}
      disabled={isPending}
      onClick={handle}
      leftIcon={<PauseCircle className="h-4 w-4" />}
      className="text-amber-700 border-amber-200 hover:bg-amber-50"
    >
      إيقاف الخطة
    </Button>
  );
}

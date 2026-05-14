'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { activatePlanAction, deactivatePlanAction } from '../actions';

interface Props {
  planId: string;
  action: 'activate' | 'deactivate';
}

export function PlanDetailActions({ planId, action }: Props) {
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

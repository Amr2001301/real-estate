'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  action: () => Promise<unknown>;
  confirm: string;
  label: string;
  className?: string;
}

export function ConfirmButton({ action, confirm, label, className }: Props) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      loading={pending}
      disabled={pending}
      className={className}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        start(async () => {
          try {
            const result = await action();
            // Server actions that refuse return { error } (a thrown message is
            // hidden in production).
            if (result && typeof result === 'object' && 'error' in result && result.error) {
              alert(String(result.error));
            }
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      {pending ? 'جاري…' : label}
    </Button>
  );
}

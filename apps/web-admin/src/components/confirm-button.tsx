'use client';

import { useTransition } from 'react';

interface Props {
  action: () => Promise<unknown>;
  confirm: string;
  label: string;
  className?: string;
}

export function ConfirmButton({ action, confirm, label, className }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={
        className ??
        'rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm disabled:opacity-60'
      }
      onClick={() => {
        if (!window.confirm(confirm)) return;
        start(() => action().catch((e) => alert((e as Error).message)));
      }}
    >
      {pending ? 'جاري…' : label}
    </button>
  );
}

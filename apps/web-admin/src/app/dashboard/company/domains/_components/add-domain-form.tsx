'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { DomainsMessages } from '../messages';
import { addDomainAction } from '../actions';

export function AddDomainForm({ m }: { m: DomainsMessages }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      data-testid="add-domain"
      onSubmit={(e) => {
        e.preventDefault();
        const hostname = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!hostname) return;
        start(async () => {
          setError(null);
          const r = await addDomainAction(hostname);
          if (!r.ok) setError(r.error);
          else {
            setValue('');
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="domain-hostname" className="text-[12.5px] font-semibold text-slate-700">{m.add.label}</label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="domain-hostname"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={m.add.placeholder}
          className="min-w-[220px] flex-1 font-mono"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-navy-band px-5 text-[13px] font-semibold text-[#F4ECD8] disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {m.add.submit}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-danger-700">{error}</p>}
    </form>
  );
}

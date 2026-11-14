'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { deleteListingAction, setListingStatusAction } from '../actions';
import type { ListingStatus } from '@/components/listings/messages';

/** The status as a select that saves on change. */
export function ListingStatusSelect({ id, status, options, label }: { id: string; status: ListingStatus; options: Array<{ value: ListingStatus; label: string }>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        defaultValue={status}
        disabled={pending}
        data-testid="listing-status"
        onChange={(e) => {
          const fd = new FormData();
          fd.set('status', e.target.value);
          start(() => setListingStatusAction(id, fd));
        }}
        className="h-10 min-w-[150px]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </label>
  );
}

export function DeleteListingButton({ id, label, confirm }: { id: string; label: string; confirm: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      disabled={pending}
      leftIcon={<Trash2 className="h-4 w-4" />}
      className="text-danger-700"
      onClick={() => {
        if (window.confirm(confirm)) start(() => deleteListingAction(id));
      }}
    >
      {label}
    </Button>
  );
}

'use client';

import { useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addReservationNoteAction } from '../../actions';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface Props {
  reservationId: string;
  locale?: Locale;
}

export function AddNoteForm({ reservationId, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await addReservationNoteAction(reservationId, formData);
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        name="body"
        rows={3}
        placeholder={m.notePlaceholder}
        disabled={pending}
        required
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          {m.noteSaveBtn}
        </Button>
      </div>
    </form>
  );
}

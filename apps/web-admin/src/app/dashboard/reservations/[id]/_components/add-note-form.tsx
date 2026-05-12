'use client';

import { useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addReservationNoteAction } from '../../actions';

interface Props {
  reservationId: string;
}

export function AddNoteForm({ reservationId }: Props) {
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
        placeholder="أضف ملاحظة داخلية…"
        disabled={pending}
        required
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          حفظ الملاحظة
        </Button>
      </div>
    </form>
  );
}

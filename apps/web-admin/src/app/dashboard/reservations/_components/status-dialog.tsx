'use client';

import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  reasonRequired?: boolean;
  action: (formData: FormData) => Promise<void | { error?: string }>;
  locale?: Locale;
}

export function StatusDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  reasonRequired = false,
  action,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (reasonRequired && !reason.trim()) {
      setError(m.statusReasonError);
      return;
    }
    const fd = new FormData();
    fd.set('reason', reason);
    startTransition(async () => {
      const result = await action(fd);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      setReason('');
      setError(null);
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            {m.statusCancelBtn}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            loading={pending}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">
          {reasonRequired ? m.statusReasonRequired : m.statusReasonOptional}
        </label>
        <Textarea
          rows={3}
          placeholder={m.statusReasonPH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
        />
        {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
      </div>
    </Dialog>
  );
}

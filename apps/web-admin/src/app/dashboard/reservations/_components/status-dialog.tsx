'use client';

import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  action: (formData: FormData) => Promise<void>;
}

export function StatusDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  action,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');

  function handleSubmit() {
    const fd = new FormData();
    fd.set('reason', reason);
    startTransition(async () => {
      await action(fd);
      setReason('');
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
            إلغاء
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
          السبب (اختياري)
        </label>
        <Textarea
          rows={3}
          placeholder="أدخل السبب…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
        />
      </div>
    </Dialog>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { replyNoteAction } from '@/app/dashboard/leads/actions';

/** "Reply" under a note on the lead's timeline: opens a small text box. */
export function NoteReply({
  leadId,
  noteId,
  labels,
}: {
  leadId: string;
  noteId: string;
  labels: { reply: string; replyPlaceholder: string; send: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        data-testid="note-reply-open"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"
      >
        <CornerDownLeft className="h-3.5 w-3.5" /> {labels.reply}
      </button>
    );
  }
  const send = () =>
    start(async () => {
      const res = await replyNoteAction(leadId, noteId, body);
      if (res.error) return setError(res.error);
      setBody('');
      setOpen(false);
    });
  return (
    <div data-testid="note-reply-form" className="mt-2 space-y-2">
      <Textarea
        autoFocus
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={labels.replyPlaceholder}
        className="text-[13px]"
      />
      <div className="flex items-center justify-end gap-2">
        {error && <p role="alert" className="me-auto text-[12px] text-danger-600">{error}</p>}
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{labels.cancel}</Button>
        <Button type="button" variant="primary" size="sm" disabled={pending || !body.trim()} onClick={send} data-testid="note-reply-send">
          {labels.send}
        </Button>
      </div>
    </div>
  );
}

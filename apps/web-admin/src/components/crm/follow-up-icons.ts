import { MessageCircle, NotebookPen, Phone, Repeat, Users } from 'lucide-react';
import type { LeadFollowUpType, LeadNoteKind } from '@/lib/types';

/** One icon per activity kind, shared by the composer, the timeline and the follow-up lists. */
export const KIND_ICON = {
  NOTE: NotebookPen,
  CALL: Phone,
  MEETING: Users,
  WHATSAPP: MessageCircle,
  FOLLOW_UP: Repeat,
} satisfies Record<LeadNoteKind | LeadFollowUpType, unknown>;

/** Call results that went nowhere read in amber; a wrong number in red. */
export const RESULT_TONE: Record<string, string> = {
  ANSWERED: 'bg-emerald-500/12 text-emerald-600',
  NO_ANSWER: 'bg-amber-500/12 text-amber-600',
  BUSY: 'bg-amber-500/12 text-amber-600',
  UNREACHABLE: 'bg-amber-500/12 text-amber-600',
  WRONG_NUMBER: 'bg-danger-500/12 text-danger-600',
};

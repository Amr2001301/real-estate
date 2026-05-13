import Link from 'next/link';
import { Building2, Phone, Mail, GripVertical, CalendarClock } from 'lucide-react';
import type { Lead, LeadStage } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { tx } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

const STAGE_TONE: Record<LeadStage, Tone> = {
  NEW: 'gray',
  INTERESTED: 'info',
  VISIT: 'purple',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'danger',
};

// Stripe color per tone. NEGOTIATION uses the brand gold (most active = highlight).
const STRIPE: Record<Tone, string> = {
  gray: 'before:bg-slate-300',
  info: 'before:bg-info-400',
  purple: 'before:bg-purple-400',
  warning: 'before:bg-brand-500',
  success: 'before:bg-success-400',
  danger: 'before:bg-danger-400',
};

const AVATAR_PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-purple-50 text-purple-700',
  'bg-success-50 text-success-700',
  'bg-warning-50 text-warning-700',
  'bg-danger-50 text-danger-700',
];

function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

interface InnerProps {
  lead: Lead;
  /** Visual-only — emphasize the gold stripe even more while dragging. */
  dragging?: boolean;
  /** Whether to render a small grip glyph indicating draggability. */
  showGrip?: boolean;
}

/** Pure card body. Used for both interactive (Link) and DragOverlay variants. */
function LeadCardBody({ lead, dragging, showGrip }: InnerProps) {
  const tone = STAGE_TONE[lead.stage];
  const isGold = tone === 'warning'; // NEGOTIATION
  const name = lead.client?.fullName ?? lead.fullName;
  const phone = lead.client?.phone ?? lead.phone;
  const email = lead.client?.email ?? lead.email;
  return (
    <div
      className={cn(
        'group relative rounded-2xl bg-surface p-5 ring-1 ring-inset ring-hairline shadow-sm transition-all duration-150',
        // End-edge stripe (in RTL, "end" = visual left)
        'before:absolute before:end-0 before:top-3 before:bottom-3 before:rounded-e-full',
        isGold
          ? 'before:w-[4px] ring-brand-200/70 shadow-[0_8px_24px_-12px_rgb(201_154_46_/_0.45)]'
          : 'before:w-[3px]',
        STRIPE[tone],
        dragging && 'shadow-xl ring-brand-400/50 scale-[1.02] rotate-[1deg]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[15px] font-semibold text-slate-900 leading-tight truncate flex-1">
          {name}
        </h4>
        <span className="font-mono text-2xs text-slate-400 shrink-0 mt-0.5">
          #{lead.id.slice(0, 4).toUpperCase()}-{lead.id.slice(4, 8).toUpperCase()}
        </span>
      </div>

      {lead.client?.hasAccount && (
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700 ring-1 ring-inset ring-success-200">
            عميل مسجل
          </span>
        </div>
      )}

      <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-3 min-h-[18px]">
        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-px" />
        <div className="min-w-0">
          <span className="truncate block">
            {lead.projectInterest ? tx(lead.projectInterest.name) : 'لم يتم تحديد مشروع'}
          </span>
          {lead.unitInterest && (
            <span className="truncate block text-slate-400 text-2xs font-medium mt-0.5">
              وحدة {lead.unitInterest.code}
            </span>
          )}
        </div>
      </div>

      {lead.upcomingVisit && (
        <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-1 mb-3">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate flex-1">{formatDateTime(lead.upcomingVisit.scheduledAt)}</span>
          <span className="shrink-0 font-medium">
            {lead.upcomingVisit.status === 'CONFIRMED' ? 'مؤكدة' : 'مجدولة'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-hairline/80">
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shrink-0 ring-2 ring-white',
            paletteFor(name),
          )}
          aria-hidden
        >
          {firstLetter(name)}
        </span>

        <div className="flex items-center gap-1">
          {phone && (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label={`هاتف ${phone}`}
              title={phone}
            >
              <Phone className="h-3.5 w-3.5" />
            </span>
          )}
          {email && (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label={`بريد ${email}`}
              title={email}
            >
              <Mail className="h-3.5 w-3.5" />
            </span>
          )}
          {showGrip && (
            <span
              aria-hidden
              className="inline-flex h-7 w-5 items-center justify-center text-slate-300 group-hover:text-slate-500 transition-colors -ms-1"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Static link card — used outside the DnD board (e.g. lead detail header, future widgets). */
export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      href={`/dashboard/leads/${lead.id}` as never}
      prefetch={false}
      className="block hover:-translate-y-px transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-2xl"
    >
      <LeadCardBody lead={lead} />
    </Link>
  );
}

/** Body-only variant for DragOverlay clones (no link wrapping). */
export function LeadCardOverlay({ lead }: { lead: Lead }) {
  return <LeadCardBody lead={lead} dragging />;
}

/** Body variant for the draggable in-column card (handle + grip indicator visible). */
export function LeadCardDraggableBody({ lead }: { lead: Lead }) {
  return <LeadCardBody lead={lead} showGrip />;
}

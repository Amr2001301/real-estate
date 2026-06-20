'use client';

import {
  Building2,
  Phone,
  Mail,
  GripVertical,
  CalendarClock,
  Briefcase,
} from 'lucide-react';
import type { Lead, LeadStage } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import Link from 'next/link';

// Thin start-border per stage — matches the column dot colour
const STAGE_BORDER: Record<LeadStage, string> = {
  NEW:         'border-s-slate-400',
  INTERESTED:  'border-s-sky-400',
  VISIT:       'border-s-violet-400',
  NEGOTIATION: 'border-s-amber-400',
  WON:         'border-s-emerald-400',
  LOST:        'border-s-rose-400',
};

// Avatar palette — identity colours, not stage colours
const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
];

function paletteFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

interface InnerProps {
  lead: Lead;
  dragging?: boolean;
  showGrip?: boolean;
}

function LeadCardBody({ lead, dragging, showGrip }: InnerProps) {
  const rawName = (lead.client?.fullName ?? lead.fullName)?.trim() ?? '';
  const displayName = rawName || 'عميل غير مُعرَّف';
  const isNameless = !rawName;
  const phone = lead.client?.phone ?? lead.phone;
  const email = lead.client?.email ?? lead.email;
  const isBrokerLead = !!lead.brokerId;
  const brokerName = lead.broker?.commercialName || lead.broker?.companyName || lead.broker?.code || null;
  const agentName = lead.brokerAgent?.fullName || null;
  const avatarSeed = rawName.length > 1 ? rawName : lead.id;

  return (
    <div
      className={cn(
        'group relative rounded-[18px] bg-surface overflow-hidden',
        'border border-hairline border-s-2',
        STAGE_BORDER[lead.stage],
        'shadow-[0_1px_6px_rgb(0_0_0/_0.06),0_0_0_1px_rgb(15_30_51/_0.025)]',
        'transition-all duration-150',
        dragging && 'shadow-[0_12px_32px_rgb(0_0_0/_0.18)] scale-[1.02] rotate-[0.4deg]',
      )}
    >
      {/* ── Content ──────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">

        {/* Name + ID */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h4
            className={cn(
              'text-[14px] font-bold leading-snug flex-1 min-w-0',
              isNameless ? 'text-slate-400 italic' : 'text-navy',
            )}
          >
            {displayName}
          </h4>
          <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-px leading-none whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded">
            #{lead.id.slice(0, 4).toUpperCase()}-{lead.id.slice(4, 8).toUpperCase()}
          </span>
        </div>

        {/* Info rows */}
        <div className="space-y-1.5">

          {/* Project */}
          <div className="flex items-start gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-[1px]" />
            <span className="text-[12px] text-slate-600 leading-tight flex-1 truncate">
              {lead.projectInterest ? tx(lead.projectInterest.name) : 'مشروع غير محدد'}
            </span>
            {lead.unitInterest && (
              <span className="shrink-0 font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded">
                {lead.unitInterest.code}
              </span>
            )}
          </div>

          {/* Broker */}
          {isBrokerLead && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-500 truncate">
                {[brokerName, agentName].filter(Boolean).join(' · ') || 'وسيط'}
              </span>
            </div>
          )}

          {/* Upcoming visit */}
          {lead.upcomingVisit && (
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-600 truncate flex-1">
                {formatDateTime(lead.upcomingVisit.scheduledAt)}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {lead.upcomingVisit.status === 'CONFIRMED' ? 'مؤكدة' : 'مجدولة'}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-hairline/60 bg-canvas/40">

        {/* Avatar */}
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ring-1 ring-black/[0.05]',
            paletteFor(avatarSeed),
          )}
          aria-hidden
        >
          {initials(displayName)}
        </span>

        {/* Account badge */}
        {lead.client?.hasAccount && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200 whitespace-nowrap">
            ✓ مسجل
          </span>
        )}

        {/* Contact icons + grip */}
        <div className="flex items-center gap-0.5 ms-auto">
          {phone && (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label={`هاتف ${phone}`}
              title={phone}
            >
              <Phone className="h-3.5 w-3.5" />
            </span>
          )}
          {email && (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label={`بريد ${email}`}
              title={email}
            >
              <Mail className="h-3.5 w-3.5" />
            </span>
          )}
          {showGrip && (
            <span
              aria-hidden
              className="inline-flex h-7 w-5 items-center justify-center text-slate-300 group-hover:text-slate-400 transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Static link card — used outside the DnD board. */
export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      href={`/dashboard/leads/${lead.id}` as never}
      prefetch={false}
      className="block hover:-translate-y-0.5 hover:shadow-card transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-[18px]"
    >
      <LeadCardBody lead={lead} />
    </Link>
  );
}

/** Body-only variant for DragOverlay (no link wrapping). */
export function LeadCardOverlay({ lead }: { lead: Lead }) {
  return <LeadCardBody lead={lead} dragging />;
}

/** Body variant for in-column draggable card (grip indicator visible). */
export function LeadCardDraggableBody({ lead }: { lead: Lead }) {
  return <LeadCardBody lead={lead} showGrip />;
}

export type { LeadStage };

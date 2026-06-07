'use client';

import {
  Building2,
  Phone,
  Mail,
  GripVertical,
  CalendarClock,
  Briefcase,
  UserCog,
} from 'lucide-react';
import type { Lead, LeadStage } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import Link from 'next/link';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

const STAGE_TONE: Record<LeadStage, Tone> = {
  NEW: 'gray',
  INTERESTED: 'info',
  VISIT: 'purple',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'danger',
};

// Start-edge (visual right in RTL = reading-start) border accent per stage.
const STRIPE: Record<Tone, string> = {
  gray: 'border-s-slate-300',
  info: 'border-s-info-400',
  purple: 'border-s-purple-400',
  warning: 'border-s-brand-500',
  success: 'border-s-success-400',
  danger: 'border-s-danger-300',
};

// Danger intentionally excluded — avatars must never look like error states.
const AVATAR_PALETTE = [
  'bg-brand-50 text-brand-700',
  'bg-info-50 text-info-700',
  'bg-purple-50 text-purple-700',
  'bg-success-50 text-success-700',
  'bg-warning-50 text-warning-700',
  'bg-slate-100 text-slate-600',
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
  const tone = STAGE_TONE[lead.stage];
  const rawName = (lead.client?.fullName ?? lead.fullName)?.trim() ?? '';
  const displayName = rawName || 'عميل غير مُعرَّف';
  const isNameless = !rawName;
  const phone = lead.client?.phone ?? lead.phone;
  const email = lead.client?.email ?? lead.email;
  const isBrokerLead = !!lead.brokerId;
  const brokerName =
    lead.broker?.commercialName || lead.broker?.companyName || lead.broker?.code || null;
  // Use the real name or the lead ID as avatar seed — never a single letter like "X".
  const avatarSeed = rawName.length > 1 ? rawName : lead.id;

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-surface overflow-hidden',
        'border border-hairline border-s-[3px]',
        'shadow-[0_1px_3px_rgb(0_0_0_/_0.07)] transition-all duration-150',
        STRIPE[tone],
        dragging && 'shadow-xl ring-2 ring-brand-400/30 scale-[1.02] rotate-[0.5deg]',
      )}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div className="px-3.5 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                'text-[13.5px] font-semibold leading-snug truncate',
                isNameless ? 'text-slate-400 italic' : 'text-slate-900',
              )}
            >
              {displayName}
            </h4>
            <p className="font-mono text-[10px] text-slate-400 mt-0.5 leading-none">
              #{lead.id.slice(0, 4).toUpperCase()}-{lead.id.slice(4, 8).toUpperCase()}
            </p>
          </div>
          {lead.client?.hasAccount && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-bold text-success-700 ring-1 ring-inset ring-success-200 whitespace-nowrap">
              مسجل ✓
            </span>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className="px-3.5 py-2.5 border-t border-hairline/60 space-y-2">
        {isBrokerLead && (
          <div className="flex items-center gap-1.5 rounded-lg bg-brand-50/80 ring-1 ring-inset ring-brand-100/70 px-2.5 py-1.5">
            <Briefcase className="h-3 w-3 text-brand-600 shrink-0" />
            <span className="text-[10px] font-bold text-brand-700">وسيط</span>
            {brokerName && (
              <>
                <span className="text-brand-200 text-[10px]">·</span>
                <span className="text-[10px] text-slate-600 truncate">{brokerName}</span>
              </>
            )}
            {lead.brokerAgent?.fullName && (
              <span className="ms-auto flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                <UserCog className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                <span className="truncate max-w-[80px]">{lead.brokerAgent.fullName}</span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500 truncate flex-1">
            {lead.projectInterest ? tx(lead.projectInterest.name) : 'مشروع غير محدد'}
          </span>
          {lead.unitInterest && (
            <span className="shrink-0 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
              {lead.unitInterest.code}
            </span>
          )}
        </div>

        {lead.upcomingVisit && (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-purple-700 bg-purple-50 rounded-lg px-2.5 py-1.5 ring-1 ring-inset ring-purple-100/60">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span className="truncate flex-1">{formatDateTime(lead.upcomingVisit.scheduledAt)}</span>
            <span className="shrink-0">
              {lead.upcomingVisit.status === 'CONFIRMED' ? 'مؤكدة' : 'مجدولة'}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3.5 py-2 border-t border-hairline/60 bg-surface-muted/20">
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ring-1 ring-white',
            paletteFor(avatarSeed),
          )}
          aria-hidden
        >
          {initials(displayName)}
        </span>

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
      className="block hover:-translate-y-px transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-xl"
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

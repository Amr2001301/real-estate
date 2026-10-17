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
import type { Locale } from '@/lib/locale';
import Link from 'next/link';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

interface InnerProps {
  lead: Lead;
  dragging?: boolean;
  showGrip?: boolean;
  locale?: Locale;
}

/** A lead card (U5): name and source up top, project, age, then rep · code · call / mail. */
function LeadCardBody({ lead, dragging, showGrip, locale = 'ar' }: InnerProps) {
  const rawName      = (lead.client?.fullName ?? lead.fullName)?.trim() ?? '';
  const displayName  = rawName || (locale === 'en' ? 'Unnamed client' : 'عميل غير مُعرَّف');
  const phone        = lead.client?.phone ?? lead.phone;
  const email        = lead.client?.email ?? lead.email;
  const isBrokerLead = !!lead.brokerId;
  const brokerName   = lead.broker?.commercialName || lead.broker?.companyName || lead.broker?.code || null;
  const days         = daysSince(lead.createdAt);
  const ageLabel     = locale === 'en'
    ? `Added ${days === 0 ? 'today' : `${days} days ago`}`
    : `أُضيفت ${days === 0 ? 'اليوم' : `منذ ${days} ${days === 1 ? 'يوم' : days <= 10 ? 'أيام' : 'يوماً'}`}`;
  const rep          = lead.assignedSales?.fullName;

  return (
    <div
      className={cn(
        'group relative rounded-[18px] border border-hairline bg-surface-muted transition-all duration-150',
        'hover:border-brand-400/50',
        dragging && 'shadow-[0_16px_36px_-12px_rgb(20_26_38/0.35)] rotate-[0.6deg]',
      )}
    >
      <div className="space-y-2 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn('min-w-0 flex-1 font-sans text-[15px] font-bold leading-snug', rawName ? 'text-slate-900' : 'italic text-slate-500')}>
            {displayName}
          </h4>
          {lead.source && (
            <span className="shrink-0 rounded-full border border-brand-400/50 px-2.5 py-0.5 text-[11.5px] font-bold text-brand-700">
              {tx(lead.source.name, locale)}
            </span>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">
            {lead.projectInterest ? tx(lead.projectInterest.name, locale) : locale === 'en' ? 'No project yet' : 'مشروع غير محدد'}
          </span>
          {lead.unitInterest && <span className="max-w-[40%] truncate font-mono text-[11px] text-brand-700" dir="ltr">· {lead.unitInterest.code}</span>}
        </p>

        {isBrokerLead && (
          <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
            <span className="truncate">{brokerName || (locale === 'en' ? 'Broker' : 'وسيط')}</span>
          </p>
        )}

        {lead.upcomingVisit && (
          <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
            <span className="truncate">{formatDateTime(lead.upcomingVisit.scheduledAt, locale)}</span>
          </p>
        )}

        <p className="text-[12px] text-slate-500">{ageLabel}</p>
      </div>

      <div className="mx-4 flex items-center gap-2 border-t border-hairline py-3">
        {rep ? (
          <span
            title={rep}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B66A] to-[#B38B3A] text-[11px] font-bold text-[#1A1408]"
          >
            {initials(rep)}
          </span>
        ) : (
          <span
            title={locale === 'en' ? 'Unassigned' : 'بدون مسؤول'}
            className="inline-flex h-8 w-8 shrink-0 rounded-full border border-dashed border-slate-400"
          />
        )}
        <span className="font-mono text-[11px] text-slate-500" dir="ltr">
          #{lead.id.slice(0, 4).toUpperCase()}-{lead.id.slice(4, 8).toUpperCase()}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          {phone && (
            <span title={phone} aria-label={phone} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-slate-700">
              <Phone className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          {email && (
            <span title={email} aria-label={email} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-slate-700">
              <Mail className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          {showGrip && (
            <span aria-hidden className="inline-flex h-9 w-5 items-center justify-center text-slate-400">
              <GripVertical className="h-4 w-4" />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Static link card — used outside the DnD board. */
export function LeadCard({ lead, locale = 'ar' }: { lead: Lead; locale?: Locale }) {
  return (
    <Link
      href={`/dashboard/leads/${lead.id}` as never}
      prefetch={false}
      className="block hover:-translate-y-0.5 hover:shadow-card transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-[18px]"
    >
      <LeadCardBody lead={lead} locale={locale} />
    </Link>
  );
}

/** Body-only variant for DragOverlay (no link wrapping). */
export function LeadCardOverlay({ lead, locale = 'ar' }: { lead: Lead; locale?: Locale }) {
  return <LeadCardBody lead={lead} dragging locale={locale} />;
}

/** Body variant for in-column draggable card (grip indicator visible). */
export function LeadCardDraggableBody({ lead, locale = 'ar' }: { lead: Lead; locale?: Locale }) {
  return <LeadCardBody lead={lead} showGrip locale={locale} />;
}

export type { LeadStage };

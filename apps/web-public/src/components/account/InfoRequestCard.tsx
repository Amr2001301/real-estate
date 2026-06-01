import type { Route } from 'next';
import Link from 'next/link';
import {
  Building2,
  Home,
  MessageSquareText,
  Clock,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { MeInfoRequest } from '@/lib/api-types';
import { Badge } from '@/components/ui/Badge';

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/**
 * One ticket line: gold icon chip + stacked label/value — identical to the
 * Visits card's metadata rows for cross-dashboard consistency.
 */
function TicketRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600 ring-1 ring-gold-200/60">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="mt-0.5 text-sm font-medium leading-snug text-ink-strong" dir="auto">
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * Inquiry card — mirrors the Visits card anatomy exactly. NOTE: MeInfoRequest
 * carries no reply/status field, so the badge reflects the inquiry's real
 * CONTEXT (unit / project / general) rather than a fabricated status.
 */
export function InfoRequestCard({ request }: { request: MeInfoRequest }) {
  const projectName = request.project ? pickAr(request.project.name) : '';
  const unitLabel = request.unit ? `${unitTypeLabel(request.unit.type)} · ${request.unit.code}` : '';
  const title = projectName || unitLabel || 'استفسار عام';
  const subtitle = projectName ? unitLabel || cityLabel(request.project?.city) : '';

  const badge: { label: string; Icon: LucideIcon; tone: 'gold' | 'neutral' } = request.unit
    ? { label: 'وحدة', Icon: Home, tone: 'gold' }
    : request.project
      ? { label: 'مشروع', Icon: Building2, tone: 'gold' }
      : { label: 'عام', Icon: MessageSquareText, tone: 'neutral' };

  const detailHref: Route | null = request.unit
    ? (routes.unit(request.unit.id) as Route)
    : request.project
      ? (routes.project(request.project.id) as Route)
      : null;

  return (
    <div className="group relative isolate flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-sm transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-xl">
      {/* Inquiry watermark — a giant, ultra-faded "?" glyph reads as an abstract
          luxury mark for a question/inquiry. font-display keeps it geometric. */}
      <span
        className="pointer-events-none absolute bottom-[-20px] left-2 -z-10 select-none font-display text-[140px] font-extrabold leading-none text-ink-strong/[0.05]"
        aria-hidden
      >
        ؟
      </span>

      {/* Stretched link: whole card navigates when tied to a property. */}
      {detailHref && (
        <Link href={detailHref} aria-label={`عرض تفاصيل ${title}`} className="absolute inset-0 z-[1]" />
      )}

      {/* ── Header: title (start) ⟷ context badge (end) ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-lg font-bold tracking-tight text-ink-strong">{title}</h3>
          {subtitle && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
              <span className="line-clamp-1">{subtitle}</span>
            </p>
          )}
        </div>
        <Badge tone={badge.tone} className="shrink-0 px-3 font-semibold shadow-sm ring-1 ring-black/5">
          <badge.Icon className="h-3 w-3 shrink-0" aria-hidden />
          {badge.label}
        </Badge>
      </div>

      {/* ── Inquiry Ticket ── */}
      <div className="mt-4 space-y-4 rounded-xl border border-hairline bg-surface-soft/60 p-4">
        <div className="space-y-3.5">
          <TicketRow icon={Clock} label="تاريخ الإرسال" value={formatDateTime(request.createdAt)} />
        </div>

        {/* Inquiry message — speech-bubble, primary space */}
        <div className="flex items-start gap-2 rounded-xl border border-hairline bg-surface p-3 text-sm leading-relaxed text-ink-muted">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" aria-hidden />
          <p className="line-clamp-5" dir="auto">
            {request.message}
          </p>
        </div>
      </div>
    </div>
  );
}

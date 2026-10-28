import {
  Bell, CheckCheck, BookmarkCheck, FileText, Wallet, BadgePercent, Users,
  MessageSquareText, Wrench, CalendarClock, type LucideIcon,
} from 'lucide-react';
import type { NotificationItem, NotificationChannel } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { markAllNotificationsReadAction } from '@/app/_actions/notifications';
import { AdminNotificationRow } from './notification-row';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';
import { DEFAULT_TIME_ZONE } from '@/lib/format';

interface Props {
  items: NotificationItem[];
  /** Either '/dashboard' or '/portal' — used to build links to entities. */
  basePath: '/dashboard' | '/portal';
  locale?: Locale;
  /** Without its own card, for a page that frames it in a panel. */
  bare?: boolean;
}

interface RelatedLink {
  href: string;
  icon: LucideIcon;
  label: string;
}

/** Map a notification payload/templateCode → dashboard/portal entity link.
 *  entityType (new) wins over legacy id keys; maintenance must beat the generic
 *  `requestId` → inquiries route. Returns null for unknown payloads. */
function relatedLink(
  payload: NotificationItem['payload'],
  base: '/dashboard' | '/portal',
  templateCode: string,
  rl: ReturnType<typeof portalSharedT>['notifications']['related'],
): RelatedLink | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const id = (key: string) => (typeof p[key] === 'string' ? (p[key] as string) : null);
  const isBroker = templateCode.startsWith('broker_');

  const entityType = id('entityType');
  const entityId = id('entityId');
  const leadId = id('leadId');
  const reservationId = id('reservationId');
  const contractId = id('contractId');
  const commissionId = id('commissionId');
  const payoutId = id('payoutId');
  const requestId = id('requestId');
  const infoRequestId = id('infoRequestId');
  const depositId = id('depositId');
  const maintenanceRequestId = id('maintenanceRequestId');
  const visitId = id('visitId');
  const appointmentId = id('appointmentId');

  if (base === '/dashboard') {
    // New entityType payloads first (maintenance/visit must beat legacy requestId).
    if (entityType === 'contract' && entityId) {
      return { href: `/dashboard/contracts/${entityId}`, icon: FileText, label: rl.contract };
    }
    if (entityType === 'reservation' && entityId) {
      return { href: `/dashboard/reservations/${entityId}`, icon: BookmarkCheck, label: rl.reservation };
    }
    if (entityType === 'deposit' && entityId) {
      return { href: `/dashboard/deposits/${entityId}`, icon: Wallet, label: rl.payment };
    }
    if (entityType === 'bonus') {
      return { href: `/dashboard/bonus`, icon: BadgePercent, label: rl.commission };
    }
    if (entityType === 'visit_request' || entityType === 'info_request') {
      return { href: `/dashboard/requests`, icon: MessageSquareText, label: rl.inquiry };
    }
    if (entityType === 'maintenance' && entityId) {
      return { href: `/dashboard/maintenance/${entityId}`, icon: Wrench, label: rl.maintenance };
    }
    if (entityType === 'visit' && entityId) {
      return { href: `/dashboard/visits/appointments/${entityId}`, icon: CalendarClock, label: rl.visit };
    }
    if (entityType === 'follow_ups') {
      return { href: `/dashboard/follow-ups`, icon: Users, label: rl.lead };
    }
    if (entityType === 'lead' && entityId) {
      return isBroker
        ? { href: `/dashboard/broker-leads/${entityId}`, icon: Users, label: rl.lead }
        : { href: `/dashboard/leads/${entityId}`, icon: Users, label: rl.lead };
    }
    if (entityType === 'broker' && entityId) {
      return { href: `/dashboard/brokers/${entityId}`, icon: Users, label: rl.broker };
    }
    if (entityType === 'user' && entityId) {
      return { href: `/dashboard/users/${entityId}`, icon: Users, label: rl.user };
    }
    if (maintenanceRequestId) {
      return { href: `/dashboard/maintenance/${maintenanceRequestId}`, icon: Wrench, label: rl.maintenance };
    }
    // Any deposit notification (submitted/approved/rejected/review) → deposit detail.
    if (depositId) {
      return { href: `/dashboard/deposits/${depositId}`, icon: Wallet, label: rl.payment };
    }
    // Visit appointment (legacy visitId/appointmentId) before requestId.
    if (visitId || appointmentId) {
      return { href: `/dashboard/visits/appointments/${visitId ?? appointmentId}`, icon: CalendarClock, label: rl.visit };
    }
    if (payoutId) return { href: `/dashboard/broker-payouts/${payoutId}`, icon: Wallet, label: rl.payment };
    if (commissionId) return { href: `/dashboard/broker-commissions/${commissionId}`, icon: BadgePercent, label: rl.commission };
    // A broker deal is an ordinary contract / reservation: its detail page is
    // the shared one (broker-contracts / broker-reservations are lists only).
    if (contractId) {
      return { href: `/dashboard/contracts/${contractId}`, icon: FileText, label: rl.contract };
    }
    if (reservationId) {
      return { href: `/dashboard/reservations/${reservationId}`, icon: BookmarkCheck, label: rl.reservation };
    }
    // Inquiries (info/visit request intake — no per-row detail page).
    if (requestId || infoRequestId) {
      return { href: `/dashboard/requests`, icon: MessageSquareText, label: rl.inquiry };
    }
    if (leadId) {
      return isBroker
        ? { href: `/dashboard/broker-leads/${leadId}`, icon: Users, label: rl.lead }
        : { href: `/dashboard/leads/${leadId}`, icon: Users, label: rl.lead };
    }
  } else {
    if (payoutId) return { href: `/portal/payouts/${payoutId}`, icon: Wallet, label: rl.payment };
    if (commissionId) return { href: `/portal/commissions/${commissionId}`, icon: BadgePercent, label: rl.commission };
    if (contractId) return { href: `/portal/contracts/${contractId}`, icon: FileText, label: rl.contract };
    if (reservationId) return { href: `/portal/reservations/${reservationId}`, icon: BookmarkCheck, label: rl.reservation };
    if (leadId) return { href: `/portal/leads/${leadId}`, icon: Users, label: rl.lead };
  }
  return null;
}

/** Category icon (+ tint) by template code — for the row even when unlinked. */
function categoryVisual(code: string, related: RelatedLink | null): { Icon: LucideIcon; chip: string } {
  const c = code.toLowerCase();
  if (c.includes('maintenance')) return { Icon: Wrench, chip: 'bg-amber-500/12 text-amber-600' };
  if (c.includes('payment_proof') || c.includes('deposit')) return { Icon: Wallet, chip: 'bg-emerald-500/12 text-emerald-600' };
  if (c.includes('payout')) return { Icon: Wallet, chip: 'bg-emerald-500/12 text-emerald-600' };
  if (c.includes('commission')) return { Icon: BadgePercent, chip: 'bg-violet-500/12 text-violet-600' };
  if (c.includes('contract')) return { Icon: FileText, chip: 'bg-sky-500/12 text-sky-600' };
  if (c.includes('reservation')) return { Icon: BookmarkCheck, chip: 'bg-brand-500/12 text-brand-700' };
  if (c.includes('visit')) return { Icon: CalendarClock, chip: 'bg-brand-500/12 text-brand-700' };
  if (c.includes('lead')) return { Icon: Users, chip: 'bg-slate-500/10 text-slate-600' };
  if (c.includes('request') || c.includes('inquiry')) return { Icon: MessageSquareText, chip: 'bg-slate-500/10 text-slate-600' };
  if (related) return { Icon: related.icon, chip: 'bg-slate-500/10 text-slate-600' };
  return { Icon: Bell, chip: 'bg-slate-500/10 text-slate-600' };
}

/** Never returns the raw template code. The server's title (in the reader's
 *  language, naming the unit / contract / amount) wins; the label map is the
 *  fallback for rows it could not title. */
function resolveTitle(n: NotificationItem, nt: ReturnType<typeof portalSharedT>['notifications']): string {
  const t = n.title?.trim();
  if (t && t !== n.templateCode) return t;
  return nt.templates[n.templateCode] ?? nt.fallbackTitle;
}

function summarisePayload(payload: NotificationItem['payload']): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['leadName', 'customerName', 'unitCode', 'projectName', 'contractNumber', 'commissionNumber', 'payoutNumber', 'reference', 'amount']) {
    const v = p[key];
    if ((typeof v === 'string' || typeof v === 'number') && String(v).trim()) parts.push(String(v));
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

function resolveBody(n: NotificationItem): string | null {
  const b = n.body?.trim();
  if (b && b !== n.templateCode) return b;
  return summarisePayload(n.payload);
}

const CHANNEL_TONE: Record<NotificationChannel, BadgeTone> = {
  IN_APP: 'success',
  PUSH:   'info',
  EMAIL:  'brand',
  SMS:    'warning',
};

/** Shows time-only for today, short date for older notifications. */
function formatCompact(value: string, dateLocale: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return new Intl.DateTimeFormat(dateLocale, { timeStyle: 'short', timeZone: DEFAULT_TIME_ZONE }).format(d);
  }
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: 'short' }).format(d);
}

export function NotificationList({ items, basePath, locale = 'ar', bare = false }: Props) {
  const Frame = bare ? BareFrame : Card;
  const nt = portalSharedT(locale).notifications;
  const safeItems = Array.isArray(items) ? items : [];
  const unreadCount = safeItems.filter((n) => !n.read).length;

  if (safeItems.length === 0) {
    return (
      <Frame className="overflow-hidden">
        <EmptyState
          icon={<Bell />}
          title={nt.emptyTitle}
          description={nt.emptyDescription}
        />
      </Frame>
    );
  }

  return (
    <Frame className="overflow-hidden">
      {/* Inbox header: unread count + mark-all — only when there are unread items */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between border-b border-hairline bg-brand-500/[0.06] px-5 py-2.5">
          <p className="text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-brand-700">{unreadCount}</span>
            {' '}{nt.unread}
          </p>
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="basePath" value={basePath} />
            <Button type="submit" variant="ghost" size="sm" leftIcon={<CheckCheck className="h-3.5 w-3.5" />}>
              {nt.markAllRead}
            </Button>
          </form>
        </div>
      )}

      <ul className="divide-y divide-hairline">
        {safeItems.map((n) => {
          const related = relatedLink(n.payload, basePath, n.templateCode, nt.related);
          const title = resolveTitle(n, nt);
          const body = resolveBody(n);
          const { Icon, chip } = categoryVisual(n.templateCode, related);
          const unread = !n.read;
          const rowClass = cn(
            'flex w-full items-start gap-3 px-5 py-4 text-start transition-colors',
            (unread || related) && 'cursor-pointer hover:bg-surface-muted/50',
            unread && 'bg-brand-500/[0.05]',
          );
          return (
            <li key={n.id}>
              <AdminNotificationRow
                id={n.id}
                href={related?.href ?? null}
                unread={unread}
                basePath={basePath}
                className={rowClass}
                markReadLabel={nt.markRead}
              >
                {/* Category icon chip */}
                <span className={cn('mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full', chip)}>
                  <Icon className="h-4 w-4" />
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: title + date */}
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm leading-snug', unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                      {title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap tabular-nums leading-snug">
                      {formatCompact(n.createdAt, nt.dateLocale)}
                    </span>
                  </div>

                  {/* Row 2: channel badge + body preview */}
                  <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                    <Badge tone={CHANNEL_TONE[n.channel]} size="sm" className="shrink-0">
                      {nt.channel[n.channel]}
                    </Badge>
                    {body && (
                      <span className="truncate text-xs text-slate-500">{body}</span>
                    )}
                  </div>

                  {/* Row 3: entity action pill */}
                  {related && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand-500/30 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      <related.icon className="h-3 w-3 shrink-0" />
                      {nt.openFn(related.label)}
                    </span>
                  )}
                </div>

                {/* Unread dot */}
                {unread && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                )}
              </AdminNotificationRow>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function BareFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('border-t border-hairline', className)}>{children}</div>;
}

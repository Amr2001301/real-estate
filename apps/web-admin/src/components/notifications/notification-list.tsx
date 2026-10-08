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

interface Props {
  items: NotificationItem[];
  /** Either '/dashboard' or '/portal' — used to build links to entities. */
  basePath: '/dashboard' | '/portal';
  locale?: Locale;
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
    if (entityType === 'maintenance' && entityId) {
      return { href: `/dashboard/maintenance/${entityId}`, icon: Wrench, label: rl.maintenance };
    }
    if (entityType === 'visit' && entityId) {
      return { href: `/dashboard/visits/appointments/${entityId}`, icon: CalendarClock, label: rl.visit };
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
    if (contractId) {
      return isBroker
        ? { href: `/dashboard/broker-contracts/${contractId}`, icon: FileText, label: rl.contract }
        : { href: `/dashboard/contracts/${contractId}`, icon: FileText, label: rl.contract };
    }
    if (reservationId) {
      return isBroker
        ? { href: `/dashboard/broker-reservations/${reservationId}`, icon: BookmarkCheck, label: rl.reservation }
        : { href: `/dashboard/reservations/${reservationId}`, icon: BookmarkCheck, label: rl.reservation };
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
  if (c.includes('maintenance')) return { Icon: Wrench, chip: 'bg-amber-50 text-amber-600' };
  if (c.includes('payment_proof') || c.includes('deposit')) return { Icon: Wallet, chip: 'bg-emerald-50 text-emerald-600' };
  if (c.includes('payout')) return { Icon: Wallet, chip: 'bg-emerald-50 text-emerald-600' };
  if (c.includes('commission')) return { Icon: BadgePercent, chip: 'bg-violet-50 text-violet-600' };
  if (c.includes('contract')) return { Icon: FileText, chip: 'bg-sky-50 text-sky-600' };
  if (c.includes('reservation')) return { Icon: BookmarkCheck, chip: 'bg-brand-50 text-brand-600' };
  if (c.includes('visit')) return { Icon: CalendarClock, chip: 'bg-brand-50 text-brand-600' };
  if (c.includes('lead')) return { Icon: Users, chip: 'bg-slate-100 text-slate-600' };
  if (c.includes('request') || c.includes('inquiry')) return { Icon: MessageSquareText, chip: 'bg-slate-100 text-slate-600' };
  if (related) return { Icon: related.icon, chip: 'bg-slate-100 text-slate-600' };
  return { Icon: Bell, chip: 'bg-slate-100 text-slate-600' };
}

/** Never returns the raw template code. */
function resolveTitle(n: NotificationItem, nt: ReturnType<typeof portalSharedT>['notifications']): string {
  const mapped = nt.templates[n.templateCode];
  if (mapped) return mapped;
  const t = n.title?.trim();
  if (t && t !== n.templateCode) return t;
  return nt.fallbackTitle;
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
    return new Intl.DateTimeFormat(dateLocale, { timeStyle: 'short' }).format(d);
  }
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: 'short' }).format(d);
}

export function NotificationList({ items, basePath, locale = 'ar' }: Props) {
  const nt = portalSharedT(locale).notifications;
  const safeItems = Array.isArray(items) ? items : [];
  const unreadCount = safeItems.filter((n) => !n.read).length;

  if (safeItems.length === 0) {
    return (
      <Card className="overflow-hidden">
        <EmptyState
          icon={<Bell />}
          title={nt.emptyTitle}
          description={nt.emptyDescription}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Inbox header: unread count + mark-all — only when there are unread items */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between border-b border-hairline bg-brand-50/50 px-4 py-2.5">
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
            'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors',
            (unread || related) && 'cursor-pointer hover:bg-slate-50',
            unread && 'bg-brand-50/30',
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
                <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', chip)}>
                  <Icon className="h-4 w-4" />
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: title + date */}
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm leading-snug', unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                      {title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap tabular-nums leading-snug" dir="ltr">
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
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
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
    </Card>
  );
}

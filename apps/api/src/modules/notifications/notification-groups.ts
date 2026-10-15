/**
 * Notification groups for the per-user e-mail / push opt-outs. In-app
 * notifications are never switched off; a group only silences the e-mail or
 * the push copy of its events. An admin broadcast belongs to no group, so it
 * always goes out.
 */
export const NOTIFICATION_GROUPS = ['sales', 'finance', 'maintenance', 'account'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export const PREF_CHANNELS = ['email', 'push'] as const;
export type PrefChannel = (typeof PREF_CHANNELS)[number];

export type NotificationPrefs = Record<PrefChannel, Record<NotificationGroup, boolean>>;

const FINANCE = [
  'installment_',
  'deposit_',
  'payment_proof_',
  'booking_payment_',
  'cheque_',
  'contract_refund_',
  'bonus_',
  'broker_commission_',
  'broker_payout_',
  'reservation_booking_',
];
const ACCOUNT = [
  'user_',
  'account_',
  'manager_assigned',
  'team_member_',
  'subscription_',
  'company_',
  'broker_user_',
  'broker_team_',
  'broker_approved',
  'broker_suspended',
];

/** The group a template code belongs to; null = never silenced. */
export function notificationGroup(code: string): NotificationGroup | null {
  if (code === 'admin_broadcast') return null;
  if (code.startsWith('maintenance_')) return 'maintenance';
  if (FINANCE.some((p) => code.startsWith(p))) return 'finance';
  if (ACCOUNT.some((p) => code.startsWith(p))) return 'account';
  return 'sales';
}

/** Stored prefs (possibly null or partial) → every channel × group, on unless off. */
export function resolvePrefs(raw: unknown): NotificationPrefs {
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as NotificationPrefs;
  for (const channel of PREF_CHANNELS) {
    const groups = (
      stored[channel] && typeof stored[channel] === 'object' ? stored[channel] : {}
    ) as Record<string, unknown>;
    out[channel] = {} as Record<NotificationGroup, boolean>;
    for (const group of NOTIFICATION_GROUPS) out[channel][group] = groups[group] !== false;
  }
  return out;
}

/** Whether this user still wants [code] on [channel]. */
export function channelAllowed(raw: unknown, channel: PrefChannel, code: string): boolean {
  const group = notificationGroup(code);
  return group === null || resolvePrefs(raw)[channel][group];
}

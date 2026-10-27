/**
 * The settings the API actually reads (apps/api: cancellation-settings,
 * late-fee, transfer-fee, fee-settings, discount-policy, company-timezone).
 * The "add setting" list offered 22 keys and nothing read 19 of them, so an
 * admin who switched on "two-factor authentication" got nothing (F7).
 */
export type KnownSettingType = 'number' | 'boolean' | 'text' | 'enum';

export interface KnownSetting {
  key: string;
  type: KnownSettingType;
  options?: string[];
  placeholder?: string;
}

export const KNOWN_SETTINGS: KnownSetting[] = [
  { key: 'pricing.maxDiscountPct', type: 'number', placeholder: '10' },
  { key: 'company.timezone', type: 'text', placeholder: 'Africa/Cairo' },
  { key: 'fees.paymentDays', type: 'number', placeholder: '30' },
  { key: 'lateFee.enabled', type: 'boolean' },
  { key: 'lateFee.graceDays', type: 'number', placeholder: '0' },
  { key: 'lateFee.mode', type: 'enum', options: ['PERCENT', 'FIXED'] },
  { key: 'lateFee.value', type: 'number', placeholder: '0' },
  { key: 'lateFee.repeat', type: 'enum', options: ['ONCE', 'MONTHLY'] },
  { key: 'lateFee.maxPerInstallment', type: 'number', placeholder: '0' },
  { key: 'transferFee.enabled', type: 'boolean' },
  { key: 'transferFee.mode', type: 'enum', options: ['PERCENT', 'FIXED'] },
  { key: 'transferFee.value', type: 'number', placeholder: '0' },
  { key: 'cancellation.bookingAmount.refundPct', type: 'number', placeholder: '0' },
  { key: 'cancellation.contract.penaltyPct', type: 'number', placeholder: '10' },
  {
    key: 'cancellation.unit.returnToAvailable',
    type: 'enum',
    options: ['AUTO', 'REQUIRES_APPROVAL'],
  },
  { key: 'cancellation.customer.demoteToClient', type: 'boolean' },
  {
    key: 'cancellation.brokerCommission.action',
    type: 'enum',
    options: ['CLAWBACK', 'RETAIN', 'MANUAL'],
  },
  {
    key: 'cancellation.salesBonus.action',
    type: 'enum',
    options: ['CLAWBACK', 'RETAIN', 'MANUAL'],
  },
  {
    key: 'cheque.bounced.installmentAction',
    type: 'enum',
    options: ['REOPEN_AS_OVERDUE', 'REOPEN_AS_PENDING'],
  },
  { key: 'cheque.bounced.penaltyAmount', type: 'number', placeholder: '0' },
];

export const KNOWN_SETTING_KEYS = new Set(KNOWN_SETTINGS.map((s) => s.key));

/**
 * Settings kept by other pages, not listed here: lead routing is edited (and
 * checked) on the campaigns intake page, and the round-robin turn is the
 * system's own bookmark.
 */
export const HIDDEN_SETTING_KEYS = new Set([
  'leads.autoAssign',
  'leads.firstCallMinutes',
  'leads.roundRobinCursor',
]);

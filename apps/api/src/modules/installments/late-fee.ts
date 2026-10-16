/**
 * Late-payment fee — a company setting, off by default.
 *
 * When on, the daily sweep charges a LATE_FEE row on each live installment
 * still unpaid `graceDays` after its due date: a percentage of the
 * installment or a fixed amount, once or again every month it stays unpaid,
 * never more than `maxPerInstallment` in total (0 = no cap). A waived fee
 * still counts as charged for its period, so it is not charged again.
 */
import { BadRequestException } from '@nestjs/common';

export type LateFeeMode = 'PERCENT' | 'FIXED';
export type LateFeeRepeat = 'ONCE' | 'MONTHLY';

export interface LateFeeSettings {
  enabled: boolean;
  graceDays: number;
  mode: LateFeeMode;
  value: number;
  repeat: LateFeeRepeat;
  maxPerInstallment: number;
}

export const LATE_FEE_DEFAULTS: LateFeeSettings = {
  enabled: false,
  graceDays: 7,
  mode: 'PERCENT',
  value: 1,
  repeat: 'ONCE',
  maxPerInstallment: 0,
};

export const LATE_FEE_SETTING_DEFAULTS: Array<{ key: string; value: string | number | boolean }> = [
  { key: 'lateFee.enabled', value: LATE_FEE_DEFAULTS.enabled },
  { key: 'lateFee.graceDays', value: LATE_FEE_DEFAULTS.graceDays },
  { key: 'lateFee.mode', value: LATE_FEE_DEFAULTS.mode },
  { key: 'lateFee.value', value: LATE_FEE_DEFAULTS.value },
  { key: 'lateFee.repeat', value: LATE_FEE_DEFAULTS.repeat },
  { key: 'lateFee.maxPerInstallment', value: LATE_FEE_DEFAULTS.maxPerInstallment },
];

export const LATE_FEE_SETTING_KEYS = LATE_FEE_SETTING_DEFAULTS.map((d) => d.key);

function nonNegativeAmount(key: string, v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new BadRequestException(`${key}: must be a non-negative number`);
  }
  if (Math.round(v * 100) !== v * 100) {
    throw new BadRequestException(`${key}: maximum 2 decimal places`);
  }
}

/** Validators for the settings endpoint, keyed by setting key. */
export const LATE_FEE_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  'lateFee.enabled': (k, v) => {
    if (typeof v !== 'boolean') throw new BadRequestException(`${k}: must be a boolean`);
  },
  'lateFee.graceDays': (k, v) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 365) {
      throw new BadRequestException(`${k}: must be an integer between 0 and 365`);
    }
  },
  'lateFee.mode': (k, v) => {
    if (v !== 'PERCENT' && v !== 'FIXED') throw new BadRequestException(`${k}: must be one of PERCENT, FIXED`);
  },
  'lateFee.value': (k, v) => {
    nonNegativeAmount(k, v);
  },
  'lateFee.repeat': (k, v) => {
    if (v !== 'ONCE' && v !== 'MONTHLY') throw new BadRequestException(`${k}: must be one of ONCE, MONTHLY`);
  },
  'lateFee.maxPerInstallment': (k, v) => nonNegativeAmount(k, v),
};

/** Resolve stored rows to typed settings; a missing or malformed row falls back to its default. */
export function resolveLateFeeSettings(rows: Array<{ key: string; value: unknown }>): LateFeeSettings {
  const get = <T>(key: string, fallback: T, ok: (v: unknown) => boolean): T => {
    const row = rows.find((r) => r.key === key);
    return row && ok(row.value) ? (row.value as T) : fallback;
  };
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  return {
    enabled: get('lateFee.enabled', LATE_FEE_DEFAULTS.enabled, (v) => typeof v === 'boolean'),
    graceDays: get('lateFee.graceDays', LATE_FEE_DEFAULTS.graceDays, num),
    mode: get('lateFee.mode', LATE_FEE_DEFAULTS.mode, (v) => v === 'PERCENT' || v === 'FIXED'),
    value: get('lateFee.value', LATE_FEE_DEFAULTS.value, num),
    repeat: get('lateFee.repeat', LATE_FEE_DEFAULTS.repeat, (v) => v === 'ONCE' || v === 'MONTHLY'),
    maxPerInstallment: get('lateFee.maxPerInstallment', LATE_FEE_DEFAULTS.maxPerInstallment, num),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * The fees (in currency units, 2 dp) to charge now on one installment, given
 * the fees already charged on it. Empty when nothing is due yet, the cap is
 * reached, or every period has been charged.
 */
export function lateFeesDue(
  installment: { amount: number; dueDate: Date },
  settings: LateFeeSettings,
  existing: Array<{ amount: number; waived: boolean }>,
  now: Date,
): number[] {
  if (!settings.enabled || settings.value <= 0) return [];
  const firstAt = new Date(installment.dueDate.getTime() + settings.graceDays * DAY_MS);
  if (now < firstAt) return [];

  let periods = 1;
  if (settings.repeat === 'MONTHLY') {
    while (addMonths(firstAt, periods) <= now) periods++;
  }
  const toCharge = periods - existing.length;
  if (toCharge <= 0) return [];

  const cents = (n: number) => Math.round(n * 100);
  const each =
    settings.mode === 'PERCENT'
      ? Math.round((cents(installment.amount) * settings.value) / 100)
      : cents(settings.value);
  if (each <= 0) return [];

  const capCents = cents(settings.maxPerInstallment);
  let charged = existing.filter((f) => !f.waived).reduce((a, f) => a + cents(f.amount), 0);
  const fees: number[] = [];
  for (let i = 0; i < toCharge; i++) {
    let fee = each;
    if (capCents > 0) fee = Math.min(fee, capCents - charged);
    if (fee <= 0) break;
    fees.push(fee / 100);
    charged += fee;
  }
  return fees;
}

/** Idempotent: a new company gets the settings, switched off, so they show on its settings page. */
export async function seedLateFeeSettingsForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { setting: { createMany: (...args: any[]) => Promise<{ count: number }> } },
  companyId: string,
): Promise<void> {
  await prisma.setting.createMany({
    data: LATE_FEE_SETTING_DEFAULTS.map(({ key, value }) => ({ companyId, key, value })),
    skipDuplicates: true,
  });
}

/**
 * Transfer fee (رسوم التنازل) — a company setting, off by default.
 *
 * When on, a transfer adds a TRANSFER_FEE row to the contract's schedule: a
 * percentage of the contract price or a fixed amount. The admin can enter a
 * different amount on the transfer itself (0 = no fee this time).
 */
import { BadRequestException } from '@nestjs/common';

export interface TransferFeeSettings {
  enabled: boolean;
  mode: 'PERCENT' | 'FIXED';
  value: number;
}

export const TRANSFER_FEE_DEFAULTS: TransferFeeSettings = { enabled: false, mode: 'PERCENT', value: 1 };

export const TRANSFER_FEE_SETTING_DEFAULTS: Array<{ key: string; value: string | number | boolean }> = [
  { key: 'transferFee.enabled', value: TRANSFER_FEE_DEFAULTS.enabled },
  { key: 'transferFee.mode', value: TRANSFER_FEE_DEFAULTS.mode },
  { key: 'transferFee.value', value: TRANSFER_FEE_DEFAULTS.value },
];

export const TRANSFER_FEE_SETTING_KEYS = TRANSFER_FEE_SETTING_DEFAULTS.map((d) => d.key);

/** Validators for the settings endpoint, keyed by setting key. */
export const TRANSFER_FEE_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  'transferFee.enabled': (k, v) => {
    if (typeof v !== 'boolean') throw new BadRequestException(`${k}: must be a boolean`);
  },
  'transferFee.mode': (k, v) => {
    if (v !== 'PERCENT' && v !== 'FIXED') throw new BadRequestException(`${k}: must be one of PERCENT, FIXED`);
  },
  'transferFee.value': (k, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new BadRequestException(`${k}: must be a non-negative number`);
    }
    if (Math.round(v * 100) !== v * 100) throw new BadRequestException(`${k}: maximum 2 decimal places`);
  },
};

/** Resolve stored rows to typed settings; a missing or malformed row falls back to its default. */
export function resolveTransferFeeSettings(rows: Array<{ key: string; value: unknown }>): TransferFeeSettings {
  const get = <T>(key: string, fallback: T, ok: (v: unknown) => boolean): T => {
    const row = rows.find((r) => r.key === key);
    return row && ok(row.value) ? (row.value as T) : fallback;
  };
  return {
    enabled: get('transferFee.enabled', TRANSFER_FEE_DEFAULTS.enabled, (v) => typeof v === 'boolean'),
    mode: get('transferFee.mode', TRANSFER_FEE_DEFAULTS.mode, (v) => v === 'PERCENT' || v === 'FIXED'),
    value: get('transferFee.value', TRANSFER_FEE_DEFAULTS.value, (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0),
  };
}

/** The fee for a transfer, to the cent; 0 when switched off. */
export function transferFeeFor(contractTotal: number, settings: TransferFeeSettings): number {
  if (!settings.enabled || settings.value <= 0) return 0;
  const cents =
    settings.mode === 'PERCENT'
      ? Math.round((Math.round(contractTotal * 100) * settings.value) / 100)
      : Math.round(settings.value * 100);
  return cents / 100;
}

/** Idempotent: a new company gets the settings, switched off. */
export async function seedTransferFeeSettingsForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { setting: { createMany: (...args: any[]) => Promise<{ count: number }> } },
  companyId: string,
): Promise<void> {
  await prisma.setting.createMany({
    data: TRANSFER_FEE_SETTING_DEFAULTS.map(({ key, value }) => ({ companyId, key, value })),
    skipDuplicates: true,
  });
}

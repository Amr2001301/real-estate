/**
 * How long a fee (late fee, transfer fee) has to be paid before it counts as
 * overdue — a company setting. A fee used to be due the day it was charged,
 * so it was overdue on day one (and the new owner of a transferred contract
 * got an "installment overdue" notice for the transfer fee straight away).
 */
import { BadRequestException } from '@nestjs/common';
import { localDayAfter } from '../../common/time/company-timezone';

export const FEE_PAYMENT_DAYS_KEY = 'fees.paymentDays';
export const FEE_PAYMENT_DAYS_DEFAULT = 14;

export const FEE_SETTING_DEFAULTS: Array<{ key: string; value: number }> = [
  { key: FEE_PAYMENT_DAYS_KEY, value: FEE_PAYMENT_DAYS_DEFAULT },
];

export const FEE_SETTING_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  [FEE_PAYMENT_DAYS_KEY]: (k, v) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 365) {
      throw new BadRequestException(`${k}: must be an integer between 0 and 365`);
    }
  },
};


/** Reads the company's payment period (default when missing or malformed). */
export async function feePaymentDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { setting: { findFirst: (...args: any[]) => Promise<{ value: unknown } | null> } },
  companyId: string,
): Promise<number> {
  const row = await db.setting.findFirst({ where: { companyId, key: FEE_PAYMENT_DAYS_KEY }, select: { value: true } });
  const v = row?.value;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365 ? v : FEE_PAYMENT_DAYS_DEFAULT;
}

/** The due date of a fee charged at `chargedAt`: the day `paymentDays` later in the company's zone. */
export function feeDueDate(chargedAt: Date, paymentDays: number, timeZone: string): Date {
  return localDayAfter(timeZone, paymentDays, chargedAt);
}

/** Idempotent: a new company gets the setting with its default. */
export async function seedFeeSettingsForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { setting: { createMany: (...args: any[]) => Promise<{ count: number }> } },
  companyId: string,
): Promise<void> {
  await prisma.setting.createMany({
    data: FEE_SETTING_DEFAULTS.map(({ key, value }) => ({ companyId, key, value })),
    skipDuplicates: true,
  });
}

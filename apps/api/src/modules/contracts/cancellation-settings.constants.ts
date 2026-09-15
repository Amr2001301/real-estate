/**
 * The eight per-tenant Settings that govern the cancellation and cheque-bounce
 * workflows (§4.4). Defaults are per the design spec.
 *
 * IMPORTANT: these values are suggestions only (Hard Rule 1). The operator's
 * entered values are the truth. These defaults are NEVER read to re-derive a
 * historical amount.
 */

export interface CancellationSettingsRow {
  key: string;
  value: string | number | boolean;
}

export const CANCELLATION_SETTING_DEFAULTS: CancellationSettingsRow[] = [
  { key: 'cancellation.bookingAmount.refundPct', value: 0 },
  { key: 'cancellation.contract.penaltyPct', value: 10 },
  { key: 'cancellation.unit.returnToAvailable', value: 'REQUIRES_APPROVAL' },
  { key: 'cancellation.customer.demoteToClient', value: false },
  { key: 'cancellation.brokerCommission.action', value: 'CLAWBACK' },
  { key: 'cancellation.salesBonus.action', value: 'CLAWBACK' },
  { key: 'cheque.bounced.installmentAction', value: 'REOPEN_AS_OVERDUE' },
  { key: 'cheque.bounced.penaltyAmount', value: 0 },
];

export const CANCELLATION_SETTING_KEYS = CANCELLATION_SETTING_DEFAULTS.map((d) => d.key);

/** Resolved, typed view of the 8 settings for a single company. */
export interface CancellationSettings {
  bookingRefundPct: number;
  penaltyPct: number;
  unitRelease: 'AUTO' | 'REQUIRES_APPROVAL';
  demoteClient: boolean;
  commissionAction: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
  bonusAction: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
  installmentAction: 'REOPEN_AS_OVERDUE' | 'REOPEN_AS_PENDING';
  penaltyAmount: number;
}

/** The portion of the policySnapshot stored on ContractCancellation (§4.2). */
export interface CancellationPolicySnapshot {
  penaltyPct: number;
  bookingRefundPct: number;
  unitRelease: string;
  demoteClient: boolean;
  commissionAction: string;
  bonusAction: string;
}

/** policySnapshot stored on a bounce-driven PaymentCorrection (§4.4). */
export interface BouncePolicySnapshot {
  installmentAction: string;
  penaltyAmount: number;
}

/**
 * Idempotent helper: seeds the 8 defaults for a single company via createMany
 * with skipDuplicates so existing operator-configured values are never touched.
 *
 * Compatible with any prisma-like client: PrismaService, rawPrisma, or a tx.
 */
export async function seedCancellationSettingsForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { setting: { createMany: (...args: any[]) => Promise<{ count: number }> } },
  companyId: string,
): Promise<void> {
  await prisma.setting.createMany({
    data: CANCELLATION_SETTING_DEFAULTS.map(({ key, value }) => ({
      companyId,
      key,
      value,
    })),
    skipDuplicates: true,
  });
}

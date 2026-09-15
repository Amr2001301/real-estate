/**
 * Step D2 — CancellationPolicyService
 *
 * READ-ONLY. Reads per-tenant Settings and computes pre-fill suggestions for
 * the cancellation modal (getCancellationSuggestion) and the bounce modal
 * (getBounceSuggestion). Neither method writes anything.
 *
 * Hard Rule 1: policy produces a SUGGESTION. The operator's entered values are
 * truth. A setting is never used to compute a historical amount.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, DepositReviewStatus, DepositType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CANCELLATION_SETTING_DEFAULTS,
  type CancellationSettings,
  type CancellationPolicySnapshot,
  type BouncePolicySnapshot,
} from './cancellation-settings.constants';

// ── Suggestion return types ──────────────────────────────────────────────────

export interface CancellationSuggestion {
  contractId: string;
  companyId: string;
  bookingCollected: string;
  otherCollected: string;
  totalCollected: string;
  suggestedBookingRefund: string;
  suggestedPenalty: string;
  suggestedRetained: string;
  suggestedRefund: string;
  policySnapshot: CancellationPolicySnapshot;
}

export interface BounceSuggestion {
  instrumentId: string;
  companyId: string;
  suggestedPenaltyAmount: string;
  installmentAction: string;
  policySnapshot: BouncePolicySnapshot;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dec(n: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return n ?? new Prisma.Decimal(0);
}

function toStr(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

@Injectable()
export class CancellationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Private: read and resolve settings for a given companyId ──────────────
  //
  // The middleware scopes Setting queries to the ALS companyId. We read by key
  // from the already-scoped result set and fall back to documented defaults so
  // a missing row never crashes a suggestion computation.

  private resolveValue<T>(
    rows: Array<{ key: string; value: unknown }>,
    key: string,
    defaultValue: T,
  ): T {
    const row = rows.find((r) => r.key === key);
    if (row === undefined) return defaultValue;
    return row.value as T;
  }

  private async readSettings(): Promise<CancellationSettings> {
    const rows = await this.prisma.setting.findMany({
      where: {
        key: {
          in: CANCELLATION_SETTING_DEFAULTS.map((d) => d.key),
        },
      },
      select: { key: true, value: true },
    });

    return {
      bookingRefundPct: this.resolveValue(rows, 'cancellation.bookingAmount.refundPct', 0),
      penaltyPct: this.resolveValue(rows, 'cancellation.contract.penaltyPct', 10),
      unitRelease: this.resolveValue(rows, 'cancellation.unit.returnToAvailable', 'REQUIRES_APPROVAL'),
      demoteClient: this.resolveValue(rows, 'cancellation.customer.demoteToClient', false),
      commissionAction: this.resolveValue(rows, 'cancellation.brokerCommission.action', 'CLAWBACK'),
      bonusAction: this.resolveValue(rows, 'cancellation.salesBonus.action', 'CLAWBACK'),
      installmentAction: this.resolveValue(rows, 'cheque.bounced.installmentAction', 'REOPEN_AS_OVERDUE'),
      penaltyAmount: this.resolveValue(rows, 'cheque.bounced.penaltyAmount', 0),
    };
  }

  // ── getCancellationSuggestion ────────────────────────────────────────────

  /**
   * Computes the operator pre-fill for the cancellation modal (§4.4 formula).
   *
   * Tenant-safe: the contract is queried via the middleware-scoped PrismaService
   * so a request from Company A cannot resolve Company B's contract — throws 404.
   *
   * Returns suggestion values and the policySnapshot that D3 will store
   * immutably on ContractCancellation.
   */
  async getCancellationSuggestion(contractId: string): Promise<CancellationSuggestion> {
    // Tenant-scoped lookup — 404 if not found in this company (no 403 leak)
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { id: true, companyId: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    // Sum APPROVED deposits by type (only non-deleted rows)
    const [bookingAgg, totalAgg] = await Promise.all([
      this.prisma.deposit.aggregate({
        where: {
          contractId,
          reviewStatus: DepositReviewStatus.APPROVED,
          type: DepositType.BOOKING_AMOUNT,
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.deposit.aggregate({
        where: {
          contractId,
          reviewStatus: DepositReviewStatus.APPROVED,
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    const bookingCollected = dec(bookingAgg._sum.amount);
    const totalCollected = dec(totalAgg._sum.amount);
    const otherCollected = totalCollected.minus(bookingCollected);

    const settings = await this.readSettings();

    // § 4.4 formula
    const suggestedBookingRefund = bookingCollected.times(settings.bookingRefundPct).dividedBy(100);
    const suggestedPenalty = otherCollected.times(settings.penaltyPct).dividedBy(100);
    const suggestedRetained = bookingCollected.minus(suggestedBookingRefund).plus(suggestedPenalty);
    const suggestedRefund = totalCollected.minus(suggestedRetained);

    const policySnapshot: CancellationPolicySnapshot = {
      penaltyPct: settings.penaltyPct,
      bookingRefundPct: settings.bookingRefundPct,
      unitRelease: settings.unitRelease,
      demoteClient: settings.demoteClient,
      commissionAction: settings.commissionAction,
      bonusAction: settings.bonusAction,
    };

    return {
      contractId: contract.id,
      companyId: contract.companyId ?? '',
      bookingCollected: toStr(bookingCollected),
      otherCollected: toStr(otherCollected),
      totalCollected: toStr(totalCollected),
      suggestedBookingRefund: toStr(suggestedBookingRefund),
      suggestedPenalty: toStr(suggestedPenalty),
      suggestedRetained: toStr(suggestedRetained),
      suggestedRefund: toStr(suggestedRefund),
      policySnapshot,
    };
  }

  // ── getBounceSuggestion ────────────────────────────────────────────────────

  /**
   * Returns the two cheque.bounced.* setting values as a pre-fill for the
   * bounce modal. Tenant-safe: instrument resolved via middleware-scoped query.
   */
  async getBounceSuggestion(instrumentId: string): Promise<BounceSuggestion> {
    const instrument = await this.prisma.paymentInstrument.findFirst({
      where: { id: instrumentId },
      select: { id: true, companyId: true },
    });
    if (!instrument) throw new NotFoundException('Payment instrument not found');

    const settings = await this.readSettings();

    const policySnapshot: BouncePolicySnapshot = {
      installmentAction: settings.installmentAction,
      penaltyAmount: settings.penaltyAmount,
    };

    return {
      instrumentId: instrument.id,
      companyId: instrument.companyId ?? '',
      suggestedPenaltyAmount: new Prisma.Decimal(settings.penaltyAmount).toFixed(2),
      installmentAction: settings.installmentAction,
      policySnapshot,
    };
  }
}

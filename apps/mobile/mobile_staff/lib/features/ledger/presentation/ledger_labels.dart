import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../domain/ledger.dart';

String ledgerGroupTitle(AppLocalizations l10n, LedgerGroup g) => switch (g) {
      LedgerGroup.installments => l10n.ledgerGroupInstallments,
      LedgerGroup.bookings => l10n.ledgerGroupBookings,
      LedgerGroup.fees => l10n.ledgerGroupFees,
      LedgerGroup.clawbacks => l10n.ledgerGroupClawbacks,
      LedgerGroup.commissions => l10n.ledgerGroupCommissions,
      LedgerGroup.bonuses => l10n.ledgerGroupBonuses,
      LedgerGroup.topUps => l10n.ledgerGroupTopUps,
      LedgerGroup.refunds => l10n.ledgerGroupRefunds,
      LedgerGroup.onHold => l10n.ledgerGroupOnHold,
    };

String ledgerStateLabel(AppLocalizations l10n, LedgerState s) => switch (s) {
      LedgerState.late => l10n.installmentStatusOverdue,
      LedgerState.dueToday => l10n.statementDueTodayShort,
      LedgerState.upcoming => l10n.ledgerStateUpcoming,
      LedgerState.onItsWay => l10n.ledgerStateOnItsWay,
      LedgerState.pendingApproval => l10n.ledgerStatePendingApproval,
    };

Color ledgerStateColor(AppColorsExt c, LedgerState s) => switch (s) {
      LedgerState.late => c.error,
      LedgerState.dueToday => c.warning,
      LedgerState.upcoming => c.inkMuted,
      LedgerState.onItsWay => AppPalette.gold400,
      LedgerState.pendingApproval => c.inkMuted,
    };

/// A row's type in words, as on the dashboard.
String ledgerTypeLabel(AppLocalizations l10n, String type) => switch (type) {
      'RESERVATION' || 'BOOKING' => l10n.depositTypeBooking,
      'DOWN_PAYMENT' => l10n.depositTypeDownPayment,
      'INSTALLMENT' => l10n.depositTypeInstallment,
      'FINAL_PAYMENT' => l10n.depositTypeFinal,
      'LATE_FEE' => l10n.planTypeLateFee,
      'BOUNCE_PENALTY' => l10n.planTypeBouncePenalty,
      'TRANSFER_FEE' => l10n.planTypeTransferFee,
      'COMMISSION' => l10n.ledgerTypeCommission,
      'TOP_UP' => l10n.ledgerGroupTopUps,
      'BONUS' => l10n.ledgerTypeBonus,
      'REFUND' => l10n.ledgerGroupRefunds,
      'COMMISSION_CLAWBACK' => l10n.ledgerTypeCommissionClawback,
      'BONUS_CLAWBACK' => l10n.ledgerTypeBonusClawback,
      'PRICE_CHANGE_CLAWBACK' => l10n.ledgerTypePriceChangeClawback,
      _ => type,
    };

String ledgerPeriodLabel(AppLocalizations l10n, LedgerPeriod p) => switch (p) {
      LedgerPeriod.all => l10n.ledgerPeriodAll,
      LedgerPeriod.thisMonth => l10n.ledgerPeriodThisMonth,
      LedgerPeriod.nextMonth => l10n.ledgerPeriodNextMonth,
      LedgerPeriod.quarter => l10n.ledgerPeriodQuarter,
      LedgerPeriod.year => l10n.ledgerPeriodYear,
    };

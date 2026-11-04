import 'package:core/core.dart';

import '../domain/entities/deposit.dart';

/// Localized labels for a deposit's type. Kept out of the entity (presentation
/// concern) so the domain stays free of l10n.
String depositTypeLabel(AppLocalizations l10n, DepositType type) => switch (type) {
      DepositType.bookingAmount => l10n.depositTypeBooking,
      DepositType.downPayment => l10n.depositTypeDownPayment,
      DepositType.installment => l10n.depositTypeInstallment,
      DepositType.finalPayment => l10n.depositTypeFinal,
      DepositType.fee => l10n.depositTypeFee,
      DepositType.unknown => l10n.depositTypePayment,
    };

/// Where the payment stands, in words, from its `state` (older API: verified).
String depositStateLabel(AppLocalizations l10n, Deposit d) => switch (d.state) {
      'COLLECTED' => l10n.depositStateCollected,
      'PENDING_REVIEW' => l10n.depositStatePendingReview,
      'CHEQUE_PENDING' => l10n.depositStateChequePending,
      'REJECTED' => l10n.depositStateRejected,
      'REVERSED' => l10n.depositStateReversed,
      'BOUNCED' => l10n.depositStateBounced,
      _ => d.verified ? l10n.depositStateCollected : l10n.depositStatePendingReview,
    };

String? paymentMethodLabel(AppLocalizations l10n, String? method) => switch (method) {
      null || '' => null,
      'CASH' => l10n.paymentMethodCash,
      'BANK_TRANSFER' => l10n.paymentMethodBankTransfer,
      'CHEQUE' => l10n.paymentMethodCheque,
      'CARD' => l10n.paymentMethodCard,
      _ => l10n.paymentMethodOther,
    };

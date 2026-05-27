import 'package:core/core.dart';

import '../domain/entities/deposit.dart';

/// Localized labels for a deposit's type. Kept out of the entity (presentation
/// concern) so the domain stays free of l10n.
String depositTypeLabel(AppLocalizations l10n, DepositType type) => switch (type) {
      DepositType.bookingAmount => l10n.depositTypeBooking,
      DepositType.downPayment => l10n.depositTypeDownPayment,
      DepositType.installment => l10n.depositTypeInstallment,
      DepositType.finalPayment => l10n.depositTypeFinal,
      DepositType.unknown => l10n.depositTypePayment,
    };

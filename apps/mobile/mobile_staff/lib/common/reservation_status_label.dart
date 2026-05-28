import 'package:core/core.dart';

String reservationStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING' => l10n.reservationStatusPending,
      'APPROVED' => l10n.reservationStatusApproved,
      'REJECTED' => l10n.reservationStatusRejected,
      'CANCELLED' => l10n.reservationStatusCancelled,
      'EXPIRED' => l10n.reservationStatusExpired,
      'CONVERTED' => l10n.reservationStatusConverted,
      _ => status,
    };

BadgeTone reservationStatusTone(String status) => switch (status) {
      'PENDING' => BadgeTone.warning,
      'APPROVED' => BadgeTone.info,
      'CONVERTED' => BadgeTone.success,
      'REJECTED' => BadgeTone.error,
      'CANCELLED' => BadgeTone.error,
      'EXPIRED' => BadgeTone.neutral,
      _ => BadgeTone.neutral,
    };

/// Filterable reservation statuses in display order.
const kReservationStatuses = [
  'PENDING', 'APPROVED', 'CONVERTED', 'REJECTED', 'CANCELLED', 'EXPIRED',
];

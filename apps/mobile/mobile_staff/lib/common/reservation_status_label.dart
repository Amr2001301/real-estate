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

/// One event on a reservation's history, as a sentence (never the raw code).
String reservationEventLabel(AppLocalizations l10n, String type) => switch (type) {
      'CREATED' => l10n.reservationEventCreated,
      'APPROVED' => l10n.reservationEventApproved,
      'REJECTED' => l10n.reservationEventRejected,
      'CANCELLED' => l10n.reservationEventCancelled,
      'EXPIRED' => l10n.reservationEventExpired,
      'NOTE_ADDED' => l10n.reservationEventNoteAdded,
      'BOOKING_PAYMENT_CONFIRMED' => l10n.reservationEventPaymentConfirmed,
      'BOOKING_PAYMENT_UNCONFIRMED' => l10n.reservationEventPaymentUnconfirmed,
      'CONVERTED' => l10n.reservationEventConverted,
      _ => l10n.reservationEventOther,
    };

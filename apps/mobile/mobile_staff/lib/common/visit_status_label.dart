import 'package:core/core.dart';

String visitStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'SCHEDULED' => l10n.visitStatusScheduled,
      'CONFIRMED' => l10n.visitStatusConfirmed,
      'COMPLETED' => l10n.visitStatusCompleted,
      'CANCELLED' => l10n.visitStatusCancelled,
      'NO_SHOW' => l10n.visitStatusNoShow,
      'RESCHEDULED' => l10n.visitStatusRescheduled,
      _ => status,
    };

/// Filterable visit statuses in display order.
const kVisitStatuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

BadgeTone visitStatusTone(String status) => switch (status) {
      'SCHEDULED' => BadgeTone.info,
      'CONFIRMED' => BadgeTone.gold,
      'COMPLETED' => BadgeTone.success,
      'CANCELLED' => BadgeTone.error,
      'NO_SHOW' => BadgeTone.warning,
      'RESCHEDULED' => BadgeTone.neutral,
      _ => BadgeTone.neutral,
    };

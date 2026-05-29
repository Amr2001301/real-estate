import 'package:core/core.dart';

import '../features/visits/domain/entities/visit.dart';

/// Staff-facing label for an appointment status. The wording reflects who is
/// currently waiting on whom — SCHEDULED reads as "awaiting customer
/// confirmation" (the two-sided P2 flow), CONFIRMED as "customer confirmed".
String visitStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'SCHEDULED' => l10n.appointmentStatusAwaitingCustomerStaff,
      'CONFIRMED' => l10n.appointmentStatusConfirmedByCustomerStaff,
      'PENDING_RESCHEDULE' => l10n.appointmentStatusPendingRescheduleStaff,
      'COMPLETED' => l10n.visitStatusCompleted,
      'CANCELLED' => l10n.visitStatusCancelled,
      'NO_SHOW' => l10n.visitStatusNoShow,
      'RESCHEDULED' => l10n.visitStatusRescheduled,
      _ => status,
    };

/// Filterable visit statuses in display order. PENDING_RESCHEDULE is in the
/// active set so sales can see and act on these without leaving the list.
const kVisitStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'PENDING_RESCHEDULE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

BadgeTone visitStatusTone(String status) => switch (status) {
      'SCHEDULED' => BadgeTone.info,
      'CONFIRMED' => BadgeTone.gold,
      'PENDING_RESCHEDULE' => BadgeTone.warning,
      'COMPLETED' => BadgeTone.success,
      'CANCELLED' => BadgeTone.error,
      'NO_SHOW' => BadgeTone.warning,
      'RESCHEDULED' => BadgeTone.neutral,
      _ => BadgeTone.neutral,
    };

/// Sales-side transitions allowed on a visit. Matches the backend's guards
/// (visits.service.ts) exactly so the UI never surfaces a button that would
/// guarantee a 400:
///
///   * SCHEDULED → only `cancel` — the customer hasn't confirmed yet, so
///     `complete` is blocked, and `no-show` requires the visit time to have
///     passed.
///   * CONFIRMED → `complete` and `cancel`; `no-show` is added once
///     `scheduledAt` is in the past.
///   * PENDING_RESCHEDULE → only `cancel` — admin must reschedule via the
///     admin dashboard, which produces a fresh SCHEDULED row.
///   * terminal (COMPLETED / CANCELLED / NO_SHOW / RESCHEDULED) → nothing.
///
/// Pure function — pulled out of the visit detail screen so it can be
/// covered with a tight unit test instead of a widget test.
List<VisitTransition> allowedVisitTransitions(Visit visit, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final hasPast =
      visit.scheduledAt != null && !visit.scheduledAt!.isAfter(reference);
  switch (visit.status) {
    case 'SCHEDULED':
      return const [VisitTransition.cancel];
    case 'CONFIRMED':
      return [
        VisitTransition.complete,
        VisitTransition.cancel,
        if (hasPast) VisitTransition.noShow,
      ];
    case 'PENDING_RESCHEDULE':
      return const [VisitTransition.cancel];
    default:
      return const [];
  }
}

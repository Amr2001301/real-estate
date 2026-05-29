import 'package:core/core_domain.dart';

/// Customer-facing visit-request lifecycle status (backend `VisitStatus`).
enum VisitStatus {
  pending('PENDING'),
  approved('APPROVED'),
  scheduled('SCHEDULED'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const VisitStatus(this.wire);
  final String wire;

  static VisitStatus fromWire(String? v) => VisitStatus.values.firstWhere(
        (s) => s.wire == v,
        orElse: () => VisitStatus.unknown,
      );
}

/// The appointment lifecycle status (backend `AppointmentStatus`). Mirrors the
/// admin/web enum. `SCHEDULED` from the customer's perspective means
/// "admin proposed, waiting on you" — the two-sided confirmation flow.
enum AppointmentStatus {
  scheduled('SCHEDULED'),
  confirmed('CONFIRMED'),
  pendingReschedule('PENDING_RESCHEDULE'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  noShow('NO_SHOW'),
  rescheduled('RESCHEDULED'),
  unknown('UNKNOWN');

  const AppointmentStatus(this.wire);
  final String wire;

  static AppointmentStatus fromWire(String? v) =>
      AppointmentStatus.values.firstWhere(
        (s) => s.wire == v,
        orElse: () => AppointmentStatus.unknown,
      );

  /// True for any state the customer can no longer act on (visit done,
  /// cancelled, no-show, or replaced by a fresh appointment).
  bool get isTerminal => switch (this) {
        AppointmentStatus.completed ||
        AppointmentStatus.cancelled ||
        AppointmentStatus.noShow ||
        AppointmentStatus.rescheduled =>
          true,
        _ => false,
      };
}

/// Most-recent appointment attached to a visit request. Pure domain.
class AppointmentSummary extends Equatable {
  const AppointmentSummary({
    required this.id,
    required this.status,
    this.scheduledAt,
    this.durationMinutes,
    this.location,
    this.meetingPoint,
    this.customerFeedback,
  });

  final String id;
  final AppointmentStatus status;
  final DateTime? scheduledAt;
  final int? durationMinutes;
  final String? location;
  final String? meetingPoint;

  /// When the customer asked to reschedule, the reason they typed is mirrored
  /// here from the backend (`customerFeedback` column). Display-only.
  final String? customerFeedback;

  /// Whether the customer is the next actor — used by the UI to decide
  /// whether to render Confirm / Request-reschedule buttons.
  bool get awaitsCustomer => status == AppointmentStatus.scheduled;

  @override
  List<Object?> get props => [id, status, scheduledAt];
}

/// A visit request the user submitted. Domain entity (pure Dart).
class VisitRequest extends Equatable {
  const VisitRequest({
    required this.id,
    required this.projectId,
    required this.status,
    required this.preferredDate,
    this.unitId,
    this.projectName,
    this.notes,
    this.preferredTime,
    this.scheduledAt,
    this.createdAt,
    this.assignedSalesName,
    this.appointments = const [],
  });

  final String id;
  final String projectId;
  final String? unitId;
  final Translatable? projectName;
  final VisitStatus status;
  final DateTime? preferredDate;

  /// HH:mm string as submitted (or derived) at submission. Display-only — the
  /// full datetime is in `preferredDate`.
  final String? preferredTime;

  /// Customer's free-text message at submission. Pre-P2 rows have only the
  /// legacy `notes` column populated; the mapper falls back to that.
  final String? notes;

  /// Admin-scheduled datetime, if the legacy /visit-requests scheduledAt was
  /// set. The newer source of truth is `appointments[0].scheduledAt`.
  final DateTime? scheduledAt;

  final DateTime? createdAt;
  final String? assignedSalesName;
  final List<AppointmentSummary> appointments;

  AppointmentSummary? get latestAppointment =>
      appointments.isEmpty ? null : appointments.first;

  @override
  List<Object?> get props =>
      [id, projectId, unitId, status, preferredDate, appointments.length];
}

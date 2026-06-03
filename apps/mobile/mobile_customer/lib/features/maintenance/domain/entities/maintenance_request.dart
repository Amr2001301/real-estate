import 'package:core/core_domain.dart';

/// Lifecycle status of a maintenance request (matches backend MaintenanceStatus).
enum MaintenanceStatus {
  open('OPEN'),
  assigned('ASSIGNED'),
  inProgress('IN_PROGRESS'),
  resolved('RESOLVED'),
  closed('CLOSED'),
  unknown('');

  const MaintenanceStatus(this.wire);
  final String wire;

  static MaintenanceStatus fromWire(String? wire) => values.firstWhere(
        (s) => s.wire == wire,
        orElse: () => MaintenanceStatus.unknown,
      );
}

/// Priority of a maintenance request (matches backend MaintenancePriority).
enum MaintenancePriority {
  low('LOW'),
  medium('MEDIUM'),
  high('HIGH'),
  urgent('URGENT'),
  unknown('');

  const MaintenancePriority(this.wire);
  final String wire;

  static MaintenancePriority fromWire(String? wire) => values.firstWhere(
        (p) => p.wire == wire,
        orElse: () => MaintenancePriority.unknown,
      );
}

/// Phase A — who confirmed a request's resolution (`null` → nobody yet).
enum MaintenanceResolvedBy {
  customer('CUSTOMER'),
  supervisor('SUPERVISOR'),
  both('BOTH');

  const MaintenanceResolvedBy(this.wire);
  final String wire;

  static MaintenanceResolvedBy? fromWire(String? wire) {
    if (wire == null || wire.isEmpty) return null;
    for (final v in values) {
      if (v.wire == wire) return v;
    }
    return null;
  }
}

/// A complaint is allowed once a request is this far past its dueAt (mirrors the
/// backend 24h gate; the API stays authoritative).
const Duration kMaintenanceComplaintOverdue = Duration(hours: 24);

/// A maintenance request the customer filed against one of their units.
class MaintenanceRequest extends Equatable {
  const MaintenanceRequest({
    required this.id,
    required this.description,
    required this.status,
    required this.priority,
    this.unitCode,
    this.categoryName,
    this.createdAt,
    this.dueAt,
    this.complaintAt,
    this.unresolvedAt,
    this.customerConfirmedResolutionAt,
    this.supervisorConfirmedResolutionAt,
    this.resolvedBy,
    this.customerRating,
    this.customerRatingText,
    this.customerRatingSubmittedAt,
  });

  final String id;
  final String description;
  final MaintenanceStatus status;
  final MaintenancePriority priority;
  final String? unitCode;
  final Translatable? categoryName;
  final DateTime? createdAt;

  // Phase A — resolution loop.
  final DateTime? dueAt;
  final DateTime? complaintAt;
  final DateTime? unresolvedAt;
  final DateTime? customerConfirmedResolutionAt;
  final DateTime? supervisorConfirmedResolutionAt;
  final MaintenanceResolvedBy? resolvedBy;
  final int? customerRating;
  final String? customerRatingText;
  final DateTime? customerRatingSubmittedAt;

  bool get _isClosedish =>
      status == MaintenanceStatus.resolved || status == MaintenanceStatus.closed;

  /// True when the request is past its dueAt and not yet resolved/closed.
  bool get isOverdue =>
      !_isClosedish && dueAt != null && dueAt!.isBefore(DateTime.now());

  /// How long past dueAt (zero when not overdue).
  Duration get overdueBy =>
      isOverdue ? DateTime.now().difference(dueAt!) : Duration.zero;

  /// Pre-gate for the complaint action (API re-validates).
  bool get canComplain =>
      !_isClosedish &&
      complaintAt == null &&
      dueAt != null &&
      DateTime.now().difference(dueAt!) >= kMaintenanceComplaintOverdue;

  /// The customer may confirm + rate once the request is resolved/closed.
  bool get canConfirmResolution =>
      _isClosedish && customerConfirmedResolutionAt == null;

  bool get customerHasConfirmed => customerConfirmedResolutionAt != null;

  @override
  List<Object?> get props => [
        id,
        status,
        priority,
        description,
        createdAt,
        dueAt,
        complaintAt,
        unresolvedAt,
        customerConfirmedResolutionAt,
        supervisorConfirmedResolutionAt,
        resolvedBy,
        customerRating,
        customerRatingText,
        customerRatingSubmittedAt,
      ];
}

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
  });

  final String id;
  final String description;
  final MaintenanceStatus status;
  final MaintenancePriority priority;
  final String? unitCode;
  final Translatable? categoryName;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, status, priority, description, createdAt];
}

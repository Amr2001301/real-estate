import 'package:core/core_domain.dart';

/// Customer-facing visit lifecycle status (backend `VisitStatus`).
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
    this.createdAt,
  });

  final String id;
  final String projectId;
  final String? unitId;
  final Translatable? projectName;
  final VisitStatus status;
  final DateTime? preferredDate;
  final String? notes;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, projectId, unitId, status, preferredDate];
}

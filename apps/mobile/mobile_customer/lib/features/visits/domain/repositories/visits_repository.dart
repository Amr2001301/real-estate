import 'package:core/core_domain.dart';

import '../entities/visit_request.dart';

class CreateVisitParams {
  const CreateVisitParams({
    required this.projectId,
    required this.preferredDate,
    this.unitId,
    this.notes,
  });
  final String projectId;
  final String? unitId;
  final DateTime preferredDate;
  final String? notes;
}

abstract interface class VisitsRepository {
  Future<Result<void>> createVisitRequest(CreateVisitParams params);

  Future<Result<Paginated<VisitRequest>>> getMyVisitRequests({
    int page,
    int pageSize,
  });

  /// P2 — confirm a proposed appointment as its owning customer.
  Future<Result<void>> confirmAppointment(String appointmentId);

  /// P2 — ask the admin to reschedule a proposed appointment. `reason` is
  /// optional free text (≤ 500 chars on the backend).
  Future<Result<void>> requestReschedule(
    String appointmentId, {
    String? reason,
  });
}

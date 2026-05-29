import 'package:core/core_domain.dart';

import '../repositories/visits_repository.dart';

/// Input for [RequestVisitReschedule]. `appointmentId` is required; `reason`
/// is optional free text (≤ 500 chars; longer values are accepted and
/// silently truncated by the backend's DTO validator).
class RequestVisitRescheduleParams {
  const RequestVisitRescheduleParams({
    required this.appointmentId,
    this.reason,
  });

  final String appointmentId;
  final String? reason;
}

/// Customer asks the admin to reschedule a proposed appointment.
class RequestVisitReschedule
    implements UseCase<void, RequestVisitRescheduleParams> {
  const RequestVisitReschedule(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(RequestVisitRescheduleParams params) =>
      _repo.requestReschedule(params.appointmentId, reason: params.reason);
}

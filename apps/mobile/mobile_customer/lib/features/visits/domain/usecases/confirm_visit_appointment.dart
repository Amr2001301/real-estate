import 'package:core/core_domain.dart';

import '../repositories/visits_repository.dart';

/// Confirm an admin-proposed appointment as the owning customer.
/// Input: the appointment id (string). Output: void on success.
class ConfirmVisitAppointment implements UseCase<void, String> {
  const ConfirmVisitAppointment(this._repo);
  final VisitsRepository _repo;

  @override
  Future<Result<void>> call(String appointmentId) =>
      _repo.confirmAppointment(appointmentId);
}

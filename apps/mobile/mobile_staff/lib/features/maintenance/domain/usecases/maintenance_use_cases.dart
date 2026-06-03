import 'package:core/core_domain.dart';

import '../entities/maintenance_request.dart';
import '../repositories/maintenance_repository.dart';

class GetAssignedMaintenance implements UseCase<List<MaintenanceRequest>, NoParams> {
  const GetAssignedMaintenance(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<List<MaintenanceRequest>>> call(NoParams params) => _repo.getAssigned();
}

class GetMaintenanceDetail implements UseCase<MaintenanceDetail, String> {
  const GetMaintenanceDetail(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<MaintenanceDetail>> call(String id) => _repo.getDetail(id);
}

class UpdateMaintenanceStatusParams {
  const UpdateMaintenanceStatusParams({required this.id, required this.transition});
  final String id;
  final MaintenanceTransition transition;
}

class UpdateMaintenanceStatus implements UseCase<void, UpdateMaintenanceStatusParams> {
  const UpdateMaintenanceStatus(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<void>> call(UpdateMaintenanceStatusParams params) =>
      _repo.updateStatus(params.id, params.transition);
}

class ConfirmMaintenanceResolution implements UseCase<void, String> {
  const ConfirmMaintenanceResolution(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<void>> call(String id) => _repo.confirmResolution(id);
}

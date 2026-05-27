import 'package:core/core_domain.dart';

import '../entities/maintenance_category.dart';
import '../entities/maintenance_request.dart';
import '../repositories/maintenance_repository.dart';

class GetMaintenanceCategories implements UseCase<List<MaintenanceCategory>, NoParams> {
  const GetMaintenanceCategories(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<List<MaintenanceCategory>>> call(NoParams params) => _repo.getCategories();
}

class GetMyMaintenanceRequests implements UseCase<List<MaintenanceRequest>, NoParams> {
  const GetMyMaintenanceRequests(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<List<MaintenanceRequest>>> call(NoParams params) => _repo.getMyRequests();
}

class CreateMaintenanceRequest implements UseCase<MaintenanceRequest, NewMaintenanceRequest> {
  const CreateMaintenanceRequest(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<MaintenanceRequest>> call(NewMaintenanceRequest params) =>
      _repo.createRequest(params);
}

class UploadMaintenancePhoto implements UseCase<void, MaintenancePhotoUpload> {
  const UploadMaintenancePhoto(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<void>> call(MaintenancePhotoUpload params) =>
      _repo.uploadPhoto(params);
}

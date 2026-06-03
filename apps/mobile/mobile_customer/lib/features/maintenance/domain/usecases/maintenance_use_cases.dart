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

/// Params for the customer confirm-resolution action (Phase A).
class ConfirmMaintenanceResolutionParams {
  const ConfirmMaintenanceResolutionParams({
    required this.requestId,
    required this.rating,
    this.note,
  });

  final String requestId;
  final int rating;
  final String? note;
}

class ConfirmMaintenanceResolution
    implements UseCase<MaintenanceRequest, ConfirmMaintenanceResolutionParams> {
  const ConfirmMaintenanceResolution(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<MaintenanceRequest>> call(ConfirmMaintenanceResolutionParams params) =>
      _repo.confirmResolution(
        requestId: params.requestId,
        rating: params.rating,
        note: params.note,
      );
}

class SubmitMaintenanceComplaint implements UseCase<MaintenanceRequest, String> {
  const SubmitMaintenanceComplaint(this._repo);
  final MaintenanceRepository _repo;

  @override
  Future<Result<MaintenanceRequest>> call(String requestId) =>
      _repo.submitComplaint(requestId);
}

import 'package:core/core.dart';

import '../../domain/entities/maintenance_category.dart';
import '../../domain/entities/maintenance_request.dart';
import '../../domain/repositories/maintenance_repository.dart';
import '../datasources/maintenance_remote_data_source.dart';
import '../mappers/maintenance_mapper.dart';

class MaintenanceRepositoryImpl implements MaintenanceRepository {
  MaintenanceRepositoryImpl(this._remote);
  final MaintenanceRemoteDataSource _remote;

  @override
  Future<Result<List<MaintenanceCategory>>> getCategories() {
    return guardApiCall(() async {
      final rows = await _remote.listCategories();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<List<MaintenanceRequest>>> getMyRequests() {
    return guardApiCall(() async {
      final rows = await _remote.listMyRequests();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<MaintenanceRequest>> createRequest(NewMaintenanceRequest input) {
    return guardApiCall(() async {
      final dto = await _remote.createRequest(
        unitId: input.unitId,
        categoryIds: input.categoryIds,
        description: input.description,
      );
      return dto.toEntity();
    });
  }

  @override
  Future<Result<void>> uploadPhoto(MaintenancePhotoUpload input) {
    return guardApiCall(() async {
      // 1. Mint a short-lived signed PUT URL (server validates type + size).
      final presign = await _remote.presignPhoto(
        requestId: input.requestId,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        fileName: input.fileName,
      );
      // 2. Upload bytes straight to storage (no bearer token attached).
      await _remote.putToSignedUrl(
        uploadUrl: presign.uploadUrl,
        bytes: input.bytes,
        contentType: input.contentType,
        onProgress: input.onProgress,
      );
      // 3. Register the object as a customer-visible document on the request.
      await _remote.registerPhoto(
        requestId: input.requestId,
        fileUrl: presign.publicUrl,
        title: input.fileName,
        fileName: input.fileName,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
      );
    });
  }

  @override
  Future<Result<MaintenanceRequest>> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  }) {
    return guardApiCall(() async {
      final dto = await _remote.confirmResolution(
        requestId: requestId,
        rating: rating,
        note: note,
      );
      return dto.toEntity();
    });
  }

  @override
  Future<Result<MaintenanceRequest>> submitComplaint(String requestId) {
    return guardApiCall(() async {
      final dto = await _remote.submitComplaint(requestId: requestId);
      return dto.toEntity();
    });
  }
}

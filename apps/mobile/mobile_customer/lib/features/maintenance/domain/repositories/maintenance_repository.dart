import 'dart:typed_data';

import 'package:core/core_domain.dart';

import '../entities/maintenance_category.dart';
import '../entities/maintenance_request.dart';

/// Input for creating a maintenance request. `categoryIds` carries one or more
/// selected categories (backend accepts the multi-category flow).
class NewMaintenanceRequest {
  const NewMaintenanceRequest({
    required this.unitId,
    required this.categoryIds,
    required this.description,
  });

  final String unitId;
  final List<String> categoryIds;
  final String description;
}

/// A single photo to attach to an existing maintenance request. The repository
/// owns the multi-step presign → upload → register dance; the caller supplies
/// the raw bytes (read in presentation) and metadata. `onProgress` (0..1) is an
/// optional upload progress hook — a plain Dart callback, no Flutter/Dio here.
class MaintenancePhotoUpload {
  const MaintenancePhotoUpload({
    required this.requestId,
    required this.bytes,
    required this.contentType,
    required this.fileName,
    required this.sizeBytes,
    this.onProgress,
  });

  final String requestId;
  final Uint8List bytes;
  final String contentType;
  final String fileName;
  final int sizeBytes;
  final void Function(double progress)? onProgress;
}

abstract interface class MaintenanceRepository {
  Future<Result<List<MaintenanceCategory>>> getCategories();
  Future<Result<List<MaintenanceRequest>>> getMyRequests();
  Future<Result<MaintenanceRequest>> createRequest(NewMaintenanceRequest input);

  /// Presigns, uploads, and registers one photo against [requestId]. Returns
  /// Err on any step failing (partial work leaves an unreferenced object that
  /// R2 lifecycle reaps — never an orphaned document row).
  Future<Result<void>> uploadPhoto(MaintenancePhotoUpload input);

  /// Phase A — customer confirms resolution + rating; returns the updated row.
  Future<Result<MaintenanceRequest>> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  });

  /// Phase A — customer files a complaint; returns the updated row.
  Future<Result<MaintenanceRequest>> submitComplaint(String requestId);
}

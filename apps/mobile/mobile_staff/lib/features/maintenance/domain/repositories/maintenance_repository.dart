import 'package:core/core_domain.dart';

import '../entities/maintenance_request.dart';

abstract interface class MaintenanceRepository {
  /// Assigned-to-me requests (backend scopes to the signed-in supervisor and
  /// APPROVED review status).
  Future<Result<List<MaintenanceRequest>>> getAssigned();

  Future<Result<MaintenanceDetail>> getDetail(String id);

  /// Drive a supervisor status transition. Returns void; the caller re-fetches.
  Future<Result<void>> updateStatus(String id, MaintenanceTransition transition);

  /// Explicit supervisor resolution confirmation.
  Future<Result<void>> confirmResolution(String id);
}

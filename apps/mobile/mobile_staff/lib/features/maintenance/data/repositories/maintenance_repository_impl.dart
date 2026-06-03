import 'package:core/core.dart';

import '../../domain/entities/maintenance_request.dart';
import '../../domain/repositories/maintenance_repository.dart';
import '../datasources/maintenance_remote_data_source.dart';
import '../mappers/maintenance_mapper.dart';

class MaintenanceRepositoryImpl implements MaintenanceRepository {
  MaintenanceRepositoryImpl(this._remote);
  final MaintenanceRemoteDataSource _remote;

  @override
  Future<Result<List<MaintenanceRequest>>> getAssigned() {
    return guardApiCall(() async {
      final rows = await _remote.listAssigned();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<MaintenanceDetail>> getDetail(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toEntity());
  }

  @override
  Future<Result<void>> updateStatus(String id, MaintenanceTransition transition) {
    return guardApiCall(() => _remote.setStatus(id, transition));
  }

  @override
  Future<Result<void>> confirmResolution(String id) {
    return guardApiCall(() => _remote.confirmResolution(id));
  }
}

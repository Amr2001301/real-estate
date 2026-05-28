import 'package:core/core.dart';

import '../../domain/entities/broker_project.dart';
import '../../domain/repositories/broker_catalog_repository.dart';
import '../datasources/broker_catalog_remote_data_source.dart';
import '../mappers/broker_catalog_mapper.dart';

class BrokerCatalogRepositoryImpl implements BrokerCatalogRepository {
  BrokerCatalogRepositoryImpl(this._remote);
  final BrokerCatalogRemoteDataSource _remote;

  @override
  Future<Result<List<BrokerProject>>> getProjects() {
    return guardApiCall(() async {
      final rows = await _remote.listProjects();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<List<BrokerUnit>>> getUnits({String? projectId}) {
    return guardApiCall(() async {
      final rows = await _remote.listUnits(projectId: projectId);
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}

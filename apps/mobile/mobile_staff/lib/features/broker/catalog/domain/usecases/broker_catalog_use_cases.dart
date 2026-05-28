import 'package:core/core_domain.dart';

import '../entities/broker_project.dart';
import '../repositories/broker_catalog_repository.dart';

class GetBrokerProjects implements UseCase<List<BrokerProject>, NoParams> {
  const GetBrokerProjects(this._repo);
  final BrokerCatalogRepository _repo;

  @override
  Future<Result<List<BrokerProject>>> call(NoParams params) => _repo.getProjects();
}

class GetBrokerProjectUnits implements UseCase<List<BrokerUnit>, String> {
  const GetBrokerProjectUnits(this._repo);
  final BrokerCatalogRepository _repo;

  @override
  Future<Result<List<BrokerUnit>>> call(String projectId) =>
      _repo.getUnits(projectId: projectId);
}

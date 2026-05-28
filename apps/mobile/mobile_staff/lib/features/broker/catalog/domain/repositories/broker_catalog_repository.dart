import 'package:core/core_domain.dart';

import '../entities/broker_project.dart';

abstract interface class BrokerCatalogRepository {
  Future<Result<List<BrokerProject>>> getProjects();
  Future<Result<List<BrokerUnit>>> getUnits({String? projectId});
}

import 'package:core/core_domain.dart';

import '../entities/broker_project.dart';

abstract interface class BrokerCatalogRepository {
  Future<Result<List<BrokerProject>>> getProjects();
  Future<Result<List<BrokerUnit>>> getUnits({String? projectId});

  /// The plans a customer would see on a unit (the broker shows the same).
  Future<Result<List<InstallmentOffer>>> unitPlans(String unitId);

  /// A project's payment offers (lowest down payment, longest term).
  Future<Result<ProjectPlanSummary>> projectPlans(String projectId);
}

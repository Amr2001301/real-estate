import 'package:core/core_domain.dart';

import '../entities/broker_dashboard.dart';
import '../repositories/broker_dashboard_repository.dart';

class GetBrokerDashboard implements UseCase<BrokerDashboard, NoParams> {
  const GetBrokerDashboard(this._repo);
  final BrokerDashboardRepository _repo;

  @override
  Future<Result<BrokerDashboard>> call(NoParams params) => _repo.getDashboard();
}

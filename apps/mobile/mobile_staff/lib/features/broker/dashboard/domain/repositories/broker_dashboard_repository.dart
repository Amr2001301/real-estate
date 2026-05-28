import 'package:core/core_domain.dart';

import '../entities/broker_dashboard.dart';

abstract interface class BrokerDashboardRepository {
  Future<Result<BrokerDashboard>> getDashboard();
}

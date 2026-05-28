import 'package:core/core_domain.dart';

import '../entities/sales_dashboard.dart';

abstract interface class DashboardRepository {
  Future<Result<SalesDashboard>> getDashboard();
}

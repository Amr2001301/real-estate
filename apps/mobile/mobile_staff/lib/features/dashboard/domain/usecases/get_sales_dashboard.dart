import 'package:core/core_domain.dart';

import '../entities/sales_dashboard.dart';
import '../repositories/dashboard_repository.dart';

class GetSalesDashboard implements UseCase<SalesDashboard, NoParams> {
  const GetSalesDashboard(this._repo);
  final DashboardRepository _repo;

  @override
  Future<Result<SalesDashboard>> call(NoParams params) => _repo.getDashboard();
}

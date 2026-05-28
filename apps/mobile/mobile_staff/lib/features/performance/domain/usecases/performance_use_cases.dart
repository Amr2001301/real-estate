import 'package:core/core_domain.dart';

import '../entities/sales_performance.dart';
import '../repositories/performance_repository.dart';

class GetSalesPerformance implements UseCase<SalesPerformance, String?> {
  const GetSalesPerformance(this._repo);
  final PerformanceRepository _repo;

  @override
  Future<Result<SalesPerformance>> call(String? period) =>
      _repo.getPerformance(period: period);
}

class GetSalesTargets implements UseCase<List<SalesTarget>, NoParams> {
  const GetSalesTargets(this._repo);
  final PerformanceRepository _repo;

  @override
  Future<Result<List<SalesTarget>>> call(NoParams params) => _repo.getTargets();
}

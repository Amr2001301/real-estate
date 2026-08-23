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

class ListSalesActors implements UseCase<List<SalesActor>, NoParams> {
  const ListSalesActors(this._repo);
  final PerformanceRepository _repo;

  @override
  Future<Result<List<SalesActor>>> call(NoParams _) => _repo.listActors();
}

class GetTeamPerformance implements UseCase<List<TeamMemberPerformance>, String?> {
  const GetTeamPerformance(this._repo);
  final PerformanceRepository _repo;

  @override
  Future<Result<List<TeamMemberPerformance>>> call(String? period) =>
      _repo.getTeamPerformance(period: period);
}

class UpsertSalesTarget {
  const UpsertSalesTarget(this._repo);
  final PerformanceRepository _repo;

  Future<Result<void>> call({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  }) =>
      _repo.upsertTarget(
        salesId: salesId,
        period: period,
        amountTarget: amountTarget,
        unitsTarget: unitsTarget,
      );
}

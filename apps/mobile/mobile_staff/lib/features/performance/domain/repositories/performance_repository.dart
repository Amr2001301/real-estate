import 'package:core/core_domain.dart';

import '../entities/sales_performance.dart';

abstract interface class PerformanceRepository {
  /// Performance for [period] (YYYY-MM); current month when null.
  Future<Result<SalesPerformance>> getPerformance({String? period});

  /// Target definitions across periods (history).
  Future<Result<List<SalesTarget>>> getTargets();

  /// Users whose targets can be managed by this actor.
  Future<Result<List<SalesActor>>> listActors();

  /// All team members' performance (ADMIN / SALES_MANAGER).
  Future<Result<List<TeamMemberPerformance>>> getTeamPerformance({String? period});

  /// Creates or updates a target for [salesId] in [period].
  Future<Result<void>> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  });
}

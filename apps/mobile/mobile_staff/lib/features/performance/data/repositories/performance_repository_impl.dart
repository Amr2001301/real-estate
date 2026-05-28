import 'package:core/core.dart';

import '../../domain/entities/sales_performance.dart';
import '../../domain/repositories/performance_repository.dart';
import '../datasources/performance_remote_data_source.dart';
import '../mappers/performance_mapper.dart';

class PerformanceRepositoryImpl implements PerformanceRepository {
  PerformanceRepositoryImpl(this._remote);
  final PerformanceRemoteDataSource _remote;

  @override
  Future<Result<SalesPerformance>> getPerformance({String? period}) {
    return guardApiCall(() async {
      final dto = await _remote.getPerformance(period: period);
      // No row → a zeroed performance for the period (graceful "no data").
      return dto?.toEntity() ?? _empty(period ?? _currentPeriod());
    });
  }

  @override
  Future<Result<List<SalesTarget>>> getTargets() {
    return guardApiCall(() async {
      final rows = await _remote.listTargets();
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  static String _currentPeriod() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}';
  }

  SalesPerformance _empty(String period) => SalesPerformance(
        period: period,
        leadsCount: 0,
        openLeadsCount: 0,
        visitsCount: 0,
        upcomingVisitsCount: 0,
        reservationsCount: 0,
        activeReservationsCount: 0,
        convertedReservationsCount: 0,
        signedContractsCount: 0,
        realizedValue: 0,
        achievedAmount: 0,
        achievedUnits: 0,
      );
}

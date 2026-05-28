import 'package:core/core_domain.dart';

import '../entities/sales_performance.dart';

abstract interface class PerformanceRepository {
  /// Performance for [period] (YYYY-MM); current month when null.
  Future<Result<SalesPerformance>> getPerformance({String? period});

  /// Target definitions across periods (history).
  Future<Result<List<SalesTarget>>> getTargets();
}

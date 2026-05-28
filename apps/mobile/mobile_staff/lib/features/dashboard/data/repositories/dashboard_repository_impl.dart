import 'package:core/core.dart';

import '../../domain/entities/sales_dashboard.dart';
import '../../domain/repositories/dashboard_repository.dart';
import '../datasources/dashboard_remote_data_source.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl(this._remote);
  final DashboardRemoteDataSource _remote;

  @override
  Future<Result<SalesDashboard>> getDashboard() {
    return guardApiCall(() async {
      // Pipeline is required (drives the headline KPIs). Visit/reservation
      // stats are best-effort: a missing permission falls back to 0 rather
      // than failing the whole screen.
      final pipeline = await _remote.pipelineCounts();
      final visits = await _safe(_remote.visitStats);
      final reservations = await _safe(_remote.reservationStats);

      final total = pipeline.values.fold<int>(0, (a, b) => a + b);
      return SalesDashboard(
        pipeline: pipeline,
        totalLeads: total,
        wonLeads: pipeline['WON'] ?? 0,
        todayVisits: _int(visits['todayVisits']),
        scheduledVisits: _int(visits['scheduledVisits']),
        reservations: _int(reservations['total']),
      );
    });
  }

  Future<Map<String, dynamic>> _safe(
    Future<Map<String, dynamic>> Function() fn,
  ) async {
    try {
      return await fn();
    } catch (_) {
      return const {};
    }
  }

  int _int(Object? v) => (v as num?)?.toInt() ?? 0;
}

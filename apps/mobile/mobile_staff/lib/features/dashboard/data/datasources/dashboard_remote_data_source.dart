import 'package:dio/dio.dart';

/// Reads the three stat endpoints that feed the sales dashboard. Pipeline is
/// required; visit/reservation stats are best-effort (a missing permission
/// shouldn't blank the whole dashboard) — handled in the repository.
abstract interface class DashboardRemoteDataSource {
  Future<Map<String, int>> pipelineCounts();
  Future<Map<String, dynamic>> visitStats();
  Future<Map<String, dynamic>> reservationStats();
}

class DashboardRemoteDataSourceImpl implements DashboardRemoteDataSource {
  DashboardRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<Map<String, int>> pipelineCounts() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/pipeline');
    final data = res.data ?? const {};
    return data.map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));
  }

  @override
  Future<Map<String, dynamic>> visitStats() async {
    final res = await _dio.get<Map<String, dynamic>>('/visits/stats');
    return res.data ?? const {};
  }

  @override
  Future<Map<String, dynamic>> reservationStats() async {
    final res = await _dio.get<Map<String, dynamic>>('/reservations/stats');
    return res.data ?? const {};
  }
}

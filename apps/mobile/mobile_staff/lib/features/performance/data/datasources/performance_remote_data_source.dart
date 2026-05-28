import 'package:dio/dio.dart';

import '../dtos/performance_dtos.dart';

abstract interface class PerformanceRemoteDataSource {
  /// Returns the single self row, or null when the API returns no rows.
  Future<SalesPerformanceDto?> getPerformance({String? period});
  Future<List<SalesTargetDto>> listTargets();
}

class PerformanceRemoteDataSourceImpl implements PerformanceRemoteDataSource {
  PerformanceRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<SalesPerformanceDto?> getPerformance({String? period}) async {
    final res = await _dio.get<List<dynamic>>(
      '/sales-targets/performance',
      queryParameters: {'period': ?period},
    );
    final rows = (res.data ?? const []).whereType<Map<String, dynamic>>().toList();
    if (rows.isEmpty) return null;
    return SalesPerformanceDto.fromJson(rows.first);
  }

  @override
  Future<List<SalesTargetDto>> listTargets() async {
    final res = await _dio.get<List<dynamic>>('/sales-targets');
    final data = res.data ?? const [];
    return data.whereType<Map<String, dynamic>>().map(SalesTargetDto.fromJson).toList();
  }
}

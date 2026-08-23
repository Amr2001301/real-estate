import 'package:dio/dio.dart';

import '../dtos/performance_dtos.dart';

abstract interface class PerformanceRemoteDataSource {
  /// Returns the single self row, or null when the API returns no rows.
  Future<SalesPerformanceDto?> getPerformance({String? period});
  Future<List<SalesTargetDto>> listTargets();
  /// Returns all team members' performance rows (ADMIN / SALES_MANAGER).
  Future<List<TeamPerformanceRowDto>> getTeamPerformance({String? period});
  /// Returns users whose targets can be managed by this actor.
  Future<List<SalesActorDto>> listActors();
  /// Creates or updates a target for a specific sales rep.
  Future<void> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  });
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

  @override
  Future<List<SalesActorDto>> listActors() async {
    final res = await _dio.get<List<dynamic>>('/sales-targets/actors');
    final data = res.data ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(SalesActorDto.fromJson)
        .toList();
  }

  @override
  Future<List<TeamPerformanceRowDto>> getTeamPerformance({String? period}) async {
    final res = await _dio.get<List<dynamic>>(
      '/sales-targets/performance',
      queryParameters: {'period': ?period},
    );
    final data = res.data ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(TeamPerformanceRowDto.fromJson)
        .toList();
  }

  @override
  Future<void> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  }) async {
    await _dio.post<void>('/sales-targets', data: {
      'salesId': salesId,
      'period': period,
      'amountTarget': amountTarget,
      'unitsTarget': unitsTarget,
    });
  }
}

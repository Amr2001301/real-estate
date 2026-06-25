import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../domain/entities/maintenance_request.dart';
import '../dtos/maintenance_dtos.dart';

abstract interface class MaintenanceRemoteDataSource {
  Future<List<MaintenanceRequestDto>> listAssigned();
  Future<MaintenanceDetailDto> getOne(String id);
  Future<void> setStatus(String id, MaintenanceTransition transition);
  Future<void> confirmResolution(String id);
}

class MaintenanceRemoteDataSourceImpl implements MaintenanceRemoteDataSource {
  MaintenanceRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<MaintenanceRequestDto>> listAssigned() async {
    final res = await _dio.get<dynamic>(
      '/me/maintenance-requests',
      queryParameters: {'page': 1, 'pageSize': 100},
    );
    assert(() {
      debugPrint('[MaintenanceDS] listAssigned: ${res.data?.runtimeType}');
      return true;
    }());
    final data = _parseListResponse(res.data);
    return data.whereType<Map<String, dynamic>>().map(MaintenanceRequestDto.fromJson).toList();
  }

  static List<dynamic> _parseListResponse(dynamic data) {
    if (data is List) return data;
    if (data is Map<String, dynamic>) {
      final items = data['data'] ?? data['items'] ?? data['results'];
      if (items is List) return items;
    }
    return const [];
  }

  @override
  Future<MaintenanceDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/me/maintenance-requests/$id');
    return MaintenanceDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> setStatus(String id, MaintenanceTransition transition) async {
    await _dio.post<Map<String, dynamic>>(
      '/me/maintenance-requests/$id/status',
      data: {'status': transition.target.wire},
    );
  }

  @override
  Future<void> confirmResolution(String id) async {
    await _dio.post<Map<String, dynamic>>('/me/maintenance-requests/$id/supervisor-confirm');
  }
}

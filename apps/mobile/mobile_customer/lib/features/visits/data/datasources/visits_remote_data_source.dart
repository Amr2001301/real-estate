import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/visit_request_dto.dart';

/// Raw network access to `/me/visit-requests` (authenticated). May throw.
abstract interface class VisitsRemoteDataSource {
  Future<void> create(Map<String, dynamic> body);
  Future<Paginated<VisitRequestDto>> listMine(int page, int pageSize);
}

class VisitsRemoteDataSourceImpl implements VisitsRemoteDataSource {
  VisitsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<void> create(Map<String, dynamic> body) async {
    await _dio.post<Map<String, dynamic>>('/me/visit-requests', data: body);
  }

  @override
  Future<Paginated<VisitRequestDto>> listMine(int page, int pageSize) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/me/visit-requests',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    return Paginated.fromJson(res.data!, VisitRequestDto.fromJson);
  }
}

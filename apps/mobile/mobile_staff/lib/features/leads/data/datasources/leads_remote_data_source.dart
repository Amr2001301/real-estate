import 'package:dio/dio.dart';

import '../../domain/repositories/leads_repository.dart';
import '../dtos/lead_dtos.dart';

abstract interface class LeadsRemoteDataSource {
  Future<List<LeadRowDto>> list(LeadsQuery query);
  Future<LeadDetailDto> getOne(String id);
  Future<void> updateStage(String id, String stage, String? reason);
  Future<void> addNote(String id, String body);
}

class LeadsRemoteDataSourceImpl implements LeadsRemoteDataSource {
  LeadsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<LeadRowDto>> list(LeadsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/leads',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'stage': ?query.stage,
        'q': ?(query.search?.isNotEmpty == true ? query.search : null),
        if (query.mine) 'mine': '1',
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(LeadRowDto.fromJson)
        .toList();
  }

  @override
  Future<LeadDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/$id');
    return LeadDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> updateStage(String id, String stage, String? reason) async {
    await _dio.patch<Map<String, dynamic>>(
      '/leads/$id/stage',
      data: {'stage': stage, 'reason': ?reason},
    );
  }

  @override
  Future<void> addNote(String id, String body) async {
    await _dio.post<Map<String, dynamic>>(
      '/leads/$id/notes',
      data: {'body': body},
    );
  }
}

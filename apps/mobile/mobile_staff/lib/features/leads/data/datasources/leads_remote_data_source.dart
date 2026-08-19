import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/repositories/leads_repository.dart';
import '../dtos/lead_dtos.dart';

abstract interface class LeadsRemoteDataSource {
  Future<Paginated<LeadRowDto>> list(LeadsQuery query);
  Future<LeadDetailDto> getOne(String id);
  Future<void> updateStage(String id, String stage, String? reason);
  Future<void> addNote(String id, String body);
  Future<LeadRowDto> create(NewLead input);
  Future<List<LeadSourceDto>> listSources();
}

class LeadsRemoteDataSourceImpl implements LeadsRemoteDataSource {
  LeadsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<Paginated<LeadRowDto>> list(LeadsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/leads',
      queryParameters: {
        'page': query.page,
        'pageSize': 20,
        'stage': ?query.stage,
        'q': ?(query.search?.isNotEmpty == true ? query.search : null),
        if (query.mine) 'mine': '1',
        'sourceId': ?query.sourceId,
        'dateFrom': ?query.dateFrom,
        'dateTo': ?query.dateTo,
      },
    );
    final json = res.data ?? const <String, dynamic>{};
    final items = (json['data'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(LeadRowDto.fromJson)
        .toList();
    final meta = PageMeta(
      page: (json['page'] as num?)?.toInt() ?? query.page,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? items.length,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
    return Paginated(data: items, meta: meta);
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

  @override
  Future<LeadRowDto> create(NewLead input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/leads',
      data: {
        'fullName': input.fullName,
        'phone': ?input.phone,
        'email': ?input.email,
        'notes': ?input.notes,
      },
    );
    return LeadRowDto.fromJson(res.data ?? const {});
  }

  @override
  Future<List<LeadSourceDto>> listSources() async {
    final res = await _dio.get<List<dynamic>>('/lead-sources');
    return (res.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LeadSourceDto.fromJson)
        .toList();
  }
}

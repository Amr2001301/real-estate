import 'package:dio/dio.dart';

import '../../domain/entities/visit.dart';
import '../../domain/repositories/visits_repository.dart';
import '../dtos/visit_dtos.dart';

abstract interface class VisitsRemoteDataSource {
  Future<List<VisitDto>> list(VisitsQuery query);
  Future<VisitDetailDto> getOne(String id);
  Future<VisitDto> create(NewVisit input);
  Future<void> transition(String id, VisitTransition transition, String? notes, String? reason);
}

class VisitsRemoteDataSourceImpl implements VisitsRemoteDataSource {
  VisitsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<VisitDto>> list(VisitsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/visits/appointments',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'status': ?query.status,
        'leadId': ?query.leadId,
        if (query.today) 'today': '1',
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(VisitDto.fromJson).toList();
  }

  @override
  Future<VisitDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/visits/appointments/$id');
    return VisitDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<VisitDto> create(NewVisit input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/visits/appointments',
      data: {
        'projectId': input.projectId,
        'scheduledAt': input.scheduledAt.toUtc().toIso8601String(),
        'unitId': ?input.unitId,
        'leadId': ?input.leadId,
        'clientId': ?input.clientId,
        'location': ?input.location,
        'salesNotes': ?input.salesNotes,
      },
    );
    return VisitDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> transition(
    String id,
    VisitTransition transition,
    String? notes,
    String? reason,
  ) async {
    final path = switch (transition) {
      VisitTransition.confirm => 'confirm',
      VisitTransition.complete => 'complete',
      VisitTransition.cancel => 'cancel',
      VisitTransition.noShow => 'no-show',
    };
    final data = <String, dynamic>{
      'salesNotes': ?notes,
      if (transition == VisitTransition.cancel) 'cancellationReason': ?reason,
      if (transition == VisitTransition.noShow) 'noShowReason': ?reason,
    };
    await _dio.post<Map<String, dynamic>>('/visits/appointments/$id/$path', data: data);
  }
}

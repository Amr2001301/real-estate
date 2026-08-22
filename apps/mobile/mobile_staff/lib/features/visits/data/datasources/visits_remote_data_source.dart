import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/entities/visit.dart';
import '../../domain/repositories/visits_repository.dart';
import '../dtos/visit_dtos.dart';

abstract interface class VisitsRemoteDataSource {
  Future<Paginated<VisitDto>> list(VisitsQuery query);
  Future<VisitDetailDto> getOne(String id);
  Future<VisitDto> create(NewVisit input);
  Future<void> transition(String id, VisitTransition transition, String? notes, String? reason);
  Future<void> reschedule(String id, DateTime scheduledAt, {String? salesNotes});
  Future<void> assign(String id, String assignedSalesId);
  Future<void> salesFeedback(String id, {int? rating, String? notes});
}

class VisitsRemoteDataSourceImpl implements VisitsRemoteDataSource {
  VisitsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<Paginated<VisitDto>> list(VisitsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/visits/appointments',
      queryParameters: {
        'page': query.page,
        'pageSize': 20,
        'status': ?query.status,
        'leadId': ?query.leadId,
        if (query.today) 'today': '1',
      },
    );
    final json = res.data ?? const <String, dynamic>{};
    final items = (json['data'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(VisitDto.fromJson)
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
        'customerName': ?input.customerName,
        'customerPhone': ?input.customerPhone,
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

  @override
  Future<void> reschedule(String id, DateTime scheduledAt, {String? salesNotes}) async {
    await _dio.post<void>('/visits/appointments/$id/reschedule', data: {
      'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'salesNotes': ?salesNotes,
    });
  }

  @override
  Future<void> assign(String id, String assignedSalesId) async {
    await _dio.patch<void>('/visits/appointments/$id/assign',
        data: {'assignedSalesId': assignedSalesId});
  }

  @override
  Future<void> salesFeedback(String id, {int? rating, String? notes}) async {
    await _dio.post<void>('/visits/appointments/$id/sales-feedback', data: {
      'rating': ?rating,
      'notes': ?notes,
    });
  }
}

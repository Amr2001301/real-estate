import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/visit_request_dto.dart';

/// Raw network access to `/me/visit-requests` + `/me/visit-appointments/*`
/// (authenticated). May throw — the repository wraps everything in
/// `guardApiCall` so the presentation layer only sees `Result<T>`.
abstract interface class VisitsRemoteDataSource {
  Future<void> create(Map<String, dynamic> body);
  Future<Paginated<VisitRequestDto>> listMine(int page, int pageSize);

  /// P2 — customer confirms an admin-proposed appointment.
  /// POST /me/visit-appointments/:id/confirm.
  Future<void> confirmAppointment(String appointmentId);

  /// P2 — customer asks to reschedule an admin-proposed appointment.
  /// POST /me/visit-appointments/:id/request-reschedule. Optional reason.
  Future<void> requestReschedule(String appointmentId, {String? reason});
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

  @override
  Future<void> confirmAppointment(String appointmentId) async {
    await _dio.post<Map<String, dynamic>>(
      '/me/visit-appointments/$appointmentId/confirm',
      data: const <String, dynamic>{},
    );
  }

  @override
  Future<void> requestReschedule(String appointmentId, {String? reason}) async {
    final trimmed = reason?.trim();
    await _dio.post<Map<String, dynamic>>(
      '/me/visit-appointments/$appointmentId/request-reschedule',
      // Send `reason` only when non-empty so the backend treats omission and
      // an empty string the same way (== "no reason given").
      data: {if (trimmed != null && trimmed.isNotEmpty) 'reason': trimmed},
    );
  }
}

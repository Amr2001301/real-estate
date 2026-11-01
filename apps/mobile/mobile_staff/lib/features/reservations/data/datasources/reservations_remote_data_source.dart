import 'package:dio/dio.dart';

import '../../domain/entities/reservation.dart';
import '../../domain/repositories/reservations_repository.dart';
import '../dtos/reservation_dtos.dart';

abstract interface class ReservationsRemoteDataSource {
  Future<List<ReservationDto>> list(ReservationsQuery query);
  Future<ReservationDetailDto> getOne(String id);
  Future<ReservationDto> create(NewReservation input);
  Future<void> addNote(String id, String body);
  Future<void> approve(String id);
  Future<void> reject(String id, String? reason);
}

class ReservationsRemoteDataSourceImpl implements ReservationsRemoteDataSource {
  ReservationsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<ReservationDto>> list(ReservationsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/reservations',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'status': ?query.status,
        'unitId': ?query.unitId,
        'leadId': ?query.leadId,
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(ReservationDto.fromJson).toList();
  }

  @override
  Future<ReservationDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/reservations/$id');
    return ReservationDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<ReservationDto> create(NewReservation input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/reservations',
      data: {
        'unitId': input.unitId,
        'leadId': ?input.leadId,
        'clientId': ?input.clientId,
        'notes': ?input.notes,
        'expiresInHours': ?input.expiresInHours,
        'installmentPlanTemplateId': ?input.installmentPlanTemplateId,
        'bookingNotes': ?input.bookingNotes,
        'bookingAmountMode': ?input.bookingAmountMode,
        'bookingAmount': ?input.bookingAmount,
        'bookingAmountPercent': ?input.bookingAmountPercent,
      },
    );
    return ReservationDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> addNote(String id, String body) async {
    await _dio.post<Map<String, dynamic>>('/reservations/$id/notes', data: {'body': body});
  }

  @override
  Future<void> approve(String id) async {
    await _dio.post<dynamic>('/reservations/$id/approve', data: const <String, dynamic>{});
  }

  @override
  Future<void> reject(String id, String? reason) async {
    await _dio.post<dynamic>('/reservations/$id/reject', data: {'reason': ?reason});
  }
}

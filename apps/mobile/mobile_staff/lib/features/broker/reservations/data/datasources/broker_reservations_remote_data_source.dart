import 'package:dio/dio.dart';

import '../../domain/entities/broker_reservation.dart';
import '../../domain/repositories/broker_reservations_repository.dart';
import '../dtos/broker_reservation_dtos.dart';

abstract interface class BrokerReservationsRemoteDataSource {
  Future<List<BrokerReservationDto>> list(BrokerReservationsQuery query);
  Future<BrokerReservationDto> getOne(String id);
  Future<BrokerReservationDto> create(NewBrokerReservation input);
}

class BrokerReservationsRemoteDataSourceImpl implements BrokerReservationsRemoteDataSource {
  BrokerReservationsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  List<BrokerReservationDto> _parseList(dynamic body) {
    final list = body is Map<String, dynamic> ? (body['data'] as List? ?? const []) : (body as List? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(BrokerReservationDto.fromJson).toList();
  }

  @override
  Future<List<BrokerReservationDto>> list(BrokerReservationsQuery query) async {
    final res = await _dio.get<dynamic>(
      '/portal/reservations',
      queryParameters: {'status': ?query.status},
    );
    return _parseList(res.data);
  }

  @override
  Future<BrokerReservationDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/portal/reservations/$id');
    return BrokerReservationDto.fromJson(res.data ?? const {});
  }

  @override
  Future<BrokerReservationDto> create(NewBrokerReservation input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/portal/reservations',
      data: {
        'leadId': input.leadId,
        'unitId': input.unitId,
        'notes': ?input.notes,
        'expiresInHours': ?input.expiresInHours,
      },
    );
    return BrokerReservationDto.fromJson(res.data ?? const {});
  }
}

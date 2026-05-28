import 'package:core/core.dart';

import '../../domain/entities/broker_reservation.dart';
import '../../domain/repositories/broker_reservations_repository.dart';
import '../datasources/broker_reservations_remote_data_source.dart';
import '../mappers/broker_reservation_mapper.dart';

class BrokerReservationsRepositoryImpl implements BrokerReservationsRepository {
  BrokerReservationsRepositoryImpl(this._remote);
  final BrokerReservationsRemoteDataSource _remote;

  @override
  Future<Result<List<BrokerReservation>>> getReservations(BrokerReservationsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<BrokerReservationDetail>> getReservation(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toDetail());
  }

  @override
  Future<Result<BrokerReservation>> createReservation(NewBrokerReservation input) {
    return guardApiCall(() async => (await _remote.create(input)).toEntity());
  }
}

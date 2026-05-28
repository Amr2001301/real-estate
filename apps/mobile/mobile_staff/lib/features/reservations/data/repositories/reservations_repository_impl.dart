import 'package:core/core.dart';

import '../../domain/entities/reservation.dart';
import '../../domain/repositories/reservations_repository.dart';
import '../datasources/reservations_remote_data_source.dart';
import '../mappers/reservation_mapper.dart';

class ReservationsRepositoryImpl implements ReservationsRepository {
  ReservationsRepositoryImpl(this._remote);
  final ReservationsRemoteDataSource _remote;

  @override
  Future<Result<List<Reservation>>> getReservations(ReservationsQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.list(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<ReservationDetail>> getReservation(String id) {
    return guardApiCall(() async => (await _remote.getOne(id)).toEntity());
  }

  @override
  Future<Result<Reservation>> createReservation(NewReservation input) {
    return guardApiCall(() async => (await _remote.create(input)).toEntity());
  }

  @override
  Future<Result<void>> addNote(String id, String body) {
    return guardApiCall(() => _remote.addNote(id, body));
  }
}

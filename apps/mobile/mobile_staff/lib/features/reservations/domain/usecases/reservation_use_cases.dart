import 'package:core/core_domain.dart';

import '../entities/reservation.dart';
import '../repositories/reservations_repository.dart';

class GetReservations implements UseCase<List<Reservation>, ReservationsQuery> {
  const GetReservations(this._repo);
  final ReservationsRepository _repo;

  @override
  Future<Result<List<Reservation>>> call(ReservationsQuery params) =>
      _repo.getReservations(params);
}

class GetReservationDetail implements UseCase<ReservationDetail, String> {
  const GetReservationDetail(this._repo);
  final ReservationsRepository _repo;

  @override
  Future<Result<ReservationDetail>> call(String id) => _repo.getReservation(id);
}

class CreateReservation implements UseCase<Reservation, NewReservation> {
  const CreateReservation(this._repo);
  final ReservationsRepository _repo;

  @override
  Future<Result<Reservation>> call(NewReservation params) => _repo.createReservation(params);
}

class AddReservationNoteParams {
  const AddReservationNoteParams({required this.id, required this.body});
  final String id;
  final String body;
}

class AddReservationNote implements UseCase<void, AddReservationNoteParams> {
  const AddReservationNote(this._repo);
  final ReservationsRepository _repo;

  @override
  Future<Result<void>> call(AddReservationNoteParams params) =>
      _repo.addNote(params.id, params.body);
}

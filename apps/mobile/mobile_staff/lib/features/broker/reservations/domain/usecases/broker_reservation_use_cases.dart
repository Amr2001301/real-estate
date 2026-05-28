import 'package:core/core_domain.dart';

import '../entities/broker_reservation.dart';
import '../repositories/broker_reservations_repository.dart';

class GetBrokerReservations implements UseCase<List<BrokerReservation>, BrokerReservationsQuery> {
  const GetBrokerReservations(this._repo);
  final BrokerReservationsRepository _repo;

  @override
  Future<Result<List<BrokerReservation>>> call(BrokerReservationsQuery params) =>
      _repo.getReservations(params);
}

class GetBrokerReservationDetail implements UseCase<BrokerReservationDetail, String> {
  const GetBrokerReservationDetail(this._repo);
  final BrokerReservationsRepository _repo;

  @override
  Future<Result<BrokerReservationDetail>> call(String id) => _repo.getReservation(id);
}

class CreateBrokerReservation implements UseCase<BrokerReservation, NewBrokerReservation> {
  const CreateBrokerReservation(this._repo);
  final BrokerReservationsRepository _repo;

  @override
  Future<Result<BrokerReservation>> call(NewBrokerReservation params) =>
      _repo.createReservation(params);
}

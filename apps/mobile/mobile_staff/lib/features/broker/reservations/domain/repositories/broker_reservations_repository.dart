import 'package:core/core_domain.dart';

import '../entities/broker_reservation.dart';

class BrokerReservationsQuery {
  const BrokerReservationsQuery({this.status});
  final String? status;
}

abstract interface class BrokerReservationsRepository {
  Future<Result<List<BrokerReservation>>> getReservations(BrokerReservationsQuery query);
  Future<Result<BrokerReservationDetail>> getReservation(String id);
  Future<Result<BrokerReservation>> createReservation(NewBrokerReservation input);
}

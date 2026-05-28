import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_reservation.dart';
import '../../domain/repositories/broker_reservations_repository.dart';
import '../../domain/usecases/broker_reservation_use_cases.dart';

class BrokerReservationsListState extends Equatable {
  const BrokerReservationsListState({
    this.status = DataStatus.initial,
    this.reservations = const [],
    this.failure,
    this.statusFilter,
  });

  final DataStatus status;
  final List<BrokerReservation> reservations;
  final AppFailure? failure;
  final String? statusFilter;

  BrokerReservationsListState copyWith({
    DataStatus? status,
    List<BrokerReservation>? reservations,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
  }) =>
      BrokerReservationsListState(
        status: status ?? this.status,
        reservations: reservations ?? this.reservations,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
      );

  @override
  List<Object?> get props => [status, reservations, failure, statusFilter];
}

class BrokerReservationsCubit extends Cubit<BrokerReservationsListState> {
  BrokerReservationsCubit(this._getReservations) : super(const BrokerReservationsListState());

  final GetBrokerReservations _getReservations;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getReservations(BrokerReservationsQuery(status: state.statusFilter));
    result.when(
      ok: (items) => emit(state.copyWith(
        status: items.isEmpty ? DataStatus.empty : DataStatus.success,
        reservations: items,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setStatus(String? status) async {
    emit(status == null
        ? state.copyWith(clearStatusFilter: true)
        : state.copyWith(statusFilter: status));
    await load();
  }
}

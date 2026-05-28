import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/reservation.dart';
import '../../domain/repositories/reservations_repository.dart';
import '../../domain/usecases/reservation_use_cases.dart';

class ReservationsListState extends Equatable {
  const ReservationsListState({
    this.status = DataStatus.initial,
    this.reservations = const [],
    this.failure,
    this.statusFilter,
  });

  final DataStatus status;
  final List<Reservation> reservations;
  final AppFailure? failure;
  final String? statusFilter;

  ReservationsListState copyWith({
    DataStatus? status,
    List<Reservation>? reservations,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
  }) =>
      ReservationsListState(
        status: status ?? this.status,
        reservations: reservations ?? this.reservations,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
      );

  @override
  List<Object?> get props => [status, reservations, failure, statusFilter];
}

class ReservationsCubit extends Cubit<ReservationsListState> {
  ReservationsCubit(this._getReservations) : super(const ReservationsListState());

  final GetReservations _getReservations;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getReservations(ReservationsQuery(status: state.statusFilter));
    result.when(
      ok: (reservations) => emit(state.copyWith(
        status: reservations.isEmpty ? DataStatus.empty : DataStatus.success,
        reservations: reservations,
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

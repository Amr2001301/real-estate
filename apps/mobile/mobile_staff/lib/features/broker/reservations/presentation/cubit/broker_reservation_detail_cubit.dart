import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_reservation.dart';
import '../../domain/usecases/broker_reservation_use_cases.dart';

typedef BrokerReservationDetailState = DataState<BrokerReservationDetail>;

class BrokerReservationDetailCubit extends Cubit<BrokerReservationDetailState> {
  BrokerReservationDetailCubit(this._getDetail, {required this.reservationId})
      : super(const BrokerReservationDetailState.initial());

  final GetBrokerReservationDetail _getDetail;
  final String reservationId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDetail(reservationId);
    result.when(
      ok: (detail) => emit(BrokerReservationDetailState.success(detail)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}

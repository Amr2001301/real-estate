import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_dashboard.dart';
import '../../domain/usecases/get_broker_dashboard.dart';

typedef BrokerDashboardState = DataState<BrokerDashboard>;

class BrokerDashboardCubit extends Cubit<BrokerDashboardState> {
  BrokerDashboardCubit(this._getDashboard) : super(const BrokerDashboardState.initial());

  final GetBrokerDashboard _getDashboard;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDashboard(const NoParams());
    result.when(
      ok: (dashboard) => emit(BrokerDashboardState.success(dashboard)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}

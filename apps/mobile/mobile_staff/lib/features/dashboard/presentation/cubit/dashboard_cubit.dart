import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/sales_dashboard.dart';
import '../../domain/usecases/get_sales_dashboard.dart';

typedef DashboardState = DataState<SalesDashboard>;

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(this._getDashboard) : super(const DashboardState.initial());

  final GetSalesDashboard _getDashboard;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDashboard(const NoParams());
    result.when(
      ok: (dashboard) => emit(DashboardState.success(dashboard)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/maintenance_request.dart';
import '../domain/usecases/maintenance_use_cases.dart';

typedef MaintenanceRequestsState = DataState<List<MaintenanceRequest>>;

class MaintenanceRequestsCubit extends Cubit<MaintenanceRequestsState> {
  MaintenanceRequestsCubit(this._getMyRequests)
      : super(const MaintenanceRequestsState.initial());

  final GetMyMaintenanceRequests _getMyRequests;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyRequests(const NoParams());
    result.when(
      ok: (requests) => emit(
        requests.isEmpty
            ? const MaintenanceRequestsState.empty()
            : MaintenanceRequestsState.success(requests),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}

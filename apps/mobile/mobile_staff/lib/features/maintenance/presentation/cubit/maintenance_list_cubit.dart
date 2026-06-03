import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/maintenance_request.dart';
import '../../domain/usecases/maintenance_use_cases.dart';

class MaintenanceListState extends Equatable {
  const MaintenanceListState({
    this.status = DataStatus.initial,
    this.requests = const [],
    this.failure,
  });

  final DataStatus status;
  final List<MaintenanceRequest> requests;
  final AppFailure? failure;

  MaintenanceListState copyWith({
    DataStatus? status,
    List<MaintenanceRequest>? requests,
    AppFailure? failure,
  }) =>
      MaintenanceListState(
        status: status ?? this.status,
        requests: requests ?? this.requests,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, requests, failure];
}

class MaintenanceListCubit extends Cubit<MaintenanceListState> {
  MaintenanceListCubit(this._getAssigned) : super(const MaintenanceListState());

  final GetAssignedMaintenance _getAssigned;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getAssigned(const NoParams());
    result.when(
      ok: (rows) => emit(state.copyWith(
        status: rows.isEmpty ? DataStatus.empty : DataStatus.success,
        requests: rows,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}

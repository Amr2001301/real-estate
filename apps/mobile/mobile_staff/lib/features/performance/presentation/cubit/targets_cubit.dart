import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/sales_performance.dart';
import '../../domain/usecases/performance_use_cases.dart';

class TargetsState extends Equatable {
  const TargetsState({
    this.status = DataStatus.initial,
    this.performance,
    this.targets = const [],
    this.failure,
  });

  final DataStatus status;
  final SalesPerformance? performance;
  final List<SalesTarget> targets;
  final AppFailure? failure;

  TargetsState copyWith({
    DataStatus? status,
    SalesPerformance? performance,
    List<SalesTarget>? targets,
    AppFailure? failure,
  }) =>
      TargetsState(
        status: status ?? this.status,
        performance: performance ?? this.performance,
        targets: targets ?? this.targets,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, performance, targets, failure];
}

/// Loads current-period performance (progress cards) + the target history.
/// Performance is required; the target list is best-effort on top.
class TargetsCubit extends Cubit<TargetsState> {
  TargetsCubit(this._getPerformance, this._getTargets) : super(const TargetsState());

  final GetSalesPerformance _getPerformance;
  final GetSalesTargets _getTargets;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final perf = await _getPerformance(null);
    await perf.when(
      ok: (performance) async {
        final targetsResult = await _getTargets(const NoParams());
        emit(state.copyWith(
          status: DataStatus.success,
          performance: performance,
          targets: targetsResult.dataOrNull ?? const [],
        ));
      },
      err: (failure) async => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}

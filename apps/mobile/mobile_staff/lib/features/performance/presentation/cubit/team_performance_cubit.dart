import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/sales_performance.dart';
import '../../domain/usecases/performance_use_cases.dart';

class TeamPerformanceState extends Equatable {
  const TeamPerformanceState({
    this.status = DataStatus.initial,
    this.members = const [],
    this.period,
    this.failure,
  });

  final DataStatus status;
  final List<TeamMemberPerformance> members;
  final String? period;
  final AppFailure? failure;

  TeamPerformanceState copyWith({
    DataStatus? status,
    List<TeamMemberPerformance>? members,
    String? period,
    AppFailure? failure,
  }) =>
      TeamPerformanceState(
        status: status ?? this.status,
        members: members ?? this.members,
        period: period ?? this.period,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, members, period, failure];
}

class TeamPerformanceCubit extends Cubit<TeamPerformanceState> {
  TeamPerformanceCubit(this._getTeamPerformance) : super(const TeamPerformanceState());

  final GetTeamPerformance _getTeamPerformance;

  Future<void> load({String? period}) async {
    emit(state.copyWith(status: DataStatus.loading, period: period));
    final result = await _getTeamPerformance(period);
    result.when(
      ok: (members) => emit(state.copyWith(
        status: members.isEmpty ? DataStatus.empty : DataStatus.success,
        members: members,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}

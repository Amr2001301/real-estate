import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/sales_performance.dart';
import '../../domain/usecases/performance_use_cases.dart';

class TeamTargetsState extends Equatable {
  const TeamTargetsState({
    this.status = DataStatus.initial,
    this.targets = const [],
    this.actors = const [],
    this.period,
    this.savingId,
    this.failure,
  });

  final DataStatus status;
  final List<SalesTarget> targets;
  final List<SalesActor> actors;
  final String? period;
  final String? savingId;
  final AppFailure? failure;

  bool get isSaving => savingId != null;

  // Summary KPIs derived from loaded targets
  int get targetCount => targets.length;
  int get totalUnitsTarget =>
      targets.fold(0, (s, t) => s + t.unitsTarget);
  double get totalAmountTarget => targets.fold(
      0.0, (s, t) => s + (double.tryParse(t.amountTarget) ?? 0.0));

  TeamTargetsState copyWith({
    DataStatus? status,
    List<SalesTarget>? targets,
    List<SalesActor>? actors,
    String? period,
    String? savingId,
    bool clearSavingId = false,
    AppFailure? failure,
    bool clearFailure = false,
  }) =>
      TeamTargetsState(
        status: status ?? this.status,
        targets: targets ?? this.targets,
        actors: actors ?? this.actors,
        period: period ?? this.period,
        savingId: clearSavingId ? null : savingId ?? this.savingId,
        failure: clearFailure ? null : failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, targets, actors, period, savingId, failure];
}

class TeamTargetsCubit extends Cubit<TeamTargetsState> {
  TeamTargetsCubit(this._listActors, this._getTargets, this._upsertTarget)
      : super(const TeamTargetsState());

  final ListSalesActors _listActors;
  final GetSalesTargets _getTargets;
  final UpsertSalesTarget _upsertTarget;

  Future<void> load({String? period}) async {
    final p = period ?? _currentPeriod();
    emit(state.copyWith(status: DataStatus.loading, period: p));

    final results = await Future.wait([
      _listActors(const NoParams()),
      _getTargets(const NoParams()),
    ]);

    final actorsResult = results[0] as Result<List<SalesActor>>;
    final targetsResult = results[1] as Result<List<SalesTarget>>;

    // Actors are best-effort — don't fail on missing actors
    final actors = actorsResult.dataOrNull ?? const [];

    await targetsResult.when(
      ok: (targets) async => emit(state.copyWith(
        status: targets.isEmpty ? DataStatus.empty : DataStatus.success,
        targets: targets,
        actors: actors,
      )),
      err: (failure) async => emit(state.copyWith(
        status: DataStatus.failure,
        actors: actors,
        failure: failure,
      )),
    );
  }

  Future<bool> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  }) async {
    emit(state.copyWith(savingId: salesId, clearFailure: true));
    final result = await _upsertTarget(
      salesId: salesId,
      period: period,
      amountTarget: amountTarget,
      unitsTarget: unitsTarget,
    );
    return result.when(
      ok: (_) {
        emit(state.copyWith(clearSavingId: true));
        load(period: state.period);
        return true;
      },
      err: (failure) {
        emit(state.copyWith(clearSavingId: true, failure: failure));
        return false;
      },
    );
  }

  static String _currentPeriod() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}';
  }
}

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/bonus_entry.dart';
import '../../domain/repositories/bonus_repository.dart';
import '../../domain/usecases/get_bonus_entries.dart';

class BonusState extends Equatable {
  const BonusState({
    this.status = DataStatus.initial,
    this.entries = const [],
    this.overview = const BonusOverview(paidTotal: 0, pendingTotal: 0, count: 0),
    this.failure,
    this.statusFilter,
  });

  final DataStatus status;
  final List<BonusEntry> entries;
  final BonusOverview overview;
  final AppFailure? failure;
  final String? statusFilter;

  BonusState copyWith({
    DataStatus? status,
    List<BonusEntry>? entries,
    BonusOverview? overview,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
  }) =>
      BonusState(
        status: status ?? this.status,
        entries: entries ?? this.entries,
        overview: overview ?? this.overview,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
      );

  @override
  List<Object?> get props => [status, entries, overview, failure, statusFilter];
}

class BonusCubit extends Cubit<BonusState> {
  BonusCubit(this._getEntries) : super(const BonusState());

  final GetBonusEntries _getEntries;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getEntries(BonusQuery(status: state.statusFilter));
    result.when(
      ok: (entries) => emit(state.copyWith(
        status: entries.isEmpty ? DataStatus.empty : DataStatus.success,
        entries: entries,
        // Overview reflects all entries regardless of the chip filter when
        // unfiltered; with a filter it reflects the filtered set.
        overview: bonusOverviewOf(entries),
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

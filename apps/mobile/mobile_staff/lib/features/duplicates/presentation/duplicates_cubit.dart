import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/duplicates.dart';

class DuplicatesState extends Equatable {
  const DuplicatesState({
    this.status = DataStatus.initial,
    this.groups = const [],
    this.failure,
    this.keep = const {},
    this.chosen = const {},
    this.merging,
    this.actionFailure,
    this.merged,
  });

  final DataStatus status;
  final List<DuplicateGroup> groups;
  final AppFailure? failure;

  /// Per customer: the lead kept, and the leads ticked to fold into it.
  final Map<String, String> keep;
  final Map<String, Set<String>> chosen;

  /// The customer whose leads are being merged.
  final String? merging;
  final AppFailure? actionFailure;

  /// How many leads the last merge folded in (for the confirmation).
  final int? merged;

  String keepOf(DuplicateGroup g) => keep[g.clientId] ?? g.suggestedKeep.id;

  /// What a merge would fold in: the ticked, mergeable leads other than the kept one.
  List<String> toMerge(DuplicateGroup g) {
    final k = keepOf(g);
    final ticked = chosen[g.clientId];
    return [
      for (final l in g.leads)
        if (l.id != k && l.mergeable && (ticked == null || ticked.contains(l.id))) l.id,
    ];
  }

  DuplicatesState copyWith({
    DataStatus? status,
    List<DuplicateGroup>? groups,
    AppFailure? failure,
    Map<String, String>? keep,
    Map<String, Set<String>>? chosen,
    String? merging,
    bool clearMerging = false,
    AppFailure? actionFailure,
    int? merged,
    bool clearAction = false,
  }) =>
      DuplicatesState(
        status: status ?? this.status,
        groups: groups ?? this.groups,
        failure: failure ?? this.failure,
        keep: keep ?? this.keep,
        chosen: chosen ?? this.chosen,
        merging: clearMerging ? null : (merging ?? this.merging),
        actionFailure: clearAction ? null : (actionFailure ?? this.actionFailure),
        merged: clearAction ? null : (merged ?? this.merged),
      );

  @override
  List<Object?> get props => [status, groups, failure, keep, chosen, merging, actionFailure, merged];
}

/// «العملاء المكررين»: a customer's open leads, one kept and the others merged in.
class DuplicatesCubit extends Cubit<DuplicatesState> {
  DuplicatesCubit(this._repo) : super(const DuplicatesState());
  final DuplicatesRepository _repo;

  Future<void> load() async {
    if (state.groups.isEmpty) emit(state.copyWith(status: DataStatus.loading));
    final result = await _repo.list();
    result.when(
      ok: (groups) => emit(state.copyWith(
        status: groups.isEmpty ? DataStatus.empty : DataStatus.success,
        groups: groups,
        keep: const {},
        chosen: const {},
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  /// Keep another lead; every other mergeable one is ticked again.
  void pickKeep(DuplicateGroup g, String leadId) {
    emit(state.copyWith(
      keep: {...state.keep, g.clientId: leadId},
      chosen: {...state.chosen}..remove(g.clientId),
    ));
  }

  void toggle(DuplicateGroup g, String leadId) {
    final current = state.chosen[g.clientId] ?? state.toMerge(g).toSet();
    final next = {...current};
    if (!next.remove(leadId)) next.add(leadId);
    emit(state.copyWith(chosen: {...state.chosen, g.clientId: next}));
  }

  Future<void> merge(DuplicateGroup g) async {
    final ids = state.toMerge(g);
    if (ids.isEmpty || state.merging != null) return;
    emit(state.copyWith(merging: g.clientId, clearAction: true));
    final result = await _repo.merge(state.keepOf(g), ids);
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(clearMerging: true, actionFailure: failure));
      return;
    }
    await load();
    emit(state.copyWith(clearMerging: true, merged: result.dataOrNull));
  }
}

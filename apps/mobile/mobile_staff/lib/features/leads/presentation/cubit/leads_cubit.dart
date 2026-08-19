import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

class LeadsListState extends Equatable {
  const LeadsListState({
    this.status = DataStatus.initial,
    this.leads = const [],
    this.failure,
    this.stage,
    this.search = '',
    this.mine = false,
    this.page = 1,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  final DataStatus status;
  final List<Lead> leads;
  final AppFailure? failure;
  final String? stage;
  final String search;
  final bool mine;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  LeadsListState copyWith({
    DataStatus? status,
    List<Lead>? leads,
    AppFailure? failure,
    String? stage,
    bool clearStage = false,
    String? search,
    bool? mine,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      LeadsListState(
        status: status ?? this.status,
        leads: leads ?? this.leads,
        failure: failure ?? this.failure,
        stage: clearStage ? null : (stage ?? this.stage),
        search: search ?? this.search,
        mine: mine ?? this.mine,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );

  @override
  List<Object?> get props =>
      [status, leads, failure, stage, search, mine, page, hasMore, isLoadingMore];
}

class LeadsCubit extends Cubit<LeadsListState> {
  LeadsCubit(this._getLeads) : super(const LeadsListState());

  final GetLeads _getLeads;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1, hasMore: false));
    final result = await _getLeads(
      LeadsQuery(stage: state.stage, search: state.search, mine: state.mine, page: 1),
    );
    result.when(
      ok: (paged) => emit(state.copyWith(
        status: paged.data.isEmpty ? DataStatus.empty : DataStatus.success,
        leads: paged.data,
        page: 1,
        hasMore: paged.hasMore,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;
    final nextPage = state.page + 1;
    emit(state.copyWith(isLoadingMore: true));
    final result = await _getLeads(
      LeadsQuery(stage: state.stage, search: state.search, mine: state.mine, page: nextPage),
    );
    result.when(
      ok: (paged) => emit(state.copyWith(
        leads: [...state.leads, ...paged.data],
        page: nextPage,
        hasMore: paged.hasMore,
        isLoadingMore: false,
      )),
      err: (_) => emit(state.copyWith(isLoadingMore: false)),
    );
  }

  Future<void> setStage(String? stage) async {
    emit(stage == null ? state.copyWith(clearStage: true) : state.copyWith(stage: stage));
    await load();
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }

  Future<void> toggleMine() async {
    emit(state.copyWith(mine: !state.mine));
    await load();
  }
}

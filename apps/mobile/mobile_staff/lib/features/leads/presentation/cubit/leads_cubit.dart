import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

export '../../domain/repositories/leads_repository.dart' show LeadSource;

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
    this.sourceId,
    this.dateFrom,
    this.dateTo,
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
  final String? sourceId;
  final String? dateFrom;
  final String? dateTo;

  bool get hasAdvancedFilters => sourceId != null || dateFrom != null || dateTo != null;

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
    String? sourceId,
    bool clearSourceId = false,
    String? dateFrom,
    bool clearDateFrom = false,
    String? dateTo,
    bool clearDateTo = false,
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
        sourceId: clearSourceId ? null : (sourceId ?? this.sourceId),
        dateFrom: clearDateFrom ? null : (dateFrom ?? this.dateFrom),
        dateTo: clearDateTo ? null : (dateTo ?? this.dateTo),
      );

  @override
  List<Object?> get props =>
      [status, leads, failure, stage, search, mine, page, hasMore, isLoadingMore,
       sourceId, dateFrom, dateTo];
}

class LeadsCubit extends Cubit<LeadsListState> {
  LeadsCubit(this._getLeads, this._repo) : super(const LeadsListState());

  final GetLeads _getLeads;
  final LeadsRepository _repo;

  Future<List<LeadSource>> fetchSources() async {
    final result = await _repo.getSources();
    return result.when(ok: (list) => list, err: (_) => const []);
  }

  LeadsQuery _buildQuery({int page = 1}) => LeadsQuery(
        stage: state.stage,
        search: state.search,
        mine: state.mine,
        page: page,
        sourceId: state.sourceId,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      );

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1, hasMore: false));
    final result = await _getLeads(_buildQuery());
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
    final result = await _getLeads(_buildQuery(page: nextPage));
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

  Future<void> setAdvancedFilters({
    String? sourceId,
    bool clearSourceId = false,
    String? dateFrom,
    bool clearDateFrom = false,
    String? dateTo,
    bool clearDateTo = false,
  }) async {
    emit(state.copyWith(
      sourceId: sourceId,
      clearSourceId: clearSourceId,
      dateFrom: dateFrom,
      clearDateFrom: clearDateFrom,
      dateTo: dateTo,
      clearDateTo: clearDateTo,
    ));
    await load();
  }

  Future<void> clearAdvancedFilters() async {
    emit(state.copyWith(
      clearSourceId: true,
      clearDateFrom: true,
      clearDateTo: true,
    ));
    await load();
  }
}

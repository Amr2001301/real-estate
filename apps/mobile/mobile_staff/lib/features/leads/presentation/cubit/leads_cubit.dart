import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

export '../../domain/repositories/leads_repository.dart' show LeadSource, StaffOption;

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
    this.salesId,
    this.salesName,
    this.unassigned = false,
    this.pipeline = const {},
    this.unassignedCount = 0,
    this.overdueFollowUps = 0,
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

  /// Managers and admins: one rep's leads (and the rep's name for the chip).
  final String? salesId;
  final String? salesName;

  /// Managers and admins: the queue of leads nobody owns yet.
  final bool unassigned;

  /// How many leads stand in each stage, in the caller's scope (the
  /// website's pipeline counts, not just the loaded page).
  final Map<String, int> pipeline;
  final int unassignedCount;

  /// The caller's follow-ups past their time.
  final int overdueFollowUps;

  int get pipelineTotal => pipeline.values.fold(0, (a, b) => a + b);

  /// Leads still open: neither won nor lost.
  int get openCount => pipelineTotal - (pipeline['WON'] ?? 0) - (pipeline['LOST'] ?? 0);

  /// Won over all leads, as on the website; null with no leads.
  int? get conversionRate => pipelineTotal == 0 ? null : ((pipeline['WON'] ?? 0) / pipelineTotal * 100).round();

  bool get hasAdvancedFilters => sourceId != null || dateFrom != null || dateTo != null || salesId != null;

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
    String? salesId,
    String? salesName,
    bool clearSales = false,
    bool? unassigned,
    Map<String, int>? pipeline,
    int? unassignedCount,
    int? overdueFollowUps,
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
        salesId: clearSales ? null : (salesId ?? this.salesId),
        salesName: clearSales ? null : (salesName ?? this.salesName),
        unassigned: unassigned ?? this.unassigned,
        pipeline: pipeline ?? this.pipeline,
        unassignedCount: unassignedCount ?? this.unassignedCount,
        overdueFollowUps: overdueFollowUps ?? this.overdueFollowUps,
      );

  @override
  List<Object?> get props =>
      [status, leads, failure, stage, search, mine, page, hasMore, isLoadingMore,
       sourceId, dateFrom, dateTo, salesId, unassigned, pipeline, unassignedCount, overdueFollowUps];
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
        salesId: state.unassigned ? null : state.salesId,
        unassigned: state.unassigned,
      );

  /// Managers and admins see the unassigned queue (as on the website).
  bool queue = false;

  /// The figures above the list: the stage counts, the overdue follow-ups
  /// and, for managers, the unassigned queue. Best-effort.
  Future<void> loadSummary() async {
    final results = await Future.wait<Object?>([
      _repo.getPipeline(),
      _repo.getFollowUpSummary(),
      if (queue) _repo.countUnassigned(),
    ]);
    if (isClosed) return;
    emit(state.copyWith(
      pipeline: (results[0]! as Result<Map<String, int>>).dataOrNull,
      overdueFollowUps: (results[1]! as Result<FollowUpSummary>).dataOrNull?.overdue,
      unassignedCount: queue ? (results[2]! as Result<int>).dataOrNull : null,
    ));
  }

  Future<List<StaffOption>> fetchStaff() async =>
      (await _repo.getSalesStaff()).when(ok: (l) => l, err: (_) => const []);

  /// Managers and admins: only the leads nobody owns, or back to all.
  Future<void> toggleUnassigned() async {
    emit(state.copyWith(unassigned: !state.unassigned, clearStage: true));
    await load();
  }

  Future<void> setSales(String? id, String? name) async {
    emit(id == null ? state.copyWith(clearSales: true) : state.copyWith(salesId: id, salesName: name));
    await load();
  }

  /// A call or WhatsApp press, logged on the lead; the phone to open.
  Future<String?> openContact(String id, String kind) async =>
      (await _repo.openContact(id, kind)).dataOrNull;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1, hasMore: false));
    unawaited(loadSummary());
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
      clearSales: true,
    ));
    await load();
  }
}

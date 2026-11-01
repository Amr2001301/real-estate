import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/usecases/lead_use_cases.dart';

class FollowUpsState extends Equatable {
  const FollowUpsState({
    this.bucket = FollowUpBucket.overdue,
    this.summary,
    this.status = DataStatus.initial,
    this.items = const [],
    this.failure,
    this.page = 1,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  final FollowUpBucket bucket;
  final FollowUpSummary? summary;
  final DataStatus status;
  final List<FollowUp> items;
  final AppFailure? failure;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  FollowUpsState copyWith({
    FollowUpBucket? bucket,
    FollowUpSummary? summary,
    DataStatus? status,
    List<FollowUp>? items,
    AppFailure? failure,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      FollowUpsState(
        bucket: bucket ?? this.bucket,
        summary: summary ?? this.summary,
        status: status ?? this.status,
        items: items ?? this.items,
        failure: failure ?? this.failure,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );

  @override
  List<Object?> get props => [bucket, summary, status, items, failure, page, hasMore, isLoadingMore];
}

/// FU1 — the follow-up lists: overdue, today, upcoming, with their counts.
/// Opens on the overdue list, or on today's when nothing is late.
class FollowUpsCubit extends Cubit<FollowUpsState> {
  FollowUpsCubit(this._getFollowUps, this._getSummary) : super(const FollowUpsState());

  final GetFollowUps _getFollowUps;
  final GetFollowUpSummary _getSummary;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final summary = (await _getSummary(const NoParams())).dataOrNull;
    final bucket = summary != null && summary.overdue == 0 && summary.today > 0 && state.summary == null
        ? FollowUpBucket.today
        : state.bucket;
    emit(state.copyWith(summary: summary, bucket: bucket));
    await _loadList(bucket);
  }

  Future<void> select(FollowUpBucket bucket) async {
    if (bucket == state.bucket && state.status == DataStatus.success) return;
    emit(state.copyWith(bucket: bucket, status: DataStatus.loading, items: const []));
    await _loadList(bucket);
  }

  /// Pull to refresh: the counts and the open list.
  Future<void> refresh() async {
    final summary = (await _getSummary(const NoParams())).dataOrNull;
    if (summary != null) emit(state.copyWith(summary: summary));
    await _loadList(state.bucket);
  }

  Future<void> _loadList(FollowUpBucket bucket) async {
    final result = await _getFollowUps(FollowUpsParams(bucket));
    if (bucket != state.bucket) return; // another tab was picked meanwhile
    result.when(
      ok: (paged) => emit(state.copyWith(
        status: paged.data.isEmpty ? DataStatus.empty : DataStatus.success,
        items: paged.data,
        page: 1,
        hasMore: paged.hasMore,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;
    final bucket = state.bucket;
    final next = state.page + 1;
    emit(state.copyWith(isLoadingMore: true));
    final result = await _getFollowUps(FollowUpsParams(bucket, page: next));
    if (bucket != state.bucket) return;
    result.when(
      ok: (paged) => emit(state.copyWith(
        items: [...state.items, ...paged.data],
        page: next,
        hasMore: paged.hasMore,
        isLoadingMore: false,
      )),
      err: (_) => emit(state.copyWith(isLoadingMore: false)),
    );
  }
}

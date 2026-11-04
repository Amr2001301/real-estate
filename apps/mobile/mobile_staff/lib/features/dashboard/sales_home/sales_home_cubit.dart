import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../leads/domain/entities/lead.dart';
import '../../leads/domain/repositories/leads_repository.dart';
import 'sales_home_data.dart';

class SalesHomeState extends Equatable {
  const SalesHomeState({
    this.status = DataStatus.initial,
    this.data,
    this.failure,
    this.followUpSummary = const FollowUpSummary(),
    this.followUpBucket = FollowUpBucket.today,
    this.followUps = const [],
    this.followUpsLoading = false,
    this.selectedDay,
  });

  final DataStatus status;
  final SalesHome? data;
  final AppFailure? failure;
  final FollowUpSummary followUpSummary;
  final FollowUpBucket followUpBucket;
  final List<FollowUp> followUps;
  final bool followUpsLoading;

  /// The agenda day chosen in the strip; null = today.
  final DateTime? selectedDay;

  SalesHomeState copyWith({
    DataStatus? status,
    SalesHome? data,
    AppFailure? failure,
    FollowUpSummary? followUpSummary,
    FollowUpBucket? followUpBucket,
    List<FollowUp>? followUps,
    bool? followUpsLoading,
    DateTime? selectedDay,
  }) =>
      SalesHomeState(
        status: status ?? this.status,
        data: data ?? this.data,
        failure: failure ?? this.failure,
        followUpSummary: followUpSummary ?? this.followUpSummary,
        followUpBucket: followUpBucket ?? this.followUpBucket,
        followUps: followUps ?? this.followUps,
        followUpsLoading: followUpsLoading ?? this.followUpsLoading,
        selectedDay: selectedDay ?? this.selectedDay,
      );

  @override
  List<Object?> get props =>
      [status, data, failure, followUpSummary, followUpBucket, followUps, followUpsLoading, selectedDay];
}

/// Loads the rep's home and the follow-ups shown on it (overdue first when
/// there are any, else today's).
class SalesHomeCubit extends Cubit<SalesHomeState> {
  SalesHomeCubit(this._repo, this._leads, {required this.userId}) : super(const SalesHomeState());

  final SalesHomeRepository _repo;
  final LeadsRepository _leads;
  final String userId;

  static const followUpsShown = 3;

  Future<void> load() async {
    if (state.data == null) emit(state.copyWith(status: DataStatus.loading));
    final results = await Future.wait([
      _repo.load(userId: userId),
      _leads.getFollowUpSummary(),
    ]);
    if (isClosed) return;
    final home = results[0] as Result<SalesHome>;
    final summary = (results[1] as Result<FollowUpSummary>).dataOrNull ?? const FollowUpSummary();
    home.when(
      ok: (data) => emit(state.copyWith(
        status: DataStatus.success,
        data: data,
        followUpSummary: summary,
        followUpBucket: summary.overdue > 0 ? FollowUpBucket.overdue : FollowUpBucket.today,
      )),
      err: (f) => emit(state.copyWith(status: state.data == null ? DataStatus.failure : DataStatus.success, failure: f)),
    );
    await showFollowUps(state.followUpBucket);
  }

  Future<void> showFollowUps(FollowUpBucket bucket) async {
    emit(state.copyWith(followUpBucket: bucket, followUpsLoading: true));
    final r = await _leads.getFollowUps(bucket);
    if (isClosed || state.followUpBucket != bucket) return;
    emit(state.copyWith(
      followUps: (r.dataOrNull?.data ?? const <FollowUp>[]).take(followUpsShown).toList(),
      followUpsLoading: false,
    ));
  }

  void selectDay(DateTime day) => emit(state.copyWith(selectedDay: DateTime(day.year, day.month, day.day)));
}

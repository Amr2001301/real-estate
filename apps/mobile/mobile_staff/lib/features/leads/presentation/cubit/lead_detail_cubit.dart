import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/usecases/lead_use_cases.dart';

class LeadDetailState extends Equatable {
  const LeadDetailState({
    this.status = DataStatus.initial,
    this.detail,
    this.failure,
    this.working = false,
    this.actionFailure,
  });

  final DataStatus status;
  final LeadDetail? detail;
  final AppFailure? failure;

  /// True while a stage update / add-note action is in flight.
  final bool working;
  final AppFailure? actionFailure;

  LeadDetailState copyWith({
    DataStatus? status,
    LeadDetail? detail,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
  }) =>
      LeadDetailState(
        status: status ?? this.status,
        detail: detail ?? this.detail,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
      );

  @override
  List<Object?> get props => [status, detail, failure, working, actionFailure];
}

class LeadDetailCubit extends Cubit<LeadDetailState> {
  LeadDetailCubit(
    this._getDetail,
    this._updateStage,
    this._addNote, {
    required this.leadId,
  }) : super(const LeadDetailState());

  final GetLeadDetail _getDetail;
  final UpdateLeadStage _updateStage;
  final AddLeadNote _addNote;
  final String leadId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getDetail(leadId);
    result.when(
      ok: (detail) => emit(state.copyWith(status: DataStatus.success, detail: detail)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> changeStage(String stage, {String? reason}) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _updateStage(
      UpdateLeadStageParams(id: leadId, stage: stage, reason: reason),
    );
    await _afterAction(result);
  }

  Future<void> addNote(String body) async {
    if (state.working || body.trim().isEmpty) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _addNote(AddLeadNoteParams(id: leadId, body: body.trim()));
    await _afterAction(result);
  }

  Future<void> _afterAction(Result<void> result) async {
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    // Refresh the detail so the new stage/note shows on the timeline.
    final refreshed = await _getDetail(leadId);
    refreshed.when(
      ok: (detail) => emit(state.copyWith(working: false, detail: detail, status: DataStatus.success)),
      err: (_) => emit(state.copyWith(working: false)),
    );
  }
}

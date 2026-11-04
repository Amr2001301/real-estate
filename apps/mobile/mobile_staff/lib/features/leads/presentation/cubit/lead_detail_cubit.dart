import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

class LeadDetailState extends Equatable {
  const LeadDetailState({
    this.status = DataStatus.initial,
    this.detail,
    this.failure,
    this.working = false,
    this.actionFailure,
    this.links = const LeadLinks(),
  });

  final DataStatus status;
  final LeadDetail? detail;
  final AppFailure? failure;

  /// True while a stage update / add-note action is in flight.
  final bool working;
  final AppFailure? actionFailure;

  /// The lead's visits and bookings (loaded with the lead, best-effort).
  final LeadLinks links;

  LeadDetailState copyWith({
    DataStatus? status,
    LeadDetail? detail,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
    LeadLinks? links,
  }) =>
      LeadDetailState(
        status: status ?? this.status,
        detail: detail ?? this.detail,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
        links: links ?? this.links,
      );

  @override
  List<Object?> get props => [status, detail, failure, working, actionFailure, links];
}

class LeadDetailCubit extends Cubit<LeadDetailState> {
  LeadDetailCubit(
    this._getDetail,
    this._updateStage,
    this._addNote, {
    required this.leadId,
    required GetLostReasons getLostReasons,
    LeadsRepository? repo,
  })  : _getLostReasons = getLostReasons,
        _repo = repo,
        super(const LeadDetailState());

  /// Visits, bookings, reassigning and the contact log (null in older tests).
  final LeadsRepository? _repo;

  final GetLeadDetail _getDetail;
  final UpdateLeadStage _updateStage;
  final AddLeadNote _addNote;
  final GetLostReasons _getLostReasons;
  final String leadId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    _loadLinks();
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

  Future<void> _loadLinks() async {
    final r = await _repo?.getLeadLinks(leadId);
    final links = r?.dataOrNull;
    if (!isClosed && links != null) emit(state.copyWith(links: links));
  }

  /// Managers and admins: the reps to hand the lead to.
  Future<List<StaffOption>> salesStaff() async =>
      (await _repo?.getSalesStaff())?.dataOrNull ?? const [];

  /// Managers and admins: hand the lead to [salesId].
  Future<void> assign(String salesId) async {
    final repo = _repo;
    if (repo == null || state.working) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    await _afterAction(await repo.assignLead(leadId, salesId));
  }

  /// A call or WhatsApp press, logged on the lead; the phone to open.
  Future<String?> openContact(String kind) async {
    final phone = (await _repo?.openContact(leadId, kind))?.dataOrNull;
    unawaited(_refresh());
    return phone;
  }

  Future<void> _refresh() async {
    final r = await _getDetail(leadId);
    if (!isClosed) r.when(ok: (d) => emit(state.copyWith(detail: d)), err: (_) {});
  }

  /// LR1 — the reasons to pick from when the lead is lost.
  Future<Result<List<LostReason>>> lostReasons() => _getLostReasons(const NoParams());

  /// LR1 — lost, for one of the company's reasons (and a word on what happened).
  Future<void> markLost(String lostReasonId, {String? note}) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _updateStage(
      UpdateLeadStageParams(id: leadId, stage: 'LOST', lostReasonId: lostReasonId, lostNote: note),
    );
    await _afterAction(result);
  }

  /// A plain note.
  Future<void> addNote(String body) => logActivity(LeadNoteInput(body: body));

  /// FU1 — logs what happened (a call and how it went, a meeting, a WhatsApp
  /// chat, a note) and the next follow-up. Returns whether it was saved.
  Future<bool> logActivity(LeadNoteInput input) async {
    if (state.working || input.body.trim().isEmpty) return false;
    emit(state.copyWith(working: true, clearActionFailure: true));
    final result = await _addNote(AddLeadNoteParams(id: leadId, input: input));
    await _afterAction(result);
    return result.failureOrNull == null;
  }

  /// FU1 — a reply under one of the lead's notes (text only).
  Future<bool> reply(String parentId, String body) =>
      logActivity(LeadNoteInput.reply(parentId: parentId, body: body.trim()));

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

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/signature_request.dart';

class SignatureState extends Equatable {
  const SignatureState({
    this.status = DataStatus.initial,
    this.requests = const [],
    this.failure,
    this.working = false,
    this.actionFailure,
    this.sent,
  });

  final DataStatus status;

  /// Newest first.
  final List<SignatureRequest> requests;
  final AppFailure? failure;

  /// A link is being made or cancelled.
  final bool working;
  final AppFailure? actionFailure;

  /// The link just made, to send the customer (shown once).
  final SentSignatureRequest? sent;

  SignatureRequest? get latest => requests.isEmpty ? null : requests.first;

  SignatureState copyWith({
    DataStatus? status,
    List<SignatureRequest>? requests,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearAction = false,
    SentSignatureRequest? sent,
  }) =>
      SignatureState(
        status: status ?? this.status,
        requests: requests ?? this.requests,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearAction ? null : (actionFailure ?? this.actionFailure),
        sent: clearAction ? null : (sent ?? this.sent),
      );

  @override
  List<Object?> get props => [status, requests, failure, working, actionFailure, sent];
}

/// A booking's online signature: its requests, a new link, cancelling one.
class SignatureCubit extends Cubit<SignatureState> {
  SignatureCubit(this._repo, {required this.reservationId}) : super(const SignatureState());
  final SignatureRequestsRepository _repo;
  final String reservationId;

  Future<void> load() async {
    if (state.requests.isEmpty) emit(state.copyWith(status: DataStatus.loading));
    final result = await _repo.list(reservationId);
    result.when(
      ok: (list) => emit(state.copyWith(status: list.isEmpty ? DataStatus.empty : DataStatus.success, requests: list)),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  Future<void> send({required String locale}) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearAction: true));
    final result = await _repo.send(reservationId, locale: locale);
    final failure = result.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    await load();
    emit(state.copyWith(working: false, sent: result.dataOrNull));
  }

  Future<void> cancel(String requestId) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearAction: true));
    final failure = (await _repo.cancel(requestId)).failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    await load();
    emit(state.copyWith(working: false));
  }
}

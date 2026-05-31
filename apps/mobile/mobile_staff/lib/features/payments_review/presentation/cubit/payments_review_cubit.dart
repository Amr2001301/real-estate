import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/payment_review_item.dart';
import '../../domain/usecases/payments_review_use_cases.dart';

class PaymentsReviewState extends Equatable {
  const PaymentsReviewState({
    this.status = DataStatus.initial,
    this.items = const [],
    this.failure,
    this.workingId,
    this.actionEpoch = 0,
    this.lastDecision,
    this.actionFailure,
  });

  /// Load lifecycle of the queue.
  final DataStatus status;
  final List<PaymentReviewItem> items;

  /// Screen-load failure (drives the full ErrorState).
  final AppFailure? failure;

  /// The deposit currently being approved/rejected — disables its buttons.
  final String? workingId;

  /// Bumped after every completed action so a listener fires exactly once per
  /// action even when the same decision repeats. Pair with [lastDecision] /
  /// [actionFailure] to know the outcome.
  final int actionEpoch;
  final ReviewDecision? lastDecision;

  /// Action-level failure (drives a friendly SnackBar, never a raw error).
  final AppFailure? actionFailure;

  PaymentsReviewState copyWith({
    DataStatus? status,
    List<PaymentReviewItem>? items,
    AppFailure? failure,
    String? workingId,
    bool clearWorkingId = false,
    int? actionEpoch,
    ReviewDecision? lastDecision,
    AppFailure? actionFailure,
    bool clearActionFailure = false,
  }) =>
      PaymentsReviewState(
        status: status ?? this.status,
        items: items ?? this.items,
        failure: failure ?? this.failure,
        workingId: clearWorkingId ? null : (workingId ?? this.workingId),
        actionEpoch: actionEpoch ?? this.actionEpoch,
        lastDecision: lastDecision ?? this.lastDecision,
        actionFailure: clearActionFailure ? null : (actionFailure ?? this.actionFailure),
      );

  @override
  List<Object?> get props => [status, items, failure, workingId, actionEpoch, lastDecision, actionFailure];
}

/// Drives the payment-proof review queue: load, approve, reject, and refresh.
/// Approve/reject reload the queue on success so the reviewed item drops off.
class PaymentsReviewCubit extends Cubit<PaymentsReviewState> {
  PaymentsReviewCubit(this._getQueue, this._approve, this._reject)
      : super(const PaymentsReviewState());

  final GetPaymentReviewQueue _getQueue;
  final ApprovePayment _approve;
  final RejectPayment _reject;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getQueue(const NoParams());
    result.when(
      ok: (items) => emit(state.copyWith(
        status: items.isEmpty ? DataStatus.empty : DataStatus.success,
        items: items,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> approve(String depositId, {String? note}) =>
      _act(depositId, ReviewDecision.approved, () => _approve(ApprovePaymentParams(depositId: depositId, note: note)));

  Future<void> reject(String depositId, String reason) =>
      _act(depositId, ReviewDecision.rejected, () => _reject(RejectPaymentParams(depositId: depositId, reason: reason)));

  Future<void> _act(
    String depositId,
    ReviewDecision decision,
    Future<Result<void>> Function() action,
  ) async {
    if (state.workingId != null) return; // one action at a time
    emit(state.copyWith(workingId: depositId, clearActionFailure: true));
    final failure = (await action()).failureOrNull;
    if (failure != null) {
      emit(state.copyWith(
        clearWorkingId: true,
        actionEpoch: state.actionEpoch + 1,
        actionFailure: failure,
      ));
      return;
    }
    // Success — reload so the now-reviewed item drops off the pending queue.
    final refreshed = await _getQueue(const NoParams());
    refreshed.when(
      ok: (items) => emit(state.copyWith(
        status: items.isEmpty ? DataStatus.empty : DataStatus.success,
        items: items,
        clearWorkingId: true,
        actionEpoch: state.actionEpoch + 1,
        lastDecision: decision,
        clearActionFailure: true,
      )),
      // Action succeeded but refresh failed — still report success; the list
      // simply keeps its previous contents until the next pull-to-refresh.
      err: (_) => emit(state.copyWith(
        clearWorkingId: true,
        actionEpoch: state.actionEpoch + 1,
        lastDecision: decision,
        clearActionFailure: true,
      )),
    );
  }
}

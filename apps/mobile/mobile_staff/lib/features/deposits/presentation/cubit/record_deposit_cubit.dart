import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/deposit_use_cases.dart';

enum RecordDepositStatus { idle, submitting, success, failure }

class RecordDepositState extends Equatable {
  const RecordDepositState({
    this.status = RecordDepositStatus.idle,
    this.failure,
  });

  final RecordDepositStatus status;
  final AppFailure? failure;

  RecordDepositState copyWith({
    RecordDepositStatus? status,
    AppFailure? failure,
    bool clearFailure = false,
  }) =>
      RecordDepositState(
        status: status ?? this.status,
        failure: clearFailure ? null : (failure ?? this.failure),
      );

  @override
  List<Object?> get props => [status, failure];
}

class RecordDepositCubit extends Cubit<RecordDepositState> {
  RecordDepositCubit(this._recordDeposit) : super(const RecordDepositState());

  final RecordDeposit _recordDeposit;

  Future<void> submit({
    required String contractId,
    required String installmentId,
    required double amount,
    required DateTime paidAt,
  }) async {
    emit(state.copyWith(status: RecordDepositStatus.submitting, clearFailure: true));
    final result = await _recordDeposit(RecordDepositParams(
      contractId: contractId,
      installmentId: installmentId,
      amount: amount,
      paidAt: paidAt,
    ));
    result.when(
      ok: (_) => emit(state.copyWith(status: RecordDepositStatus.success)),
      err: (failure) =>
          emit(state.copyWith(status: RecordDepositStatus.failure, failure: failure)),
    );
  }
}

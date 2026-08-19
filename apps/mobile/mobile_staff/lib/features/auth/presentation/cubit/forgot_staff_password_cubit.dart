import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/forgot_staff_password.dart';

enum StaffForgotResetStep { requestForm, resetForm, done }

class ForgotStaffPasswordState extends Equatable {
  const ForgotStaffPasswordState({
    this.step = StaffForgotResetStep.requestForm,
    this.submitting = false,
    this.failure,
  });

  final StaffForgotResetStep step;
  final bool submitting;
  final AppFailure? failure;

  ForgotStaffPasswordState copyWith({
    StaffForgotResetStep? step,
    bool? submitting,
    AppFailure? failure,
    bool clearFailure = false,
  }) =>
      ForgotStaffPasswordState(
        step: step ?? this.step,
        submitting: submitting ?? this.submitting,
        failure: clearFailure ? null : (failure ?? this.failure),
      );

  @override
  List<Object?> get props => [step, submitting, failure];
}

class ForgotStaffPasswordCubit extends Cubit<ForgotStaffPasswordState> {
  ForgotStaffPasswordCubit(this._forgotPassword, this._resetPassword)
      : super(const ForgotStaffPasswordState());

  final ForgotStaffPassword _forgotPassword;
  final ResetStaffPassword _resetPassword;

  Future<void> sendResetLink(String email) async {
    emit(state.copyWith(submitting: true, clearFailure: true));
    final result = await _forgotPassword(email);
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, step: StaffForgotResetStep.resetForm)),
      err: (failure) => emit(state.copyWith(submitting: false, failure: failure)),
    );
  }

  Future<void> submitReset(String token, String newPassword) async {
    emit(state.copyWith(submitting: true, clearFailure: true));
    final result = await _resetPassword(
      ResetStaffPasswordParams(token: token, newPassword: newPassword),
    );
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, step: StaffForgotResetStep.done)),
      err: (failure) => emit(state.copyWith(submitting: false, failure: failure)),
    );
  }
}

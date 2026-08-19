import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/usecases/forgot_password.dart';
import '../domain/usecases/reset_password.dart';

enum ForgotResetStep { requestForm, resetForm, done }

class ForgotPasswordState extends Equatable {
  const ForgotPasswordState({
    this.step = ForgotResetStep.requestForm,
    this.submitting = false,
    this.failure,
  });

  final ForgotResetStep step;
  final bool submitting;
  final AppFailure? failure;

  ForgotPasswordState copyWith({
    ForgotResetStep? step,
    bool? submitting,
    AppFailure? failure,
    bool clearFailure = false,
  }) =>
      ForgotPasswordState(
        step: step ?? this.step,
        submitting: submitting ?? this.submitting,
        failure: clearFailure ? null : (failure ?? this.failure),
      );

  @override
  List<Object?> get props => [step, submitting, failure];
}

class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._forgotPassword, this._resetPassword)
      : super(const ForgotPasswordState());

  final ForgotPassword _forgotPassword;
  final ResetPassword _resetPassword;

  Future<void> sendResetLink(String email) async {
    emit(state.copyWith(submitting: true, clearFailure: true));
    final result = await _forgotPassword(email);
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, step: ForgotResetStep.resetForm)),
      err: (failure) => emit(state.copyWith(submitting: false, failure: failure)),
    );
  }

  Future<void> submitReset(String token, String newPassword) async {
    emit(state.copyWith(submitting: true, clearFailure: true));
    final result = await _resetPassword(ResetPasswordParams(token: token, newPassword: newPassword));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, step: ForgotResetStep.done)),
      err: (failure) => emit(state.copyWith(submitting: false, failure: failure)),
    );
  }
}

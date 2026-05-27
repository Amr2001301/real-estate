import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/repositories/auth_repository.dart';
import '../domain/usecases/login_with_email.dart';
import '../domain/usecases/logout_user.dart';
import '../domain/usecases/register_customer.dart';
import '../domain/usecases/request_otp.dart';
import '../domain/usecases/verify_otp.dart';
import 'auth_state.dart';

/// Drives the auth flows. Depends on use cases + the app-wide [SessionCubit]
/// (a core primitive) which it updates on success/logout via emit-only adopt.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required SessionCubit sessionCubit,
    required LoginWithEmail loginWithEmail,
    required RegisterCustomer registerCustomer,
    required RequestOtp requestOtp,
    required VerifyOtp verifyOtp,
    required LogoutUser logoutUser,
  })  : _session = sessionCubit,
        _loginWithEmail = loginWithEmail,
        _registerCustomer = registerCustomer,
        _requestOtp = requestOtp,
        _verifyOtp = verifyOtp,
        _logoutUser = logoutUser,
        super(const AuthState());

  final SessionCubit _session;
  final LoginWithEmail _loginWithEmail;
  final RegisterCustomer _registerCustomer;
  final RequestOtp _requestOtp;
  final VerifyOtp _verifyOtp;
  final LogoutUser _logoutUser;

  Future<void> loginEmail(String email, String password) async {
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    final result = await _loginWithEmail(LoginParams(email: email, password: password));
    _completeSignIn(result);
  }

  Future<void> register(RegisterParams params) async {
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    _completeSignIn(await _registerCustomer(params));
  }

  Future<void> requestOtp(String phone) async {
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    final result = await _requestOtp(phone);
    result.when(
      ok: (_) => emit(state.copyWith(status: AuthStatus.otpSent, otpPhone: phone)),
      err: (failure) => emit(state.copyWith(status: AuthStatus.failure, failure: failure)),
    );
  }

  Future<void> verifyOtp(String code, {String? fullName}) async {
    final phone = state.otpPhone;
    if (phone == null) return;
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    _completeSignIn(
      await _verifyOtp(VerifyOtpParams(phone: phone, code: code, fullName: fullName)),
    );
  }

  Future<void> logout() async {
    await _logoutUser(const NoParams());
    _session.adoptSignedOut();
  }

  void _completeSignIn(Result<Session> result) {
    result.when(
      ok: (session) {
        _session.adopt(session);
        emit(state.copyWith(status: AuthStatus.success));
      },
      err: (failure) =>
          emit(state.copyWith(status: AuthStatus.failure, failure: failure)),
    );
  }
}

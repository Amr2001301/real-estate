import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../storage/customer_tenant_storage.dart';
import '../domain/repositories/auth_repository.dart';
import '../domain/usecases/login_with_email.dart';
import '../domain/usecases/logout_user.dart';
import '../domain/usecases/register_customer.dart';
import '../domain/usecases/request_otp.dart';
import '../domain/usecases/verify_otp.dart';
import 'auth_state.dart';

/// Drives the auth flows. Reads the selected company slug from
/// [CustomerTenantStorage] and forwards it to every V2 use case — the slug
/// is never sourced from form fields or JWT.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required SessionCubit sessionCubit,
    required CustomerTenantStorage tenantStorage,
    required LoginWithEmail loginWithEmail,
    required RegisterCustomer registerCustomer,
    required RequestOtp requestOtp,
    required VerifyOtp verifyOtp,
    required LogoutUser logoutUser,
  })  : _session = sessionCubit,
        _tenantStorage = tenantStorage,
        _loginWithEmail = loginWithEmail,
        _registerCustomer = registerCustomer,
        _requestOtp = requestOtp,
        _verifyOtp = verifyOtp,
        _logoutUser = logoutUser,
        super(const AuthState());

  final SessionCubit _session;
  final CustomerTenantStorage _tenantStorage;
  final LoginWithEmail _loginWithEmail;
  final RegisterCustomer _registerCustomer;
  final RequestOtp _requestOtp;
  final VerifyOtp _verifyOtp;
  final LogoutUser _logoutUser;

  // Returns the stored slug, or emits a failure and returns null if missing.
  String? _slug() {
    final slug = _tenantStorage.selectedCompanySlug;
    if (slug == null || slug.isEmpty) {
      emit(state.copyWith(
        status: AuthStatus.failure,
        failure: AppFailure(type: FailureType.unknown),
      ));
    }
    return slug;
  }

  Future<void> loginEmail(String email, String password) async {
    final slug = _slug();
    if (slug == null) return;
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    final result = await _loginWithEmail(
      LoginParams(slug: slug, email: email, password: password),
    );
    _completeSignIn(result);
  }

  Future<void> register(RegisterParams params) async {
    final slug = _slug();
    if (slug == null) return;
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    _completeSignIn(await _registerCustomer(RegisterWithSlugParams(slug: slug, params: params)));
  }

  Future<void> requestOtp(String phone) async {
    final slug = _slug();
    if (slug == null) return;
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    final result = await _requestOtp(OtpRequestParams(slug: slug, phone: phone));
    result.when(
      ok: (_) => emit(state.copyWith(status: AuthStatus.otpSent, otpPhone: phone)),
      err: (failure) => emit(state.copyWith(status: AuthStatus.failure, failure: failure)),
    );
  }

  Future<void> verifyOtp(String code, {String? fullName}) async {
    final phone = state.otpPhone;
    if (phone == null) return;
    final slug = _slug();
    if (slug == null) return;
    emit(state.copyWith(status: AuthStatus.submitting, clearFailure: true));
    _completeSignIn(
      await _verifyOtp(VerifyOtpParams(slug: slug, phone: phone, code: code, fullName: fullName)),
    );
  }

  /// Normal logout: revokes tokens and signs out. Preserves the selected company
  /// slug so the returning user lands back on the same company's login screen.
  Future<void> logout() async {
    await _logoutUser(const NoParams());
    _session.adoptSignedOut();
  }

  /// Change-company logout: revokes tokens, clears the selected company, and
  /// signs out. The router redirect then sends the user to /select-company.
  Future<void> changeCompany() async {
    await _logoutUser(const NoParams());
    await _tenantStorage.clearSelectedCompany();
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

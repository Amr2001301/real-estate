import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_two_factor.dart';
import '../../domain/usecases/login_staff.dart';
import '../../domain/usecases/logout_staff.dart';
import '../../domain/usecases/staff_two_factor.dart';

enum StaffAuthStatus { idle, submitting, success, failure }

class StaffAuthState extends Equatable {
  const StaffAuthState({
    this.status = StaffAuthStatus.idle,
    this.failure,
    this.twoFactor,
    this.slug = '',
    this.setup,
    this.recoveryCodes,
  });

  final StaffAuthStatus status;
  final AppFailure? failure;

  /// TFA1 — the second step after a correct password (null on the login form).
  final StaffTwoFactorStep? twoFactor;

  /// The company code of the sign-in in progress (kept for the second step).
  final String slug;

  /// The secret to add to the authenticator app, when setting it up.
  final StaffTwoFactorSetup? setup;

  /// Shown once after setting it up; the session starts when they are acknowledged.
  final List<String>? recoveryCodes;

  bool get isSubmitting => status == StaffAuthStatus.submitting;

  StaffAuthState copyWith({
    StaffAuthStatus? status,
    AppFailure? failure,
    bool clearFailure = false,
    StaffTwoFactorStep? twoFactor,
    String? slug,
    StaffTwoFactorSetup? setup,
    List<String>? recoveryCodes,
  }) =>
      StaffAuthState(
        status: status ?? this.status,
        failure: clearFailure ? null : (failure ?? this.failure),
        twoFactor: twoFactor ?? this.twoFactor,
        slug: slug ?? this.slug,
        setup: setup ?? this.setup,
        recoveryCodes: recoveryCodes ?? this.recoveryCodes,
      );

  @override
  List<Object?> get props => [status, failure, twoFactor, slug, setup, recoveryCodes];
}

/// Drives staff login. Depends on use cases + the app-wide [SessionCubit] (a
/// core primitive) which it updates on success/logout via emit-only adopt.
class StaffAuthCubit extends Cubit<StaffAuthState> {
  StaffAuthCubit({
    required SessionCubit sessionCubit,
    required LoginStaff loginStaff,
    required LogoutStaff logoutStaff,
    required VerifyStaffTwoFactor verifyTwoFactor,
    required StartStaffTwoFactorSetup startTwoFactorSetup,
    required FinishStaffTwoFactorSetup finishTwoFactorSetup,
    Future<void> Function()? beforeLogout,
  })  : _session = sessionCubit,
        _loginStaff = loginStaff,
        _logoutStaff = logoutStaff,
        _verifyTwoFactor = verifyTwoFactor,
        _startTwoFactorSetup = startTwoFactorSetup,
        _finishTwoFactorSetup = finishTwoFactorSetup,
        _beforeLogout = beforeLogout,
        super(const StaffAuthState());

  final SessionCubit _session;
  final LoginStaff _loginStaff;
  final LogoutStaff _logoutStaff;
  final VerifyStaffTwoFactor _verifyTwoFactor;
  final StartStaffTwoFactorSetup _startTwoFactorSetup;
  final FinishStaffTwoFactorSetup _finishTwoFactorSetup;
  Session? _pending;

  /// Runs while the session is still valid (e.g. unregistering this device
  /// from push). Best-effort: a failure never blocks signing out.
  final Future<void> Function()? _beforeLogout;

  /// Tenant-aware login. [slug] is the company code entered by the user.
  /// On success, the repository persists tokens + selectedCompanySlug.
  Future<void> login(String slug, String email, String password) async {
    final normalized = slug.trim().toLowerCase();
    emit(state.copyWith(status: StaffAuthStatus.submitting, clearFailure: true));
    final result = await _loginStaff(
      LoginParams(
        slug: normalized,
        email: email.trim(),
        password: password,
      ),
    );
    switch (result) {
      case Ok(data: StaffSignedIn(:final session)):
        _session.adopt(session);
        emit(state.copyWith(status: StaffAuthStatus.success));
      case Ok(data: final StaffTwoFactorStep step):
        // TFA1 — a code next (or setting it up first).
        emit(StaffAuthState(twoFactor: step, slug: normalized));
        if (step.setupRequired) await _loadSetup();
      case Err(:final failure):
        emit(state.copyWith(status: StaffAuthStatus.failure, failure: failure));
    }
  }

  Future<void> _loadSetup() async {
    final step = state.twoFactor;
    if (step == null) return;
    emit(state.copyWith(status: StaffAuthStatus.submitting, clearFailure: true));
    final result = await _startTwoFactorSetup(TwoFactorParams(challenge: step.challenge));
    _settle(result, (setup) => emit(state.copyWith(status: StaffAuthStatus.idle, setup: setup)));
  }

  /// The code from the authenticator app, or a recovery code.
  Future<void> verifyCode(String code) async {
    final step = state.twoFactor;
    if (step == null) return;
    emit(state.copyWith(status: StaffAuthStatus.submitting, clearFailure: true));
    final result = await _verifyTwoFactor(
      TwoFactorParams(challenge: step.challenge, code: code.trim(), slug: state.slug),
    );
    _settle(result, (session) {
      _session.adopt(session);
      emit(state.copyWith(status: StaffAuthStatus.success));
    });
  }

  /// The first code from the app: it is on; the recovery codes are shown before going in.
  Future<void> finishSetup(String code) async {
    final step = state.twoFactor;
    if (step == null) return;
    emit(state.copyWith(status: StaffAuthStatus.submitting, clearFailure: true));
    final result = await _finishTwoFactorSetup(
      TwoFactorParams(challenge: step.challenge, code: code.trim(), slug: state.slug),
    );
    _settle(result, (enabled) {
      _pending = enabled.session;
      emit(state.copyWith(status: StaffAuthStatus.idle, recoveryCodes: enabled.recoveryCodes));
    });
  }

  /// The recovery codes were seen: start the session.
  void acknowledgeRecoveryCodes() {
    final session = _pending;
    if (session == null) return;
    _pending = null;
    _session.adopt(session);
    emit(state.copyWith(status: StaffAuthStatus.success));
  }

  /// Back to the login form (or the step timed out).
  void cancelTwoFactor() {
    _pending = null;
    emit(const StaffAuthState());
  }

  void _settle<T>(Result<T> result, void Function(T value) ok) {
    switch (result) {
      case Ok(:final data):
        ok(data);
      case Err(:final failure):
        if (failure.code == 'CHALLENGE_EXPIRED') {
          // Five minutes passed: start again from the password.
          emit(StaffAuthState(status: StaffAuthStatus.failure, failure: failure, slug: state.slug));
        } else {
          emit(state.copyWith(status: StaffAuthStatus.failure, failure: failure));
        }
    }
  }

  Future<void> logout() async {
    try {
      await _beforeLogout?.call();
    } catch (_) {
      // Best-effort: signing out never waits on it.
    }
    await _logoutStaff(const NoParams());
    _session.adoptSignedOut();
  }
}

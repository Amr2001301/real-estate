import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/login_staff.dart';
import '../../domain/usecases/logout_staff.dart';

enum StaffAuthStatus { idle, submitting, success, failure }

class StaffAuthState extends Equatable {
  const StaffAuthState({this.status = StaffAuthStatus.idle, this.failure});

  final StaffAuthStatus status;
  final AppFailure? failure;

  bool get isSubmitting => status == StaffAuthStatus.submitting;

  StaffAuthState copyWith({
    StaffAuthStatus? status,
    AppFailure? failure,
    bool clearFailure = false,
  }) =>
      StaffAuthState(
        status: status ?? this.status,
        failure: clearFailure ? null : (failure ?? this.failure),
      );

  @override
  List<Object?> get props => [status, failure];
}

/// Drives staff login. Depends on use cases + the app-wide [SessionCubit] (a
/// core primitive) which it updates on success/logout via emit-only adopt.
class StaffAuthCubit extends Cubit<StaffAuthState> {
  StaffAuthCubit({
    required SessionCubit sessionCubit,
    required LoginStaff loginStaff,
    required LogoutStaff logoutStaff,
    Future<void> Function()? beforeLogout,
  })  : _session = sessionCubit,
        _loginStaff = loginStaff,
        _logoutStaff = logoutStaff,
        _beforeLogout = beforeLogout,
        super(const StaffAuthState());

  final SessionCubit _session;
  final LoginStaff _loginStaff;
  final LogoutStaff _logoutStaff;

  /// Runs while the session is still valid (e.g. unregistering this device
  /// from push). Best-effort: a failure never blocks signing out.
  final Future<void> Function()? _beforeLogout;

  /// Tenant-aware login. [slug] is the company code entered by the user.
  /// On success, the repository persists tokens + selectedCompanySlug.
  Future<void> login(String slug, String email, String password) async {
    emit(state.copyWith(status: StaffAuthStatus.submitting, clearFailure: true));
    final result = await _loginStaff(
      LoginParams(
        slug: slug.trim().toLowerCase(),
        email: email.trim(),
        password: password,
      ),
    );
    result.when(
      ok: (session) {
        _session.adopt(session);
        emit(state.copyWith(status: StaffAuthStatus.success));
      },
      err: (failure) =>
          emit(state.copyWith(status: StaffAuthStatus.failure, failure: failure)),
    );
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

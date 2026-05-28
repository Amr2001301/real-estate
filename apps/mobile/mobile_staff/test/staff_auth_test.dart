import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/auth/data/datasources/staff_auth_remote_data_source.dart';
import 'package:mobile_staff/features/auth/data/dtos/staff_auth_dtos.dart';
import 'package:mobile_staff/features/auth/data/mappers/staff_auth_mapper.dart';
import 'package:mobile_staff/features/auth/data/repositories/staff_auth_repository_impl.dart';
import 'package:mobile_staff/features/auth/domain/repositories/staff_auth_repository.dart';
import 'package:mobile_staff/features/auth/domain/usecases/login_staff.dart';
import 'package:mobile_staff/features/auth/domain/usecases/logout_staff.dart';
import 'package:mobile_staff/features/auth/presentation/cubit/staff_auth_cubit.dart';
import 'package:mobile_staff/router/app_router.dart';

/// Throwing remote so error mapping never touches secure storage.
class _ThrowingRemote implements StaffAuthRemoteDataSource {
  _ThrowingRemote(this.error);
  final DioException error;
  @override
  Future<AuthBundleDto> login(String e, String p) async => throw error;
  @override
  Future<AuthBundleDto> refresh(String t) async => throw error;
  @override
  Future<void> logout(String t) async => throw error;
}

class _FakeRepo implements StaffAuthRepository {
  _FakeRepo({this.session, this.failure});
  final Session? session;
  final AppFailure? failure;
  Result<Session> get _r => failure != null ? Result.err(failure!) : Result.ok(session!);

  @override
  Future<Result<Session>> loginWithEmail(String e, String p) async => _r;
  @override
  Future<Result<Session>> refreshSession() async => _r;
  @override
  Future<Result<void>> logout() async => const Ok(null);
}

DioException _http(int status) => DioException(
      requestOptions: RequestOptions(path: '/auth/login'),
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: RequestOptions(path: '/auth/login'), statusCode: status),
    );

void main() {
  group('AuthBundleDto → Session mapper', () {
    test('maps staff user + role', () {
      final session = AuthBundleDto.fromJson({
        'user': {'id': 'u1', 'role': 'SALES', 'fullName': 'Omar', 'email': 'o@x.com'},
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
      }).toSession();
      expect(session.userId, 'u1');
      expect(session.role, AppRole.sales);
      expect(session.displayName, 'Omar');
    });
  });

  group('StaffAuthRepositoryImpl error mapping', () {
    test('401 → Err(unauthorized), never throws', () async {
      final repo = StaffAuthRepositoryImpl(_ThrowingRemote(_http(401)), TokenStorage());
      final result = await repo.loginWithEmail('a@b.com', 'pw');
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('403 (inactive / non-staff) → Err(forbidden)', () async {
      final repo = StaffAuthRepositoryImpl(_ThrowingRemote(_http(403)), TokenStorage());
      final result = await repo.loginWithEmail('a@b.com', 'pw');
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });
  });

  group('StaffAuthCubit', () {
    StaffAuthCubit build(_FakeRepo repo, SessionCubit session) => StaffAuthCubit(
          sessionCubit: session,
          loginStaff: LoginStaff(repo),
          logoutStaff: LogoutStaff(repo),
        );

    test('login success adopts the session', () async {
      final repo = _FakeRepo(session: const Session(userId: '1', role: AppRole.sales, displayName: 'S'));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login('a@b.com', 'pw');
      expect(cubit.state.status, StaffAuthStatus.success);
      expect(session.state.isAuthenticated, isTrue);
      expect(session.state.role, AppRole.sales);
    });

    test('login failure surfaces AppFailure without adopting', () async {
      final repo = _FakeRepo(failure: AppFailure(type: FailureType.unauthorized));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login('a@b.com', 'bad');
      expect(cubit.state.status, StaffAuthStatus.failure);
      expect(cubit.state.failure?.type, FailureType.unauthorized);
      expect(session.state.isAuthenticated, isFalse);
    });
  });

  group('staffRedirect (role routing + session restore)', () {
    test('unresolved session → splash (restore in progress)', () {
      expect(staffRedirect(const SessionState.unknown(), '/home'), '/splash');
      expect(staffRedirect(const SessionState.unknown(), '/splash'), isNull);
    });

    test('unauthenticated → login', () {
      expect(staffRedirect(const SessionState.unauthenticated(), '/home'), '/login');
      expect(staffRedirect(const SessionState.unauthenticated(), '/login'), isNull);
    });

    test('customer-side role is bounced to login', () {
      const s = SessionState.authenticated(Session(userId: '1', role: AppRole.customer));
      expect(staffRedirect(s, '/home'), '/login');
    });

    test('sales lands on the shell and is kept off login/splash', () {
      const s = SessionState.authenticated(Session(userId: '1', role: AppRole.sales));
      expect(staffRedirect(s, '/login'), '/home');
      expect(staffRedirect(s, '/home'), isNull);
      expect(staffRedirect(s, '/leads/1'), isNull);
    });

    test('sales manager is treated as staff', () {
      const s = SessionState.authenticated(Session(userId: '1', role: AppRole.salesManager));
      expect(staffRedirect(s, '/home'), isNull);
    });

    test('broker is confined to the broker workspace (Phase 5)', () {
      const s = SessionState.authenticated(Session(userId: '1', role: AppRole.broker));
      expect(staffRedirect(s, '/home'), '/broker/home');
      expect(staffRedirect(s, '/broker/home'), isNull);
      expect(staffRedirect(s, '/leads/1'), '/broker/home');
    });
  });
}

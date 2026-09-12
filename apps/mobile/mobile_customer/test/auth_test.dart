import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:mobile_customer/features/auth/data/dtos/auth_dtos.dart';
import 'package:mobile_customer/features/auth/data/mappers/auth_mapper.dart';
import 'package:mobile_customer/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:mobile_customer/features/auth/domain/repositories/auth_repository.dart';
import 'package:mobile_customer/features/auth/domain/usecases/login_with_email.dart';
import 'package:mobile_customer/features/auth/domain/usecases/logout_user.dart';
import 'package:mobile_customer/features/auth/domain/usecases/refresh_session.dart';
import 'package:mobile_customer/features/auth/domain/usecases/register_customer.dart';
import 'package:mobile_customer/features/auth/domain/usecases/request_otp.dart';
import 'package:mobile_customer/features/auth/domain/usecases/verify_otp.dart';
import 'package:mobile_customer/features/auth/presentation/auth_cubit.dart';
import 'package:mobile_customer/features/auth/presentation/auth_state.dart';
import 'package:mobile_customer/storage/customer_tenant_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Fake remote that throws a configurable DioException (success paths aren't
/// exercised here to avoid touching secure storage).
class _ThrowingRemote implements AuthRemoteDataSource {
  _ThrowingRemote(this.error);
  final DioException error;
  @override
  Future<AuthBundleDto> loginCustomer(String slug, String e, String p) async => throw error;
  @override
  Future<AuthBundleDto> registerCustomer(String slug, RegisterParams p) async => throw error;
  @override
  Future<void> requestOtp(String slug, String phone) async => throw error;
  @override
  Future<AuthBundleDto> verifyOtp(String slug, String p, String c, String? f) async => throw error;
  @override
  Future<AuthBundleDto> refresh(String t) async => throw error;
  @override
  Future<void> logout(String t) async => throw error;
  @override
  Future<void> forgotPassword(String slug, String email) async => throw error;
  @override
  Future<void> resetPassword(String token, String newPassword) async => throw error;
}

/// Fake repository returning canned results (no network, no storage).
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.session, this.failure});
  final Session? session;
  final AppFailure? failure;

  Result<Session> get _r =>
      failure != null ? Result.err(failure!) : Result.ok(session!);

  @override
  Future<Result<Session>> loginWithEmail(String slug, String e, String p) async => _r;
  @override
  Future<Result<Session>> registerCustomer(String slug, RegisterParams params) async => _r;
  @override
  Future<Result<void>> requestOtp(String slug, String phone) async =>
      failure != null ? Result.err(failure!) : const Ok(null);
  @override
  Future<Result<Session>> verifyOtp(String slug, String p, String c, {String? fullName}) async => _r;
  @override
  Future<Result<Session>> refreshSession() async => _r;
  @override
  Future<Result<void>> logout() async => const Ok(null);
  @override
  Future<Result<void>> forgotPassword(String slug, String email) async => const Ok(null);
  @override
  Future<Result<void>> resetPassword(String token, String newPassword) async => const Ok(null);
}

/// Repository variant that simulates a backend logout failure (e.g. network
/// error). Used to verify that local cleanup still happens unconditionally.
class _BackendLogoutFailRepo extends _FakeAuthRepository {
  _BackendLogoutFailRepo()
      : super(session: const Session(userId: 'u1', role: AppRole.customer));

  @override
  Future<Result<void>> logout() async =>
      Result.err(AppFailure(type: FailureType.network));
}

/// Minimal [TokenStorage] subclass that avoids FlutterSecureStorage platform
/// channels. Used only to test [SessionCubit.restore] additionalCheck semantics.
class _FakeTokenStorage extends TokenStorage {
  bool hasTokens;
  int clearCount = 0;

  _FakeTokenStorage({this.hasTokens = true});

  @override
  Future<bool> get hasSession async => hasTokens;

  @override
  Future<String?> readSessionJson() async =>
      hasTokens ? '{"userId":"u1","role":"customer"}' : null;

  @override
  Future<void> clear() async {
    hasTokens = false;
    clearCount++;
  }
}

DioException _http(int status) => DioException(
      requestOptions: RequestOptions(path: '/auth/customer/login'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/auth/customer/login'),
        statusCode: status,
      ),
    );

void main() {
  group('AuthBundleDto → Session mapper', () {
    test('maps user fields + role to Session', () {
      final session = AuthBundleDto.fromJson({
        'user': {
          'id': 'u1',
          'role': 'CUSTOMER',
          'fullName': 'Sara',
          'email': 's@x.com',
          'phone': '+201000000000',
        },
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
      }).toSession();
      expect(session.userId, 'u1');
      expect(session.role, AppRole.customer);
      expect(session.displayName, 'Sara');
    });
  });

  group('AuthRepositoryImpl error mapping', () {
    test('401 login → Err(unauthorized), never throws', () async {
      final repo = AuthRepositoryImpl(_ThrowingRemote(_http(401)), TokenStorage());
      final result = await repo.loginWithEmail('alpha', 'a@b.com', 'password');
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('validation (422) register → Err(validation)', () async {
      final repo = AuthRepositoryImpl(_ThrowingRemote(_http(422)), TokenStorage());
      final result = await repo.registerCustomer(
        'alpha',
        const RegisterParams(fullName: 'a', phone: '+201', email: 'e', password: 'p'),
      );
      expect(result.failureOrNull?.type, FailureType.validation);
    });

  });

  group('RefreshSession use case', () {
    test('propagates the unauthorized failure', () async {
      final repo = _FakeAuthRepository(failure: AppFailure(type: FailureType.unauthorized));
      final result = await RefreshSession(repo)(const NoParams());
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });
  });

  // ── SessionCubit.restore — additionalCheck null-return semantics ─────────────

  group('SessionCubit.restore — additionalCheck semantics', () {
    test('null → unauthenticated, tokens NOT cleared (network-failure path)', () async {
      final storage = _FakeTokenStorage(hasTokens: true);
      final cubit = SessionCubit(storage);

      await cubit.restore(additionalCheck: () async => null);

      expect(cubit.state.isAuthenticated, isFalse);
      expect(storage.clearCount, 0, reason: 'tokens must be preserved for retry');
      expect(storage.hasTokens, isTrue);
    });

    test('false → unauthenticated AND tokens cleared (invalid company / no slug)', () async {
      final storage = _FakeTokenStorage(hasTokens: true);
      final cubit = SessionCubit(storage);

      await cubit.restore(additionalCheck: () async => false);

      expect(cubit.state.isAuthenticated, isFalse);
      expect(storage.clearCount, 1, reason: 'false must trigger token clear');
      expect(storage.hasTokens, isFalse);
    });

    test('true → authenticated, tokens untouched', () async {
      final storage = _FakeTokenStorage(hasTokens: true);
      final cubit = SessionCubit(storage);

      await cubit.restore(additionalCheck: () async => true);

      expect(cubit.state.isAuthenticated, isTrue);
      expect(storage.clearCount, 0);
    });

    test('second restore after null → authenticates from preserved tokens', () async {
      // Simulates: startup network failure (null) preserves tokens,
      // then retry succeeds and restore() is called again without additionalCheck.
      final storage = _FakeTokenStorage(hasTokens: true);
      final cubit = SessionCubit(storage);

      await cubit.restore(additionalCheck: () async => null);
      expect(cubit.state.isAuthenticated, isFalse);
      expect(storage.hasTokens, isTrue); // tokens preserved

      // Retry succeeded — restore without additionalCheck (already validated).
      await cubit.restore();
      expect(cubit.state.isAuthenticated, isTrue);
    });
  });

  group('AuthCubit', () {
    late CustomerTenantStorage tenantStorage;

    setUp(() async {
      SharedPreferences.setMockInitialValues(
        {CustomerTenantStorage.kSlugKey: 'test-company'},
      );
      tenantStorage = CustomerTenantStorage(await SharedPreferences.getInstance());
    });

    AuthCubit build(AuthRepository repo, SessionCubit session) => AuthCubit(
          sessionCubit: session,
          tenantStorage: tenantStorage,
          loginWithEmail: LoginWithEmail(repo),
          registerCustomer: RegisterCustomer(repo),
          requestOtp: RequestOtp(repo),
          verifyOtp: VerifyOtp(repo),
          logoutUser: LogoutUser(repo),
        );

    test('login success adopts the session', () async {
      final repo = _FakeAuthRepository(
        session: const Session(userId: '1', role: AppRole.customer, displayName: 'A'),
      );
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);

      await cubit.loginEmail('a@b.com', 'password');
      expect(cubit.state.status, AuthStatus.success);
      expect(session.state.isAuthenticated, isTrue);
      expect(session.state.role, AppRole.customer);
    });

    test('login failure surfaces an AppFailure without adopting', () async {
      final repo = _FakeAuthRepository(failure: AppFailure(type: FailureType.unauthorized));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);

      await cubit.loginEmail('a@b.com', 'bad');
      expect(cubit.state.status, AuthStatus.failure);
      expect(cubit.state.failure?.type, FailureType.unauthorized);
      expect(session.state.isAuthenticated, isFalse);
    });

    test('requestOtp success moves to otpSent', () async {
      final repo = _FakeAuthRepository(session: const Session(userId: '1', role: AppRole.client));
      final cubit = build(repo, SessionCubit(TokenStorage()));
      await cubit.requestOtp('+201000000000');
      expect(cubit.state.status, AuthStatus.otpSent);
      expect(cubit.state.otpPhone, '+201000000000');
    });

    // ── logout / changeCompany (Sections 3 & 4) ──────────────────────────────

    test('normal logout signs out but preserves the selected company slug', () async {
      final repo = _FakeAuthRepository(
        session: const Session(userId: '1', role: AppRole.customer),
      );
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);

      await cubit.logout();

      // Company preserved — returning user lands on the same company's login screen.
      expect(tenantStorage.selectedCompanySlug, 'test-company');
      expect(session.state.isAuthenticated, isFalse);
    });

    test('changeCompany clears selected company and signs out', () async {
      final repo = _FakeAuthRepository(
        session: const Session(userId: '1', role: AppRole.customer),
      );
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);

      await cubit.changeCompany();

      // Company cleared — router guard redirects to /select-company.
      expect(tenantStorage.selectedCompanySlug, isNull);
      expect(session.state.isAuthenticated, isFalse);
    });

    test('changeCompany local cleanup runs even when backend logout returns error', () async {
      // Simulates network failure during server-side token revocation.
      // Local cleanup (clear company + sign out) must still complete.
      final repo = _BackendLogoutFailRepo();
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);

      await cubit.changeCompany();

      expect(tenantStorage.selectedCompanySlug, isNull,
          reason: 'company must be cleared despite backend error');
      expect(session.state.isAuthenticated, isFalse,
          reason: 'session must be signed out despite backend error');
    });
  });
}

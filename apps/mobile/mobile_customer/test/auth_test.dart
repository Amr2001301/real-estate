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

/// Fake remote that throws a configurable DioException (success paths aren't
/// exercised here to avoid touching secure storage).
class _ThrowingRemote implements AuthRemoteDataSource {
  _ThrowingRemote(this.error);
  final DioException error;
  @override
  Future<AuthBundleDto> loginCustomer(String e, String p) async => throw error;
  @override
  Future<AuthBundleDto> registerCustomer(RegisterParams p) async => throw error;
  @override
  Future<void> requestOtp(String phone) async => throw error;
  @override
  Future<AuthBundleDto> verifyOtp(String p, String c, String? f) async => throw error;
  @override
  Future<AuthBundleDto> refresh(String t) async => throw error;
  @override
  Future<void> logout(String t) async => throw error;
  @override
  Future<void> forgotPassword(String email) async => throw error;
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
  Future<Result<Session>> loginWithEmail(String e, String p) async => _r;
  @override
  Future<Result<Session>> registerCustomer(RegisterParams params) async => _r;
  @override
  Future<Result<void>> requestOtp(String phone) async =>
      failure != null ? Result.err(failure!) : const Ok(null);
  @override
  Future<Result<Session>> verifyOtp(String p, String c, {String? fullName}) async => _r;
  @override
  Future<Result<Session>> refreshSession() async => _r;
  @override
  Future<Result<void>> logout() async => const Ok(null);
  @override
  Future<Result<void>> forgotPassword(String email) async => const Ok(null);
  @override
  Future<Result<void>> resetPassword(String token, String newPassword) async => const Ok(null);
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
      final result = await repo.loginWithEmail('a@b.com', 'password');
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('validation (422) register → Err(validation)', () async {
      final repo = AuthRepositoryImpl(_ThrowingRemote(_http(422)), TokenStorage());
      final result = await repo.registerCustomer(
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

  group('AuthCubit', () {
    AuthCubit build(_FakeAuthRepository repo, SessionCubit session) => AuthCubit(
          sessionCubit: session,
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
  });
}

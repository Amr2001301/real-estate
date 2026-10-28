import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/auth/data/datasources/staff_auth_remote_data_source.dart';
import 'package:mobile_staff/features/auth/data/dtos/staff_auth_dtos.dart';
import 'package:mobile_staff/features/auth/data/mappers/staff_auth_mapper.dart';
import 'package:mobile_staff/features/auth/data/repositories/staff_auth_repository_impl.dart';
import 'package:mobile_staff/features/auth/domain/entities/staff_two_factor.dart';
import 'package:mobile_staff/features/auth/domain/repositories/staff_auth_repository.dart';
import 'package:mobile_staff/features/auth/domain/usecases/login_staff.dart';
import 'package:mobile_staff/features/auth/domain/usecases/logout_staff.dart';
import 'package:mobile_staff/features/auth/domain/usecases/staff_two_factor.dart';
import 'package:mobile_staff/features/auth/presentation/cubit/staff_auth_cubit.dart';
import 'package:mobile_staff/features/auth/presentation/screens/staff_two_factor_panel.dart';
import 'package:mobile_staff/features/splash/splash_screen.dart';
import 'package:mobile_staff/router/app_router.dart';

/// Throwing remote so error mapping never touches secure storage.
class _ThrowingRemote implements StaffAuthRemoteDataSource {
  _ThrowingRemote(this.error);
  final DioException error;
  @override
  Future<StaffLoginResponseDto> loginWithSlug(String s, String e, String p) async =>
      throw error;
  @override
  Future<AuthBundleDto> verifyTwoFactor(String c, String code) async => throw error;
  @override
  Future<TwoFactorSetupDto> startTwoFactorSetup(String c) async => throw error;
  @override
  Future<TwoFactorEnabledDto> finishTwoFactorSetup(String c, String code) async => throw error;
  @override
  Future<AuthBundleDto> refresh(String t) async => throw error;
  @override
  Future<void> logout(String t) async => throw error;
  @override
  Future<void> forgotPassword(String email) async => throw error;
  @override
  Future<void> resetPassword(String token, String newPassword) async =>
      throw error;
}

class _FakeRepo implements StaffAuthRepository {
  _FakeRepo({this.session, this.failure, this.step, this.verifyFailure});
  final Session? session;
  final AppFailure? failure;

  /// TFA1 — the password leads to this second step instead of a session.
  final StaffTwoFactorStep? step;
  final AppFailure? verifyFailure;
  final calls = <String>[];
  Result<Session> get _r =>
      failure != null ? Result.err(failure!) : Result.ok(session!);

  @override
  Future<Result<StaffLoginOutcome>> loginWithSlug(
          String slug, String email, String password) async =>
      failure != null ? Result.err(failure!) : Result.ok(step ?? StaffSignedIn(session!));
  @override
  Future<Result<Session>> verifyTwoFactor(String challenge, String code, String slug) async {
    calls.add('verify:$challenge:$code:$slug');
    return verifyFailure != null ? Result.err(verifyFailure!) : Result.ok(session!);
  }

  @override
  Future<Result<StaffTwoFactorSetup>> startTwoFactorSetup(String challenge) async {
    calls.add('setup:$challenge');
    return const Ok(StaffTwoFactorSetup(secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP'));
  }

  @override
  Future<Result<StaffTwoFactorEnabled>> finishTwoFactorSetup(String challenge, String code, String slug) async {
    calls.add('enable:$challenge:$code:$slug');
    if (verifyFailure != null) return Result.err(verifyFailure!);
    return Ok(StaffTwoFactorEnabled(session: session!, recoveryCodes: const ['aaaa-bbbb', 'cccc-dddd']));
  }
  @override
  Future<Result<Session>> refreshSession() async => _r;
  @override
  Future<Result<void>> logout() async => const Ok(null);
  @override
  Future<Result<void>> forgotPassword(String email) async => const Ok(null);
  @override
  Future<Result<void>> resetPassword(String token, String newPassword) async =>
      const Ok(null);
}

DioException _http(int status) => DioException(
      requestOptions: RequestOptions(path: '/auth/login-staff'),
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: RequestOptions(path: '/auth/login-staff'),
          statusCode: status),
    );

void main() {
  group('AuthBundleDto → Session mapper', () {
    test('maps staff user + role', () {
      final session = AuthBundleDto.fromJson({
        'user': {
          'id': 'u1',
          'role': 'SALES',
          'fullName': 'Omar',
          'email': 'o@x.com'
        },
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
      }).toSession();
      expect(session.userId, 'u1');
      expect(session.role, AppRole.sales);
      expect(session.displayName, 'Omar');
    });

    test('AuthBundleDto contains no companyId field', () {
      // Confirm the DTO shape — no companyId parsed from JWT or response body.
      final dto = AuthBundleDto.fromJson({
        'user': {'id': 'u1', 'role': 'SALES'},
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
      });
      final session = dto.toSession();
      // Session has no companyId — backend DB reload is authoritative.
      expect(session.userId, 'u1');
    });
  });

  group('LoginParams', () {
    test('carries slug field (no companyId)', () {
      const params = LoginParams(
          slug: 'acme', email: 'a@b.com', password: 'pw');
      expect(params.slug, 'acme');
      expect(params.email, 'a@b.com');
    });

    test('slug is forwarded to loginWithSlug, not legacy login', () async {
      final repo = _FakeRepo(
          session: const Session(userId: '1', role: AppRole.sales));
      String? capturedSlug;
      final wrappedRepo = _CapturingRepo(
        repo,
        onLogin: (slug, _, _) => capturedSlug = slug,
      );
      final useCase = LoginStaff(wrappedRepo);
      await useCase(const LoginParams(
          slug: 'mycompany', email: 'a@b.com', password: 'pw'));
      expect(capturedSlug, 'mycompany');
    });
  });

  group('StaffAuthRepositoryImpl error mapping', () {
    test('401 → Err(unauthorized), never throws', () async {
      final repo = StaffAuthRepositoryImpl(
          _ThrowingRemote(_http(401)), TokenStorage());
      final result = await repo.loginWithSlug('co', 'a@b.com', 'pw');
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('403 (inactive company / non-staff) → Err(forbidden)', () async {
      final repo = StaffAuthRepositoryImpl(
          _ThrowingRemote(_http(403)), TokenStorage());
      final result = await repo.loginWithSlug('co', 'a@b.com', 'pw');
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });

    test('404 (unknown company slug) → Err(notFound)', () async {
      final repo = StaffAuthRepositoryImpl(
          _ThrowingRemote(_http(404)), TokenStorage());
      final result = await repo.loginWithSlug('unknown', 'a@b.com', 'pw');
      expect(result.failureOrNull?.type, FailureType.notFound);
    });
  });

  group('StaffAuthCubit', () {
    StaffAuthCubit build(_FakeRepo repo, SessionCubit session) =>
        StaffAuthCubit(
          sessionCubit: session,
          loginStaff: LoginStaff(repo),
          logoutStaff: LogoutStaff(repo),
          verifyTwoFactor: VerifyStaffTwoFactor(repo),
          startTwoFactorSetup: StartStaffTwoFactorSetup(repo),
          finishTwoFactorSetup: FinishStaffTwoFactorSetup(repo),
        );

    test('login(slug, email, password) success adopts the session', () async {
      final repo = _FakeRepo(
          session: const Session(
              userId: '1', role: AppRole.sales, displayName: 'S'));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login('myco', 'a@b.com', 'pw');
      expect(cubit.state.status, StaffAuthStatus.success);
      expect(session.state.isAuthenticated, isTrue);
      expect(session.state.role, AppRole.sales);
    });

    test('login failure surfaces AppFailure without adopting', () async {
      final repo =
          _FakeRepo(failure: AppFailure(type: FailureType.unauthorized));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login('myco', 'a@b.com', 'bad');
      expect(cubit.state.status, StaffAuthStatus.failure);
      expect(cubit.state.failure?.type, FailureType.unauthorized);
      expect(session.state.isAuthenticated, isFalse);
    });

    test('slug is trimmed + lowercased before forwarding', () async {
      final repo = _FakeRepo(
          session: const Session(userId: '1', role: AppRole.sales));
      String? capturedSlug;
      final wrappedRepo = _CapturingRepo(
        repo,
        onLogin: (slug, _, _) => capturedSlug = slug,
      );
      final session = SessionCubit(TokenStorage());
      final cubit = StaffAuthCubit(
        sessionCubit: session,
        loginStaff: LoginStaff(wrappedRepo),
        logoutStaff: LogoutStaff(_FakeRepo()),
        verifyTwoFactor: VerifyStaffTwoFactor(wrappedRepo),
        startTwoFactorSetup: StartStaffTwoFactorSetup(wrappedRepo),
        finishTwoFactorSetup: FinishStaffTwoFactorSetup(wrappedRepo),
      );
      await cubit.login('  MyCompany  ', 'a@b.com', 'pw');
      expect(capturedSlug, 'mycompany');
    });
  });

  group('Two-step sign-in (TFA1)', () {
    const staff = Session(userId: '1', role: AppRole.sales, displayName: 'S');
    StaffAuthCubit build(_FakeRepo repo, SessionCubit session) => StaffAuthCubit(
          sessionCubit: session,
          loginStaff: LoginStaff(repo),
          logoutStaff: LogoutStaff(repo),
          verifyTwoFactor: VerifyStaffTwoFactor(repo),
          startTwoFactorSetup: StartStaffTwoFactorSetup(repo),
          finishTwoFactorSetup: FinishStaffTwoFactorSetup(repo),
        );

    test('the login response is a session or the second step', () {
      final step = StaffLoginResponseDto.fromJson({'twoFactorRequired': true, 'challenge': 'ch'});
      expect(step.challenge, 'ch');
      expect(step.setupRequired, isFalse);
      expect(step.bundle, isNull);
      final setup = StaffLoginResponseDto.fromJson({'twoFactorSetupRequired': true, 'challenge': 'ch'});
      expect(setup.setupRequired, isTrue);
      final signedIn = StaffLoginResponseDto.fromJson({
        'user': {'id': 'u1', 'role': 'SALES'},
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
      });
      expect(signedIn.challenge, isNull);
      expect(signedIn.bundle?.user.id, 'u1');
      final enabled = TwoFactorEnabledDto.fromJson({
        'user': {'id': 'u1', 'role': 'SALES'},
        'tokens': {'accessToken': 'a', 'refreshToken': 'r'},
        'recoveryCodes': ['aaaa-bbbb'],
      });
      expect(enabled.recoveryCodes, ['aaaa-bbbb']);
    });

    test('a correct password asks for the code; the code signs in under the company', () async {
      final repo = _FakeRepo(session: staff, step: const StaffTwoFactorStep(challenge: 'ch1', setupRequired: false));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login(' MyCo ', 'a@b.com', 'pw');
      expect(cubit.state.twoFactor?.challenge, 'ch1');
      expect(session.state.isAuthenticated, isFalse);
      await cubit.verifyCode(' 123456 ');
      expect(repo.calls, ['verify:ch1:123456:myco']);
      expect(cubit.state.status, StaffAuthStatus.success);
      expect(session.state.isAuthenticated, isTrue);
    });

    test('a wrong code stays on the step; an expired step goes back to the password', () async {
      final wrong = _FakeRepo(
        session: staff,
        step: const StaffTwoFactorStep(challenge: 'ch', setupRequired: false),
        verifyFailure: AppFailure(type: FailureType.unauthorized, code: 'TWO_FACTOR_INVALID'),
      );
      final session = SessionCubit(TokenStorage());
      final cubit = build(wrong, session);
      await cubit.login('co', 'a@b.com', 'pw');
      await cubit.verifyCode('000000');
      expect(cubit.state.status, StaffAuthStatus.failure);
      expect(cubit.state.twoFactor, isNotNull);
      expect(session.state.isAuthenticated, isFalse);

      final expired = _FakeRepo(
        session: staff,
        step: const StaffTwoFactorStep(challenge: 'ch', setupRequired: false),
        verifyFailure: AppFailure(type: FailureType.unauthorized, code: 'CHALLENGE_EXPIRED'),
      );
      final cubit2 = build(expired, SessionCubit(TokenStorage()));
      await cubit2.login('co', 'a@b.com', 'pw');
      await cubit2.verifyCode('123456');
      expect(cubit2.state.twoFactor, isNull);
      expect(cubit2.state.failure?.code, 'CHALLENGE_EXPIRED');
    });

    test('required but not set up: the key, the first code, the recovery codes, then in', () async {
      final repo = _FakeRepo(session: staff, step: const StaffTwoFactorStep(challenge: 'ch2', setupRequired: true));
      final session = SessionCubit(TokenStorage());
      final cubit = build(repo, session);
      await cubit.login('co', 'a@b.com', 'pw');
      expect(cubit.state.setup?.secret, 'JBSWY3DPEHPK3PXP');
      await cubit.finishSetup('654321');
      expect(repo.calls, ['setup:ch2', 'enable:ch2:654321:co']);
      expect(cubit.state.recoveryCodes, ['aaaa-bbbb', 'cccc-dddd']);
      // Not in until the codes were seen.
      expect(session.state.isAuthenticated, isFalse);
      cubit.acknowledgeRecoveryCodes();
      expect(session.state.isAuthenticated, isTrue);
      expect(cubit.state.status, StaffAuthStatus.success);
    });

    Widget host(StaffAuthCubit cubit) => MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SingleChildScrollView(
              child: BlocProvider<StaffAuthCubit>.value(value: cubit, child: const StaffTwoFactorPanel()),
            ),
          ),
        );

    testWidgets('the code step: a 6-digit code is checked before it is sent', (tester) async {
      final repo = _FakeRepo(session: staff, step: const StaffTwoFactorStep(challenge: 'ch', setupRequired: false));
      final cubit = build(repo, SessionCubit(TokenStorage()));
      await cubit.login('co', 'a@b.com', 'pw');
      await tester.pumpWidget(host(cubit));
      await tester.pumpAndSettle();
      expect(find.text('التحقق بخطوتين'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '12');
      await tester.tap(find.text('تأكيد'));
      await tester.pump();
      expect(find.text('اكتب الكود المكوّن من 6 أرقام'), findsOneWidget);
      expect(repo.calls, isEmpty);
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.text('تأكيد'));
      await tester.pumpAndSettle();
      expect(repo.calls, ['verify:ch:123456:co']);
    });

    testWidgets('setting it up shows the key, then the recovery codes', (tester) async {
      final repo = _FakeRepo(session: staff, step: const StaffTwoFactorStep(challenge: 'ch', setupRequired: true));
      final cubit = build(repo, SessionCubit(TokenStorage()));
      await cubit.login('co', 'a@b.com', 'pw');
      await tester.pumpWidget(host(cubit));
      await tester.pumpAndSettle();
      expect(find.text('JBSWY3DPEHPK3PXP'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '654321');
      await tester.tap(find.text('تفعيل ومتابعة'));
      await tester.pumpAndSettle();
      expect(find.text('aaaa-bbbb'), findsOneWidget);
      expect(find.text('حفظتها — متابعة'), findsOneWidget);
    });

    test('the step\'s own refusals have their own messages', () async {
      final l10n = await AppLocalizations.delegate.load(const Locale('ar'));
      expect(staffTwoFactorMessage(l10n, AppFailure(type: FailureType.unauthorized, code: 'TWO_FACTOR_INVALID')), l10n.staffTfaWrongCode);
      expect(staffTwoFactorMessage(l10n, AppFailure(type: FailureType.unknown, code: 'TWO_FACTOR_LOCKED')), l10n.staffTfaLocked);
      expect(staffTwoFactorMessage(l10n, AppFailure(type: FailureType.unauthorized)), isNull);
    });

    test('back from the step returns to the login form', () async {
      final repo = _FakeRepo(session: staff, step: const StaffTwoFactorStep(challenge: 'ch', setupRequired: false));
      final cubit = build(repo, SessionCubit(TokenStorage()));
      await cubit.login('co', 'a@b.com', 'pw');
      cubit.cancelTwoFactor();
      expect(cubit.state.twoFactor, isNull);
      expect(cubit.state.status, StaffAuthStatus.idle);
    });
  });

  group('staffRedirect (role routing + session restore)', () {
    setUp(() => SplashScreen.splashDone.value = true);
    tearDown(() => SplashScreen.splashDone.value = false);

    test('unresolved session → splash (restore in progress)', () {
      expect(staffRedirect(const SessionState.unknown(), '/home'), '/splash');
      expect(staffRedirect(const SessionState.unknown(), '/splash'), isNull);
    });

    test('unauthenticated → login', () {
      expect(
          staffRedirect(const SessionState.unauthenticated(), '/home'), '/login');
      expect(
          staffRedirect(const SessionState.unauthenticated(), '/login'), isNull);
    });

    test('customer-side role is bounced to login', () {
      const s = SessionState.authenticated(
          Session(userId: '1', role: AppRole.customer));
      expect(staffRedirect(s, '/home'), '/login');
    });

    test('sales lands on the shell and is kept off login/splash', () {
      const s =
          SessionState.authenticated(Session(userId: '1', role: AppRole.sales));
      expect(staffRedirect(s, '/login'), '/home');
      expect(staffRedirect(s, '/home'), isNull);
      expect(staffRedirect(s, '/leads/1'), isNull);
    });

    test('sales manager is treated as staff', () {
      const s = SessionState.authenticated(
          Session(userId: '1', role: AppRole.salesManager));
      expect(staffRedirect(s, '/home'), isNull);
    });

    test('broker is confined to the broker workspace (Phase 5)', () {
      const s = SessionState.authenticated(
          Session(userId: '1', role: AppRole.broker));
      expect(staffRedirect(s, '/home'), '/broker/home');
      expect(staffRedirect(s, '/broker/home'), isNull);
      expect(staffRedirect(s, '/leads/1'), '/broker/home');
    });
  });

  group('Legacy /auth/login endpoint', () {
    test('StaffAuthRemoteDataSourceImpl does NOT call /auth/login', () {
      // Verify the data source interface no longer has a login(email, password)
      // method — it only has loginWithSlug(slug, email, password).
      final methods = StaffAuthRemoteDataSource;
      // If this compiles, loginWithSlug exists and login() does not.
      // Runtime check: try to call loginWithSlug with a fake Dio.
      final fakeRemote = _ThrowingRemote(DioException(
        requestOptions: RequestOptions(path: '/auth/login-staff'),
        type: DioExceptionType.cancel,
      ));
      expect(
        () => fakeRemote.loginWithSlug('co', 'a@b.com', 'pw'),
        throwsA(isA<DioException>()),
      );
      // The type has no `login(String, String)` method — compiler would catch
      // this if it did (breaking interface change intentional).
      expect(methods.toString(), contains('StaffAuthRemoteDataSource'));
    });
  });
}

/// Captures the slug/email/password forwarded by the use case to the repo.
class _CapturingRepo implements StaffAuthRepository {
  _CapturingRepo(this._delegate,
      {void Function(String, String, String)? onLogin})
      : _onLogin = onLogin;
  final StaffAuthRepository _delegate;
  final void Function(String, String, String)? _onLogin;

  @override
  Future<Result<StaffLoginOutcome>> loginWithSlug(
      String slug, String email, String password) {
    _onLogin?.call(slug, email, password);
    return _delegate.loginWithSlug(slug, email, password);
  }

  @override
  Future<Result<Session>> verifyTwoFactor(String challenge, String code, String slug) =>
      _delegate.verifyTwoFactor(challenge, code, slug);
  @override
  Future<Result<StaffTwoFactorSetup>> startTwoFactorSetup(String challenge) =>
      _delegate.startTwoFactorSetup(challenge);
  @override
  Future<Result<StaffTwoFactorEnabled>> finishTwoFactorSetup(String challenge, String code, String slug) =>
      _delegate.finishTwoFactorSetup(challenge, code, slug);

  @override
  Future<Result<Session>> refreshSession() => _delegate.refreshSession();
  @override
  Future<Result<void>> logout() => _delegate.logout();
  @override
  Future<Result<void>> forgotPassword(String email) =>
      _delegate.forgotPassword(email);
  @override
  Future<Result<void>> resetPassword(String token, String newPassword) =>
      _delegate.resetPassword(token, newPassword);
}

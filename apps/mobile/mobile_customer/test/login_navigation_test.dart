import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_customer/features/auth/domain/repositories/auth_repository.dart';
import 'package:mobile_customer/features/auth/domain/usecases/login_with_email.dart';
import 'package:mobile_customer/features/auth/domain/usecases/logout_user.dart';
import 'package:mobile_customer/features/auth/domain/usecases/register_customer.dart';
import 'package:mobile_customer/features/auth/domain/usecases/request_otp.dart';
import 'package:mobile_customer/features/auth/domain/usecases/verify_otp.dart';
import 'package:mobile_customer/features/auth/presentation/auth_cubit.dart';
import 'package:mobile_customer/features/auth/presentation/login_screen.dart';
import 'package:mobile_customer/router/auth_navigation.dart';

/// Regression coverage for the post-auth redirect flow.
///
/// Auth screens are opened with `context.push(...)`, so the router's `redirect`
/// guard (which keys off `matchedLocation` — still the underlying route) can
/// never move an authenticated user off them. Each auth screen navigates itself
/// on success, to a validated `?redirect=` target or `/account` as fallback.
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this._session);
  final Session _session;

  @override
  Future<Result<Session>> loginWithEmail(String e, String p) async =>
      Result.ok(_session);
  @override
  Future<Result<Session>> registerCustomer(RegisterParams params) async =>
      Result.ok(_session);
  @override
  Future<Result<void>> requestOtp(String phone) async => const Ok(null);
  @override
  Future<Result<Session>> verifyOtp(String p, String c, {String? fullName}) async =>
      Result.ok(_session);
  @override
  Future<Result<Session>> refreshSession() async => Result.ok(_session);
  @override
  Future<Result<void>> logout() async => const Ok(null);
  @override
  Future<Result<void>> forgotPassword(String email) async => const Ok(null);
  @override
  Future<Result<void>> resetPassword(String token, String newPassword) async => const Ok(null);
}

void main() {
  group('safePostAuthRedirect', () {
    test('missing / empty → /account', () {
      expect(safePostAuthRedirect(null), '/account');
      expect(safePostAuthRedirect(''), '/account');
    });

    test('valid in-app path (with query) is preserved', () {
      expect(safePostAuthRedirect('/units/123'), '/units/123');
      expect(safePostAuthRedirect('/projects?city=Cairo'), '/projects?city=Cairo');
    });

    test('external / absolute URLs → /account', () {
      expect(safePostAuthRedirect('https://evil.com'), '/account');
      expect(safePostAuthRedirect('//evil.com'), '/account');
      expect(safePostAuthRedirect('http://localhost/x'), '/account');
    });

    test('relative (non-root) path → /account', () {
      expect(safePostAuthRedirect('units/123'), '/account');
    });

    test('auth routes → /account (no loop)', () {
      expect(safePostAuthRedirect('/login'), '/account');
      expect(safePostAuthRedirect('/register'), '/account');
      expect(safePostAuthRedirect('/login/otp'), '/account');
    });
  });

  group('login navigation (end-to-end)', () {
    /// Pumps a minimal app, opens [loginUrl] via `push` over `/home`, logs in
    /// successfully, and returns the resulting location.
    Future<String> loginAndSettle(
      WidgetTester tester, {
      required String loginUrl,
    }) async {
      final session = SessionCubit(TokenStorage())..adoptSignedOut();
      addTearDown(session.close);

      AuthRepository repo() => _FakeAuthRepository(
            const Session(
                userId: 'u1', role: AppRole.customer, displayName: 'Amr'),
          );
      final authCubit = AuthCubit(
        sessionCubit: session,
        loginWithEmail: LoginWithEmail(repo()),
        registerCustomer: RegisterCustomer(repo()),
        requestOtp: RequestOtp(repo()),
        verifyOtp: VerifyOtp(repo()),
        logoutUser: LogoutUser(repo()),
      );
      addTearDown(authCubit.close);

      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          GoRoute(path: '/home', builder: (_, _) => const Text('home-screen')),
          GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
          GoRoute(
            path: '/account',
            builder: (_, _) => const Text('account-screen'),
          ),
          GoRoute(
            path: '/units/:id',
            builder: (_, s) => Text('unit-${s.pathParameters['id']}'),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        BlocProvider<AuthCubit>.value(
          value: authCubit,
          child: MaterialApp.router(
            routerConfig: router,
            locale: const Locale('en'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            theme: AppTheme.light(isArabic: false),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open login the way the app does — pushed on top of the current route.
      router.push(loginUrl);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'client@example.com');
      await tester.enterText(fields.at(1), 'amrrakha2001');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsNothing,
          reason: 'the pushed login screen must be gone after success');
      expect(session.state.isAuthenticated, isTrue);
      return router.routerDelegate.currentConfiguration.uri.toString();
    }

    testWidgets('no redirect → /account', (tester) async {
      final loc = await loginAndSettle(tester, loginUrl: '/login');
      expect(loc, '/account');
      expect(find.text('account-screen'), findsOneWidget);
    });

    testWidgets('valid redirect → returns to origin', (tester) async {
      final loc = await loginAndSettle(
        tester,
        loginUrl: Uri(
          path: '/login',
          queryParameters: const {'redirect': '/units/123'},
        ).toString(),
      );
      expect(loc, '/units/123');
      expect(find.text('unit-123'), findsOneWidget);
    });

    testWidgets('external redirect → /account', (tester) async {
      final loc = await loginAndSettle(
        tester,
        loginUrl: Uri(
          path: '/login',
          queryParameters: const {'redirect': 'https://evil.com'},
        ).toString(),
      );
      expect(loc, '/account');
    });

    testWidgets('auth-route redirect → /account (no loop)', (tester) async {
      final loc = await loginAndSettle(
        tester,
        loginUrl: Uri(
          path: '/login',
          queryParameters: const {'redirect': '/login'},
        ).toString(),
      );
      expect(loc, '/account');
    });
  });
}

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

/// Regression: the auth screens are opened with `context.push(...)`, so the
/// router's `redirect` (which keys off `matchedLocation` — still the underlying
/// route, e.g. `/home`) can never move an authenticated user off them. The
/// LoginScreen must therefore navigate to `/account` itself on success.
/// Before the fix, a successful login left the pushed LoginScreen on top of the
/// stack — visually "nothing happens" until a restart.
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
}

void main() {
  testWidgets('successful login on a pushed /login lands on /account',
      (tester) async {
    final session = SessionCubit(TokenStorage())..adoptSignedOut();
    addTearDown(session.close);

    final repo = _FakeAuthRepository(
      const Session(userId: 'u1', role: AppRole.customer, displayName: 'Amr'),
    );
    final authCubit = AuthCubit(
      sessionCubit: session,
      loginWithEmail: LoginWithEmail(repo),
      registerCustomer: RegisterCustomer(repo),
      requestOtp: RequestOtp(repo),
      verifyOtp: VerifyOtp(repo),
      logoutUser: LogoutUser(repo),
    );
    addTearDown(authCubit.close);

    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const Text('home-screen')),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(
          path: '/account',
          builder: (_, __) => const Text('account-screen'),
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

    // Open login the way the app does — pushed on top of /home.
    router.push('/login');
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);

    // Fill the form and submit.
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'client@example.com');
    await tester.enterText(fields.at(1), 'amrrakha2001');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(find.text('account-screen'), findsOneWidget,
        reason: 'login should navigate to /account');
    expect(find.byType(LoginScreen), findsNothing,
        reason: 'the pushed login screen must be gone');
    expect(session.state.isAuthenticated, isTrue);
  });
}

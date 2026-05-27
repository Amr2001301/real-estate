import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/splash/splash_screen.dart';

/// Staff App routing. Unlike the Customer App, **everything requires
/// authentication** — there is no guest tier. Customer-side roles are bounced
/// back to login (a real backend role check lands with the auth phase).
GoRouter createStaffRouter(SessionCubit sessionCubit) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _CubitRefresh(sessionCubit.stream),
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) {
      final session = sessionCubit.state;
      final loc = state.matchedLocation;

      if (!session.isResolved) return loc == '/splash' ? null : '/splash';

      final isStaff = session.isAuthenticated && session.role.isStaffSide;
      if (!isStaff) return loc == '/login' ? null : '/login';
      if (loc == '/login' || loc == '/splash') return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/dashboard', builder: (_, _) => const DashboardScreen()),
      GoRoute(
        path: '/gallery',
        builder: (_, _) => const ComponentGalleryScreen(),
      ),
    ],
  );
}

/// Bridges a bloc/cubit [Stream] to a [Listenable] for GoRouter's
/// `refreshListenable`.
class _CubitRefresh extends ChangeNotifier {
  _CubitRefresh(Stream<dynamic> stream) {
    notifyListeners();
    _sub = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

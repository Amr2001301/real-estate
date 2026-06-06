import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Query-parameter key carrying the route to return to after a successful auth
/// flow (login / register / OTP). See [AuthNavigationX].
const String kRedirectParam = 'redirect';

/// Auth routes a post-auth redirect must never target (it would loop straight
/// back into the auth flow). Mirrors `_authRoutes` in `app_router.dart`.
const Set<String> _authPaths = {'/login', '/register', '/login/otp'};

/// Validates a post-auth `redirect` target and returns a safe destination.
///
/// Falls back to `/account` when the value is missing, unparseable, external
/// (has a scheme or authority, e.g. `https://evil.com`), relative, or points
/// back at an auth screen (which would loop).
String safePostAuthRedirect(String? value) {
  if (value == null || value.isEmpty) return '/account';

  final uri = Uri.tryParse(value);
  if (uri == null) return '/account';

  // Reject external/absolute URLs (`https://…`, `//host`, `scheme:…`).
  if (uri.hasScheme || uri.hasAuthority) return '/account';

  // Only in-app, root-relative paths are allowed.
  if (!uri.path.startsWith('/')) return '/account';

  if (_authPaths.contains(uri.path)) return '/account';

  return uri.toString();
}

extension AuthNavigationX on BuildContext {
  /// The `redirect` target carried by the currently active route, if any.
  String? get _activeRedirect =>
      GoRouterState.of(this).uri.queryParameters[kRedirectParam];

  /// Opens `/login`, remembering the current route so the user is returned
  /// here after authenticating. Use for contextual sign-in prompts (favoriting,
  /// requesting a visit, other protected actions).
  void pushLoginWithRedirect() {
    final from = GoRouterState.of(this).uri.toString();
    push(
      Uri(path: '/login', queryParameters: {kRedirectParam: from}).toString(),
    );
  }

  /// Navigates to another auth route ([path], e.g. `/register`, `/login/otp`)
  /// while preserving the active `redirect` parameter, so it survives hops
  /// between the auth screens.
  void pushAuthRoute(String path) {
    final redirect = _activeRedirect;
    push(
      Uri(
        path: path,
        queryParameters: redirect == null ? null : {kRedirectParam: redirect},
      ).toString(),
    );
  }

  /// Navigates after a successful auth: to the remembered (validated) route, or
  /// `/account` when there is none or it is unsafe. Uses `go` (not `pop`) so the
  /// pushed auth screen is removed from the stack.
  void goPostAuth() => go(safePostAuthRedirect(_activeRedirect));
}

import 'interceptors/auth_interceptor.dart';

/// Breaks the chicken-and-egg between Dio and the auth feature: `Dio` is built
/// in `buildAppRoot` (core) before the app's auth repository exists, but the
/// 401→refresh handler needs that repository. The app sets [handler] once the
/// auth repository is constructed; the interceptor calls through this registry.
class SessionRefresherRegistry {
  SessionRefresher? handler;

  /// Matches the [SessionRefresher] signature passed to the AuthInterceptor.
  Future<String?> call() async => handler == null ? null : handler!();
}

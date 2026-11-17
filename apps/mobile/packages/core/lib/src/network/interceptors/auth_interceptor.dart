import 'package:dio/dio.dart';

/// Reads the current access token (or null when signed out).
typedef AccessTokenReader = Future<String?> Function();

/// Attempts to refresh the session. Returns the new access token on success,
/// or null if refresh failed / is not yet wired.
///
/// Phase 1 ships a placeholder that returns null (the `/auth/refresh` flow is
/// implemented in a later phase). The retry/serialization machinery here is
/// already correct, so wiring it later is a one-line change.
typedef SessionRefresher = Future<String?> Function();

/// Called when refresh is impossible/failed and the session must be cleared.
typedef SessionInvalidator = Future<void> Function();

/// Injects `Authorization: Bearer <token>` and transparently retries once on a
/// 401 after refreshing. Concurrent 401s share one in-flight refresh, not a
/// stampede.
///
/// Not a `QueuedInterceptorsWrapper`: that queues every error, and the apps
/// send `/auth/refresh` through this same client — a refused refresh then
/// waited behind the 401 that started it, and every request on the screen
/// hung for good (the staff dashboard stuck on its loading cards).
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required Dio retryClient,
    required AccessTokenReader readAccessToken,
    SessionRefresher? refreshSession,
    SessionInvalidator? invalidateSession,
  })  : _retryClient = retryClient,
        _readAccessToken = readAccessToken,
        _refreshSession = refreshSession,
        _invalidateSession = invalidateSession;

  final Dio _retryClient;
  final AccessTokenReader _readAccessToken;
  final SessionRefresher? _refreshSession;
  final SessionInvalidator? _invalidateSession;

  /// Marks a request as exempt from auth (public endpoints, e.g. chat, catalog).
  static const String skipAuthExtra = 'skipAuth';

  /// Internal flag to prevent infinite refresh→retry loops.
  static const String _retriedExtra = 'authRetried';

  /// The refresh under way, shared by every 401 that arrives meanwhile.
  Future<String?>? _refreshing;

  Future<String?> _refreshOnce() {
    return _refreshing ??= () async {
      try {
        final token = await _refreshSession!();
        if (token == null || token.isEmpty) await _invalidateSession?.call();
        return token;
      } catch (_) {
        await _invalidateSession?.call();
        return null;
      } finally {
        _refreshing = null;
      }
    }();
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra[skipAuthExtra] == true) {
      return handler.next(options);
    }
    final token = await _readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    final isUnauthorized = response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra[_retriedExtra] == true;
    final canRefresh = _refreshSession != null &&
        err.requestOptions.extra[skipAuthExtra] != true;

    if (!isUnauthorized || alreadyRetried || !canRefresh) {
      return handler.next(err);
    }

    final newToken = await _refreshOnce();
    if (newToken == null || newToken.isEmpty) {
      return handler.next(err);
    }

    // Replay the original request once with the refreshed token.
    final options = err.requestOptions
      ..extra[_retriedExtra] = true
      ..headers['Authorization'] = 'Bearer $newToken';

    try {
      final retried = await _retryClient.fetch<dynamic>(options);
      return handler.resolve(retried);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }
}

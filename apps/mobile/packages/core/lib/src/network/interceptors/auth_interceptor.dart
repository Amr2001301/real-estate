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
/// 401 after refreshing. Uses [QueuedInterceptorsWrapper] so concurrent 401s
/// trigger a single refresh, not a stampede.
class AuthInterceptor extends QueuedInterceptorsWrapper {
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

    final newToken = await _refreshSession();
    if (newToken == null || newToken.isEmpty) {
      await _invalidateSession?.call();
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

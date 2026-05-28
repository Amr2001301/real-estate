import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../auth/token_storage.dart';
import '../env/env_config.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/locale_interceptor.dart';
import 'interceptors/request_id_interceptor.dart';

/// Builds the app-wide configured [Dio]. Constructed once in the app
/// composition root (`bootstrap.dart`) and provided to the widget tree via a
/// `RepositoryProvider`.
///
/// Wires: request id, locale header, bearer injection (from secure storage),
/// and the 401→refresh→retry machinery (its [SessionRefresher] stays null until
/// the auth phase wires `/auth/refresh`). Errors are normalized to `AppFailure`
/// by callers via `guardApiCall` / `DioErrorMapper` — not here.
abstract final class DioClientFactory {
  static Dio create({
    required EnvConfig env,
    required TokenStorage tokenStorage,
    required String Function() readLocale,
    SessionRefresher? refreshSession,
  }) {
    BaseOptions baseOptions() => BaseOptions(
          baseUrl: env.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 20),
          contentType: 'application/json',
          // Only 2xx is success; 4xx/5xx throw DioException so guardApiCall +
          // DioErrorMapper turn them into AppFailure (and AuthInterceptor can
          // catch 401 for refresh).
          validateStatus: (status) => status != null && status >= 200 && status < 300,
        );

    // Bare client to replay a request after refresh without re-entering auth.
    final retryClient = Dio(baseOptions());

    final client = Dio(baseOptions());
    client.interceptors.addAll([
      RequestIdInterceptor(),
      LocaleInterceptor(readLocale),
      AuthInterceptor(
        retryClient: retryClient,
        readAccessToken: tokenStorage.readAccessToken,
        refreshSession: refreshSession,
        invalidateSession: tokenStorage.clear,
      ),
    ]);

    if (env.enableLogging && kDebugMode) {
      // Debug-only, and deliberately minimal: log the request line + response
      // status, but NEVER headers (bearer token) or bodies (login password,
      // OTP codes, signed URLs, financial data).
      client.interceptors.add(
        LogInterceptor(
          request: true,
          requestHeader: false,
          requestBody: false,
          responseHeader: false,
          responseBody: false,
          error: true,
          logPrint: (Object o) => debugPrint(o.toString()),
        ),
      );
    }

    return client;
  }
}

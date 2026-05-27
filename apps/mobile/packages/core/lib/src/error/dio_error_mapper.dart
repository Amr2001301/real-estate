import 'package:dio/dio.dart';

import '../network/interceptors/request_id_interceptor.dart';
import 'app_failure.dart';
import 'failure_type.dart';

/// Translates every [DioException] into a safe [AppFailure].
///
/// Rules:
/// - No raw backend message reaches the user, **except** validation detail
///   (400/422), which is user-facing by nature and captured in
///   [AppFailure.validationMessages] / [AppFailure.fieldErrors].
/// - The request id (`X-Request-Id`) is attached for log correlation.
abstract final class DioErrorMapper {
  static AppFailure map(DioException e) {
    final requestId =
        e.requestOptions.headers[RequestIdInterceptor.headerName]?.toString();
    final technical = _technical(e);

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return AppFailure(
          type: FailureType.timeout,
          technicalMessage: technical,
          requestId: requestId,
          originalError: e,
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return AppFailure(
          type: FailureType.network,
          technicalMessage: technical,
          requestId: requestId,
          originalError: e,
        );
      case DioExceptionType.cancel:
        // A cancelled request is not a user-facing error in practice; treat as
        // unknown + non-retryable so callers can ignore it.
        return AppFailure(
          type: FailureType.unknown,
          technicalMessage: 'request cancelled',
          requestId: requestId,
          originalError: e,
        );
      case DioExceptionType.badResponse:
        return _fromResponse(e, requestId, technical);
      case DioExceptionType.unknown:
        return AppFailure(
          type: FailureType.network,
          technicalMessage: technical,
          requestId: requestId,
          originalError: e,
        );
    }
  }

  static AppFailure _fromResponse(
    DioException e,
    String? requestId,
    String technical,
  ) {
    final status = e.response?.statusCode;
    final body = e.response?.data;
    final code = _extractCode(body);

    final type = switch (status) {
      400 || 422 => FailureType.validation,
      401 => FailureType.unauthorized,
      403 => FailureType.forbidden,
      404 => FailureType.notFound,
      503 => FailureType.maintenance,
      _ when status != null && status >= 500 => FailureType.server,
      _ => FailureType.unknown,
    };

    final validationMessages =
        type == FailureType.validation ? _extractMessages(body) : const <String>[];

    return AppFailure(
      type: type,
      statusCode: status,
      code: code,
      requestId: requestId,
      technicalMessage: technical,
      originalError: e,
      validationMessages: validationMessages,
    );
  }

  /// NestJS error bodies look like `{ message: string | string[], code?, error? }`.
  /// Only validation messages are considered safe to surface.
  static List<String> _extractMessages(Object? body) {
    if (body is Map) {
      final msg = body['message'];
      if (msg is String && msg.isNotEmpty) return [msg];
      if (msg is List) {
        return msg.whereType<String>().where((m) => m.isNotEmpty).toList();
      }
    }
    return const [];
  }

  static String? _extractCode(Object? body) {
    if (body is Map && body['code'] is String) return body['code'] as String;
    return null;
  }

  /// Builds a log-only technical string. Never shown to users.
  static String _technical(DioException e) {
    final method = e.requestOptions.method;
    final path = e.requestOptions.path;
    final status = e.response?.statusCode;
    return '${e.type.name} $method $path'
        '${status != null ? ' -> $status' : ''}'
        '${e.message != null ? ' (${e.message})' : ''}';
  }
}

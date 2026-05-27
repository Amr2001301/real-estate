import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _dio(
  DioExceptionType type, {
  int? status,
  Object? body,
  String? requestId,
}) {
  final options = RequestOptions(
    path: '/x',
    method: 'GET',
    headers: requestId == null
        ? null
        : {RequestIdInterceptor.headerName: requestId},
  );
  return DioException(
    requestOptions: options,
    type: type,
    response: status == null
        ? null
        : Response(requestOptions: options, statusCode: status, data: body),
  );
}

void main() {
  group('DioErrorMapper', () {
    test('timeouts map to retryable timeout', () {
      final f = DioErrorMapper.map(_dio(DioExceptionType.receiveTimeout));
      expect(f.type, FailureType.timeout);
      expect(f.isRetryable, isTrue);
    });

    test('connection error maps to retryable network', () {
      final f = DioErrorMapper.map(_dio(DioExceptionType.connectionError));
      expect(f.type, FailureType.network);
      expect(f.isRetryable, isTrue);
    });

    test('status codes map to the right categories', () {
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 401)).type,
          FailureType.unauthorized);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 403)).type,
          FailureType.forbidden);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 404)).type,
          FailureType.notFound);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 422)).type,
          FailureType.validation);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 500)).type,
          FailureType.server);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 503)).type,
          FailureType.maintenance);
    });

    test('401/403/404 are not retryable; 5xx is', () {
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 401)).isRetryable,
          isFalse);
      expect(DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 500)).isRetryable,
          isTrue);
    });

    test('extracts safe validation messages only for validation', () {
      final f = DioErrorMapper.map(_dio(
        DioExceptionType.badResponse,
        status: 422,
        body: {'message': ['name is required', 'phone is invalid'], 'code': 'bad'},
      ));
      expect(f.validationMessages, ['name is required', 'phone is invalid']);
      expect(f.code, 'bad');
    });

    test('does not surface raw server message for 500', () {
      final f = DioErrorMapper.map(_dio(
        DioExceptionType.badResponse,
        status: 500,
        body: {'message': 'NullPointer at line 42'},
      ));
      expect(f.validationMessages, isEmpty);
    });

    test('attaches request id for log correlation', () {
      final f = DioErrorMapper.map(
        _dio(DioExceptionType.connectionError, requestId: 'req-123'),
      );
      expect(f.requestId, 'req-123');
    });

    test('technicalMessage never leaks into the user-facing log props', () {
      final f = DioErrorMapper.map(_dio(DioExceptionType.badResponse, status: 500));
      // technicalMessage exists for logging…
      expect(f.technicalMessage, isNotNull);
      // …and the user message comes from the localized key, not the technical text.
      expect(f.userMessageKey, AppErrorMessageKey.server);
    });
  });

  group('localized failure messages', () {
    late AppLocalizations en;
    late AppLocalizations ar;

    setUpAll(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      en = await AppLocalizations.delegate.load(const Locale('en'));
      ar = await AppLocalizations.delegate.load(const Locale('ar'));
    });

    test('every failure type yields a non-empty localized message (en + ar)', () {
      for (final type in FailureType.values) {
        final f = AppFailure(type: type);
        expect(f.userMessage(en).trim(), isNotEmpty, reason: 'en/$type');
        expect(f.userMessage(ar).trim(), isNotEmpty, reason: 'ar/$type');
      }
    });

    test('session-expired message differs by language', () {
      final f = AppFailure(type: FailureType.unauthorized);
      expect(f.userMessage(en), en.errorSessionExpired);
      expect(f.userMessage(ar), ar.errorSessionExpired);
      expect(f.userMessage(en), isNot(equals(f.userMessage(ar))));
    });

    test('validation failure prefers safe backend messages when present', () {
      final f = AppFailure(
        type: FailureType.validation,
        validationMessages: const ['name is required'],
      );
      expect(f.userMessage(en), 'name is required');
    });
  });
}

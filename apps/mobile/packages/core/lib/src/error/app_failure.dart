import 'package:equatable/equatable.dart';

import 'failure_type.dart';

/// The single error type that flows through the app. Repositories, cubits and
/// blocs all surface failures as [AppFailure] — never `DioException`, raw
/// strings, or arbitrary exceptions.
///
/// - [userMessageKey] resolves to a localized, friendly message (see
///   `failure_localizations.dart`). The UI shows **only** this.
/// - [technicalMessage] is for logs / crash reporting (never shown to users).
/// - [validationMessages] / [fieldErrors] carry safe, user-facing validation
///   detail for inline display on forms.
class AppFailure extends Equatable implements Exception {
  AppFailure({
    required this.type,
    AppErrorMessageKey? userMessageKey,
    bool? isRetryable,
    this.code,
    this.statusCode,
    this.technicalMessage,
    this.requestId,
    this.originalError,
    this.validationMessages = const [],
    this.fieldErrors = const {},
  })  : userMessageKey = userMessageKey ?? _keyFor(type),
        isRetryable = isRetryable ?? _retryFor(type);

  final FailureType type;

  /// Stable key for the localized message shown to the user.
  final AppErrorMessageKey userMessageKey;

  /// Backend machine code if any (e.g. `missing_permission`).
  final String? code;
  final int? statusCode;

  /// For logs / Sentry / Crashlytics — never rendered in the UI.
  final String? technicalMessage;

  /// Echoed request id (from the `X-Request-Id` header) to correlate logs.
  final String? requestId;

  /// The underlying error/exception, kept only for logging.
  final Object? originalError;

  /// Safe, user-facing validation messages (from the backend) for forms.
  final List<String> validationMessages;

  /// Optional field → message map for inline field errors.
  final Map<String, String> fieldErrors;

  final bool isRetryable;

  static AppErrorMessageKey _keyFor(FailureType t) => t.defaultMessageKey;
  static bool _retryFor(FailureType t) => t.isRetryableByDefault;

  AppFailure copyWith({
    AppErrorMessageKey? userMessageKey,
    bool? isRetryable,
    String? code,
    int? statusCode,
    String? technicalMessage,
    String? requestId,
    Object? originalError,
    List<String>? validationMessages,
    Map<String, String>? fieldErrors,
  }) {
    return AppFailure(
      type: type,
      userMessageKey: userMessageKey ?? this.userMessageKey,
      isRetryable: isRetryable ?? this.isRetryable,
      code: code ?? this.code,
      statusCode: statusCode ?? this.statusCode,
      technicalMessage: technicalMessage ?? this.technicalMessage,
      requestId: requestId ?? this.requestId,
      originalError: originalError ?? this.originalError,
      validationMessages: validationMessages ?? this.validationMessages,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  /// Convenience for unexpected/non-Dio errors.
  factory AppFailure.unexpected(Object error, [StackTrace? stackTrace]) {
    return AppFailure(
      type: FailureType.unknown,
      technicalMessage: '$error',
      originalError: error,
    );
  }

  /// A single-line, log-safe summary. Excludes anything user-facing.
  String get logLine {
    final parts = [
      'type: ${type.name}',
      if (statusCode != null) 'status: $statusCode',
      if (code != null) 'code: $code',
      if (requestId != null) 'reqId: $requestId',
      if (technicalMessage != null) 'msg: $technicalMessage',
    ].join(', ');
    return 'AppFailure($parts)';
  }

  @override
  String toString() => logLine;

  @override
  List<Object?> get props => [
        type,
        userMessageKey,
        code,
        statusCode,
        isRetryable,
        requestId,
        validationMessages,
        fieldErrors,
      ];
}

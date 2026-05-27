/// Coarse error categories the whole app branches on. UI never sees anything
/// more technical than this + a localized message.
enum FailureType {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  validation,
  server,
  maintenance,
  unknown,
}

/// Stable key identifying which localized user message to show. Decoupled from
/// [FailureType] so we can show, e.g., a different message for the same type.
enum AppErrorMessageKey {
  noConnection,
  timeout,
  sessionExpired,
  permissionDenied,
  notFound,
  validation,
  server,
  maintenance,
  unknown,
}

extension FailureTypeX on FailureType {
  /// Default message key for a type. Mappers may override per case.
  AppErrorMessageKey get defaultMessageKey => switch (this) {
        FailureType.network => AppErrorMessageKey.noConnection,
        FailureType.timeout => AppErrorMessageKey.timeout,
        FailureType.unauthorized => AppErrorMessageKey.sessionExpired,
        FailureType.forbidden => AppErrorMessageKey.permissionDenied,
        FailureType.notFound => AppErrorMessageKey.notFound,
        FailureType.validation => AppErrorMessageKey.validation,
        FailureType.server => AppErrorMessageKey.server,
        FailureType.maintenance => AppErrorMessageKey.maintenance,
        FailureType.unknown => AppErrorMessageKey.unknown,
      };

  /// Whether a retry could plausibly succeed (transient/server-side issues).
  bool get isRetryableByDefault => switch (this) {
        FailureType.network ||
        FailureType.timeout ||
        FailureType.server ||
        FailureType.maintenance =>
          true,
        FailureType.unauthorized ||
        FailureType.forbidden ||
        FailureType.notFound ||
        FailureType.validation ||
        FailureType.unknown =>
          false,
      };
}

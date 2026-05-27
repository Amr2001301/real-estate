import 'package:flutter/foundation.dart';

import 'app_failure.dart';
import 'failure_type.dart';

/// Pluggable sink for technical error details. Swap in a Sentry/Crashlytics
/// implementation later by setting [AppLog.reporter] at startup — no call sites
/// change.
abstract interface class ErrorReporter {
  void report(AppFailure failure, {StackTrace? stackTrace});
}

/// Default reporter: prints the **log-safe** line in debug, silent in release.
class DebugErrorReporter implements ErrorReporter {
  const DebugErrorReporter();

  @override
  void report(AppFailure failure, {StackTrace? stackTrace}) {
    if (kDebugMode) {
      debugPrint(failure.logLine);
      if (stackTrace != null) debugPrint('$stackTrace');
    }
  }
}

/// Central logging entry point. Logs [AppFailure.technicalMessage] details for
/// developers; the user-facing message is resolved separately and never logged
/// as the source of truth.
abstract final class AppLog {
  static ErrorReporter reporter = const DebugErrorReporter();

  static void failure(AppFailure failure, {StackTrace? stackTrace}) {
    // Cancellations are noise — don't report them.
    if (failure.type == FailureType.unknown &&
        failure.technicalMessage == 'request cancelled') {
      return;
    }
    reporter.report(failure, stackTrace: stackTrace);
  }
}

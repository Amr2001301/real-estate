import 'package:core/core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class CrashlyticsErrorReporter implements ErrorReporter {
  const CrashlyticsErrorReporter();

  @override
  void report(AppFailure failure, {StackTrace? stackTrace}) {
    if (kDebugMode) return;
    FirebaseCrashlytics.instance.recordError(
      failure.technicalMessage ?? failure.type.name,
      stackTrace,
      reason: failure.logLine,
      fatal: false,
    );
  }
}

import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

/// Smoke test: light/dark themes build for both ar/en and expose the brand
/// color extension, so `context.appColors` is always resolvable.
///
/// In hermetic test environments the google_fonts font files are not bundled
/// as assets, so every font-load attempt fails. The failure comes through TWO
/// channels:
///
///   1. FlutterError.onError — reported by the Flutter binding.
///   2. An unhandled async exception in the Dart zone — because
///      google_fonts uses fire-and-forget futures and re-throws the error
///      after printing it.
///
/// We suppress both:
///   - setUp/tearDown override FlutterError.onError.
///   - Each test body runs inside runZonedGuarded so the rethrown async
///     error is caught before it reaches the flutter_test zone.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  FlutterExceptionHandler? savedOnError;

  setUp(() {
    savedOnError = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      final msg = details.exceptionAsString();
      if (msg.contains('GoogleFonts') ||
          msg.contains('was not found in the application assets')) {
        return; // expected: font files not bundled in test environment
      }
      savedOnError?.call(details);
    };
  });

  tearDown(() {
    FlutterError.onError = savedOnError;
  });

  /// Runs [body] inside a zone that swallows google_fonts font-not-found
  /// errors. Waits several event-loop turns so that all the async font-load
  /// futures created by GoogleFonts can settle inside the zone before the
  /// test returns.
  Future<void> withFontErrorsIgnored(void Function() body) {
    final done = Completer<void>();
    runZonedGuarded(() async {
      body();
      // google_fonts schedules multiple async hops; loop a few times so
      // every in-flight future either settles or errors inside this zone.
      for (var i = 0; i < 5; i++) {
        await Future<void>.delayed(Duration.zero);
      }
      if (!done.isCompleted) done.complete();
    }, (Object e, StackTrace _) {
      final msg = e.toString();
      if (msg.contains('was not found in the application assets') ||
          msg.contains('GoogleFonts')) {
        if (!done.isCompleted) done.complete(); // assertions already passed
        return;
      }
      if (!done.isCompleted) done.completeError(e);
    });
    return done.future;
  }

  for (final isArabic in [false, true]) {
    test('light theme builds + carries AppColorsExt (isArabic=$isArabic)',
        () => withFontErrorsIgnored(() {
              final theme = AppTheme.light(isArabic: isArabic);
              expect(theme.brightness, Brightness.light);
              expect(theme.extension<AppColorsExt>(), isNotNull);
            }));

    test('dark theme builds + carries AppColorsExt (isArabic=$isArabic)',
        () => withFontErrorsIgnored(() {
              final theme = AppTheme.dark(isArabic: isArabic);
              expect(theme.brightness, Brightness.dark);
              expect(theme.extension<AppColorsExt>(), isNotNull);
            }));
  }
}

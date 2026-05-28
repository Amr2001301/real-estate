import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

/// Smoke test: light/dark themes build for both ar/en and expose the brand
/// color extension, so `context.appColors` is always resolvable.
///
/// google_fonts requires the test binding (it reads the asset manifest) and
/// — with `allowRuntimeFetching = false` — schedules an async font load that
/// will throw because the .ttf isn't bundled as a test asset. That throw is
/// posted to the current zone via `handleUncaughtError`, so a plain
/// `try/catch` can't see it; we run the test body in a guarded zone that
/// swallows the expected GoogleFonts-not-found error and re-raises anything
/// else. Production code already falls back to the platform font.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  Future<void> ignoringFontLoadErrors(FutureOr<void> Function() body) {
    final done = Completer<void>();
    runZonedGuarded(() async {
      await body();
      // Let any microtasks (incl. failing font loads) settle.
      await Future<void>.delayed(Duration.zero);
      if (!done.isCompleted) done.complete();
    }, (e, _) {
      final msg = e.toString();
      if (msg.contains('was not found in the application assets') ||
          msg.contains('GoogleFonts')) {
        return; // expected in hermetic tests
      }
      if (!done.isCompleted) done.completeError(e);
    });
    return done.future;
  }

  for (final isArabic in [false, true]) {
    test('light theme builds + carries AppColorsExt (isArabic=$isArabic)', () async {
      await ignoringFontLoadErrors(() {
        final theme = AppTheme.light(isArabic: isArabic);
        expect(theme.brightness, Brightness.light);
        expect(theme.extension<AppColorsExt>(), isNotNull);
      });
    });

    test('dark theme builds + carries AppColorsExt (isArabic=$isArabic)', () async {
      await ignoringFontLoadErrors(() {
        final theme = AppTheme.dark(isArabic: isArabic);
        expect(theme.brightness, Brightness.dark);
        expect(theme.extension<AppColorsExt>(), isNotNull);
      });
    });
  }
}

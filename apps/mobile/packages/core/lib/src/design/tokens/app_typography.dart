import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Typography ported from the web: Latin body = Inter, Arabic body =
/// IBM Plex Sans Arabic, display/headings = Tajawal (covers both scripts).
///
/// Flutter can't swap fonts per-glyph the way CSS font stacks do, so the body
/// font is chosen by the active locale (the app rebuilds on locale change).
///
/// NOTE (production): `google_fonts` fetches + caches these at runtime. Before
/// release, bundle the licensed font files into assets for offline guarantees.
abstract final class AppTypography {
  static String bodyFamilyFor({required bool isArabic}) => (isArabic
          ? GoogleFonts.ibmPlexSansArabic()
          : GoogleFonts.inter())
      .fontFamily!;

  static String get displayFamily => GoogleFonts.tajawal().fontFamily!;

  static TextTheme textTheme({
    required bool isArabic,
    required Color ink,
    required Color inkMuted,
  }) {
    final body = isArabic ? GoogleFonts.ibmPlexSansArabic : GoogleFonts.inter;
    final display = GoogleFonts.tajawal;

    TextStyle d(double size, FontWeight w, {double height = 1.15}) => display(
          fontSize: size,
          fontWeight: w,
          height: height,
          letterSpacing: -0.015,
          color: ink,
        );

    TextStyle t(double size, FontWeight w, {double height = 1.4, Color? color}) =>
        body(fontSize: size, fontWeight: w, height: height, color: color ?? ink);

    return TextTheme(
      displayLarge: d(40, FontWeight.w800, height: 1.08),
      displayMedium: d(32, FontWeight.w700, height: 1.12),
      displaySmall: d(28, FontWeight.w700),
      headlineMedium: d(24, FontWeight.w700, height: 1.2),
      headlineSmall: d(20, FontWeight.w700, height: 1.25),
      titleLarge: t(18, FontWeight.w600, height: 1.3),
      titleMedium: t(16, FontWeight.w600, height: 1.3),
      titleSmall: t(14, FontWeight.w600, height: 1.3),
      bodyLarge: t(16, FontWeight.w400),
      bodyMedium: t(14, FontWeight.w400),
      bodySmall: t(12, FontWeight.w400, color: inkMuted),
      labelLarge: t(14, FontWeight.w600, height: 1.2),
      labelMedium: t(12, FontWeight.w600, height: 1.2),
      labelSmall: t(11, FontWeight.w500, height: 1.2, color: inkMuted),
    );
  }
}

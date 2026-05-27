import 'package:flutter/widgets.dart';

/// Elevation system ported from the web shadows (soft / card / lift).
/// Shadow alpha is tuned per brightness so dark surfaces don't wash out.
abstract final class AppShadows {
  static List<BoxShadow> soft(Brightness b) => _shadow(
        b,
        blur: 16,
        spread: -4,
        dy: 4,
        lightAlpha: 0.06,
        darkAlpha: 0.30,
      );

  static List<BoxShadow> card(Brightness b) => _shadow(
        b,
        blur: 30,
        spread: -12,
        dy: 8,
        lightAlpha: 0.12,
        darkAlpha: 0.45,
      );

  static List<BoxShadow> lift(Brightness b) => _shadow(
        b,
        blur: 48,
        spread: -16,
        dy: 18,
        lightAlpha: 0.22,
        darkAlpha: 0.55,
      );

  static List<BoxShadow> _shadow(
    Brightness b, {
    required double blur,
    required double spread,
    required double dy,
    required double lightAlpha,
    required double darkAlpha,
  }) {
    final base = b == Brightness.dark
        ? const Color(0xFF000000)
        : const Color(0xFF0F1E33);
    final alpha = b == Brightness.dark ? darkAlpha : lightAlpha;
    return [
      BoxShadow(
        color: base.withValues(alpha: alpha),
        blurRadius: blur,
        spreadRadius: spread,
        offset: Offset(0, dy),
      ),
    ];
  }
}

import 'package:flutter/widgets.dart';

/// Raw palette constants ported 1:1 from the web "Warm Luxe" design system
/// (apps/web-public). These are the source of truth; semantic mapping happens
/// in [AppColorsExt] / the theme builders — screens should read tokens from the
/// theme extension, not from here directly.
abstract final class AppPalette {
  // ---- Brand: Gold / Navy (the platform's own; one company's app replaces them) --
  // The platform's tools (staff app, admin) never call [applyBrand]; a company's
  // customer app calls it once its branding is known, so every screen that reads
  // these gets the company's colours. Read them at build time, not in `const`.
  static const _gold = [
    Color(0xFFFBF6EA), Color(0xFFF4E8C9), Color(0xFFE2C792), Color(0xFFD4B36A),
    Color(0xFFC8A24B), Color(0xFFB7902F), Color(0xFF9C7A26),
  ];
  static const _navy = [Color(0xFF0F1E33), Color(0xFF1C3050), Color(0xFF26405F)];
  static List<Color> _g = _gold;
  static List<Color> _n = _navy;

  static Color get gold50 => _g[0];
  static Color get gold100 => _g[1];
  static Color get gold200 => _g[2];
  static Color get gold300 => _g[3];
  static Color get gold400 => _g[4]; // primary accent
  static Color get gold500 => _g[5];
  static Color get gold600 => _g[6];

  static Color get navy => _n[0];
  static Color get navy700 => _n[1];
  static Color get navy600 => _n[2];

  /// A company's colours as the app's two scales (navy = the dark surfaces,
  /// gold = the accent). A light primary is darkened until white text reads on
  /// it; an accent that would vanish on the primary is lightened. With neither
  /// colour the platform's own palette stays.
  static void applyBrand({Color? primary, Color? accent}) {
    Color mix(Color a, Color b, double t) => Color.lerp(a, b, t)!;
    double contrast(Color a, Color b) {
      final x = a.computeLuminance(), y = b.computeLuminance();
      return (x > y ? x + 0.05 : y + 0.05) / (x > y ? y + 0.05 : x + 0.05);
    }

    var p = primary;
    var a = accent;
    if (p != null) {
      for (var i = 0; i < 12 && p!.computeLuminance() > 0.18; i++) {
        p = mix(p, const Color(0xFF000000), 0.12);
      }
      _n = [p!, mix(p, const Color(0xFFFFFFFF), 0.07), mix(p, const Color(0xFFFFFFFF), 0.14)];
    } else {
      _n = _navy;
    }
    if (a != null) {
      final base = p ?? _navy[0];
      for (var i = 0; i < 12 && contrast(a!, base) < 3; i++) {
        a = mix(a, const Color(0xFFFFFFFF), 0.12);
      }
      const w = Color(0xFFFFFFFF), k = Color(0xFF000000);
      _g = [mix(a!, w, 0.9), mix(a, w, 0.8), mix(a, w, 0.55), mix(a, w, 0.22), a, mix(a, k, 0.1), mix(a, k, 0.22)];
    } else {
      _g = _gold;
    }
  }

  // ---- Light surfaces -------------------------------------------------------
  static const lightCanvas = Color(0xFFFAF7F2);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurfaceSoft = Color(0xFFF4EFE8);
  static const lightHairline = Color(0xFFE7DFD3);
  static const lightInk = Color(0xFF1A2230);
  static const lightInkMuted = Color(0xFF6B6256);
  static const lightInkStrong = Color(0xFF0F1E33);

  // ---- Dark surfaces --------------------------------------------------------
  static const darkCanvas = Color(0xFF0E1A2E);
  static const darkSurface = Color(0xFF1A2840);
  static const darkSurfaceSoft = Color(0xFF121D31);
  static const darkHairline = Color(0xFF33445F);
  static const darkInk = Color(0xFFECE6DB);
  static const darkInkMuted = Color(0xFF9AA6B6);
  static const darkInkStrong = Color(0xFFF5F1EA);

  // ---- Semantic (flip with theme) ------------------------------------------
  static const successLight = Color(0xFF3E7C5A);
  static const successDark = Color(0xFF5BAD82);
  static const warningLight = Color(0xFFC98A2B);
  static const warningDark = Color(0xFFE2AD50);
  static const errorLight = Color(0xFFB23B3B);
  static const errorDark = Color(0xFFE07272);
}

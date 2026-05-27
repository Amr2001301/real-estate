import 'package:flutter/widgets.dart';

/// Raw palette constants ported 1:1 from the web "Warm Luxe" design system
/// (apps/web-public). These are the source of truth; semantic mapping happens
/// in [AppColorsExt] / the theme builders — screens should read tokens from the
/// theme extension, not from here directly.
abstract final class AppPalette {
  // ---- Brand: Gold (stays literal across light/dark) ------------------------
  static const gold50 = Color(0xFFFBF6EA);
  static const gold100 = Color(0xFFF4E8C9);
  static const gold200 = Color(0xFFE2C792);
  static const gold300 = Color(0xFFD4B36A);
  static const gold400 = Color(0xFFC8A24B); // primary accent
  static const gold500 = Color(0xFFB7902F);
  static const gold600 = Color(0xFF9C7A26);

  // ---- Brand: Navy (stays literal across light/dark) ------------------------
  static const navy = Color(0xFF0F1E33);
  static const navy700 = Color(0xFF1C3050);
  static const navy600 = Color(0xFF26405F);

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

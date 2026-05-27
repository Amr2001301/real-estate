import 'package:flutter/material.dart';

import '../tokens/app_colors.dart';
import '../tokens/app_shadows.dart';

/// Brand + semantic design tokens exposed through the [ThemeData] so widgets
/// can read them via `Theme.of(context).extension<AppColorsExt>()` (or the
/// `context.appColors` helper). These go beyond Material's [ColorScheme]:
/// gold/navy brand colors, surface tiers, and the soft/card/lift shadow sets.
@immutable
class AppColorsExt extends ThemeExtension<AppColorsExt> {
  const AppColorsExt({
    required this.canvas,
    required this.surface,
    required this.surfaceSoft,
    required this.hairline,
    required this.ink,
    required this.inkMuted,
    required this.inkStrong,
    required this.brandGold,
    required this.brandGoldSoft,
    required this.brandNavy,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
    required this.shadowSoft,
    required this.shadowCard,
    required this.shadowLift,
  });

  final Color canvas;
  final Color surface;
  final Color surfaceSoft;
  final Color hairline;
  final Color ink;
  final Color inkMuted;
  final Color inkStrong;

  final Color brandGold;
  final Color brandGoldSoft;
  final Color brandNavy;

  final Color success;
  final Color warning;
  final Color error;
  final Color info;

  final List<BoxShadow> shadowSoft;
  final List<BoxShadow> shadowCard;
  final List<BoxShadow> shadowLift;

  static const AppColorsExt light = AppColorsExt(
    canvas: AppPalette.lightCanvas,
    surface: AppPalette.lightSurface,
    surfaceSoft: AppPalette.lightSurfaceSoft,
    hairline: AppPalette.lightHairline,
    ink: AppPalette.lightInk,
    inkMuted: AppPalette.lightInkMuted,
    inkStrong: AppPalette.lightInkStrong,
    brandGold: AppPalette.gold400,
    brandGoldSoft: AppPalette.gold100,
    brandNavy: AppPalette.navy,
    success: AppPalette.successLight,
    warning: AppPalette.warningLight,
    error: AppPalette.errorLight,
    info: AppPalette.navy600,
    shadowSoft: [],
    shadowCard: [],
    shadowLift: [],
  );

  static const AppColorsExt dark = AppColorsExt(
    canvas: AppPalette.darkCanvas,
    surface: AppPalette.darkSurface,
    surfaceSoft: AppPalette.darkSurfaceSoft,
    hairline: AppPalette.darkHairline,
    ink: AppPalette.darkInk,
    inkMuted: AppPalette.darkInkMuted,
    inkStrong: AppPalette.darkInkStrong,
    brandGold: AppPalette.gold300,
    brandGoldSoft: AppPalette.navy700,
    brandNavy: AppPalette.navy,
    success: AppPalette.successDark,
    warning: AppPalette.warningDark,
    error: AppPalette.errorDark,
    info: AppPalette.gold300,
    shadowSoft: [],
    shadowCard: [],
    shadowLift: [],
  );

  /// Returns the variant for [brightness] with brightness-tuned shadow sets.
  static AppColorsExt resolve(Brightness brightness) {
    final base = brightness == Brightness.dark ? dark : light;
    return base.copyWith(
      shadowSoft: AppShadows.soft(brightness),
      shadowCard: AppShadows.card(brightness),
      shadowLift: AppShadows.lift(brightness),
    );
  }

  @override
  AppColorsExt copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceSoft,
    Color? hairline,
    Color? ink,
    Color? inkMuted,
    Color? inkStrong,
    Color? brandGold,
    Color? brandGoldSoft,
    Color? brandNavy,
    Color? success,
    Color? warning,
    Color? error,
    Color? info,
    List<BoxShadow>? shadowSoft,
    List<BoxShadow>? shadowCard,
    List<BoxShadow>? shadowLift,
  }) {
    return AppColorsExt(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceSoft: surfaceSoft ?? this.surfaceSoft,
      hairline: hairline ?? this.hairline,
      ink: ink ?? this.ink,
      inkMuted: inkMuted ?? this.inkMuted,
      inkStrong: inkStrong ?? this.inkStrong,
      brandGold: brandGold ?? this.brandGold,
      brandGoldSoft: brandGoldSoft ?? this.brandGoldSoft,
      brandNavy: brandNavy ?? this.brandNavy,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      info: info ?? this.info,
      shadowSoft: shadowSoft ?? this.shadowSoft,
      shadowCard: shadowCard ?? this.shadowCard,
      shadowLift: shadowLift ?? this.shadowLift,
    );
  }

  @override
  AppColorsExt lerp(ThemeExtension<AppColorsExt>? other, double t) {
    if (other is! AppColorsExt) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<BoxShadow> s(List<BoxShadow> a, List<BoxShadow> b) =>
        BoxShadow.lerpList(a, b, t) ?? b;
    return AppColorsExt(
      canvas: c(canvas, other.canvas),
      surface: c(surface, other.surface),
      surfaceSoft: c(surfaceSoft, other.surfaceSoft),
      hairline: c(hairline, other.hairline),
      ink: c(ink, other.ink),
      inkMuted: c(inkMuted, other.inkMuted),
      inkStrong: c(inkStrong, other.inkStrong),
      brandGold: c(brandGold, other.brandGold),
      brandGoldSoft: c(brandGoldSoft, other.brandGoldSoft),
      brandNavy: c(brandNavy, other.brandNavy),
      success: c(success, other.success),
      warning: c(warning, other.warning),
      error: c(error, other.error),
      info: c(info, other.info),
      shadowSoft: s(shadowSoft, other.shadowSoft),
      shadowCard: s(shadowCard, other.shadowCard),
      shadowLift: s(shadowLift, other.shadowLift),
    );
  }
}

/// Ergonomic accessors so widgets can write `context.appColors.brandGold`.
extension AppColorsContext on BuildContext {
  AppColorsExt get appColors =>
      Theme.of(this).extension<AppColorsExt>() ??
      AppColorsExt.resolve(Theme.of(this).brightness);
}

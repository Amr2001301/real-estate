import 'package:flutter/material.dart';

import '../tokens/app_colors.dart';
import '../tokens/app_radii.dart';
import '../tokens/app_spacing.dart';
import '../tokens/app_typography.dart';
import 'app_theme_ext.dart';

/// Builds the light/dark [ThemeData] for both apps from the shared tokens.
///
/// [isArabic] selects the body font (Inter vs IBM Plex Sans Arabic). Headings
/// always use Tajawal. The brand identity (navy + gold) is identical across
/// both apps so they read as one family.
abstract final class AppTheme {
  static ThemeData light({required bool isArabic}) =>
      _build(Brightness.light, isArabic: isArabic);

  static ThemeData dark({required bool isArabic}) =>
      _build(Brightness.dark, isArabic: isArabic);

  static ThemeData _build(Brightness brightness, {required bool isArabic}) {
    final isDark = brightness == Brightness.dark;
    final ext = AppColorsExt.resolve(brightness);

    final scheme = ColorScheme.fromSeed(
      seedColor: AppPalette.gold400,
      brightness: brightness,
    ).copyWith(
      primary: ext.brandGold,
      onPrimary: AppPalette.navy,
      secondary: ext.brandNavy,
      onSecondary: Colors.white,
      surface: ext.surface,
      onSurface: ext.ink,
      surfaceContainerHighest: ext.surfaceSoft,
      error: ext.error,
      outline: ext.hairline,
      outlineVariant: ext.hairline,
    );

    final textTheme = AppTypography.textTheme(
      isArabic: isArabic,
      ink: ext.ink,
      inkMuted: ext.inkMuted,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: ext.canvas,
      canvasColor: ext.canvas,
      textTheme: textTheme,
      fontFamily: AppTypography.bodyFamilyFor(isArabic: isArabic),
      splashFactory: InkSparkle.splashFactory,
      extensions: [ext],
      appBarTheme: AppBarTheme(
        backgroundColor: ext.canvas,
        foregroundColor: ext.ink,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
      ),
      dividerTheme: DividerThemeData(
        color: ext.hairline,
        thickness: 1,
        space: 1,
      ),
      cardTheme: CardThemeData(
        color: ext.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: BorderSide(color: ext.hairline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? ext.surfaceSoft : ext.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 2,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: ext.inkMuted),
        labelStyle: textTheme.labelLarge?.copyWith(color: ext.inkMuted),
        border: OutlineInputBorder(
          borderRadius: AppRadii.input,
          borderSide: BorderSide(color: ext.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.input,
          borderSide: BorderSide(color: ext.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.input,
          borderSide: BorderSide(color: ext.brandGold, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.input,
          borderSide: BorderSide(color: ext.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadii.input,
          borderSide: BorderSide(color: ext.error, width: 1.6),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ext.brandNavy,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.pillAll),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ext.ink,
          minimumSize: const Size(0, 52),
          side: BorderSide(color: ext.hairline),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.pillAll),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: ext.brandNavy,
          textStyle: textTheme.labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: ext.surfaceSoft,
        side: BorderSide(color: ext.hairline),
        labelStyle: textTheme.labelMedium,
        shape: const RoundedRectangleBorder(borderRadius: AppRadii.pillAll),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: ext.surface,
        selectedItemColor: ext.brandGold,
        unselectedItemColor: ext.inkMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: ext.inkStrong,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: ext.canvas),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadii.md)),
        ),
      ),
    );
  }
}

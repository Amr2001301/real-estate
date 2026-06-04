import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/platform/app_platform.dart';
import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_spacing.dart';

/// One destination in an [AppBottomNav].
class AppBottomNavItem {
  const AppBottomNavItem({
    required this.icon,
    required this.label,
    this.activeIcon,
    this.cupertinoIcon,
  });

  final IconData icon;

  /// Optional distinct glyph for the active state; falls back to [icon].
  final IconData? activeIcon;

  /// Optional iOS/Cupertino glyph; used instead of [icon] when the bar renders
  /// in its Cupertino style. Falls back to [icon].
  final IconData? cupertinoIcon;

  final String label;
}

/// Selects the bottom-nav platform style. [adaptive] (default) picks Cupertino
/// on iOS/macOS and Material elsewhere; explicit values force a style (tests).
enum AppBottomNavStyle { adaptive, material, cupertino }

/// iOS floating tab-bar visual variants (review options). Switch the default
/// below to preview each:
///   - [liquid]      : transparent frosted glass, glossy top, glowing gold dot.
///   - [darkGlass]   : navy translucent luxury glass, gold active.
///   - [minimalDock] : compact light Apple-style dock, subtle dot.
enum IosTabBarStyle { liquid, darkGlass, minimalDock }

/// The active iOS tab-bar variant. Change this single constant to switch the
/// look across the app for review (iOS only; Android is unaffected).
const IosTabBarStyle kIosTabBarStyle = IosTabBarStyle.liquid;

/// A premium, warm-luxe bottom navigation bar:
/// - **Android (Material):** in-slot surface bar with a soft gold active pill.
/// - **iOS (Cupertino):** a floating glass dock (see [kIosTabBarStyle]).
///
/// Presentational only: takes [currentIndex] and reports taps via [onSelect].
/// A light selection haptic fires on tap. RTL-safe and safe-area aware.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelect,
    this.style = AppBottomNavStyle.adaptive,
  });

  final List<AppBottomNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;
  final AppBottomNavStyle style;

  bool _useCupertino(BuildContext context) => switch (style) {
        AppBottomNavStyle.material => false,
        AppBottomNavStyle.cupertino => true,
        AppBottomNavStyle.adaptive => context.isApplePlatform,
      };

  void _handleTap(int index) {
    HapticFeedback.selectionClick();
    onSelect(index);
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = _useCupertino(context);
    final iosCfg = cupertino
        ? _IosTabConfig.resolve(kIosTabBarStyle, context.appColors)
        : null;
    final row = Row(
      children: [
        for (var i = 0; i < items.length; i++)
          Expanded(
            child: _NavItemView(
              item: items[i],
              selected: i == currentIndex,
              cupertino: cupertino,
              iosCfg: iosCfg,
              onTap: () => _handleTap(i),
            ),
          ),
      ],
    );
    return cupertino ? _cupertinoBar(context, row, iosCfg!) : _materialBar(context, row);
  }

  /// iOS: a floating glass dock styled by [cfg]. The shell sets `extendBody` on
  /// iOS so the body scrolls behind it and the blur frosts real content.
  Widget _cupertinoBar(BuildContext context, Widget row, _IosTabConfig cfg) {
    final colors = context.appColors;
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final radius = BorderRadius.circular(cfg.radius);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        cfg.hMargin,
        AppSpacing.xs,
        cfg.hMargin,
        bottomInset + AppSpacing.md,
      ),
      child: DecoratedBox(
        // Shadow on the unclipped outer box so it isn't clipped away.
        decoration: BoxDecoration(borderRadius: radius, boxShadow: colors.shadowLift),
        child: ClipRRect(
          borderRadius: radius,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: cfg.blur, sigmaY: cfg.blur),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: cfg.fillColors,
                  stops: cfg.fillStops,
                ),
                borderRadius: radius,
                border: Border.all(color: cfg.borderColor, width: cfg.borderWidth),
              ),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs,
                  vertical: cfg.vPadding,
                ),
                child: row,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Android: a premium Material bar — surface fill, top hairline + soft shadow.
  Widget _materialBar(BuildContext context, Widget row) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.hairline)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.xs,
            ),
            child: row,
          ),
        ),
      ),
    );
  }
}

/// Resolved visual values for one [IosTabBarStyle] — keeps the bar + item code
/// variant-agnostic.
class _IosTabConfig {
  const _IosTabConfig({
    required this.fillColors,
    required this.fillStops,
    required this.borderColor,
    required this.borderWidth,
    required this.blur,
    required this.radius,
    required this.hMargin,
    required this.vPadding,
    required this.activeColor,
    required this.inactiveColor,
    required this.iconSize,
    required this.labelSize,
    required this.dotSize,
    required this.glowDot,
  });

  final List<Color> fillColors;
  final List<double> fillStops;
  final Color borderColor;
  final double borderWidth;
  final double blur;
  final double radius;
  final double hMargin;
  final double vPadding;
  final Color activeColor;
  final Color inactiveColor;
  final double iconSize;
  final double labelSize;
  final double dotSize;
  final bool glowDot;

  static _IosTabConfig resolve(IosTabBarStyle style, AppColorsExt c) {
    switch (style) {
      // A — Liquid Glass Dock: very transparent, glossy top, glowing gold dot.
      case IosTabBarStyle.liquid:
        return _IosTabConfig(
          fillColors: [
            Colors.white.withValues(alpha: 0.30),
            c.surface.withValues(alpha: 0.34),
            c.surface.withValues(alpha: 0.46),
          ],
          fillStops: const [0.0, 0.4, 1.0],
          borderColor: Colors.white.withValues(alpha: 0.60),
          borderWidth: 1.2,
          blur: 34,
          radius: 34,
          hMargin: 20,
          vPadding: AppSpacing.xs,
          activeColor: c.brandGold,
          inactiveColor: c.inkMuted,
          iconSize: 23,
          labelSize: 11,
          dotSize: 4,
          glowDot: true,
        );
      // B — Dark Glass Luxury: navy translucent glass, gold active.
      case IosTabBarStyle.darkGlass:
        return _IosTabConfig(
          fillColors: [
            c.brandNavy.withValues(alpha: 0.60),
            c.brandNavy.withValues(alpha: 0.78),
          ],
          fillStops: const [0.0, 1.0],
          borderColor: Colors.white.withValues(alpha: 0.16),
          borderWidth: 1,
          blur: 24,
          radius: 32,
          hMargin: 20,
          vPadding: AppSpacing.xs,
          activeColor: c.brandGold,
          inactiveColor: Colors.white.withValues(alpha: 0.62),
          iconSize: 23,
          labelSize: 11,
          dotSize: 4,
          glowDot: true,
        );
      // C — Minimal iOS Dock: compact, light, subtle labels + tiny dot.
      case IosTabBarStyle.minimalDock:
        return _IosTabConfig(
          fillColors: [
            Colors.white.withValues(alpha: 0.22),
            c.surface.withValues(alpha: 0.42),
          ],
          fillStops: const [0.0, 1.0],
          borderColor: Colors.white.withValues(alpha: 0.50),
          borderWidth: 1,
          blur: 28,
          radius: 30,
          hMargin: 26,
          vPadding: AppSpacing.xxs,
          activeColor: c.brandGold,
          inactiveColor: c.inkMuted,
          iconSize: 22,
          labelSize: 10,
          dotSize: 3,
          glowDot: false,
        );
    }
  }
}

class _NavItemView extends StatelessWidget {
  const _NavItemView({
    required this.item,
    required this.selected,
    required this.cupertino,
    required this.onTap,
    this.iosCfg,
  });

  final AppBottomNavItem item;
  final bool selected;
  final bool cupertino;
  final _IosTabConfig? iosCfg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final child = cupertino ? _cupertino(context) : _material(context);
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: cupertino
          ? GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTap,
              child: child,
            )
          : InkResponse(
              onTap: onTap,
              radius: 48,
              highlightShape: BoxShape.rectangle,
              child: child,
            ),
    );
  }

  /// iOS: tinted glyph + label + tiny (optionally glowing) gold dot — no pill,
  /// no ripple. Colors/sizes come from the active [IosTabBarStyle] config.
  Widget _cupertino(BuildContext context) {
    final cfg = iosCfg!;
    final theme = Theme.of(context);
    final iconData = item.cupertinoIcon ??
        (selected ? (item.activeIcon ?? item.icon) : item.icon);
    final color = selected ? cfg.activeColor : cfg.inactiveColor;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(iconData, size: cfg.iconSize, color: color),
          const SizedBox(height: 3),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontSize: cfg.labelSize,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
          const SizedBox(height: 3),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: cfg.dotSize,
            width: selected ? cfg.dotSize : 0,
            decoration: BoxDecoration(
              color: cfg.activeColor,
              shape: BoxShape.circle,
              boxShadow: cfg.glowDot && selected
                  ? [
                      BoxShadow(
                        color: cfg.activeColor.withValues(alpha: 0.6),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
          ),
        ],
      ),
    );
  }

  /// Android: gold-tinted active pill behind the glyph (Material indicator).
  Widget _material(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconData = selected ? (item.activeIcon ?? item.icon) : item.icon;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: const Cubic(0.32, 0.72, 0, 1),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: selected ? colors.brandGold.withValues(alpha: 0.14) : null,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Icon(
              iconData,
              size: 20,
              color: selected ? colors.brandGold : colors.inkMuted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: selected ? colors.brandGold : colors.inkMuted,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

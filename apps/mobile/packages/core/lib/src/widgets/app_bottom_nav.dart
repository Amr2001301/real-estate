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
///   - [cream]       : warm cream frosted floating dock — matches the warm-luxe
///                     UI; light and premium (default).
///   - [liquid]      : transparent frosted glass, glossy top, glowing gold dot.
///   - [darkGlass]   : navy translucent luxury glass, gold active.
///   - [minimalDock] : compact light Apple-style dock, subtle dot.
enum IosTabBarStyle { cream, liquid, darkGlass, minimalDock }

/// The active iOS tab-bar variant. Change this single constant to switch the
/// look across the app for review (iOS only; Android is unaffected).
const IosTabBarStyle kIosTabBarStyle = IosTabBarStyle.cream;

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
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final radius = BorderRadius.circular(cfg.radius);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        cfg.hMargin,
        AppSpacing.xs,
        cfg.hMargin,
        bottomInset + AppSpacing.sm,
      ),
      child: DecoratedBox(
        // Shadow on the unclipped outer box so it isn't clipped away.
        decoration: BoxDecoration(borderRadius: radius, boxShadow: cfg.shadow),
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
    required this.activeIconSize,
    required this.labelSize,
    required this.dotSize,
    required this.glowDot,
    required this.glowActiveIcon,
    required this.shadow,
  });

  final List<Color> fillColors;
  final List<double> fillStops;
  final Color borderColor;
  final double borderWidth;
  final double blur;
  final List<BoxShadow> shadow;
  final double radius;
  final double hMargin;
  final double vPadding;
  final Color activeColor;
  final Color inactiveColor;
  final double iconSize; // inactive glyph size
  final double activeIconSize; // active glyph size (slightly larger)
  final double labelSize;
  final double dotSize;
  final bool glowDot; // gold glow on the indicator dot
  final bool glowActiveIcon; // soft gold glow under the active glyph

  static _IosTabConfig resolve(IosTabBarStyle style, AppColorsExt c) {
    switch (style) {
      // Default — Premium Cream Floating Dock: a crisp, warm, clearly-elevated
      // cream panel (not white, not navy). Near-opaque so it reads as a defined
      // dock — the float comes from a soft warm shadow, not heavy borders.
      case IosTabBarStyle.cream:
        return _IosTabConfig(
          fillColors: [
            Colors.white.withValues(alpha: 0.85), // bright top sheen
            c.canvas.withValues(alpha: 0.97), // warm cream body
            c.surfaceSoft.withValues(alpha: 0.98), // denser warm base
          ],
          fillStops: const [0.0, 0.34, 1.0],
          borderColor: c.hairline.withValues(alpha: 0.45), // whisper-thin rim
          borderWidth: 1,
          blur: 14,
          radius: 30,
          hMargin: 22,
          vPadding: AppSpacing.xs,
          activeColor: c.brandGold,
          inactiveColor: c.inkMuted, // warm muted gray/navy
          iconSize: 21,
          activeIconSize: 23,
          labelSize: 10.5,
          dotSize: 0, // no dot — gold icon+label carry the active state
          glowDot: false,
          glowActiveIcon: true,
          shadow: c.shadowCard, // clear, soft warm float
        );
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
          vPadding: AppSpacing.xxs,
          activeColor: c.brandGold,
          inactiveColor: c.inkMuted,
          iconSize: 22,
          activeIconSize: 23,
          labelSize: 11,
          dotSize: 4,
          glowDot: true,
          glowActiveIcon: false,
          shadow: c.shadowLift,
        );
      // B — Navy Frosted Dock: a LIGHT navy frosted glass (not a dark slab).
      // Low navy opacity + strong blur + a warm top gloss so the background
      // clearly shows through; bright-enough icons keep it readable.
      case IosTabBarStyle.darkGlass:
        return _IosTabConfig(
          fillColors: [
            Colors.white.withValues(alpha: 0.16), // warm top gloss
            c.brandNavy.withValues(alpha: 0.40),
            c.brandNavy.withValues(alpha: 0.52),
          ],
          fillStops: const [0.0, 0.30, 1.0],
          borderColor: Colors.white.withValues(alpha: 0.24),
          borderWidth: 1,
          blur: 30,
          radius: 30,
          hMargin: 24,
          vPadding: AppSpacing.xxs,
          activeColor: c.brandGold,
          inactiveColor: Colors.white.withValues(alpha: 0.74),
          iconSize: 22,
          activeIconSize: 24,
          labelSize: 10.5,
          dotSize: 3,
          glowDot: false,
          glowActiveIcon: true,
          shadow: c.shadowLift,
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
          activeIconSize: 22,
          labelSize: 10,
          dotSize: 3,
          glowDot: false,
          glowActiveIcon: false,
          shadow: c.shadowCard,
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
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            iconData,
            size: selected ? cfg.activeIconSize : cfg.iconSize,
            color: color,
            // Soft gold glow under the active glyph (premium depth).
            shadows: cfg.glowActiveIcon && selected
                ? [
                    Shadow(
                      color: cfg.activeColor.withValues(alpha: 0.55),
                      blurRadius: 9,
                    ),
                  ]
                : null,
          ),
          const SizedBox(height: 2),
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
          // Indicator dot — omitted entirely when dotSize == 0 (e.g. cream).
          if (cfg.dotSize > 0) ...[
            const SizedBox(height: 2),
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

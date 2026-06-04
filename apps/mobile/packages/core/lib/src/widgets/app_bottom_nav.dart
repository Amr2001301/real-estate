import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/platform/app_platform.dart';
import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
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
  /// in its Cupertino style, so iPhone tabs feel native. Falls back to [icon].
  final IconData? cupertinoIcon;

  final String label;
}

/// Selects the bottom-nav visual style. [adaptive] (default) picks Cupertino on
/// iOS/macOS and Material elsewhere; the explicit values force a style (used by
/// tests and previews).
enum AppBottomNavStyle { adaptive, material, cupertino }

/// A premium, warm-luxe bottom navigation bar that adapts per platform while
/// keeping the Devora gold/navy brand:
///
/// - **Android (Material):** a gold-gradient active pill behind the glyph
///   (navy icon + gold label) with ink ripple on tap.
/// - **iOS (Cupertino):** no pill or ripple — the active destination is simply
///   tinted gold (icon + label), lighter and more native to a tab bar.
///
/// Presentational only: takes [currentIndex] and reports taps via [onSelect],
/// so it has no router dependency and is reusable by both apps. A light
/// selection haptic fires on tap. RTL-safe and safe-area aware.
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
    final colors = context.appColors;
    final cupertino = _useCupertino(context);

    return Material(
      color: colors.surface,
      child: SafeArea(
        top: false,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.hairline)),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: cupertino ? AppSpacing.xxs : AppSpacing.xs,
            ),
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: _NavItemView(
                      item: items[i],
                      selected: i == currentIndex,
                      cupertino: cupertino,
                      onTap: () => _handleTap(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItemView extends StatelessWidget {
  const _NavItemView({
    required this.item,
    required this.selected,
    required this.cupertino,
    required this.onTap,
  });

  final AppBottomNavItem item;
  final bool selected;
  final bool cupertino;
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

  /// iOS: tinted glyph + label, no pill, no ripple — light and native.
  Widget _cupertino(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconData = item.cupertinoIcon ??
        (selected ? (item.activeIcon ?? item.icon) : item.icon);
    final color = selected ? colors.brandGold : colors.inkMuted;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(iconData, size: 26, color: color),
          const SizedBox(height: 3),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontSize: 10,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// Android: gold-gradient active pill behind the glyph (Material indicator).
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
              gradient: selected
                  ? const LinearGradient(
                      colors: [AppPalette.gold300, AppPalette.gold500],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Icon(
              iconData,
              size: 22,
              color: selected ? colors.brandNavy : colors.inkMuted,
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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/platform/app_platform.dart';
import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';

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

  /// Kept for API compatibility; not used in the current unified design.
  final IconData? cupertinoIcon;

  final String label;
}

/// Selects the tap interaction style. [adaptive] (default) picks Cupertino
/// on iOS/macOS and Material elsewhere; explicit values force a style (tests).
enum AppBottomNavStyle { adaptive, material, cupertino }

/// Warm-prestige bottom navigation bar.
///
/// Warm cream surface with pronounced rounded top corners and a dual-layer
/// shadow (deep navy primary + soft gold accent). The active item shows an
/// animated gold oval chip behind the icon — refined, not heavy.
/// Works with `Scaffold.bottomNavigationBar` + `extendBody: false`.
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

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final cupertino = _useCupertino(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        // Warm cream ties the nav to the page canvas — not cold white.
        color: colors.canvas,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(18),
          topRight: Radius.circular(18),
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.navy.withValues(alpha: 0.07),
            blurRadius: 18,
            offset: const Offset(0, -5),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: Builder(
          builder: (ctx) {
            // Use a capped bottom inset: enough to clear the home indicator
            // visually without leaving a large empty cream strip at the bottom.
            final deviceBottom = MediaQuery.paddingOf(ctx).bottom;
            final bottomPad = deviceBottom > 0 ? 10.0 : 0.0;
            return Padding(
              padding: EdgeInsets.only(bottom: bottomPad),
              child: SizedBox(
                height: 74,
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      _NavItemView(
                        item: items[i],
                        selected: i == currentIndex,
                        cupertino: cupertino,
                        colors: colors,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onSelect(i);
                        },
                      ),
                  ],
                ),
              ),
            );
          },
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
    required this.colors,
    required this.onTap,
  });

  final AppBottomNavItem item;
  final bool selected;
  final bool cupertino;
  final AppColorsExt colors;
  final VoidCallback onTap;

  Widget _content(BuildContext context) {
    final theme = Theme.of(context);
    final iconData = selected ? (item.activeIcon ?? item.icon) : item.icon;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Animated gold oval chip — expands when selected, disappears when not.
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: selected ? 46 : 32,
          height: 24,
          decoration: BoxDecoration(
            color: selected
                ? AppPalette.gold400.withValues(alpha: 0.13)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: selected
                ? Border.all(
                    color: AppPalette.gold400.withValues(alpha: 0.28),
                    width: 0.75,
                  )
                : null,
          ),
          child: Center(
            child: Icon(
              iconData,
              size: 22,
              color: selected ? AppPalette.gold500 : colors.inkMuted,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          item.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(
            color: selected ? AppPalette.gold600 : colors.inkMuted,
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            height: 1.1,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: item.label,
        child: cupertino
            ? GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onTap,
                child: _content(context),
              )
            : InkWell(
                onTap: onTap,
                splashColor: AppPalette.gold400.withValues(alpha: 0.07),
                highlightColor: AppPalette.gold400.withValues(alpha: 0.04),
                child: _content(context),
              ),
      ),
    );
  }
}

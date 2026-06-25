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

/// Premium, layout-reserved bottom navigation bar.
///
/// Full-width warm surface with subtle rounded top corners and an upward
/// shadow. The active item shows a 24×3px animated gold indicator line above
/// the icon; inactive items show muted icons and labels.
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
        color: colors.surface,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: SafeArea(
          top: false,
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

    return SizedBox(
      height: 74,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Gold top indicator — animates from 0 to 24px wide when selected
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            width: selected ? 24 : 0,
            height: 3,
            decoration: BoxDecoration(
              color: AppPalette.gold500,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 7),
          Icon(
            iconData,
            size: 22,
            color: selected ? AppPalette.gold500 : colors.inkMuted,
          ),
          const SizedBox(height: 4),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: selected ? AppPalette.gold500 : colors.inkMuted,
              fontSize: 12.5,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              height: 1.1,
            ),
          ),
        ],
      ),
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
                splashColor: AppPalette.gold500.withValues(alpha: 0.06),
                highlightColor: AppPalette.gold500.withValues(alpha: 0.04),
                child: _content(context),
              ),
      ),
    );
  }
}

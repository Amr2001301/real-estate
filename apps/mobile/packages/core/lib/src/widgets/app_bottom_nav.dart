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

/// Selects the tap interaction style.
enum AppBottomNavStyle { adaptive, material, cupertino }

/// Compact premium bottom navigation bar — warm surface, gold underline
/// indicator on the active tab. Sits as a normal Scaffold.bottomNavigationBar.
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
        color: colors.canvas,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(16),
          topRight: Radius.circular(16),
        ),
        border: Border(
          top: BorderSide(
            color: colors.hairline.withValues(alpha: 0.75),
            width: 0.75,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      // Manual bottom-inset handling: total height = 60px content + device inset.
      // SafeArea wrapping would add the inset ON TOP of the SizedBox height,
      // creating excessive blank space at the bottom.
      child: Builder(
        builder: (ctx) {
          final bottomInset = MediaQuery.paddingOf(ctx).bottom;
          return SizedBox(
            height: 60 + bottomInset,
            child: Padding(
              padding: EdgeInsets.only(bottom: bottomInset),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 390),
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
        },
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
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          iconData,
          size: 22,
          color: selected ? AppPalette.gold500 : colors.inkMuted,
        ),
        const SizedBox(height: 3),
        Text(
          item.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(
            fontSize: 11.5,
            height: 1.05,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
            color: selected ? AppPalette.gold600 : colors.inkMuted,
          ),
        ),
        const SizedBox(height: 4),
        // Animated gold underline — expands on selection, invisible otherwise.
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: selected ? 20 : 0,
          height: 3,
          decoration: BoxDecoration(
            color: AppPalette.gold500,
            borderRadius: BorderRadius.circular(99),
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
                child: Center(child: _content(context)),
              )
            : InkWell(
                onTap: onTap,
                splashColor: AppPalette.gold400.withValues(alpha: 0.07),
                highlightColor: AppPalette.gold400.withValues(alpha: 0.04),
                child: Center(child: _content(context)),
              ),
      ),
    );
  }
}

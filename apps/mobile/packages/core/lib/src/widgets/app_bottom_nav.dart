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
  final IconData? activeIcon;
  final IconData? cupertinoIcon; // kept for API compat
  final String label;
}

enum AppBottomNavStyle { adaptive, material, cupertino }

/// Premium bottom navigation bar for the Warm-Luxe real-estate design system.
///
/// Selected state: animated icon chip (gold tint, expands on selection) with
/// gold label below — no heavy capsule around the full item.
/// Sits as a normal Scaffold.bottomNavigationBar; never overlays content.
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

    return _NavShell(
      colors: colors,
      child: Builder(builder: (ctx) {
        final bottomInset = MediaQuery.paddingOf(ctx).bottom;
        return SizedBox(
          height: 62 + bottomInset,
          child: Padding(
            padding: EdgeInsets.only(bottom: bottomInset),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      _NavItem(
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
      }),
    );
  }
}

// ── Shell ─────────────────────────────────────────────────────────────────────

class _NavShell extends StatelessWidget {
  const _NavShell({required this.colors, required this.child});

  final AppColorsExt colors;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Main surface
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.canvas,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18),
              topRight: Radius.circular(18),
            ),
            boxShadow: [
              // Deep lift shadow
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.09),
                blurRadius: 20,
                offset: const Offset(0, -6),
              ),
              // Gold warmth bloom
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.07),
                blurRadius: 12,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: child,
        ),
        // Gold shimmer accent line across the top edge
        Positioned(
          top: 0,
          left: 32,
          right: 32,
          child: Container(
            height: 1.5,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.transparent,
                  AppPalette.gold400.withValues(alpha: 0.55),
                  AppPalette.gold400.withValues(alpha: 0.55),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.25, 0.75, 1.0],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Item ──────────────────────────────────────────────────────────────────────

class _NavItem extends StatelessWidget {
  const _NavItem({
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
        // ── Icon chip — expands and fills with gold tint on selection ────
        AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          width: selected ? 48 : 30,
          height: 30,
          decoration: BoxDecoration(
            color: selected
                ? AppPalette.gold400.withValues(alpha: 0.13)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
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
              size: 21,
              color: selected ? AppPalette.gold500 : colors.inkMuted,
            ),
          ),
        ),
        const SizedBox(height: 4),
        // ── Label — gold weight shift, no background ─────────────────────
        Text(
          item.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(
            fontSize: 11.5,
            height: 1.0,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
            color: selected ? AppPalette.gold600 : colors.inkMuted,
            letterSpacing: selected ? 0.1 : 0,
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
            : InkResponse(
                onTap: onTap,
                containedInkWell: true,
                highlightShape: BoxShape.rectangle,
                borderRadius: BorderRadius.circular(12),
                splashColor: AppPalette.gold400.withValues(alpha: 0.06),
                highlightColor: AppPalette.gold400.withValues(alpha: 0.03),
                child: Center(child: _content(context)),
              ),
      ),
    );
  }
}

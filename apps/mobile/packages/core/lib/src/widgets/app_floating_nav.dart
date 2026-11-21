import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../core.dart';

/// A navy bar floating above the page's bottom edge; the chosen tab in gold.
class AppFloatingNav extends StatelessWidget {
  const AppFloatingNav({super.key, required this.items, required this.currentIndex, required this.onSelect});
  final List<AppBottomNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    if (AppPalette.glassNav) return _glass(context);
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(14, 0, 14, bottom + 12),
      child: Container(
        key: const Key('app-floating-nav'),
        height: 68,
        decoration: BoxDecoration(
          color: AppPalette.navy.withValues(alpha: 0.97),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.35), blurRadius: 30, offset: const Offset(0, 14))],
        ),
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => onSelect(i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: EdgeInsets.symmetric(horizontal: i == currentIndex ? 18 : 0, vertical: 4),
                        decoration: BoxDecoration(
                          color: i == currentIndex ? AppPalette.gold400.withValues(alpha: 0.16) : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          i == currentIndex ? (items[i].activeIcon ?? items[i].icon) : items[i].icon,
                          size: 22,
                          color: i == currentIndex ? AppPalette.gold300 : const Color(0xFF8E9BB0),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        items[i].label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: i == currentIndex ? FontWeight.w700 : FontWeight.w500,
                          color: i == currentIndex ? AppPalette.gold300 : const Color(0xFF8E9BB0),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Frosted glass, a pill per tab; the chosen one is a gold pill.
  Widget _glass(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final idle = dark ? const Color(0xFF8F9AAE) : const Color(0xFF7A8496);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottom + 14),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(34),
          boxShadow: [BoxShadow(color: const Color(0xFF0B1426).withValues(alpha: dark ? 0.5 : 0.18), blurRadius: 34, offset: const Offset(0, 14))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(34),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
            child: Container(
              key: const Key('app-floating-nav'),
              height: 66,
              padding: const EdgeInsets.symmetric(horizontal: 7),
              decoration: BoxDecoration(
                color: dark ? const Color(0xFF161E2E).withValues(alpha: 0.78) : Colors.white.withValues(alpha: 0.74),
                borderRadius: BorderRadius.circular(34),
                border: Border.all(color: dark ? Colors.white.withValues(alpha: 0.10) : Colors.white.withValues(alpha: 0.95)),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => onSelect(i),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOut,
                          height: 52,
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(26),
                            gradient: i == currentIndex
                                ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEED7A0), Color(0xFFD4B060)])
                                : null,
                            boxShadow: i == currentIndex
                                ? [BoxShadow(color: const Color(0xFFB88F35).withValues(alpha: 0.45), blurRadius: 14, offset: const Offset(0, 6))]
                                : null,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(i == currentIndex ? (items[i].activeIcon ?? items[i].icon) : items[i].icon,
                                  size: 21, color: i == currentIndex ? const Color(0xFF1B1405) : idle),
                              const SizedBox(height: 2),
                              Text(
                                items[i].label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: i == currentIndex ? FontWeight.w700 : FontWeight.w500,
                                  color: i == currentIndex ? const Color(0xFF1B1405) : idle,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

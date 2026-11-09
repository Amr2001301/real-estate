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
}

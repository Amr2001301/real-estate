import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';

/// One filter of a list: a pill with an optional status dot and count.
/// Selected is navy with white text; the rest sit on the surface with a
/// hairline. Every list filter in both apps uses this, so they look the same.
class AppFilterChip extends StatelessWidget {
  const AppFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
    this.dotColor,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  final Color? dotColor;

  static const _navyDeep = Color(0xFF0B1726);
  static const _navyLight = Color(0xFF243F62);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final dark = colors.surface.computeLuminance() < 0.2;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            gradient: selected
                ? const LinearGradient(
                    colors: [_navyLight, _navyDeep],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: selected ? null : colors.surface,
            borderRadius: AppRadii.pillAll,
            border: Border.all(
              color: selected
                  ? (dark ? const Color(0xFF7C9CC9) : Colors.transparent)
                  : colors.hairline,
              width: selected && !dark ? 0 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: selected ? _navyDeep.withValues(alpha: 0.22) : Colors.black.withValues(alpha: 0.04),
                blurRadius: selected ? 10 : 4,
                offset: Offset(0, selected ? 3 : 1),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dotColor != null) ...[
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : colors.inkStrong,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
              if (count != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: selected ? Colors.white.withValues(alpha: 0.18) : colors.surfaceSoft,
                    borderRadius: AppRadii.pillAll,
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: selected ? Colors.white : colors.inkMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import 'app_tone.dart';

enum IconChipSize { sm, md, lg }

/// A premium icon container matching the website's icon chips (e.g. the gold
/// chip on account summary tiles / icon circles).
///
/// - `filled == false` (default): a soft tinted background with a tone-colored
///   glyph — the calm, frequently-used variant.
/// - `filled == true`: a solid fill; for [AppTone.gold] this becomes the warm
///   gold gradient (gold300→gold500) with a navy glyph, mirroring the website's
///   emphasized chip.
///
/// Light/dark aware (reads [AppColorsExt]) and RTL-safe (square container).
class IconChip extends StatelessWidget {
  const IconChip({
    super.key,
    required this.icon,
    this.tone = AppTone.gold,
    this.size = IconChipSize.md,
    this.filled = false,
  });

  final IconData icon;
  final AppTone tone;
  final IconChipSize size;
  final bool filled;

  double get _box => switch (size) {
        IconChipSize.sm => 40,
        IconChipSize.md => 48,
        IconChipSize.lg => 56,
      };

  double get _iconSize => switch (size) {
        IconChipSize.sm => 18,
        IconChipSize.md => 20,
        IconChipSize.lg => 24,
      };

  double get _radius => switch (size) {
        IconChipSize.sm => 12,
        IconChipSize.md => 14,
        IconChipSize.lg => 16,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final base = tone.baseColor(colors);

    late final BoxDecoration decoration;
    late final Color iconColor;

    if (filled && tone == AppTone.gold) {
      // Emphasized gold gradient (matches the website's active summary chip).
      decoration = BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.gold300, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(_radius),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.40),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      );
      iconColor = colors.brandNavy;
    } else if (filled) {
      decoration = BoxDecoration(
        color: base,
        borderRadius: BorderRadius.circular(_radius),
      );
      iconColor = tone.onColor();
    } else {
      // Soft tinted: gold uses the brand soft token (pale gold in light, deep
      // navy in dark) so the chip stays warm and legible in both themes.
      final bg = tone == AppTone.gold
          ? colors.brandGoldSoft
          : base.withValues(alpha: 0.12);
      decoration = BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: base.withValues(alpha: 0.18)),
      );
      iconColor = tone == AppTone.gold ? colors.brandGold : base;
    }

    return Container(
      width: _box,
      height: _box,
      alignment: Alignment.center,
      decoration: decoration,
      child: Icon(icon, size: _iconSize, color: iconColor),
    );
  }
}

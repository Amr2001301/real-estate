import 'package:flutter/widgets.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';

/// Shared semantic accent tone used by the premium composite widgets
/// ([IconChip], [PremiumCard], [SummaryTile]). Mirrors the website's status
/// accent language (gold / navy / success / warning / error / muted).
///
/// This is intentionally separate from [BadgeTone] (in status_badge.dart):
/// badges expose an `info`/`neutral` pair tuned for pills, whereas accent tones
/// drive rails, chips and glows. Keeping them distinct avoids changing the
/// existing badge API.
enum AppTone { gold, navy, success, warning, error, muted }

extension AppToneColors on AppTone {
  /// The tone's base brand/semantic color, resolved from the active theme.
  Color baseColor(AppColorsExt c) => switch (this) {
        AppTone.gold => c.brandGold,
        AppTone.navy => c.brandNavy,
        AppTone.success => c.success,
        AppTone.warning => c.warning,
        AppTone.error => c.error,
        AppTone.muted => c.inkMuted,
      };

  /// Foreground color to place ON a solid [baseColor] fill.
  Color onColor() => switch (this) {
        // Navy text reads best on gold; white on the darker tones.
        AppTone.gold => AppPalette.navy,
        _ => const Color(0xFFFFFFFF),
      };
}

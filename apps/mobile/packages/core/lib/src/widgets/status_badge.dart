import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// Semantic tone of a [StatusBadge].
enum BadgeTone { neutral, gold, navy, success, warning, error, info }

enum BadgeVariant { soft, solid }

/// A small pill used for statuses (lead stage, reservation status, etc.).
/// Mirrors the web Badge component's tones and soft/solid variants.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.tone = BadgeTone.neutral,
    this.variant = BadgeVariant.soft,
    this.dot = false,
  });

  final String label;
  final BadgeTone tone;
  final BadgeVariant variant;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final base = switch (tone) {
      BadgeTone.neutral => colors.inkMuted,
      BadgeTone.gold => colors.brandGold,
      BadgeTone.navy => colors.brandNavy,
      BadgeTone.success => colors.success,
      BadgeTone.warning => colors.warning,
      BadgeTone.error => colors.error,
      BadgeTone.info => colors.info,
    };

    final bool solid = variant == BadgeVariant.solid;
    final bg = solid ? base : base.withValues(alpha: 0.12);
    final fg = solid ? _onColor(base) : base;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs + 1,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }

  Color _onColor(Color bg) {
    return bg.computeLuminance() > 0.5 ? const Color(0xFF0F1E33) : Colors.white;
  }
}

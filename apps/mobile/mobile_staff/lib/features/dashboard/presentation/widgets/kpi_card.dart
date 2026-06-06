import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// A compact KPI tile: a tone-filled [IconChip], a big value, and a label,
/// wrapped in a [PremiumCard] — mirroring the Guest dashboard's [SummaryTile]
/// look so staff dashboards read as the same product. Used on the dashboards.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.tone = BadgeTone.navy,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final BadgeTone tone;
  final VoidCallback? onTap;

  /// Maps the badge tone onto the premium accent-tone language used by the
  /// Guest [IconChip] / [PremiumCard] widgets.
  AppTone get _accent => switch (tone) {
    BadgeTone.gold => AppTone.gold,
    BadgeTone.success => AppTone.success,
    BadgeTone.warning => AppTone.warning,
    BadgeTone.error => AppTone.error,
    _ => AppTone.navy,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return PremiumCard(
      elevation: AppCardElevation.soft,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconChip(
            icon: icon,
            tone: _accent,
            size: IconChipSize.sm,
            filled: _accent == AppTone.gold,
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

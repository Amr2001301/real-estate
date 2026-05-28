import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// A compact KPI tile: icon, big value, and a label. Used on the dashboard.
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

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final accent = switch (tone) {
      BadgeTone.gold => colors.brandGold,
      BadgeTone.success => colors.success,
      BadgeTone.info => colors.info,
      BadgeTone.warning => colors.warning,
      BadgeTone.error => colors.error,
      _ => colors.brandNavy,
    };
    return AppCard(
      elevation: AppCardElevation.soft,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: accent),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

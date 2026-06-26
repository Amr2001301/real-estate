import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// A compact KPI tile used on the sales dashboard.
///
/// Layout: large value + icon chip on the top row, label below.
/// Uses a reduced internal padding (AppSpacing.sm) to avoid the visual gap
/// that `spaceBetween` created when the card height exceeded content height.
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
      padding: const EdgeInsets.all(AppSpacing.sm),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.max,
        children: [
          // Value + icon on the same row — in RTL: value on RIGHT, icon on LEFT.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.inkStrong,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
              ),
              IconChip(
                icon: icon,
                tone: _accent,
                size: IconChipSize.sm,
                filled: _accent == AppTone.gold,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: colors.inkMuted,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

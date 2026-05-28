import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/sales_performance.dart';

/// Visual progress card for the current period's target achievement (amount +
/// units bars). Shows a friendly "no target" hint when none is set.
class TargetProgressCard extends StatelessWidget {
  const TargetProgressCard({super.key, required this.performance, this.onTap});

  final SalesPerformance performance;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    return AppCard(
      elevation: AppCardElevation.soft,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.track_changes_rounded, color: colors.brandGold, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(l10n.targetsTitle, style: Theme.of(context).textTheme.titleSmall),
              ),
              Text(performance.period,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (!performance.hasTarget)
            Text(l10n.targetsNone,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted))
          else ...[
            _Bar(
              label: l10n.targetAmount,
              percent: performance.targetAmountPercent,
              achieved: PriceFormatter.format(performance.achievedAmount, languageCode: lang),
              target: performance.targetAmount == null
                  ? null
                  : PriceFormatter.format(performance.targetAmount!, languageCode: lang),
            ),
            const SizedBox(height: AppSpacing.md),
            _Bar(
              label: l10n.targetUnits,
              percent: performance.targetUnitsPercent,
              achieved: '${performance.achievedUnits}',
              target: performance.targetUnits == null ? null : '${performance.targetUnits}',
            ),
          ],
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.percent, required this.achieved, this.target});
  final String label;
  final double? percent;
  final String achieved;
  final String? target;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final pct = (percent ?? 0).clamp(0, 100).toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
            Text(
              target == null ? achieved : '$achieved / $target',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: AppRadii.pillAll,
          child: LinearProgressIndicator(
            value: pct / 100,
            minHeight: 8,
            backgroundColor: colors.surfaceSoft,
            color: pct >= 100 ? colors.success : colors.brandGold,
          ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text('${pct.toStringAsFixed(0)}%',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
      ],
    );
  }
}

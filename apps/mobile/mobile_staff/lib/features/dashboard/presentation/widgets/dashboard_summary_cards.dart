import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../../performance/presentation/widgets/target_progress_card.dart';

/// Dashboard target progress card — permission-aware (soft "unavailable").
class DashboardTargetCard extends StatelessWidget {
  const DashboardTargetCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<TargetSummaryCubit, TargetSummaryState>(
      builder: (context, state) => switch (state.status) {
        TargetSummaryStatus.loading => const _SummarySkeleton(),
        TargetSummaryStatus.unavailable => _UnavailableCard(
          icon: Icons.track_changes_rounded,
          label: l10n.targetsTitle,
        ),
        TargetSummaryStatus.ready => TargetProgressCard(
          performance: state.performance!,
          onTap: () => context.push('/targets'),
        ),
      },
    );
  }
}

/// Dashboard bonus summary card — permission-aware (soft "unavailable").
class DashboardBonusCard extends StatelessWidget {
  const DashboardBonusCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return BlocBuilder<BonusSummaryCubit, BonusSummaryState>(
      builder: (context, state) {
        switch (state.status) {
          case SummaryStatus.loading:
            return const _SummarySkeleton();
          case SummaryStatus.unavailable:
            return _UnavailableCard(
              icon: Icons.payments_outlined,
              label: l10n.bonusTitle,
            );
          case SummaryStatus.ready:
            final o = state.overview!;
            return PremiumCard(
              elevation: AppCardElevation.soft,
              accentRail: AppTone.gold,
              onTap: () => context.push('/bonus'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const IconChip(
                        icon: Icons.payments_rounded,
                        tone: AppTone.gold,
                        size: IconChipSize.sm,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          l10n.bonusTitle,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: colors.inkMuted),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: _Metric(
                          label: l10n.bonusPaid,
                          value: PriceFormatter.format(
                            o.paidTotal,
                            languageCode: lang,
                          ),
                          color: colors.success,
                        ),
                      ),
                      Expanded(
                        child: _Metric(
                          label: l10n.bonusPending,
                          value: PriceFormatter.format(
                            o.pendingTotal,
                            languageCode: lang,
                          ),
                          color: colors.warning,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
        }
      },
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(color: color),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
      ],
    );
  }
}

class _UnavailableCard extends StatelessWidget {
  const _UnavailableCard({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return PremiumCard(
      elevation: AppCardElevation.soft,
      child: Row(
        children: [
          IconChip(icon: icon, tone: AppTone.muted, size: IconChipSize.sm),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.titleSmall),
          ),
          Text(
            context.l10n.summaryUnavailable,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: PremiumCard(
        elevation: AppCardElevation.soft,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Summary title',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: AppSpacing.md),
            Text('0000 / 0000', style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}

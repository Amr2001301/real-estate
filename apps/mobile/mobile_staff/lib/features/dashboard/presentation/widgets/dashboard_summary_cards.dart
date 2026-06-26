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

  static String _periodLabel(DateTime now) {
    final m = now.month.toString().padLeft(2, '0');
    return '${now.year}-$m';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    // Use locale rather than Directionality to avoid widget-tree lookup issues.
    final chevron = lang == 'ar'
        ? Icons.chevron_left_rounded
        : Icons.chevron_right_rounded;

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
                  // Header: icon + title + period chip + chevron
                  Row(
                    children: [
                      const IconChip(
                        icon: Icons.payments_rounded,
                        tone: AppTone.gold,
                        size: IconChipSize.sm,
                        filled: true,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          l10n.bonusTitle,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      _PeriodChip(label: _periodLabel(DateTime.now())),
                      const SizedBox(width: AppSpacing.xs),
                      Icon(chevron, size: 20, color: colors.inkMuted),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  // Hairline divider
                  Divider(height: 1, thickness: 1, color: colors.hairline),
                  const SizedBox(height: AppSpacing.sm),
                  // Paid / Pending metrics
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
                      Container(
                        width: 1,
                        height: 48,
                        color: colors.hairline,
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsetsDirectional.only(
                            start: AppSpacing.sm,
                          ),
                          child: _Metric(
                            label: l10n.bonusPending,
                            value: PriceFormatter.format(
                              o.pendingTotal,
                              languageCode: lang,
                            ),
                            color: colors.warning,
                          ),
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

/// Small pill chip showing the current period (e.g. "2026-06").
class _PeriodChip extends StatelessWidget {
  const _PeriodChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.hairline),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: colors.inkMuted,
        ),
      ),
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
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: color,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: colors.inkMuted,
            height: 1.3,
          ),
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

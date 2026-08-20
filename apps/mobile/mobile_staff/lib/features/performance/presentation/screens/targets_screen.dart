import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/targets_cubit.dart';
import '../widgets/target_progress_card.dart';

/// Targets: current-period progress cards + a target history list.
class TargetsScreen extends StatefulWidget {
  const TargetsScreen({super.key});

  @override
  State<TargetsScreen> createState() => _TargetsScreenState();
}

class _TargetsScreenState extends State<TargetsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TargetsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit  = context.read<TargetsCubit>();
    final isRtl  = context.read<LocaleCubit>().isRtl;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.targetsTitle,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<TargetsCubit, TargetsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 4);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                            AppSpacing.lg, AppSpacing.md,
                            AppSpacing.lg, bottomPad + 100),
                        children: [
                          if (state.performance != null)
                            TargetProgressCard(performance: state.performance!),
                          const SizedBox(height: AppSpacing.lg),
                          if (state.performance != null)
                            _ActivityCard(performance: state.performance!),
                          if (state.targets.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.lg),
                            AppSectionHeader(title: l10n.targetsHistory),
                            const SizedBox(height: AppSpacing.sm),
                            for (final t in state.targets) ...[
                              _TargetHistoryTile(target: t),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ],
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.performance});
  final SalesPerformance performance;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 3, height: 16,
              decoration: BoxDecoration(
                color: AppPalette.gold400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              l10n.targetsActivity,
              style: Theme.of(context).textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          _row(context, l10n.dashboardLeads, '${performance.leadsCount}'),
          _row(context, l10n.navVisits, '${performance.visitsCount}'),
          _row(context, l10n.navReservations,
              '${performance.reservationsCount}'),
          _row(context, l10n.targetsSignedContracts,
              '${performance.signedContractsCount}'),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: colors.inkMuted),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _TargetHistoryTile extends StatelessWidget {
  const _TargetHistoryTile({required this.target});
  final SalesTarget target;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final lang   = Localizations.localeOf(context).languageCode;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              target.period,
              style: Theme.of(context).textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                PriceFormatter.formatString(
                    target.amountTarget, languageCode: lang),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: colors.brandGold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                l10n.targetsUnitsN(target.unitsTarget),
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: colors.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

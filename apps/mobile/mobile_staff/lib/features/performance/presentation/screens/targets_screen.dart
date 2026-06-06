import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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
    final cubit = context.read<TargetsCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.targetsTitle)),
      body: BlocBuilder<TargetsCubit, TargetsState>(
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
                  padding: const EdgeInsets.all(AppSpacing.lg),
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
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.performance});
  final SalesPerformance performance;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.targetsActivity,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          _row(context, l10n.dashboardLeads, '${performance.leadsCount}'),
          _row(context, l10n.navVisits, '${performance.visitsCount}'),
          _row(
            context,
            l10n.navReservations,
            '${performance.reservationsCount}',
          ),
          _row(
            context,
            l10n.targetsSignedContracts,
            '${performance.signedContractsCount}',
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
          ),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
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
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Text(
              target.period,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          Text(
            '${PriceFormatter.formatString(target.amountTarget, languageCode: lang)} · ${l10n.targetsUnitsN(target.unitsTarget)}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

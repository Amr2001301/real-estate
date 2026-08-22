import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/targets_cubit.dart';
import '../widgets/target_progress_card.dart';

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
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.targetsTitle,
            compact: true,
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
                    return ErrorState(
                        failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      color: AppPalette.gold400,
                      onRefresh: cubit.load,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          bottomPad + AppSpacing.xl,
                        ),
                        children: [
                          if (state.performance != null) ...[
                            TargetProgressCard(performance: state.performance!),
                            const SizedBox(height: AppSpacing.lg),
                            _ActivityGrid(performance: state.performance!),
                          ],
                          if (state.targets.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.xl),
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

// ─── Activity stats 2×2 grid ────────────────────────────────────────────────

class _ActivityGrid extends StatelessWidget {
  const _ActivityGrid({required this.performance});
  final SalesPerformance performance;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
          // Section header
          Row(children: [
            Container(
              width: 3,
              height: 16,
              decoration: BoxDecoration(
                color: AppPalette.gold400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              l10n.targetsActivity,
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          // Row 1
          Row(
            children: [
              _StatCell(
                icon: Icons.person_rounded,
                color: const Color(0xFF60A5FA),
                count: '${performance.leadsCount}',
                label: l10n.dashboardLeads,
              ),
              const SizedBox(width: AppSpacing.sm),
              _StatCell(
                icon: Icons.event_rounded,
                color: const Color(0xFF34C77B),
                count: '${performance.visitsCount}',
                label: l10n.navVisits,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Row 2
          Row(
            children: [
              _StatCell(
                icon: Icons.bookmark_rounded,
                color: AppPalette.gold400,
                count: '${performance.reservationsCount}',
                label: l10n.navReservations,
              ),
              const SizedBox(width: AppSpacing.sm),
              _StatCell(
                icon: Icons.description_rounded,
                color: const Color(0xFFA78BFA),
                count: '${performance.signedContractsCount}',
                label: l10n.targetsSignedContracts,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.icon,
    required this.color,
    required this.count,
    required this.label,
  });
  final IconData icon;
  final Color color;
  final String count;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    count,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: AppPalette.navy,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    label,
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall
                        ?.copyWith(color: colors.inkMuted),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Target history tile ─────────────────────────────────────────────────────

class _TargetHistoryTile extends StatelessWidget {
  const _TargetHistoryTile({required this.target});
  final SalesTarget target;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(14),
      elevation: 1,
      shadowColor: Colors.black.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
        child: Row(
          children: [
            // Period badge
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppPalette.navy.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                target.period,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppPalette.navy,
                    ),
              ),
            ),
            const Spacer(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  PriceFormatter.formatString(
                    target.amountTarget,
                    languageCode: lang,
                  ),
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: colors.brandGold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.targetsUnitsN(target.unitsTarget),
                  style: Theme.of(context)
                      .textTheme
                      .labelSmall
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../domain/entities/sales_dashboard.dart';
import '../cubit/dashboard_cubit.dart';
import '../widgets/dashboard_summary_cards.dart';
import '../widgets/kpi_card.dart';

/// Sales dashboard: premium navy header + KPI cards + pipeline breakdown.
/// Skeleton loading, error retry, pull-to-refresh.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DashboardCubit>().load();
    context.read<BonusSummaryCubit>().load();
    context.read<TargetSummaryCubit>().load();
  }

  Future<void> _refresh() {
    context.read<BonusSummaryCubit>().load();
    context.read<TargetSummaryCubit>().load();
    return context.read<DashboardCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.read<SessionCubit>().state.sessionOrNull;
    final name = session?.displayName;

    return Scaffold(
      body: Column(
        children: [
          // Premium navy header — mirrors the Customer app's screen headers
          AppNavHeader(
            title: l10n.navDashboard,
            subtitle: name != null ? '${l10n.dashboardWelcome}, $name' : null,
            actions: [const NotificationsBell()],
          ),
          // Body
          Expanded(
            child: BlocBuilder<DashboardCubit, DashboardState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const _DashboardSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<DashboardCubit>().load(),
                    );
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: _refresh,
                      child: _DashboardBody(data: state.data!),
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

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});
  final SalesDashboard data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // P11.6 — payment review is viewable by ADMIN + SALES_MANAGER (matches
    // GET /deposits/review-queue). Hidden for SALES/BROKER, who would 403.
    final role = context.read<SessionCubit>().state.role;
    final canReviewPayments =
        role == AppRole.admin || role == AppRole.salesManager;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 1.45,
          children: [
            KpiCard(
              icon: Icons.people_alt_outlined,
              label: l10n.dashboardLeads,
              value: '${data.totalLeads}',
              tone: BadgeTone.navy,
            ),
            KpiCard(
              icon: Icons.event_available_outlined,
              label: l10n.dashboardTodayVisits,
              value: '${data.todayVisits}',
              tone: BadgeTone.gold,
              onTap: () => context.push('/visits?today=1'),
            ),
            KpiCard(
              icon: Icons.calendar_month_outlined,
              label: l10n.dashboardScheduledVisits,
              value: '${data.scheduledVisits}',
              tone: BadgeTone.info,
              onTap: () => context.push('/visits'),
            ),
            KpiCard(
              icon: Icons.bookmark_added_outlined,
              label: l10n.dashboardReservations,
              value: '${data.reservations}',
              tone: BadgeTone.success,
              onTap: () => context.push('/reservations'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        const DashboardTargetCard(),
        const SizedBox(height: AppSpacing.md),
        const DashboardBonusCard(),
        const SizedBox(height: AppSpacing.lg),
        AppSectionHeader(title: l10n.dashboardQuickActions),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            ActionChip(
              avatar: const Icon(Icons.event_outlined, size: 18),
              label: Text(l10n.visitNew),
              onPressed: () => context.push('/visits/new'),
            ),
            ActionChip(
              avatar: const Icon(Icons.bookmark_add_outlined, size: 18),
              label: Text(l10n.reservationNew),
              onPressed: () => context.push('/reservations/new'),
            ),
            ActionChip(
              avatar: const Icon(Icons.calculate_outlined, size: 18),
              label: Text(l10n.calculatorTitle),
              onPressed: () => context.push('/calculator'),
            ),
            ActionChip(
              avatar: const Icon(Icons.track_changes_outlined, size: 18),
              label: Text(l10n.targetsTitle),
              onPressed: () => context.push('/targets'),
            ),
            ActionChip(
              avatar: const Icon(Icons.payments_outlined, size: 18),
              label: Text(l10n.bonusTitle),
              onPressed: () => context.push('/bonus'),
            ),
            if (canReviewPayments)
              ActionChip(
                avatar: const Icon(Icons.receipt_long_outlined, size: 18),
                label: Text(l10n.paymentReviewTitle),
                onPressed: () => context.push('/payments-review'),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppSectionHeader(title: l10n.dashboardPipeline),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          child: Column(
            children: [
              for (final stage in kLeadStages)
                _PipelineRow(stage: stage, count: data.pipeline[stage] ?? 0),
            ],
          ),
        ),
      ],
    );
  }
}

class _PipelineRow extends StatelessWidget {
  const _PipelineRow({required this.stage, required this.count});
  final String stage;
  final int count;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          StatusBadge(
            label: leadStageLabel(l10n, stage),
            tone: leadStageTone(stage),
          ),
          const Spacer(),
          Text('$count', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: GridView.count(
        padding: const EdgeInsets.all(AppSpacing.lg),
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.md,
        childAspectRatio: 1.45,
        children: const [
          KpiCard(icon: Icons.people_alt_outlined, label: 'Leads', value: '00'),
          KpiCard(
            icon: Icons.event_available_outlined,
            label: 'Visits',
            value: '00',
          ),
          KpiCard(
            icon: Icons.calendar_month_outlined,
            label: 'Scheduled',
            value: '00',
          ),
          KpiCard(
            icon: Icons.bookmark_added_outlined,
            label: 'Reservations',
            value: '00',
          ),
        ],
      ),
    );
  }
}

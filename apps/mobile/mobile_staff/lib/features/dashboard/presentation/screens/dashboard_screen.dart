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
          AppNavHeader(
            title: l10n.navDashboard,
            subtitle: name != null ? l10n.dashboardWelcomeUser(name) : null,
            actions: [const NotificationsBell()],
            bottom: _RoleChip(label: l10n.salesRoleChip),
          ),
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

/// Gold role chip shown at the bottom of the header.
class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppPalette.gold400.withValues(alpha: 0.15),
          border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.40)),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: AppPalette.gold300,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});
  final SalesDashboard data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // P11.6 — payment review viewable by ADMIN + SALES_MANAGER only.
    final role = context.read<SessionCubit>().state.role;
    final canReviewPayments =
        role == AppRole.admin || role == AppRole.salesManager;

    // Max pipeline count drives relative progress bar widths.
    final maxCount = kLeadStages
        .map((s) => data.pipeline[s] ?? 0)
        .fold<int>(1, (m, v) => v > m ? v : m);

    return ListView(
      // Reduced top padding (was AppSpacing.lg = 20) — eliminates the large
      // empty gap that appeared between the rounded header bottom and the KPIs.
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xxxl,
      ),
      children: [
        // ── 1. KPI cards ─────────────────────────────────────────────────
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
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
              icon: Icons.bookmark_added_outlined,
              label: l10n.dashboardReservations,
              value: '${data.reservations}',
              tone: BadgeTone.success,
              onTap: () => context.push('/reservations'),
            ),
            KpiCard(
              icon: Icons.calendar_month_outlined,
              label: l10n.dashboardScheduledVisits,
              value: '${data.scheduledVisits}',
              tone: BadgeTone.info,
              onTap: () => context.push('/visits'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        // ── 2. Quick actions ─────────────────────────────────────────────
        AppSectionHeader(title: l10n.dashboardQuickActions),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            _QuickActionPill(
              icon: Icons.event_outlined,
              label: l10n.visitNew,
              onTap: () => context.push('/visits/new'),
            ),
            _QuickActionPill(
              icon: Icons.bookmark_add_outlined,
              label: l10n.reservationNew,
              onTap: () => context.push('/reservations/new'),
            ),
            _QuickActionPill(
              icon: Icons.calculate_outlined,
              label: l10n.calculatorTitle,
              onTap: () => context.push('/calculator'),
            ),
            _QuickActionPill(
              icon: Icons.track_changes_outlined,
              label: l10n.targetsTitle,
              onTap: () => context.push('/targets'),
            ),
            _QuickActionPill(
              icon: Icons.payments_outlined,
              label: l10n.bonusTitle,
              onTap: () => context.push('/bonus'),
            ),
            if (canReviewPayments)
              _QuickActionPill(
                icon: Icons.receipt_long_outlined,
                label: l10n.paymentReviewTitle,
                onTap: () => context.push('/payments-review'),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        // ── 3. Sales pipeline ─────────────────────────────────────────────
        AppSectionHeader(title: l10n.dashboardPipeline),
        const SizedBox(height: AppSpacing.xs),
        AppCard(
          child: Column(
            children: [
              for (final stage in kLeadStages)
                _PipelineRow(
                  stage: stage,
                  count: data.pipeline[stage] ?? 0,
                  maxCount: maxCount,
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── 4. Targets ────────────────────────────────────────────────────
        const DashboardTargetCard(),
        const SizedBox(height: AppSpacing.sm),

        // ── 5. Bonus ──────────────────────────────────────────────────────
        const DashboardBonusCard(),
      ],
    );
  }
}

// ── Pipeline row with relative progress bar ───────────────────────────────────
class _PipelineRow extends StatelessWidget {
  const _PipelineRow({
    required this.stage,
    required this.count,
    required this.maxCount,
  });
  final String stage;
  final int count;
  final int maxCount;

  static Color _color(BadgeTone tone, AppColorsExt c) => switch (tone) {
    BadgeTone.gold => c.brandGold,
    BadgeTone.success => c.success,
    BadgeTone.info => c.info,
    BadgeTone.warning => c.warning,
    BadgeTone.error => c.error,
    _ => c.inkMuted,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final toneColor = _color(leadStageTone(stage), colors);
    final progress = count / maxCount;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 68,
            child: Text(
              leadStageLabel(l10n, stage),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: toneColor,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xs),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: toneColor.withValues(alpha: 0.12),
                valueColor: AlwaysStoppedAnimation<Color>(toneColor),
                minHeight: 6,
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 28,
            child: Text(
              '$count',
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: colors.inkStrong,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Quick action pill ─────────────────────────────────────────────────────────
class _QuickActionPill extends StatelessWidget {
  const _QuickActionPill({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.pill),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.hairline),
          borderRadius: BorderRadius.circular(AppRadii.pill),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: colors.brandGold),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: colors.inkStrong,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: GridView.count(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
        childAspectRatio: 1.45,
        children: const [
          KpiCard(icon: Icons.people_alt_outlined, label: 'Leads', value: '00'),
          KpiCard(
            icon: Icons.event_available_outlined,
            label: 'Visits',
            value: '00',
          ),
          KpiCard(
            icon: Icons.bookmark_added_outlined,
            label: 'Reservations',
            value: '00',
          ),
          KpiCard(
            icon: Icons.calendar_month_outlined,
            label: 'Scheduled',
            value: '00',
          ),
        ],
      ),
    );
  }
}

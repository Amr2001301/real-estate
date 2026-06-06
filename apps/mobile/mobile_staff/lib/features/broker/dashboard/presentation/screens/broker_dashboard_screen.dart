import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/reservation_status_label.dart';
import '../../../../dashboard/presentation/widgets/kpi_card.dart';
import '../../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../profile/presentation/cubit/broker_profile_cubit.dart';
import '../../domain/entities/broker_dashboard.dart';
import '../cubit/broker_dashboard_cubit.dart';

/// Broker dashboard: KPI cards, a permission-aware commission card, recent
/// leads/reservations, and quick actions.
class BrokerDashboardScreen extends StatefulWidget {
  const BrokerDashboardScreen({super.key});

  @override
  State<BrokerDashboardScreen> createState() => _BrokerDashboardScreenState();
}

class _BrokerDashboardScreenState extends State<BrokerDashboardScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerDashboardCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navDashboard),
        actions: const [NotificationsBell()],
      ),
      body: BlocBuilder<BrokerDashboardCubit, BrokerDashboardState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const _Skeleton();
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<BrokerDashboardCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: () => context.read<BrokerDashboardCubit>().load(),
                child: _Body(data: state.data!),
              );
          }
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.data});
  final BrokerDashboard data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final canViewCommissions = context.select<BrokerProfileCubit, bool>(
      (c) => c.state.data?.canViewCommissions ?? false,
    );

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
              label: l10n.brokerDashLeads,
              value: '${data.leadsTotal}',
              tone: BadgeTone.navy,
              onTap: () => context.push('/broker/leads'),
            ),
            KpiCard(
              icon: Icons.verified_outlined,
              label: l10n.brokerDashApprovedLeads,
              value: '${data.leadsApproved}',
              tone: BadgeTone.success,
            ),
            KpiCard(
              icon: Icons.bookmark_added_outlined,
              label: l10n.navReservations,
              value: '${data.reservationsTotal}',
              tone: BadgeTone.gold,
              onTap: () => context.push('/broker/reservations'),
            ),
            KpiCard(
              icon: Icons.check_circle_outline_rounded,
              label: l10n.brokerDashApprovedReservations,
              value: '${data.reservationsApproved}',
              tone: BadgeTone.info,
            ),
          ],
        ),
        if (canViewCommissions) ...[
          const SizedBox(height: AppSpacing.md),
          PremiumCard(
            elevation: AppCardElevation.soft,
            accentRail: AppTone.gold,
            onTap: () => context.push('/broker/commissions'),
            child: Row(
              children: [
                const IconChip(
                  icon: Icons.payments_rounded,
                  tone: AppTone.gold,
                  size: IconChipSize.sm,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    l10n.navCommissions,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Text(
                  PriceFormatter.format(
                    data.commissionsGross,
                    languageCode: lang,
                  ),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: context.appColors.brandGold,
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: context.appColors.inkMuted,
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        AppSectionHeader(title: l10n.dashboardQuickActions),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            ActionChip(
              avatar: const Icon(Icons.person_add_alt_1_outlined, size: 18),
              label: Text(l10n.brokerLeadNew),
              onPressed: () => context.push('/broker/leads/new'),
            ),
            ActionChip(
              avatar: const Icon(Icons.bookmark_add_outlined, size: 18),
              label: Text(l10n.reservationNew),
              onPressed: () => context.push('/broker/reservations/new'),
            ),
          ],
        ),
        if (data.recentLeads.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          AppSectionHeader(title: l10n.brokerRecentLeads),
          const SizedBox(height: AppSpacing.sm),
          for (final lead in data.recentLeads.take(5)) ...[
            AppCard(
              onTap: () => context.push('/broker/leads/${lead.id}'),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      lead.fullName,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  StatusBadge(
                    label: brokerLeadStatusLabel(l10n, lead.approvalStatus),
                    tone: brokerLeadStatusTone(lead.approvalStatus),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
        if (data.recentReservations.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          AppSectionHeader(title: l10n.brokerRecentReservations),
          const SizedBox(height: AppSpacing.sm),
          for (final r in data.recentReservations.take(5)) ...[
            AppCard(
              onTap: () => context.push('/broker/reservations/${r.id}'),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      r.reservationNumber ?? r.unitCode ?? l10n.navReservations,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  StatusBadge(
                    label: reservationStatusLabel(l10n, r.status),
                    tone: reservationStatusTone(r.status),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ],
    );
  }
}

/// Loading placeholder mirroring the live KPI grid — a shimmering set of
/// [KpiCard]s instead of a bare spinner, matching the Guest loading language.
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: GridView.count(
        padding: const EdgeInsets.all(AppSpacing.lg),
        crossAxisCount: 2,
        shrinkWrap: true,
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.md,
        childAspectRatio: 1.45,
        children: const [
          KpiCard(icon: Icons.people_alt_outlined, label: 'Leads', value: '00'),
          KpiCard(
            icon: Icons.verified_outlined,
            label: 'Approved',
            value: '00',
          ),
          KpiCard(
            icon: Icons.bookmark_added_outlined,
            label: 'Reservations',
            value: '00',
          ),
          KpiCard(
            icon: Icons.check_circle_outline_rounded,
            label: 'Approved',
            value: '00',
          ),
        ],
      ),
    );
  }
}

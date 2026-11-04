import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/role_label.dart';
import '../home_kit/home_kit.dart';
import '../sales_home/sales_home_cubit.dart';
import '../sales_home/sales_home_data.dart';
import '../sales_home/sales_sections.dart';

/// The sales manager's home (owner-approved design, 2026-11-04): the team's
/// figures from their dashboard on the website (`sales-manager-home.tsx`) —
/// the team target, what waits for their decision, the team ranking and the
/// team's week.
class ManagerHomeScreen extends StatefulWidget {
  const ManagerHomeScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<SalesHomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: BlocBuilder<SalesHomeCubit, SalesHomeState>(
        builder: (context, state) {
          final data = state.data;
          final cubit = context.read<SalesHomeCubit>();
          return HomePage(
            pageKey: const Key('manager-home'),
            loading: data == null && state.status != DataStatus.failure,
            failure: data == null ? state.failure : null,
            onRetry: cubit.load,
            onRefresh: cubit.load,
            hero: HomeHero(
              name: homeSessionName(context),
              roleLabel: roleLabel(l10n, context.read<SessionCubit>().state.role),
              companyName: data?.companyName,
              logoUrl: data?.companyLogoUrl,
            ),
            overlap: data == null ? null : _goal(context, data),
            children: data == null
                ? const []
                : [
                    HomeActions(actions: [
                      HomeAction(id: 'add-lead', icon: Icons.person_add_rounded, label: l10n.shActLead, onTap: () => context.push('/leads/new')),
                      HomeAction(id: 'visit', icon: Icons.event_rounded, label: l10n.shActVisit, onTap: () => context.push('/visits/new')),
                      HomeAction(id: 'targets', icon: Icons.flag_rounded, label: l10n.mhActTargets, onTap: () => context.push('/team-targets')),
                      HomeAction(id: 'bonus', icon: Icons.account_balance_wallet_rounded, label: l10n.mhActBonus, onTap: () => context.push('/bonus')),
                    ]),
                    _figures(context, data),
                    _decide(context, data),
                    HomeSection(
                      icon: Icons.leaderboard_rounded,
                      title: l10n.mhLeaderboard,
                      action: l10n.mhPerformance,
                      onAction: () => context.push('/team-performance'),
                      child: HomeRankList(
                        empty: l10n.mhNoTeam,
                        rows: [
                          for (final r in data.team)
                            HomeRankRow(
                              id: r.salesId,
                              title: r.name,
                              subtitle: r.performance.hasTarget
                                  ? l10n.mhRankSub(r.performance.signedContracts, ltr('${r.performance.targetPercent ?? 0}%'))
                                  : l10n.mhRankNoTarget(r.performance.signedContracts),
                              percent: r.performance.hasTarget ? r.performance.targetPercent : null,
                              value: homeCompact(r.performance.realizedValue, l10n).$1,
                              unit: '${homeCompact(r.performance.realizedValue, l10n).$2} '
                                      '${PriceFormatter.symbol(Localizations.localeOf(context).languageCode)}'
                                  .trim(),
                            ),
                        ],
                      ),
                    ),
                    HomeAgenda(state: state, title: l10n.mhTeamAgenda, showWho: true),
                    HomePipeline(stages: data.stages, onLeads: () => widget.onSwitchTab?.call(1)),
                  ],
          );
        },
      ),
    );
  }

  Widget _goal(BuildContext context, SalesHome data) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final p = data.performance;
    final now = DateTime.now();
    final daysLeft = DateTime(now.year, now.month + 1, 0).day - now.day;
    final (achieved, unit) = homeCompact(p?.achievedAmount ?? 0, l10n);
    return HomeGoalCard(
      percent: p != null && p.hasTarget ? (p.targetPercent ?? 0) : null,
      percentLabel: l10n.shOfGoal,
      icon: Icons.groups_rounded,
      title: l10n.mhTeamGoal,
      value: achieved,
      unit: unit,
      trailing: l10n.shOfTarget('${homeCompactText(p?.targetAmount ?? 0, l10n)} ${PriceFormatter.symbol(lang)}'),
      minis: [
        (l10n.mhUnitsSold, l10n.mhUnitsN(p?.achievedUnits ?? 0)),
        (l10n.shDaysLeftLabel, l10n.shDaysLeft(daysLeft)),
      ],
      emptyText: l10n.shNoTarget,
    );
  }

  Widget _figures(BuildContext context, SalesHome data) {
    final l10n = context.l10n;
    final now = DateTime.now();
    final today = homeDay(now);
    final todayVisits = data.visits.where((v) => homeDay(v.at) == today).length;
    final expiring7 = data.expiringWithin7(now);
    final p = data.performance;
    final (realized, rUnit) = homeCompact(p?.realizedValue ?? 0, l10n);
    final active = data.team.where((r) => r.active).length;
    final inactive = data.team.length - active;
    return HomeSection(
      icon: Icons.insights_rounded,
      title: l10n.mhFigures,
      child: Column(children: [
        HomeBand(figures: [
          HomeFigure(
            id: 'open-leads',
            value: '${data.openLeads}',
            label: l10n.shOpenLeads,
            hint: data.staleLeads > 0 ? l10n.shStaleN(data.staleLeads) : l10n.shAllFollowed,
            warn: data.staleLeads > 0,
          ),
          HomeFigure(id: 'visits', value: '${data.visits.length}', label: l10n.shUpcomingVisits, hint: l10n.shTodayN(todayVisits)),
          HomeFigure(
            id: 'reservations',
            value: '${data.activeReservations}',
            label: l10n.shActiveReservations,
            hint: expiring7 > 0 ? l10n.shExpiringN(expiring7) : l10n.shNoneExpiring,
            warn: expiring7 > 0,
          ),
        ]),
        HomeTiles(tiles: [
          HomeTile(label: l10n.shContractsMonth, value: '${p?.signedContracts ?? 0}', sub: l10n.shUnitsSoldN(p?.achievedUnits ?? 0)),
          HomeTile(
            label: l10n.shRealized,
            value: realized,
            unit: rUnit,
            sub: PriceFormatter.symbol(Localizations.localeOf(context).languageCode),
          ),
          HomeTile(
            label: l10n.mhActiveTeam,
            value: '$active / ${data.team.length}',
            sub: inactive > 0 ? l10n.mhInactiveN(inactive) : l10n.mhAllActive,
          ),
        ]),
      ]),
    );
  }

  Widget _decide(BuildContext context, SalesHome data) {
    final l10n = context.l10n;
    final inactive = data.team.where((r) => !r.active).length;
    return HomeSection(
      icon: Icons.priority_high_rounded,
      title: l10n.mhDecide,
      child: HomeAttentionGrid(
        columns: 2,
        cards: [
          HomeAttention(
            id: 'pending',
            icon: Icons.hourglass_top_rounded,
            tone: HomeTone.gold,
            count: data.pendingReservations,
            label: l10n.mhPending,
            hot: true,
            onTap: () => context.push('/reservations'),
          ),
          HomeAttention(
            id: 'stale',
            icon: Icons.warning_rounded,
            tone: HomeTone.amber,
            count: data.staleLeads,
            label: l10n.shAttStale(kStaleAfterDays),
            onTap: () => widget.onSwitchTab?.call(1),
          ),
          HomeAttention(
            id: 'unconfirmed',
            icon: Icons.phone_in_talk_rounded,
            tone: HomeTone.sky,
            count: data.unconfirmedVisits,
            label: l10n.shAttUnconfirmed,
            onTap: () => context.push('/visits'),
          ),
          HomeAttention(
            id: 'lapsing',
            icon: Icons.timer_rounded,
            tone: HomeTone.rose,
            count: data.expiringWithin7(DateTime.now()),
            label: l10n.shAttLapsing,
            onTap: () => context.push('/reservations'),
          ),
          if (inactive > 0)
            HomeAttention(
              id: 'inactive',
              icon: Icons.person_off_rounded,
              tone: HomeTone.rose,
              count: inactive,
              label: l10n.mhInactiveReps,
              onTap: () => context.push('/team-performance'),
            ),
        ],
      ),
    );
  }
}

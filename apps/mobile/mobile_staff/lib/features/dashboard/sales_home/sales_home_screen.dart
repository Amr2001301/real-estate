import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/role_label.dart';
import '../home_kit/home_kit.dart';
import 'sales_home_cubit.dart';
import 'sales_home_data.dart';
import 'sales_sections.dart';

/// The sales rep's home (owner-approved design, 2026-11-04): the same figures
/// as their dashboard on the website, on the app's navy and gold.
class SalesHomeScreen extends StatefulWidget {
  const SalesHomeScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<SalesHomeScreen> createState() => _SalesHomeScreenState();
}

class _SalesHomeScreenState extends State<SalesHomeScreen> {
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
            pageKey: const Key('sales-home'),
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
            overlap: data == null ? null : _goal(context, data.performance),
            children: data == null
                ? const []
                : [
                    HomeActions(actions: [
                      HomeAction(id: 'add-lead', icon: Icons.person_add_rounded, label: l10n.shActLead, onTap: () => context.push('/leads/new')),
                      HomeAction(id: 'visit', icon: Icons.event_rounded, label: l10n.shActVisit, onTap: () => context.push('/visits/new')),
                      HomeAction(id: 'reservation', icon: Icons.bookmark_add_rounded, label: l10n.shActReservation, onTap: () => context.push('/reservations/new')),
                      HomeAction(id: 'calculator', icon: Icons.calculate_rounded, label: l10n.shActCalculator, onTap: () => context.push('/calculator')),
                    ]),
                    _figures(context, data),
                    HomeSection(
                      icon: Icons.priority_high_rounded,
                      title: l10n.shAttention,
                      child: HomeAttentionGrid(cards: [
                        HomeAttention(
                          id: 'stale',
                          icon: Icons.warning_rounded,
                          tone: HomeTone.amber,
                          count: data.staleLeads,
                          label: l10n.shAttStale(kStaleAfterDays),
                          hot: true,
                          onTap: () => widget.onSwitchTab?.call(1),
                        ),
                        HomeAttention(
                          id: 'lapsing',
                          icon: Icons.timer_rounded,
                          tone: HomeTone.rose,
                          count: data.expiringWithin7(DateTime.now()),
                          label: l10n.shAttLapsing,
                          onTap: () => context.push('/reservations'),
                        ),
                        HomeAttention(
                          id: 'unconfirmed',
                          icon: Icons.phone_in_talk_rounded,
                          tone: HomeTone.sky,
                          count: data.unconfirmedVisits,
                          label: l10n.shAttUnconfirmed,
                          onTap: () => context.push('/visits'),
                        ),
                      ]),
                    ),
                    HomeFollowUps(state: state),
                    HomeAgenda(state: state),
                    HomePipeline(stages: data.stages, onLeads: () => widget.onSwitchTab?.call(1)),
                  ],
          );
        },
      ),
    );
  }

  Widget _goal(BuildContext context, SalesPerformanceRow? p) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final now = DateTime.now();
    final daysLeft = DateTime(now.year, now.month + 1, 0).day - now.day;
    final (achieved, unit) = homeCompact(p?.achievedAmount ?? 0, l10n);
    return HomeGoalCard(
      percent: p != null && p.hasTarget ? (p.targetPercent ?? 0) : null,
      percentLabel: l10n.shOfGoal,
      icon: Icons.flag_rounded,
      title: l10n.shGoalTitle,
      value: achieved,
      unit: unit,
      trailing: l10n.shOfTarget('${homeCompactText(p?.targetAmount ?? 0, l10n)} ${PriceFormatter.symbol(lang)}'),
      minis: [
        (l10n.shGoalUnits, ltr('${p?.achievedUnits ?? 0} / ${p?.targetUnits ?? 0}')),
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
    final avg = p?.averageDeal;
    final (avgV, avgUnit) = avg == null ? ('—', '') : homeCompact(avg, l10n);
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return HomeSection(
      icon: Icons.insights_rounded,
      title: l10n.shFigures,
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
          HomeTile(label: l10n.shRealized, value: realized, unit: rUnit, sub: currency),
          HomeTile(label: l10n.shAvgDeal, value: avgV, unit: avgUnit, sub: avg == null ? '' : currency),
        ]),
      ]),
    );
  }
}

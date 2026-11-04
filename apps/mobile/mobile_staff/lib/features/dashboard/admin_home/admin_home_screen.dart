import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/role_label.dart';
import '../home_kit/home_kit.dart';
import 'admin_home_data.dart';

/// The company admin's home (owner-approved design, 2026-11-04), with the
/// figures of the admin dashboard on the website: the contracts' value and
/// collection, the company's month, what needs action, the funnel, the
/// bookings trend, the top reps and brokers, and the latest activity.
class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<AdminHomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: BlocBuilder<AdminHomeCubit, AdminHomeState>(
        builder: (context, state) {
          final data = state.data;
          final cubit = context.read<AdminHomeCubit>();
          return HomePage(
            pageKey: const Key('admin-home'),
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
            overlap: data == null ? null : _value(context, data),
            children: data == null
                ? const []
                : [
                    HomeActions(actions: [
                      HomeAction(
                          id: 'payment', icon: Icons.payments_rounded, label: l10n.ahActPayment, onTap: () => context.push('/deposits/record')),
                      HomeAction(
                          id: 'reservation',
                          icon: Icons.bookmark_add_rounded,
                          label: l10n.shActReservation,
                          onTap: () => context.push('/reservations/new')),
                      HomeAction(
                          id: 'review', icon: Icons.fact_check_rounded, label: l10n.ahActReview, onTap: () => context.push('/payments-review')),
                      HomeAction(id: 'ledger', icon: Icons.account_balance_rounded, label: l10n.ledgerTitle, onTap: () => context.push('/ledger')),
                    ]),
                    _month(context, data),
                    _action(context, data),
                    HomeSection(
                      icon: Icons.filter_alt_rounded,
                      title: l10n.ahFunnel,
                      child: HomeFunnel(steps: [
                        HomeFunnelStep(label: l10n.ahFunnelLeads, value: data.funnel[0], colors: homeTaupe),
                        HomeFunnelStep(label: l10n.ahFunnelVisits, value: data.funnel[1], colors: homeNavy),
                        HomeFunnelStep(label: l10n.ahFunnelReservations, value: data.funnel[2], colors: homeGold),
                        HomeFunnelStep(label: l10n.ahFunnelContracts, value: data.funnel[3], colors: homeGreen),
                      ]),
                    ),
                    if (data.trend.isNotEmpty)
                      HomeSection(
                        icon: Icons.bar_chart_rounded,
                        title: l10n.ahTrend,
                        child: HomeBars(bars: [
                          for (final (month, n) in data.trend)
                            (DateFormatter.monthShort(month, languageCode: Localizations.localeOf(context).languageCode), n),
                        ]),
                      ),
                    HomeSection(
                      icon: Icons.military_tech_rounded,
                      title: l10n.ahTopSales,
                      action: l10n.mhPerformance,
                      onAction: () => context.push('/team-performance'),
                      child: HomeRankList(
                        empty: l10n.ahNoSales,
                        rows: [
                          for (final r in data.topSales)
                            HomeRankRow(
                              id: r.id,
                              title: r.name,
                              subtitle: l10n.ahTopSalesSub(r.contracts),
                              value: homeCompact(r.value, l10n).$1,
                              unit: _unit(context, r.value),
                            ),
                        ],
                      ),
                    ),
                    HomeSection(
                      icon: Icons.handshake_rounded,
                      title: l10n.ahTopBrokers,
                      child: HomeRankList(
                        empty: l10n.ahNoBrokers,
                        rows: [
                          for (final b in data.topBrokers)
                            HomeRankRow(
                              id: b.id,
                              title: b.name,
                              icon: Icons.storefront_rounded,
                              subtitle: [
                                l10n.ahContractsN(b.contracts),
                                if ((b.commission ?? 0) > 0) l10n.ahCommission(_money(context, b.commission!)),
                              ].join(' · '),
                              value: homeCompact(b.value, l10n).$1,
                              unit: _unit(context, b.value),
                            ),
                        ],
                      ),
                    ),
                    HomeSection(
                      icon: Icons.history_rounded,
                      title: l10n.ahActivity,
                      child: HomeActivityList(
                        empty: l10n.ahNoActivity,
                        items: [
                          for (final a in data.activity.take(7))
                            HomeActivityItem(
                              icon: _activityIcon(a.type),
                              title: a.title,
                              subtitle: [
                                _activityLabel(l10n, a.type),
                                if ((a.context ?? '').isNotEmpty && a.context != a.title) ltr(a.context!),
                                if ((a.amount ?? 0) > 0) _money(context, a.amount!),
                              ].join(' · '),
                              when: adminAgo(l10n, a.at, DateTime.now()),
                            ),
                        ],
                      ),
                    ),
                  ],
          );
        },
      ),
    );
  }

  String _symbol(BuildContext context) => PriceFormatter.symbol(Localizations.localeOf(context).languageCode);

  /// "مليون ج.م" under a ranked figure.
  String _unit(BuildContext context, double v) => '${homeCompact(v, context.l10n).$2} ${_symbol(context)}'.trim();

  /// "396 ألف ج.م".
  String _money(BuildContext context, double v) => '${homeCompactText(v, context.l10n)} ${_symbol(context)}';

  Widget _value(BuildContext context, AdminHome d) {
    final l10n = context.l10n;
    final (value, unit) = homeCompact(d.contractValue, l10n);
    return HomeGoalCard(
      percent: d.collectionRate ?? 0,
      percentLabel: d.collectionRate == null ? l10n.ahNothingDue : l10n.ahCollectionRate,
      icon: Icons.description_rounded,
      title: l10n.ahContractValue,
      value: value,
      unit: unit,
      trailing: '${_symbol(context)} · ${l10n.ahContractsN(d.contractsCount)}',
      minis: [
        (l10n.ahCollected, homeCompactText(d.collected, l10n)),
        (l10n.ahOverdue, homeCompactText(d.overdue, l10n)),
      ],
    );
  }

  Widget _month(BuildContext context, AdminHome d) {
    final l10n = context.l10n;
    final (collected, cUnit) = homeCompact(d.collectedThisMonth, l10n);
    final (due, dueUnit) = homeCompact(d.brokerPayoutsDue, l10n);
    final (expected, eUnit) = homeCompact(d.expectedNext30, l10n);
    return HomeSection(
      icon: Icons.auto_graph_rounded,
      title: l10n.ahCompanyMonth,
      child: Column(children: [
        HomeBand(figures: [
          HomeFigure(
            id: 'collected',
            value: collected,
            label: cUnit.isEmpty ? l10n.ahCollectedMonth : l10n.ahCollectedMonthUnit(cUnit),
            hint: l10n.ahLastMonth(ltr(adminInUnit(d.prevMonthCollected, d.collectedThisMonth))),
            warn: d.collectedThisMonth < d.prevMonthCollected,
          ),
          HomeFigure(
            id: 'signed',
            value: '${d.signedThisMonth}',
            label: l10n.ahSignedMonth,
            hint: l10n.ahLastMonth(ltr('${d.prevMonthSigned}')),
            warn: d.signedThisMonth < d.prevMonthSigned,
          ),
          HomeFigure(
            id: 'new-leads',
            value: '${d.newLeadsThisMonth}',
            label: l10n.ahNewLeads,
            hint: l10n.ahLastMonth(ltr('${d.prevMonthNewLeads}')),
            warn: d.newLeadsThisMonth < d.prevMonthNewLeads,
          ),
        ]),
        HomeTiles(tiles: [
          HomeTile(
            label: l10n.ahAvailableUnits,
            value: '${d.availableUnits}',
            unit: l10n.ahOfN(d.totalUnits),
            sub: l10n.ahSoldReserved(d.soldUnits, d.reservedUnits),
          ),
          HomeTile(label: l10n.ahBrokerDue, value: due, unit: dueUnit, sub: _symbol(context)),
          HomeTile(label: l10n.ahExpected30, value: expected, unit: eUnit, sub: _symbol(context)),
        ]),
      ]),
    );
  }

  Widget _action(BuildContext context, AdminHome d) {
    final l10n = context.l10n;
    final a = d.alerts;
    return HomeSection(
      icon: Icons.priority_high_rounded,
      title: l10n.ahNeedsAction,
      child: HomeAttentionGrid(
        columns: 2,
        cards: [
          HomeAttention(
            id: 'sign',
            icon: Icons.draw_rounded,
            tone: HomeTone.gold,
            count: a.contractsAwaitingSignature,
            label: l10n.ahAttSign,
            hot: true,
            onTap: () => context.push('/contracts'),
          ),
          HomeAttention(
            id: 'visits',
            icon: Icons.event_available_rounded,
            tone: HomeTone.sky,
            count: a.visitsAwaitingConfirmation,
            label: l10n.ahAttVisits,
            onTap: () => context.push('/visits'),
          ),
          HomeAttention(
            id: 'maintenance',
            icon: Icons.build_rounded,
            tone: HomeTone.rose,
            count: a.openMaintenance,
            label: l10n.ahAttMaintenance,
            onTap: () => context.push('/maintenance'),
          ),
          HomeAttention(
            id: 'inquiries',
            icon: Icons.help_rounded,
            tone: HomeTone.sky,
            count: a.infoRequestsOpen,
            label: l10n.ahAttInquiries,
            onTap: () => widget.onSwitchTab?.call(1),
          ),
          HomeAttention(
            id: 'proofs',
            icon: Icons.receipt_long_rounded,
            tone: HomeTone.amber,
            count: a.depositsPendingReview,
            label: l10n.ahAttProofs,
            onTap: () => context.push('/payments-review'),
          ),
          HomeAttention(
            id: 'follow-ups',
            icon: Icons.phone_rounded,
            tone: HomeTone.rose,
            count: d.overdueFollowUps,
            label: l10n.ahAttFollowUps,
            onTap: () => context.push('/follow-ups'),
          ),
        ],
      ),
    );
  }
}

IconData _activityIcon(String type) => switch (type) {
      'lead' => Icons.person_add_rounded,
      'reservation' => Icons.bookmark_added_rounded,
      'contract' => Icons.description_rounded,
      'visit' => Icons.event_rounded,
      'maintenance' => Icons.build_rounded,
      'deposit' => Icons.payments_rounded,
      'info_request' => Icons.help_rounded,
      _ => Icons.history_rounded,
    };

String _activityLabel(AppLocalizations l10n, String type) => switch (type) {
      'lead' => l10n.ahEvLead,
      'reservation' => l10n.ahEvReservation,
      'contract' => l10n.ahEvContract,
      'visit' => l10n.ahEvVisit,
      'maintenance' => l10n.ahEvMaintenance,
      'deposit' => l10n.ahEvDeposit,
      'info_request' => l10n.ahEvInquiry,
      _ => '',
    };

/// "منذ ساعة", as the website's activity list.
String adminAgo(AppLocalizations l10n, DateTime at, DateTime now) {
  final mins = now.difference(at).inMinutes;
  if (mins < 1) return l10n.ahAgoNow;
  if (mins < 60) return l10n.ahAgoMinutes(mins);
  final hours = (mins / 60).round();
  if (hours < 24) return l10n.ahAgoHours(hours);
  return l10n.ahAgoDays((hours / 24).round());
}

/// [v] in the unit [like] is shown in ("2.56" million → last month "0.18"),
/// so the two read side by side.
String adminInUnit(double v, double like) {
  final div = like.abs() >= 1000000 ? 1000000 : (like.abs() >= 1000 ? 1000 : 1);
  final t = (v / div).toStringAsFixed(2);
  return t.contains('.') ? t.replaceFirst(RegExp(r'\.?0+$'), '') : t;
}

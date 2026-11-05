import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../dashboard/home_kit/home_kit.dart';
import '../../reservations/view/reservation_page_screen.dart' show ReservationLinkCard;
import 'brokers_perf_data.dart';

/// «أداء الوسطاء» for the admin (design bp1, owner-approved 2026-11-05): the
/// brokers' sales and commissions, their funnel and monthly trend, a card per
/// broker, and the projects they sell.
class BrokersPerformanceScreen extends StatefulWidget {
  const BrokersPerformanceScreen({super.key});

  @override
  State<BrokersPerformanceScreen> createState() => _BrokersPerformanceScreenState();
}

class _BrokersPerformanceScreenState extends State<BrokersPerformanceScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokersPerfCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    return _Shell(
      title: l10n.bpTitle,
      subtitle: l10n.bpSubtitle,
      body: (p) {
        final s = p.summary;
        final sales = homeCompact(s.salesGross, l10n);
        final com = homeCompact(s.commissionsNet, l10n);
        final pend = homeCompactText(s.commissionsPendingNet, l10n);
        return [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
            child: HomeBand(figures: [
              HomeFigure(id: 'sales', value: sales.$1, label: l10n.bpBrokersSales, hint: [if (sales.$2.isNotEmpty) sales.$2, currency].join(' ')),
              HomeFigure(id: 'com', value: com.$1, label: l10n.bpCommissions, hint: l10n.bpPendingOf(pend), warn: s.commissionsPendingNet > 0),
              HomeFigure(id: 'active', value: '${s.activeBrokers ?? 0}', label: l10n.bpActive, hint: l10n.bpActiveOf(s.totalBrokers ?? 0)),
            ]),
          ),
          HomeSection(icon: Icons.filter_alt_rounded, title: l10n.bpFunnel, child: PerfFunnel(summary: s)),
          if (p.trend.isNotEmpty) HomeSection(icon: Icons.trending_up_rounded, title: l10n.bpTrend, child: PerfTrend(buckets: p.trend)),
          if (p.brokers.isNotEmpty)
            HomeSection(
              icon: Icons.emoji_events_rounded,
              title: l10n.bpTop,
              child: Column(children: [for (final b in p.brokers) Padding(padding: const EdgeInsets.only(bottom: 10), child: BrokerPerfCard(broker: b, currency: currency))]),
            ),
          if (p.projects.isNotEmpty) HomeSection(icon: Icons.apartment_rounded, title: l10n.bpByProject, child: PerfProjects(projects: p.projects)),
        ];
      },
    );
  }
}

/// «أدائي» for the broker (design bp2): the broker's own sales, commission and
/// funnel, the commissions and payouts, the projects, and the team.
class BrokerOwnPerformanceScreen extends StatefulWidget {
  const BrokerOwnPerformanceScreen({super.key});

  @override
  State<BrokerOwnPerformanceScreen> createState() => _BrokerOwnPerformanceScreenState();
}

class _BrokerOwnPerformanceScreenState extends State<BrokerOwnPerformanceScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokersPerfCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final colors = context.appColors;
    return _Shell(
      title: l10n.bpMineTitle,
      subtitle: null,
      back: false,
      body: (p) {
        final s = p.summary;
        final sales = homeCompact(s.salesGross, l10n);
        final com = homeCompact(s.commissionsNet, l10n);
        final pend = homeCompactText(s.commissionsPendingNet, l10n);
        final paidOut = s.payoutsTotalNet;
        Widget line(String t, String sub, double v, {Color? color}) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                    Text(sub, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                  ]),
                ),
                Text(contractMoney(v), style: homeDisplay(15, color ?? colors.inkStrong)),
              ]),
            );
        return [
          if ((p.brokerName ?? '').isNotEmpty)
            Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 12, AppSpacing.lg, 0), child: Text(p.brokerName!, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
            child: HomeBand(figures: [
              HomeFigure(id: 'sales', value: sales.$1, label: l10n.bpMineSales, hint: [if (sales.$2.isNotEmpty) sales.$2, currency].join(' ')),
              HomeFigure(id: 'com', value: com.$1, label: l10n.bpMineCom, hint: l10n.bpPendingOf(pend), warn: s.commissionsPendingNet > 0),
              HomeFigure(id: 'signed', value: '${s.contractsSigned}', label: l10n.bpSigned, hint: l10n.bpMineContractsHint(s.reservations)),
            ]),
          ),
          HomeSection(icon: Icons.filter_alt_rounded, title: l10n.bpFunnelMine, child: PerfFunnel(summary: s)),
          if (p.trend.isNotEmpty) HomeSection(icon: Icons.trending_up_rounded, title: l10n.bpTrendMine, child: PerfTrend(buckets: p.trend)),
          HomeSection(
            icon: Icons.payments_rounded,
            title: l10n.bpCommissionsBlock,
            child: Column(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: homeCard(context, radius: 22),
                child: Column(children: [
                  line(l10n.bpNetCommissions, l10n.bpNetHint, s.commissionsNet),
                  Divider(height: 1, color: colors.hairline),
                  line(l10n.bpPendingLbl, l10n.bpPendingNote, s.commissionsPendingNet, color: const Color(0xFF8A5A12)),
                  Divider(height: 1, color: colors.hairline),
                  line(l10n.bpPaidOutLbl, '${s.payoutsPaid}', paidOut, color: const Color(0xFF2F6B4A)),
                ]),
              ),
              const SizedBox(height: 8),
              ReservationLinkCard(key: const Key('broker-perf-commissions'), icon: Icons.payments_rounded, title: l10n.bpMyCommissions, onTap: () => context.push('/broker/commissions')),
            ]),
          ),
          if (p.projects.isNotEmpty) HomeSection(icon: Icons.apartment_rounded, title: l10n.bpByProject, child: PerfProjects(projects: p.projects)),
          if (p.brokers.isNotEmpty)
            HomeSection(
              icon: Icons.groups_rounded,
              title: l10n.bpTeam,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: homeCard(context, radius: 22),
                child: Column(children: [
                  for (final (i, a) in p.brokers.indexed)
                    Container(
                      decoration: BoxDecoration(border: Border(top: i == 0 ? BorderSide.none : BorderSide(color: colors.hairline))),
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(children: [
                        Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(12)),
                          child: Text(homeInitials(a.name), style: homeDisplay(12, AppPalette.gold300)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(a.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                            Text(l10n.bpAgentLine(a.leads, a.contracts), style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                          ]),
                        ),
                        Text(homeCompactText(a.salesGross, l10n), style: homeDisplay(14, colors.inkStrong)),
                      ]),
                    ),
                ]),
              ),
            ),
        ];
      },
    );
  }
}

class _Shell extends StatelessWidget {
  const _Shell({required this.title, required this.subtitle, required this.body, this.back = true});
  final String title;
  final String? subtitle;
  final bool back;
  final List<Widget> Function(BrokersPerf) body;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokersPerfCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokersPerfCubit, DataState<BrokersPerf>>(
          builder: (context, state) {
            final p = state.data;
            return Column(children: [
              HomeListHero(title: title, subtitle: subtitle, back: back),
              Expanded(
                child: switch (state.status) {
                  DataStatus.initial || DataStatus.loading when p == null => const StaffListSkeleton(rows: 4),
                  DataStatus.failure when p == null => ErrorState(failure: state.failure, onRetry: cubit.load),
                  DataStatus.empty => EmptyState(icon: Icons.insights_rounded, title: l10n.bpEmpty, message: l10n.bpEmptyMsg),
                  _ when p == null => const SizedBox.shrink(),
                  _ => RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + (back ? 24 : 110)), children: body(p)),
                    ),
                },
              ),
            ]);
          },
        ),
      ),
    );
  }
}

/// Leads → approved → bookings → signed → commission paid, as bars.
class PerfFunnel extends StatelessWidget {
  const PerfFunnel({super.key, required this.summary});
  final BrokersSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final rows = <(String, int, Color)>[
      (l10n.bpLeadsSent, summary.leadsSubmitted, AppPalette.navy),
      (l10n.bpLeadsApproved, summary.leadsApproved, AppPalette.navy),
      (l10n.bpBookings, summary.reservations, AppPalette.gold500),
      (l10n.bpSigned, summary.contractsSigned, const Color(0xFF3E7C5A)),
      (l10n.bpPaidCom, summary.commissionPaidContracts, const Color(0xFF3E7C5A)),
    ];
    final max = rows.map((r) => r.$2).fold<int>(1, (a, b) => b > a ? b : a);
    return Container(
      key: const Key('perf-funnel'),
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final (label, v, color) in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              SizedBox(width: 92, child: Text(label, style: TextStyle(fontSize: 11.5, color: colors.inkMuted))),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, box) => Container(
                    height: 26,
                    alignment: AlignmentDirectional.centerStart,
                    decoration: BoxDecoration(color: const Color(0xFFEFE8DC), borderRadius: BorderRadius.circular(9)),
                    child: Container(
                      width: (box.maxWidth * (v / max)).clamp(28, box.maxWidth),
                      height: 26,
                      alignment: AlignmentDirectional.centerStart,
                      padding: const EdgeInsets.symmetric(horizontal: 9),
                      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(9)),
                      child: Text('$v', style: homeDisplay(13, color == AppPalette.gold500 ? AppPalette.navy : Colors.white)),
                    ),
                  ),
                ),
              ),
            ]),
          ),
      ]),
    );
  }
}

/// Net commissions month by month, as bars.
class PerfTrend extends StatelessWidget {
  const PerfTrend({super.key, required this.buckets});
  final List<TrendBucket> buckets;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final max = buckets.map((b) => b.commissionsNet).fold<double>(1, (a, b) => b > a ? b : a);
    String month(String label) {
      final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(label);
      return m == null ? label : DateFormatter.monthShort(DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!)), languageCode: lang);
    }

    return Container(
      key: const Key('perf-trend'),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          height: 128,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (final b in buckets)
              Expanded(
                child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  Text(b.commissionsNet == 0 ? '—' : homeCompactText(b.commissionsNet, l10n), style: homeDisplay(10, colors.inkStrong)),
                  const SizedBox(height: 4),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    height: (b.commissionsNet / max * 80).clamp(4, 80),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFE7C873), Color(0xFFC9A14A)]),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(8), bottom: Radius.circular(3)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(month(b.label), style: TextStyle(fontSize: 10, color: colors.inkMuted)),
                ]),
              ),
          ]),
        ),
        Padding(padding: const EdgeInsets.only(top: 4), child: Text(l10n.bpTrendNote, style: TextStyle(fontSize: 11, color: colors.inkMuted))),
      ]),
    );
  }
}

class PerfProjects extends StatelessWidget {
  const PerfProjects({super.key, required this.projects});
  final List<ProjectPerf> projects;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final (i, p) in projects.indexed)
          Container(
            decoration: BoxDecoration(border: Border(top: i == 0 ? BorderSide.none : BorderSide(color: colors.hairline))),
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  Text(l10n.bpProjectLine(p.city ?? '—', p.contractsSigned), style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                ]),
              ),
              Text(homeCompactText(p.salesGross, l10n), style: homeDisplay(14, colors.inkStrong)),
            ]),
          ),
      ]),
    );
  }
}

/// One broker company: the status, the code and conversion, sales, commission
/// and what was paid out, and the funnel in a line.
class BrokerPerfCard extends StatelessWidget {
  const BrokerPerfCard({super.key, required this.broker, required this.currency});
  final BrokerPerf broker;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final b = broker;
    Widget tile(String k, double v) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
            decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: TextStyle(fontSize: 10, color: colors.inkMuted)),
              Text(v == 0 ? '0' : homeCompactText(v, l10n), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(13.5, colors.inkStrong)),
            ]),
          ),
        );
    return Container(
      key: Key('broker-perf-${b.id}'),
      decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
              child: Text(homeInitials(b.name), style: homeDisplay(14, AppPalette.gold300)),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(b.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                Text.rich(TextSpan(children: [
                  if (b.code != null) TextSpan(text: ltr(b.code!), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                  if (b.conversionRate != null) TextSpan(text: ' · ${l10n.bpConv(ltr('${(b.conversionRate! * 100).round()}%'))}', style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
                ])),
              ]),
            ),
            if (b.status == 'ACTIVE')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE6F2EA), borderRadius: BorderRadius.circular(99)),
                child: Text(l10n.bpActiveBadge, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF2F6B4A))),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          child: Row(children: [
            tile(l10n.bpSalesLbl, b.salesGross),
            const SizedBox(width: 6),
            tile(l10n.bpCommissionLbl, b.commissionNet),
            const SizedBox(width: 6),
            tile(l10n.bpPaidLbl, b.payoutNet),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(color: colors.surfaceSoft, border: Border(top: BorderSide(color: colors.hairline)), borderRadius: const BorderRadius.vertical(bottom: Radius.circular(22))),
          child: Text(l10n.bpBrokerLine(b.leads, b.reservations, b.contracts), style: TextStyle(fontSize: 11, color: colors.inkMuted)),
        ),
      ]),
    );
  }
}

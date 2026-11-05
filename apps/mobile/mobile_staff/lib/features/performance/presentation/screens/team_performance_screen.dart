import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/team_performance_cubit.dart';
import '../period.dart';
import '../period_picker.dart';

/// «أداء الفريق» (design t3): the period, the team's sales, signed contracts
/// and average achievement, and a card per member with progress and activity.
class TeamPerformanceScreen extends StatefulWidget {
  const TeamPerformanceScreen({super.key});

  @override
  State<TeamPerformanceScreen> createState() => _TeamPerformanceScreenState();
}

class _TeamPerformanceScreenState extends State<TeamPerformanceScreen> {
  late String _period = currentPeriod();

  @override
  void initState() {
    super.initState();
    context.read<TeamPerformanceCubit>().load(period: _period);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final cubit = context.read<TeamPerformanceCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<TeamPerformanceCubit, TeamPerformanceState>(
          builder: (context, state) {
            final members = state.members;
            final sales = members.fold<double>(0, (s, m) => s + m.performance.realizedValue);
            final contracts = members.fold<int>(0, (s, m) => s + m.performance.signedContractsCount);
            final withTarget = members.where((m) => m.performance.targetAmountPercent != null).toList();
            final avg = withTarget.isEmpty ? null : withTarget.fold<double>(0, (s, m) => s + m.performance.targetAmountPercent!) / withTarget.length;
            final total = homeCompact(sales, l10n);
            return Column(children: [
              HomeListHero(title: l10n.teamPerfTitle, subtitle: periodLabel(_period, lang), back: true),
              Expanded(
                child: switch (state.status) {
                  DataStatus.initial || DataStatus.loading => const StaffListSkeleton(rows: 4),
                  DataStatus.failure => ErrorState(failure: state.failure, onRetry: () => cubit.load(period: _period)),
                  _ => RefreshIndicator(
                      onRefresh: () => cubit.load(period: _period),
                      child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                        PeriodBar(
                          period: _period,
                          onPick: (p) {
                            setState(() => _period = p);
                            cubit.load(period: p);
                          },
                        ),
                        if (members.isEmpty)
                          EmptyState(icon: Icons.groups_rounded, title: l10n.teamPerfEmpty)
                        else ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                            child: HomeBand(figures: [
                              HomeFigure(id: 'sales', value: total.$1, label: l10n.teamPerfTotalSales, hint: [if (total.$2.isNotEmpty) total.$2, currency].join(' ')),
                              HomeFigure(id: 'contracts', value: '$contracts', label: l10n.targetsSignedContracts, hint: periodLabel(_period, lang)),
                              HomeFigure(id: 'avg', value: avg == null ? '—' : ltr('${avg.round()}%'), label: l10n.teamPerfAvgAchievement, hint: periodLabel(_period, lang)),
                            ]),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                            child: Column(children: [for (final m in members) Padding(padding: const EdgeInsets.only(bottom: 10), child: _MemberCard(member: m, currency: currency))]),
                          ),
                        ],
                      ]),
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

class _MemberCard extends StatelessWidget {
  const _MemberCard({required this.member, required this.currency});
  final TeamMemberPerformance member;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final p = member.performance;
    Widget chip(IconData icon, String text, {Color bg = const Color(0xFFEEF2F7), Color fg = const Color(0xFF26405F)}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 4),
            Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
          ]),
        );
    return Container(
      key: Key('team-member-${member.salesId}'),
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
            child: Text(homeInitials(member.salesName), style: homeDisplay(14, AppPalette.gold300)),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(member.salesName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              if (p.hasTarget && p.targetAmount != null)
                Text.rich(TextSpan(style: TextStyle(fontSize: 11.5, color: colors.inkMuted), children: [
                  TextSpan(text: contractMoney(p.achievedAmount), style: TextStyle(fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  TextSpan(text: ' / ${contractMoney(p.targetAmount!)} $currency'),
                ]))
              else
                Text(l10n.teamTargetNoTarget, style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
            ]),
          ),
          if (p.targetAmountPercent != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: AppPalette.gold400, borderRadius: BorderRadius.circular(99)),
              child: Text(ltr('${p.targetAmountPercent!.round()}%'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.navy)),
            ),
        ]),
        if (p.targetAmountPercent != null) ...[
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: (p.targetAmountPercent! / 100).clamp(0, 1), minHeight: 8, backgroundColor: const Color(0xFFEFE8DC), color: AppPalette.gold400),
          ),
        ],
        const SizedBox(height: 10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          chip(Icons.person_rounded, '${p.leadsCount} ${l10n.tpFunnelLeads}'),
          chip(Icons.event_rounded, '${p.visitsCount} ${l10n.tpVisits}'),
          chip(Icons.bookmark_rounded, '${p.reservationsCount} ${l10n.tpBookings}'),
          chip(Icons.description_rounded, '${p.signedContractsCount} ${l10n.tpContracts}', bg: const Color(0xFFE6F2EA), fg: const Color(0xFF2F6B4A)),
        ]),
      ]),
    );
  }
}

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
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
                          const SizedBox(height: 12),
                          DvHeroStats(
                            id: 'sales',
                            label: l10n.teamPerfTotalSales,
                            value: total.$1,
                            unit: [if (total.$2.isNotEmpty) total.$2, currency].join(' '),
                            figures: [
                              DvStat(id: 'contracts', label: l10n.targetsSignedContracts, value: '$contracts'),
                              DvStat(id: 'avg', label: l10n.teamPerfAvgAchievement, value: avg == null ? '—' : '${avg.round()}%'),
                            ],
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
    final pct = p.targetAmountPercent;
    return Container(
      key: Key('team-member-${member.salesId}'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: Color(0xFF0B1426), shape: BoxShape.circle),
            child: Text(homeInitials(member.salesName), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFFEED7A0))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(member.salesName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              const SizedBox(height: 3),
              if (p.hasTarget && p.targetAmount != null)
                Text('${contractMoney(p.achievedAmount)} ${l10n.tgOf('${contractMoney(p.targetAmount!)} $currency')}', style: TextStyle(fontSize: 12.5, color: colors.inkMuted))
              else
                Text(l10n.teamTargetNoTarget, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
            ]),
          ),
          if (pct != null) DvPill(ltr('${pct.round()}%'), tone: pct >= 60 ? DvTone.ok : DvTone.warn),
        ]),
        if (pct != null) ...[
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(value: (pct / 100).clamp(0, 1), minHeight: 6, backgroundColor: colors.surfaceSoft, color: AppPalette.gold500),
          ),
        ],
        Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: colors.hairline)),
        Text(
          [
            '${p.leadsCount} ${l10n.tpFunnelLeads}',
            '${p.visitsCount} ${l10n.tpVisits}',
            '${p.reservationsCount} ${l10n.tpBookings}',
            '${p.signedContractsCount} ${l10n.tpContracts}',
          ].join('  ·  '),
          style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkMuted),
        ),
      ]),
    );
  }
}

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/targets_cubit.dart';
import '../period.dart';

/// «أهدافي» (design t1, owner-approved 2026-11-05): this period's progress on
/// the sales value and the units, what is left, the rep's activity, and the
/// history of targets.
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
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final cubit = context.read<TargetsCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<TargetsCubit, TargetsState>(
          builder: (context, state) {
            final p = state.performance;
            return Column(children: [
              HomeListHero(title: l10n.targetsTitle, subtitle: p == null ? null : periodLabel(p.period, lang), back: true),
              Expanded(
                child: switch (state.status) {
                  DataStatus.initial || DataStatus.loading => const StaffListSkeleton(rows: 4),
                  DataStatus.failure => ErrorState(failure: state.failure, onRetry: cubit.load),
                  _ when p == null => const SizedBox.shrink(),
                  _ => RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                          child: _Progress(perf: p, currency: currency),
                        ),
                        HomeSection(
                          icon: Icons.insights_rounded,
                          title: l10n.tgPeriodActivity,
                          child: GridView.count(
                            padding: EdgeInsets.zero,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                            childAspectRatio: 2.6,
                            children: [
                              _Stat(Icons.person_rounded, '${p.leadsCount}', l10n.dashboardLeads),
                              _Stat(Icons.event_rounded, '${p.visitsCount}', l10n.navVisits),
                              _Stat(Icons.bookmark_rounded, '${p.reservationsCount}', l10n.navReservations),
                              _Stat(Icons.description_rounded, '${p.signedContractsCount}', l10n.targetsSignedContracts),
                            ],
                          ),
                        ),
                        if (state.targets.isNotEmpty)
                          HomeSection(
                            icon: Icons.history_rounded,
                            title: l10n.targetsHistory,
                            child: Column(children: [
                              for (final t in state.targets)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(12),
                                  decoration: homeCard(context, radius: 20),
                                  child: Row(children: [
                                    Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(color: AppPalette.gold50, border: Border.all(color: AppPalette.gold100), borderRadius: BorderRadius.circular(14)),
                                      child: const Icon(Icons.track_changes_rounded, size: 21, color: AppPalette.gold500),
                                    ),
                                    const SizedBox(width: 11),
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(periodLabel(t.period, lang), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                                        const SizedBox(height: 3),
                                        Text(l10n.targetsUnitsN(t.unitsTarget), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                      ]),
                                    ),
                                    Text('${contractMoney(double.tryParse(t.amountTarget) ?? 0)} $currency', style: homeDisplay(15, colors.inkStrong)),
                                  ]),
                                ),
                            ]),
                          ),
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

class _Progress extends StatelessWidget {
  const _Progress({required this.perf, required this.currency});
  final SalesPerformance perf;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final p = perf;
    Widget bar(double? pct, {Color color = AppPalette.gold400}) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(value: ((pct ?? 0) / 100).clamp(0, 1), minHeight: 8, backgroundColor: const Color(0xFFEFE8DC), color: color),
        );
    final left = (p.targetAmount ?? 0) - p.achievedAmount;
    final unitsLeft = (p.targetUnits ?? 0) - p.achievedUnits;
    return Container(
      key: const Key('targets-progress'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 22),
      child: !p.hasTarget
          ? Row(children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: AppPalette.gold50, border: Border.all(color: AppPalette.gold100), borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.flag_outlined, size: 21, color: AppPalette.gold500),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(l10n.tgNoTarget, style: TextStyle(fontSize: 13.5, height: 1.5, color: colors.ink))),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l10n.tgSales, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: contractMoney(p.achievedAmount), style: homeDisplay(26, colors.inkStrong)),
                      TextSpan(text: '  ${l10n.tgOf('${contractMoney(p.targetAmount ?? 0)} $currency')}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ])),
                  ]),
                ),
                if (p.targetAmountPercent != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppPalette.gold400, borderRadius: BorderRadius.circular(99)),
                    child: Text(ltr('${p.targetAmountPercent!.round()}%'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.navy)),
                  ),
              ]),
              const SizedBox(height: 10),
              bar(p.targetAmountPercent),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: Text(l10n.tgUnitsSold, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
                Text(l10n.tgUnitsOf(p.achievedUnits, p.targetUnits ?? 0), style: homeDisplay(13, colors.inkStrong)),
              ]),
              const SizedBox(height: 6),
              bar(p.targetUnitsPercent),
              if (left > 0 || unitsLeft > 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.hairline))),
                  child: Text.rich(TextSpan(style: TextStyle(fontSize: 12, color: colors.inkMuted), children: [
                    TextSpan(text: '${l10n.tgRemaining}: '),
                    if (left > 0) TextSpan(text: '${contractMoney(left)} $currency', style: TextStyle(fontWeight: FontWeight.w800, color: colors.inkStrong)),
                    if (left > 0 && unitsLeft > 0) const TextSpan(text: ' · '),
                    if (unitsLeft > 0) TextSpan(text: l10n.targetsUnitsN(unitsLeft)),
                  ])),
                ),
              ],
            ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.icon, this.value, this.label);
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: homeCard(context, radius: 18),
      child: Row(children: [
        Container(width: 34, height: 34, decoration: BoxDecoration(color: AppPalette.gold500.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(11)), child: Icon(icon, size: 18, color: AppPalette.gold600)),
        const SizedBox(width: 9),
        Expanded(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: homeDisplay(19, colors.inkStrong)),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
      ]),
    );
  }
}
